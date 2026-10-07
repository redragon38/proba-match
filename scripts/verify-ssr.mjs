import { mkdir, writeFile } from 'node:fs/promises';

// HTTP-only companion to verify-seo.mjs. Does NOT certify layout, hydration or accessibility.
const base = process.env.VERIFY_URL || 'http://127.0.0.1:3000';
const paths = [
  '/',
  '/matchs',
  '/live',
  '/equipes',
  '/joueurs',
  '/competitions',
  '/classements',
  '/a-propos',
  '/methodologie',
  '/comprendre-probabilites',
  '/lexique-football',
  '/sources-donnees',
  '/contact',
  '/confidentialite',
  '/cookies',
  '/mentions-legales',
  '/recherche',
  '/favoris',
  '/parametres',
  '/comparateur/equipes',
  '/comparateur/joueurs',
  '/admin',
];
const editorial = new Set([
  '/a-propos',
  '/methodologie',
  '/comprendre-probabilites',
  '/lexique-football',
  '/sources-donnees',
]);
const attributes = (tag) =>
  Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
const report = {
  generatedAt: new Date().toISOString(),
  scope: 'Local HTTP rendered HTML, no browser and no production DB',
  pages: [],
  checks: [],
  limitations: [
    'Mobile layout, console, hydration and accessibility require a browser.',
    'External indexing, structured data eligibility, GEO mentions and field Core Web Vitals are not measured.',
  ],
};
const check = (name, pass, detail) =>
  report.checks.push({ name, status: pass ? 'PASS' : 'FAIL', detail });
const sitemapResponse = await fetch(`${base}/sitemap.xml`);
const sitemap = await sitemapResponse.text();
check('sitemap', sitemapResponse.ok && /<urlset\b/.test(sitemap), 'Sitemap XML available');
for (const path of editorial) check('sitemap-editorial', sitemap.includes(`${path}</loc>`), path);
const robots = await fetch(`${base}/robots.txt`);
check(
  'robots',
  robots.ok && !(await robots.text()).includes('Disallow: /\n'),
  'Public content crawlable',
);
for (const path of paths) {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(30000) });
  const html = await response.text();
  const ms = performance.now() - started;
  const metas = [...html.matchAll(/<meta\b[^>]*>/g)].map((m) => attributes(m[0]));
  const meta = (name) => metas.find((m) => m.name === name || m.property === name)?.content;
  const links = [...html.matchAll(/<link\b[^>]*>/g)].map((m) => attributes(m[0]));
  const canonical = links.find((l) => l.rel === 'canonical')?.href;
  const h1 = [...html.matchAll(/<h1\b/g)].length;
  const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
  const structured = [
    ...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g),
  ];
  let validJson = true;
  for (const [, value] of structured) {
    try {
      JSON.parse(value);
    } catch {
      validJson = false;
    }
  }
  report.pages.push({
    path,
    status: response.status,
    title,
    description: meta('description'),
    canonical,
    robots: meta('robots'),
    h1,
    htmlBytes: Buffer.byteLength(html),
    responseMs: Math.round(ms),
    jsonLdCount: structured.length,
  });
  check('http', response.status === 200, path);
  check('h1', h1 === 1, path);
  check('metadata', !!title && !!meta('description'), path);
  check('structured-data-json', validJson && structured.length > 0, path);
  if (path !== '/admin')
    check('canonical', !!canonical && new URL(canonical).pathname === path, path);
  if (editorial.has(path)) {
    check('editorial-indexable', !meta('robots')?.includes('noindex'), path);
    check(
      'social',
      meta('og:url') === canonical &&
        !!meta('og:image') &&
        meta('twitter:card') === 'summary_large_image',
      path,
    );
  }
}
check(
  'unique-titles',
  new Set(report.pages.map((p) => p.title)).size === report.pages.length,
  'All sampled routes',
);
check(
  'unique-descriptions',
  new Set(report.pages.map((p) => p.description)).size === report.pages.length,
  'All sampled routes',
);
const missing = await fetch(`${base}/match/this-match-does-not-exist`);
check('unknown-match-404', missing.status === 404, 'No invented fixture');
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/IMPROVEMENT-SSR.json', JSON.stringify(report, null, 2));
const failed = report.checks.filter((c) => c.status === 'FAIL');
console.log(
  JSON.stringify({ pages: report.pages.length, checks: report.checks.length, failed }, null, 2),
);
if (failed.length) process.exitCode = 1;
