import type { RequestHandler } from '@sveltejs/kit';

// Consider adding dynamic entries (coins, users, etc.) by querying the DB here
// if you want a fully exhaustive sitemap.

const staticPaths: Array<{ path: string; priority?: number; changefreq?: string }> = [
  { path: '/', priority: 1.0, changefreq: 'daily' },
  { path: '/about', priority: 0.4, changefreq: 'yearly' },
  { path: '/market', priority: 0.8, changefreq: 'hourly' },
  { path: '/leaderboard', priority: 0.6, changefreq: 'daily' },
  { path: '/portfolio', priority: 0.6, changefreq: 'hourly' },
  { path: '/live', priority: 0.6, changefreq: 'always' },
  { path: '/treemap', priority: 0.5, changefreq: 'daily' },
  { path: '/gambling', priority: 0.4, changefreq: 'daily' },
  { path: '/messages', priority: 0.5, changefreq: 'hourly' },
  { path: '/notifications', priority: 0.4, changefreq: 'hourly' },
  { path: '/settings', priority: 0.3, changefreq: 'monthly' },
  { path: '/transactions', priority: 0.4, changefreq: 'daily' },
  { path: '/tickets', priority: 0.4, changefreq: 'daily' },
  { path: '/hopium', priority: 0.5, changefreq: 'daily' },
  { path: '/legal/privacy', priority: 0.2, changefreq: 'yearly' },
  { path: '/legal/terms', priority: 0.2, changefreq: 'yearly' }
];

const generateSitemap = (origin: string) => {
  const urls = staticPaths
    .map(({ path, priority = 0.5, changefreq = 'weekly' }) => {
      return `\n  <url>\n    <loc>${origin}${path}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}\n</urlset>`;
};

export const GET: RequestHandler = async ({ url }) => {
  const origin = url.origin;
  const body = generateSitemap(origin);

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};


