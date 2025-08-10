import { auth } from '$lib/auth';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { conversation, conversationParticipant } from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export async function POST({ request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const me = Number(session.user.id);
  const { toUserId } = await request.json();
  const other = Number(toUserId);
  if (!other) throw error(400, 'toUserId required');

  // Find existing by dual-join
  const cp1 = alias(conversationParticipant, 'cp1');
  const cp2 = alias(conversationParticipant, 'cp2');
  const existing = await db
    .select({ id: conversation.id })
    .from(conversation)
    .innerJoin(cp1, and(eq(cp1.conversationId, conversation.id), eq(cp1.userId, me)))
    .innerJoin(cp2, and(eq(cp2.conversationId, conversation.id), eq(cp2.userId, other)))
    .where(eq(conversation.isGroup, false))
    .limit(1);
  if (existing[0]) return json({ conversationId: existing[0].id });

  // Create new convo
  const [created] = await db.insert(conversation).values({ isGroup: false, createdBy: me }).returning({ id: conversation.id });
  await db.insert(conversationParticipant).values([{ conversationId: created.id, userId: me }, { conversationId: created.id, userId: other }]);
  return json({ conversationId: created.id });
}


