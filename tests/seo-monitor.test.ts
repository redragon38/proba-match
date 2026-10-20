import { expect, it, vi } from 'vitest';
import { crawlSeo, inspectHtml, monitorMarkdown } from '@/lib/seo-monitor.mjs';

const origin = 'https://football.example';
const html = (path: string, extra = '') => `<html lang='fr'><head><title>${path}</title>
<meta content='Description ${path}' name='description'><link href='${origin}${path}' rel='canonical'>
</head><body><main><h1>Page ${path}</h1><p>${'Contenu public utile et documenté. '.repeat(5)}</p>${extra}</main></body></html>`;
const adapter = (overrides: Record<string, Response> = {}) =>
  vi.fn(async (input: Parameters<typeof fetch>[0]) => {
    const url = input instanceof Request ? input.url : String(input);
    const path = new URL(url).pathname + new URL(url).search;
    const found = overrides[path];
    if (found) return found.clone();
    if (path === '/robots.txt')
      return new Response(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml`);
    if (path === '/sitemap.xml')
      return new Response(`<urlset><url><loc>${origin}/</loc></url></urlset>`);
    return new Response(html(path));
  });

it('reads server HTML, attribute order, noindex, JSON-LD and links without running JavaScript', () => {
  const info = inspectHtml(
    html(
      '/',
      `<a href='/match/a?x=1&amp;y=2'>Match</a>
    <script type='application/ld+json'>{"@type":"WebSite"}</script>`,
    ),
  );
  expect(info.title).toBe('/');
  expect(info.h1).toEqual(['Page /']);
  expect(info.description).toBe('Description /');
  expect(info.canonical).toBe(origin + '/');
  expect(info.links).toEqual(['/match/a?x=1&y=2']);
  expect(info.structured).toEqual([{ '@type': 'WebSite' }]);
  expect(info.invalidJson).toBe(false);
});

it('finds broken internal links and distinguishes sitemap noindex, invalid dates and volume changes', async () => {
  const fetchImpl = adapter({
    '/': new Response(html('/', '<a href="/broken">Lien cassé</a>')),
    '/broken': new Response('Introuvable', { status: 404 }),
    '/match/a': new Response(html('/match/a', '<meta name="robots" content="noindex">')),
    '/sitemap.xml': new Response(`<urlset><url><loc>${origin}/</loc></url>
      <url><loc>${origin}/match/a</loc><lastmod>2999-01-01</lastmod></url></urlset>`),
  });
  const report = await crawlSeo({
    baseUrl: origin,
    fetchImpl,
    delayMs: 0,
    maxPages: 40,
    previousCount: 100,
  });
  expect(report.issues.map((i: { code: string }) => i.code)).toEqual(
    expect.arrayContaining([
      'PAGE_HTTP',
      'SITEMAP_NOINDEX',
      'SITEMAP_LASTMOD',
      'INDEXABLE_VOLUME_CHANGED',
    ]),
  );
  expect(report.pages.find((p: { path: string }) => p.path === '/broken')?.status).toBe(404);
  expect(monitorMarkdown(report)).toContain('PAGE_HTTP');
});

it('expands sitemap indexes and samples entity families before catalogue pagination', async () => {
  const urls = [
    origin + '/equipe/a',
    origin + '/competition/a',
    origin + '/match/a',
    ...Array.from({ length: 30 }, (_, i) => origin + '/joueurs?page=' + (i + 1)),
  ];
  const fetchImpl = adapter({
    '/sitemap.xml': new Response(
      `<sitemapindex><sitemap><loc>${origin}/parts.xml</loc></sitemap></sitemapindex>`,
    ),
    '/parts.xml': new Response(
      '<urlset>' +
        urls.map((u) => `<url><loc>${u.replaceAll('&', '&amp;')}</loc></url>`).join('') +
        '</urlset>',
    ),
  });
  const report = await crawlSeo({ baseUrl: origin, fetchImpl, delayMs: 0, maxPages: 24 });
  expect(report.sitemapFiles).toBe(2);
  expect(report.sitemapCount).toBe(33);
  expect(report.pages.map((p: { path: string }) => p.path)).toEqual(
    expect.arrayContaining(['/match/a', '/equipe/a', '/competition/a']),
  );
  expect(report.scope).toContain('sample');
  expect(report.orphanScope).toContain('Candidates only');
});

it('never follows an external redirect or crawls a foreign sitemap target', async () => {
  const fetchImpl = adapter({
    '/': new Response(null, {
      status: 302,
      headers: { Location: 'https://outside.example/private' },
    }),
    '/sitemap.xml': new Response(
      '<urlset><url><loc>https://outside.example/page</loc></url></urlset>',
    ),
  });
  const report = await crawlSeo({ baseUrl: origin, fetchImpl, delayMs: 0, maxPages: 12 });
  expect(report.issues.map((i: { code: string }) => i.code)).toContain('SITEMAP_ORIGIN');
  expect(fetchImpl.mock.calls.every(([url]) => new URL(String(url)).origin === origin)).toBe(true);
  await expect(crawlSeo({ baseUrl: origin, maxPages: NaN })).rejects.toThrow(
    'INVALID_MONITOR_LIMIT',
  );
});

it('reports stale source timestamps and nonexistent structured event statuses', async () => {
  const fetchImpl = adapter({
    '/': new Response(
      html(
        '/',
        '<time data-football-updated-at="2026-01-01T00:00:00Z"></time>' +
          '<script type="application/ld+json">{"@type":"SportsEvent","eventStatus":"https://schema.org/EventCompleted"}</script>',
      ),
    ),
  });
  const report = await crawlSeo({
    baseUrl: origin,
    fetchImpl,
    delayMs: 0,
    maxPages: 1,
    now: Date.parse('2026-10-20T00:00:00Z'),
  });
  expect(report.issues.map((i) => i.code)).toEqual(
    expect.arrayContaining(['DATA_SNAPSHOT_OLD', 'JSONLD_EVENT_STATUS']),
  );
});
