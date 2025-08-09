import { auth } from '$lib/auth';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { supportTicket, user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { createNotification } from '$lib/server/notification';

export async function GET({ params, request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const currentUserId = Number(session.user.id);
  const ticketId = Number(params.id);
  if (isNaN(ticketId)) throw error(400, 'Invalid ticket id');

  const [row] = await db
    .select({
      id: supportTicket.id,
      subject: supportTicket.subject,
      status: supportTicket.status,
      priority: supportTicket.priority,
      userId: supportTicket.userId,
      createdAt: supportTicket.createdAt,
      lastActivityAt: supportTicket.lastActivityAt,
    })
    .from(supportTicket)
    .where(eq(supportTicket.id, ticketId))
    .limit(1);
  if (!row) throw error(404, 'Ticket not found');

  const [currentUser] = await db.select({ isAdmin: user.isAdmin }).from(user).where(eq(user.id, currentUserId)).limit(1);
  const isAdmin = Boolean(currentUser?.isAdmin);
  if (!isAdmin && row.userId !== currentUserId) throw error(403, 'Forbidden');

  return json({ ticket: row, isAdmin });
}

export async function PATCH({ params, request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const currentUserId = Number(session.user.id);
  const ticketId = Number(params.id);
  if (isNaN(ticketId)) throw error(400, 'Invalid ticket id');

  const body = await request.json().catch(() => ({}));
  const { status, priority, subject } = body as { status?: string; priority?: string; subject?: string };

  const [ticket] = await db.select({ userId: supportTicket.userId }).from(supportTicket).where(eq(supportTicket.id, ticketId)).limit(1);
  if (!ticket) throw error(404, 'Ticket not found');

  const [currentUser] = await db.select({ isAdmin: user.isAdmin }).from(user).where(eq(user.id, currentUserId)).limit(1);
  const isAdmin = Boolean(currentUser?.isAdmin);
  if (!isAdmin && ticket.userId !== currentUserId) throw error(403, 'Forbidden');

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (status) updates.status = status;
  if (priority) updates.priority = priority;
  if (subject && isAdmin) updates.subject = subject; // allow subject edit by staff only

  await db.update(supportTicket).set(updates).where(eq(supportTicket.id, ticketId));
  // Notify participants if status/priority changed
  try {
    if (status || priority) {
      const admins = await db.select({ id: user.id }).from(user).where(eq(user.isAdmin, true));
      const targets = new Set<number>(admins.map(a => a.id));
      targets.add(ticket.userId);
      await Promise.all(Array.from(targets).map((id) =>
        createNotification(String(id), 'SYSTEM', 'Ticket updated', `Ticket #${ticketId} updated${status ? `: ${status}` : ''}`, `/tickets/${ticketId}`)
      ));
    }
  } catch (e) {
    console.error('Failed to notify on ticket update:', e);
  }
  return json({ ok: true });
}


