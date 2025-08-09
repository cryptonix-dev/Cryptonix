import { auth } from '$lib/auth';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { supportTicket, supportTicketMessage, user } from '$lib/server/db/schema';
import { createNotification } from '$lib/server/notification';
import { and, asc, desc, eq } from 'drizzle-orm';

export async function GET({ params, request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const currentUserId = Number(session.user.id);

  const ticketId = Number(params.id);
  if (isNaN(ticketId)) throw error(400, 'Invalid ticket id');

  const [ticket] = await db.select({ userId: supportTicket.userId }).from(supportTicket).where(eq(supportTicket.id, ticketId)).limit(1);
  if (!ticket) throw error(404, 'Ticket not found');

  const [currentUser] = await db.select({ isAdmin: user.isAdmin }).from(user).where(eq(user.id, currentUserId)).limit(1);
  const isAdmin = Boolean(currentUser?.isAdmin);
  if (!isAdmin && ticket.userId !== currentUserId) throw error(403, 'Forbidden');

  const rows = await db
    .select({
      id: supportTicketMessage.id,
      ticketId: supportTicketMessage.ticketId,
      authorUserId: supportTicketMessage.authorUserId,
      message: supportTicketMessage.message,
      isStaffReply: supportTicketMessage.isStaffReply,
      createdAt: supportTicketMessage.createdAt,
    })
    .from(supportTicketMessage)
    .where(eq(supportTicketMessage.ticketId, ticketId))
    .orderBy(asc(supportTicketMessage.createdAt));

  return json({ messages: rows });
}

export async function POST({ params, request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const currentUserId = Number(session.user.id);

  const ticketId = Number(params.id);
  if (isNaN(ticketId)) throw error(400, 'Invalid ticket id');

  const body = await request.json().catch(() => ({}));
  const message: string = (body.message || '').toString().trim();
  if (!message || message.length < 1) throw error(400, 'Message is required');

  const [ticket] = await db.select({ userId: supportTicket.userId }).from(supportTicket).where(eq(supportTicket.id, ticketId)).limit(1);
  if (!ticket) throw error(404, 'Ticket not found');

  const [currentUser] = await db.select({ isAdmin: user.isAdmin }).from(user).where(eq(user.id, currentUserId)).limit(1);
  const isAdmin = Boolean(currentUser?.isAdmin);
  if (!isAdmin && ticket.userId !== currentUserId) throw error(403, 'Forbidden');

  await db.insert(supportTicketMessage).values({
    ticketId,
    authorUserId: currentUserId,
    message,
    isStaffReply: isAdmin,
  });

  await db
    .update(supportTicket)
    .set({ lastActivityAt: new Date() })
    .where(eq(supportTicket.id, ticketId));

  // Notify the other party
  try {
    const notifyUserId = isAdmin ? ticket.userId : (await db.select({ id: user.id }).from(user).where(eq(user.isAdmin, true))).map(u=>u.id);
    if (Array.isArray(notifyUserId)) {
      await Promise.all(notifyUserId.map((id) => createNotification(String(id), 'SYSTEM', 'New ticket reply', message.slice(0, 80), `/tickets/${ticketId}`)));
    } else if (notifyUserId) {
      await createNotification(String(notifyUserId), 'SYSTEM', 'New ticket reply', message.slice(0, 80), `/tickets/${ticketId}`);
    }
  } catch (e) {
    console.error('Failed to notify ticket participants:', e);
  }

  return json({ ok: true });
}


