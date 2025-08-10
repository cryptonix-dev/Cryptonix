import { auth } from '$lib/auth';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { friendship, user } from '$lib/server/db/schema';
import { createNotification } from '$lib/server/notification';
import { and, eq, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export async function GET({ request, url }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const me = Number(session.user.id);
  const status = url.searchParams.get('status') || 'ACCEPTED';
  const requester = alias(user, 'requester');
  const addressee = alias(user, 'addressee');
  const rows = await db
    .select({
      id: friendship.id,
      status: friendship.status,
      requesterId: friendship.requesterId,
      addresseeId: friendship.addresseeId,
      requester: { id: requester.id, username: requester.username, name: requester.name, image: requester.image },
      addressee: { id: addressee.id, username: addressee.username, name: addressee.name, image: addressee.image },
    })
    .from(friendship)
    .leftJoin(requester, eq(requester.id, friendship.requesterId))
    .leftJoin(addressee, eq(addressee.id, friendship.addresseeId))
    .where(and(eq(friendship.status, status as any), or(eq(friendship.requesterId, me), eq(friendship.addresseeId, me))));
  return json({ friends: rows });
}

export async function POST({ request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const me = Number(session.user.id);
  const body = await request.json().catch(() => ({}));
  const username = (body.username || '').toString().trim();
  if (!username) throw error(400, 'username required');
  const [u] = await db.select({ id: user.id }).from(user).where(eq(user.username, username)).limit(1);
  if (!u) throw error(404, 'User not found');
  if (u.id === me) throw error(400, 'Cannot friend yourself');
  await db.insert(friendship).values({ requesterId: me, addresseeId: u.id, status: 'PENDING' });
  // notify addressee
  try {
    await createNotification(String(u.id), 'SYSTEM', 'Friend request', `@${session.user.username} sent you a friend request`, '/notifications');
  } catch (e) { /* ignore */ }
  return json({ ok: true });
}

export async function PATCH({ request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const me = Number(session.user.id);
  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  const action = (body.action || '').toString();
  if (!id || !['ACCEPT','DECLINE','BLOCK','CANCEL'].includes(action)) throw error(400, 'Invalid');
  // Basic accept/decline/cancel/block logic
  if (action === 'ACCEPT') {
    await db.update(friendship).set({ status: 'ACCEPTED', updatedAt: new Date() }).where(and(eq(friendship.id, id), eq(friendship.addresseeId, me)));
    // notify requester
    const req = await db.select({ requesterId: friendship.requesterId }).from(friendship).where(eq(friendship.id, id)).limit(1);
    if (req[0]) { try { await createNotification(String(req[0].requesterId), 'SYSTEM', 'Friend request accepted', 'Your friend request was accepted', '/messages'); } catch {} }
  } else if (action === 'DECLINE') {
    await db.update(friendship).set({ status: 'BLOCKED', updatedAt: new Date() }).where(and(eq(friendship.id, id), eq(friendship.addresseeId, me)));
    const req = await db.select({ requesterId: friendship.requesterId }).from(friendship).where(eq(friendship.id, id)).limit(1);
    if (req[0]) { try { await createNotification(String(req[0].requesterId), 'SYSTEM', 'Friend request declined', 'Your request was declined', '/notifications'); } catch {} }
  } else if (action === 'CANCEL') {
    await db.update(friendship).set({ status: 'BLOCKED', updatedAt: new Date() }).where(and(eq(friendship.id, id), eq(friendship.requesterId, me)));
  } else if (action === 'BLOCK') {
    await db.update(friendship).set({ status: 'BLOCKED', updatedAt: new Date() }).where(or(eq(friendship.addresseeId, me), eq(friendship.requesterId, me)));
  }
  return json({ ok: true });
}

export async function DELETE({ request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const me = Number(session.user.id);
  const body = await request.json().catch(() => ({}));
  const friendUserId = Number(body.userId);
  if (!friendUserId) throw error(400, 'userId required');
  await db.delete(friendship).where(
    or(
      and(eq(friendship.requesterId, me), eq(friendship.addresseeId, friendUserId)),
      and(eq(friendship.requesterId, friendUserId), eq(friendship.addresseeId, me))
    )
  );
  return json({ ok: true });
}


