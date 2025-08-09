import { auth } from '$lib/auth';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { supportTicket, supportTicketMessage, user } from '$lib/server/db/schema';
import { createNotification } from '$lib/server/notification';
import { and, desc, eq, ilike } from 'drizzle-orm';

// List current user's tickets (admins can filter all)
export async function GET({ request, url }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const currentUserId = Number(session.user.id);

  const search = url.searchParams.get('search') || '';
  const idParam = url.searchParams.get('id');
  const status = url.searchParams.get('status') || 'all';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get('limit') || '20')));

  // Check admin
  const [u] = await db.select({ isAdmin: user.isAdmin }).from(user).where(eq(user.id, currentUserId)).limit(1);
  const isAdmin = Boolean(u?.isAdmin);

  const conditions = isAdmin ? [] : [eq(supportTicket.userId, currentUserId)];
  if (idParam) {
    const idNum = parseInt(idParam);
    if (!isNaN(idNum)) conditions.push(eq(supportTicket.id, idNum));
  }
  if (status !== 'all') conditions.push(eq(supportTicket.status, status as any));
  if (search) conditions.push(ilike(supportTicket.subject, `%${search}%`));

  const where = conditions.length ? and(...conditions) : undefined;

  const offset = (page - 1) * limit;

  const rows = await db
    .select({
      id: supportTicket.id,
      subject: supportTicket.subject,
      status: supportTicket.status,
      priority: supportTicket.priority,
      lastActivityAt: supportTicket.lastActivityAt,
      createdAt: supportTicket.createdAt,
      updatedAt: supportTicket.updatedAt,
      userId: supportTicket.userId,
    })
    .from(supportTicket)
    .where(where)
    .orderBy(desc(supportTicket.lastActivityAt))
    .limit(limit)
    .offset(offset);

  return json({ tickets: rows, page, limit });
}

// Create a new ticket
export async function POST({ request }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const currentUserId = Number(session.user.id);

  const body = await request.json().catch(() => ({}));
  const subject: string = (body.subject || '').toString().trim();
  const message: string = (body.message || '').toString().trim();
  const priority = (body.priority || 'LOW').toString().toUpperCase();

  if (!subject || subject.length < 4) throw error(400, 'Subject is required');
  if (!message || message.length < 4) throw error(400, 'Message is required');

  const [created] = await db
    .insert(supportTicket)
    .values({ userId: currentUserId, subject, priority: priority as any })
    .returning({ id: supportTicket.id });

  await db.insert(supportTicketMessage).values({ ticketId: created.id, authorUserId: currentUserId, message, isStaffReply: false });

  // Notify admins of new ticket
  try {
    const admins = await db.select({ id: user.id }).from(user).where(eq(user.isAdmin, true));
    await Promise.all(
      admins.map((a) =>
        createNotification(String(a.id), 'SYSTEM', 'New support ticket', subject, `/tickets/${created.id}`)
      )
    );
  } catch (e) {
    console.error('Failed to notify admins about new ticket:', e);
  }

  return json({ id: created.id });
}


