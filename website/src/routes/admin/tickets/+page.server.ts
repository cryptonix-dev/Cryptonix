import type { PageServerLoad } from './$types';
import { auth } from '$lib/auth';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ request }) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) throw error(401, 'Not authenticated');
  const [u] = await db
    .select({ isAdmin: user.isAdmin })
    .from(user)
    .where(eq(user.id, Number(session.user.id)))
    .limit(1);
  if (!u?.isAdmin) throw error(403, 'Admin access required');
  return {};
};


