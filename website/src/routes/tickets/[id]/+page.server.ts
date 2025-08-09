import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const id = params.id ?? '';
  return { id };
};


