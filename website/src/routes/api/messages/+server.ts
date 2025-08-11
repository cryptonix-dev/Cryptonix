import { auth } from '$lib/auth';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversation, conversationParticipant, message, user } from '$lib/server/db/schema';
import { and, eq, or, sql } from 'drizzle-orm';
import { redis } from '$lib/server/redis';

export async function GET({ request, url }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const me = Number(session.user.id);
  const convoOnly = url.searchParams.get('conversationId');
  if (convoOnly) {
    const convoId = Number(convoOnly);
    if (!convoId) throw error(400, 'Invalid conversationId');
    const rows = await db
      .select({ id: message.id, senderId: message.senderId, content: message.content, createdAt: message.createdAt })
      .from(message)
      .where(eq(message.conversationId, convoId))
      .orderBy(sql`"created_at" ASC`)
      .limit(100);
    return json({ messages: rows });
  }
  const enriched = url.searchParams.get('enriched');
  // List conversations for user
  const threads = await db
    .select({ id: conversation.id, isGroup: conversation.isGroup, createdAt: conversation.createdAt })
    .from(conversation)
    .innerJoin(conversationParticipant, eq(conversationParticipant.conversationId, conversation.id))
    .where(eq(conversationParticipant.userId, me))
    .orderBy(sql`"created_at" DESC`)
    .limit(50);

  if (!enriched) {
    return json({ conversations: threads });
  }

  const results: Array<any> = [];
  for (const t of threads) {
    // Find the other participant (for 1:1)
    const others = await db
      .select({ id: user.id, username: user.username, name: user.name, image: user.image })
      .from(conversationParticipant)
      .innerJoin(user, eq(user.id, conversationParticipant.userId))
      .where(and(eq(conversationParticipant.conversationId, t.id), sql`"user_id" <> ${me}`))
      .limit(1);

    // Find last message
    const last = await db
      .select({ content: message.content, createdAt: message.createdAt })
      .from(message)
      .where(eq(message.conversationId, t.id))
      .orderBy(sql`"created_at" DESC`)
      .limit(1);

    // Compute unread count for current user
    const [meRow] = await db
      .select({ lastReadMessageId: conversationParticipant.lastReadMessageId })
      .from(conversationParticipant)
      .where(and(eq(conversationParticipant.conversationId, t.id), eq(conversationParticipant.userId, me)))
      .limit(1);

    const lastReadId = meRow?.lastReadMessageId ?? 0;
    const [{ count: unreadCount }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(message)
      .where(and(eq(message.conversationId, t.id), sql`"id" > ${lastReadId}`))
      .limit(1);

    results.push({
      id: t.id,
      isGroup: t.isGroup,
      createdAt: t.createdAt,
      otherUser: others[0] || null,
      lastContent: last[0]?.content || null,
      lastCreatedAt: last[0]?.createdAt || null,
      unreadCount: Number(unreadCount) || 0
    });
  }

  return json({ conversations: results });
}

export async function POST({ request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const me = Number(session.user.id);
  const body = await request.json().catch(() => ({}));
  const toUserId = body.toUserId ? Number(body.toUserId) : undefined;
  const conversationId = body.conversationId ? Number(body.conversationId) : undefined;
  const content = (body.content || '').toString().trim();
  if (!content) throw error(400, 'content required');

  let convoId: number | null = conversationId ?? null;
  if (!convoId) {
    if (!toUserId) throw error(400, 'toUserId required when no conversationId');
    // Find or create a one-to-one conversation
    const existing = await db
      .select({ id: conversation.id })
      .from(conversation)
      .innerJoin(conversationParticipant, eq(conversationParticipant.conversationId, conversation.id))
      .where(and(eq(conversation.isGroup, false), eq(conversationParticipant.userId, me)))
      .limit(100);
    if (existing.length > 0) {
      for (const c of existing) {
        const count = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(conversationParticipant)
          .where(and(eq(conversationParticipant.conversationId, c.id), or(eq(conversationParticipant.userId, me), eq(conversationParticipant.userId, toUserId))))
          .limit(1);
        if (count[0]?.count === 2) { convoId = c.id; break; }
      }
    }
    if (!convoId) {
      const [created] = await db.insert(conversation).values({ isGroup: false, createdBy: me }).returning({ id: conversation.id });
      convoId = created.id;
      await db.insert(conversationParticipant).values([{ conversationId: convoId, userId: me }, { conversationId: convoId, userId: toUserId }]);
    }
  } else {
    // ensure user is participant
    const rows = await db.select().from(conversationParticipant).where(and(eq(conversationParticipant.conversationId, convoId), eq(conversationParticipant.userId, me))).limit(1);
    if (rows.length === 0) throw error(403, 'Not a participant');
  }
  const [msg] = await db.insert(message).values({ conversationId: convoId, senderId: me, content }).returning({ id: message.id, createdAt: message.createdAt });

  // Notify other participants via websocket (redis notifications channel)
  const participants = await db
    .select({ userId: conversationParticipant.userId })
    .from(conversationParticipant)
    .where(eq(conversationParticipant.conversationId, convoId));
  const payload = JSON.stringify({ type: 'dm_message', conversationId: convoId, content, createdAt: msg.createdAt });
  for (const p of participants) {
    if (Number(p.userId) !== me) {
      await redis.publish(`notifications:${p.userId}`, payload);
    }
  }

  return json({ conversationId: convoId, messageId: msg.id, createdAt: msg.createdAt });
}

export async function PUT({ request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const me = Number(session.user.id);
  const body = await request.json().catch(() => ({}));
  const conversationId = Number(body.conversationId);
  if (!conversationId) throw error(400, 'conversationId required');

  // Ensure participant
  const rows = await db
    .select({ userId: conversationParticipant.userId })
    .from(conversationParticipant)
    .where(and(eq(conversationParticipant.conversationId, conversationId), eq(conversationParticipant.userId, me)))
    .limit(1);
  if (rows.length === 0) throw error(403, 'Not a participant');

  if (body.typing) {
    // Broadcast typing event to other participants
    const participants = await db
      .select({ userId: conversationParticipant.userId })
      .from(conversationParticipant)
      .where(eq(conversationParticipant.conversationId, conversationId));
    const typingPayload = JSON.stringify({ type: 'dm_typing', conversationId });
    for (const p of participants) {
      if (Number(p.userId) !== me) {
        await redis.publish(`notifications:${p.userId}`, typingPayload);
      }
    }
    return json({ ok: true });
  }

  // Mark as read: set lastReadMessageId to latest message id
  const last = await db
    .select({ id: message.id })
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(sql`"created_at" DESC`)
    .limit(1);
  if (last[0]) {
    await db
      .update(conversationParticipant)
      .set({ lastReadMessageId: last[0].id })
      .where(and(eq(conversationParticipant.conversationId, conversationId), eq(conversationParticipant.userId, me)));
  }
  return json({ ok: true });
}

export async function DELETE({ request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const me = Number(session.user.id);
  const body = await request.json().catch(() => ({}));
  const conversationId = Number(body.conversationId);
  if (!conversationId) throw error(400, 'conversationId required');

  // Ensure participant and fetch all participants
  const participants = await db
    .select({ userId: conversationParticipant.userId })
    .from(conversationParticipant)
    .where(eq(conversationParticipant.conversationId, conversationId));
  if (!participants.some(p => Number(p.userId) === me)) throw error(403, 'Not a participant');

  // Delete conversation (cascades to messages and participants)
  await db.delete(conversation).where(eq(conversation.id, conversationId));

  // Notify others that conversation closed
  const payload = JSON.stringify({ type: 'dm_closed', conversationId });
  for (const p of participants) {
    if (Number(p.userId) !== me) {
      await redis.publish(`notifications:${p.userId}`, payload);
    }
  }

  return json({ ok: true });
}


