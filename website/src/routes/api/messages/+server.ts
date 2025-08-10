import { auth } from '$lib/auth';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversation, conversationParticipant, message, user } from '$lib/server/db/schema';
import { and, eq, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
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
  // List conversations for user, optionally enriched
  const enriched = url.searchParams.get('enriched');
  if (enriched) {
    // Step 1: get my conversations
    const baseThreads = await db
      .select({ id: conversation.id, isGroup: conversation.isGroup, createdAt: conversation.createdAt })
      .from(conversation)
      .innerJoin(conversationParticipant, eq(conversationParticipant.conversationId, conversation.id))
      .where(eq(conversationParticipant.userId, me))
      .orderBy(sql`"created_at" DESC`)
      .limit(50);

    // Step 2: enrich each with other participant and last message
    const enrichedThreads = await Promise.all(baseThreads.map(async (t) => {
      const cp = alias(conversationParticipant, 'cp');
      const otherU = alias(user, 'otherU');
      const other = await db
        .select({ id: otherU.id, username: otherU.username, name: otherU.name, image: otherU.image })
        .from(cp)
        .leftJoin(otherU, eq(otherU.id, cp.userId))
        .where(and(eq(cp.conversationId, t.id), sql`${cp.userId} <> ${me}`))
        .limit(1);
      const last = await db
        .select({ content: message.content, createdAt: message.createdAt })
        .from(message)
        .where(eq(message.conversationId, t.id))
        .orderBy(sql`"created_at" DESC`)
        .limit(1);
      return {
        ...t,
        otherUser: other[0] || null,
        lastContent: last[0]?.content || null,
        lastCreatedAt: last[0]?.createdAt || null,
      };
    }));
    return json({ conversations: enrichedThreads });
  } else {
    const threads = await db
      .select({ id: conversation.id, isGroup: conversation.isGroup, createdAt: conversation.createdAt })
      .from(conversation)
      .innerJoin(conversationParticipant, eq(conversationParticipant.conversationId, conversation.id))
      .where(eq(conversationParticipant.userId, me))
      .orderBy(sql`"created_at" DESC`)
      .limit(50);
    return json({ conversations: threads });
  }
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
    // Find existing direct conversation via dual-join to participants
    const cp1 = alias(conversationParticipant, 'cp1');
    const cp2 = alias(conversationParticipant, 'cp2');
    const existing = await db
      .select({ id: conversation.id })
      .from(conversation)
      .innerJoin(cp1, and(eq(cp1.conversationId, conversation.id), eq(cp1.userId, me)))
      .innerJoin(cp2, and(eq(cp2.conversationId, conversation.id), eq(cp2.userId, toUserId)))
      .where(eq(conversation.isGroup, false))
      .limit(1);
    if (existing[0]) {
      convoId = existing[0].id;
    } else {
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
  try {
    // notify the other participant via websocket notifications channel
    const others = await db
      .select({ userId: conversationParticipant.userId })
      .from(conversationParticipant)
      .where(and(eq(conversationParticipant.conversationId, convoId), sql`${conversationParticipant.userId} <> ${me}`));
    for (const o of others) {
      await redis.publish(`notifications:${o.userId}`, JSON.stringify({ type: 'dm_message', conversationId: convoId, content, createdAt: msg.createdAt }));
    }
  } catch (e) {
    console.error('Failed to publish dm_message', e);
  }
  return json({ conversationId: convoId, messageId: msg.id, createdAt: msg.createdAt });
}

export async function PUT({ request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const me = Number(session.user.id);
  const body = await request.json().catch(() => ({}));
  const conversationId = Number(body.conversationId);
  const typing = body.typing ? true : false;
  if (!conversationId) throw error(400, 'conversationId required');
  const [latest] = await db
    .select({ id: message.id })
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(sql`"created_at" DESC`)
    .limit(1);
  if (!typing && latest) {
    await db
      .update(conversationParticipant)
      .set({ lastReadMessageId: latest.id })
      .where(and(eq(conversationParticipant.conversationId, conversationId), eq(conversationParticipant.userId, me)));
  }
  if (typing) {
    // publish typing to other participants
    const others = await db
      .select({ userId: conversationParticipant.userId })
      .from(conversationParticipant)
      .where(and(eq(conversationParticipant.conversationId, conversationId), sql`${conversationParticipant.userId} <> ${me}`));
    for (const o of others) {
      await redis.publish(`notifications:${o.userId}`, JSON.stringify({ type: 'dm_typing', conversationId }));
    }
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
  // verify membership
  const rows = await db
    .select({ userId: conversationParticipant.userId })
    .from(conversationParticipant)
    .where(eq(conversationParticipant.conversationId, conversationId));
  if (!rows.find((r) => r.userId === me)) throw error(403, 'Not a participant');
  await db.delete(conversation).where(eq(conversation.id, conversationId));
  // notify other side so they can remove the thread
  for (const r of rows) {
    if (r.userId !== me) {
      await redis.publish(`notifications:${r.userId}`, JSON.stringify({ type: 'dm_closed', conversationId }));
    }
  }
  return json({ ok: true });
}


