import type { RequestHandler } from './$types';

// Redirect /favicon.ico requests to the Cryptonix PNG logo
export const GET: RequestHandler = async () => {
  return new Response(null, {
    status: 302,
    headers: { Location: '/facedev/Cryptonix.png' }
  });
};



