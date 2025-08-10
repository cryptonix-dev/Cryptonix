import type { PageServerLoad } from './$types';
import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { user, supportTicket } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ request }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const [u] = await db.select({ isAdmin: user.isAdmin }).from(user).where(eq(user.id, Number(session.user.id))).limit(1);
  if (!u?.isAdmin) throw error(403, 'Admin access required');
  const [counts] = await db
    .select({
      open: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.status} = 'OPEN')`,
      pending: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.status} = 'PENDING')`,
      solved: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.status} = 'SOLVED')`,
      closed: sql<number>`COUNT(*) FILTER (WHERE ${supportTicket.status} = 'CLOSED')`,
    })
    .from(supportTicket);

  const recent = await db
    .select({ id: supportTicket.id, subject: supportTicket.subject, status: supportTicket.status, priority: supportTicket.priority, lastActivityAt: supportTicket.lastActivityAt })
    .from(supportTicket)
    .orderBy(sql`"last_activity_at" DESC`)
    .limit(5);

  return { counts, recent };
};


