import type { RequestHandler } from '@sveltejs/kit';

const robotsTxt = (origin: string) => `User-agent: *
Allow: /

Sitemap: ${origin}/sitemap.xml
`;

export const GET: RequestHandler = async ({ url }) => {
  const body = robotsTxt(url.origin);
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};


