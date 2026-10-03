import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.VERIFY_URL || 'http://localhost:3000';
const strict = process.env.SEO_REQUIRE_HTTPS === 'true';
const expectedOrigin = process.env.SEO_CANONICAL_ORIGIN
  ? new URL(process.env.SEO_CANONICAL_ORIGIN).origin
  : null;
const output = process.env.SEO_REPORT || 'artifacts/seo-audit.json';
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'chrome' : 'chromium',
});
const report = {
  generatedAt: new Date().toISOString(),
  base,
  pages: [],
  checks: [],
  browser: [],
  links: {},
  external:
    'NON VÉRIFIÉ EXTERNEMENT: Search Console, PageSpeed Insights, CrUX, Rich Results Test, public TLS and redirects',
};
const check = (category, pass, detail, warning = false) =>
  report.checks.push({ category, status: pass ? 'PASS' : warning ? 'WARNING' : 'FAIL', detail });
const pathOf = (url) => {
  const u = new URL(url, base);
  return u.pathname + u.search;
};
try {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const request = context.request;
  const robots = await request.get(`${base}/robots.txt`);
  const robotsText = await robots.text();
  check(
    'robots',
    robots.ok() && !/^Disallow:\s*\/\s*$/m.test(robotsText),
    'Public routes and rendering resources are not blocked',
  );
  check(
    'robots',
    !/Disallow:\s*\/(recherche|favoris|parametres)/.test(robotsText),
    'Crawlers can read noindex on private/search pages',
  );
  const sitemap = await request.get(`${base}/sitemap.xml`);
  const xml = await sitemap.text();
  const parsed = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return {
      valid: !doc.querySelector('parsererror') && doc.documentElement.localName === 'urlset',
      urls: [...doc.querySelectorAll('loc')].map((n) => n.textContent),
    };
  }, xml);
  check('sitemap', sitemap.ok() && parsed.valid, 'Valid sitemap XML');
  check('sitemap', new Set(parsed.urls).size === parsed.urls.length, 'Unique sitemap URLs');
  check('sitemap', parsed.urls.length <= 50000, 'Sitemap remains below the URL limit');
  if (expectedOrigin) {
    check(
      'canonical',
      parsed.urls.every((url) => new URL(url).origin === expectedOrigin),
      'Every sitemap URL uses the configured canonical origin',
    );
    check(
      'robots',
      robotsText.includes(`Sitemap: ${expectedOrigin}/sitemap.xml`),
      'Robots references the canonical sitemap',
    );
  }
  check(
    'HTTPS',
    parsed.urls.every((url) => url.startsWith('https://')) &&
      /^Sitemap: https:\/\//m.test(robotsText),
    'Public HTTPS origin required at launch',
    !strict,
  );
  const paths = [
    ...new Set([
      '/',
      '/matchs',
      '/live',
      '/equipes',
      '/joueurs',
      '/competitions',
      '/classements',
      '/a-propos',
      '/methodologie',
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
      ...parsed.urls.map(pathOf),
    ]),
  ];
  const catalog = await (await request.get(`${base}/api/matches/today`)).json();
  if (catalog.matches?.[0]) paths.push(`/match/${catalog.matches[0].slug}`);
  const sitemapPaths = new Set(parsed.urls.map(pathOf));
  const links = new Set();
  for (const path of paths) {
    // Parse actual server HTML without retaining thousands of browser navigations/assets.
    const network = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(30000) });
    const response = {
      status: () => network.status,
      headers: () => Object.fromEntries(network.headers),
    };
    const html = await network.text();
    if (sitemapPaths.has(path))
      check('sitemap', !network.redirected, `${path}: sitemap URL does not redirect`);
    const data = await page.evaluate((html) => {
      const document = new DOMParser().parseFromString(html, 'text/html');
      const meta = (name) =>
        document
          .querySelector(`meta[name="${name}"],meta[property="${name}"]`)
          ?.getAttribute('content') || '';
      const main = document.querySelector('main')?.cloneNode(true);
      main?.querySelectorAll('script,style,[hidden]').forEach((node) => node.remove());
      return {
        title: document.title,
        description: meta('description'),
        canonical: document.querySelector('link[rel=canonical]')?.href || '',
        robots: meta('robots'),
        h1: [...document.querySelectorAll('main h1')].map((n) => n.textContent.trim()),
        visibleText: main?.textContent.length || 0,
        headings: [...document.querySelectorAll('main h1,main h2,main h3,main h4')].map((n) => ({
          level: Number(n.tagName[1]),
          text: n.textContent.trim(),
        })),
        lang: document.documentElement.lang,
        viewport: meta('viewport'),
        og: {
          title: meta('og:title'),
          description: meta('og:description'),
          url: meta('og:url'),
          image: meta('og:image'),
          twitter: meta('twitter:card'),
        },
        links: [...document.querySelectorAll('a[href]')].map((n) => n.getAttribute('href')),
        images: [...document.querySelectorAll('img')].map((n) => ({
          alt: n.getAttribute('alt'),
          width: n.getAttribute('width'),
          height: n.getAttribute('height'),
          src: n.getAttribute('src'),
        })),
        jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].map((n) => {
          try {
            return JSON.parse(n.textContent);
          } catch {
            return null;
          }
        }),
      };
    }, html);
    if (report.pages.length % 250 === 0)
      console.info(`SEO: ${report.pages.length}/${paths.length} server-rendered pages`);
    const indexable = !data.robots.includes('noindex');
    const row = { path, status: response.status(), htmlBytes: Buffer.byteLength(html), ...data };
    report.pages.push(row);
    check('routes', response.status() === 200, `${path} HTTP 200`);
    check(
      'SSR',
      data.h1.length === 1 && data.visibleText > 100,
      `${path}: one H1 and main content without JavaScript`,
    );
    check('metadata', !!data.title && !!data.description, `${path}: title and description`);
    if (indexable) {
      check(
        'canonical',
        !!data.canonical &&
          pathOf(data.canonical) === path &&
          (!expectedOrigin || new URL(data.canonical).origin === expectedOrigin),
        `${path}: self canonical`,
      );
      check(
        'indexation',
        !/noindex|none/i.test(response.headers()['x-robots-tag'] || ''),
        `${path}: no accidental noindex HTTP header`,
      );
      check(
        'Open Graph',
        !!data.og.title &&
          !!data.og.description &&
          !!data.og.image &&
          new URL(data.og.url || base).href === data.canonical &&
          !!data.og.twitter,
        `${path}: social metadata`,
      );
      check('sitemap', sitemapPaths.has(path), `${path}: indexable route included in sitemap`);
    }
    if (sitemapPaths.has(path))
      check('indexation', indexable, `${path}: sitemap target is indexable`);
    check(
      'mobile',
      data.lang === 'fr' && data.viewport.includes('width=device-width'),
      `${path}: lang and viewport`,
    );
    check(
      'images',
      data.images.every((i) => i.alt !== null && Number(i.width) > 0 && Number(i.height) > 0),
      `${path}: alt and dimensions`,
    );
    check(
      'structured data',
      data.jsonLd.every((j) => j && j['@context'] === 'https://schema.org' && j['@type']),
      `${path}: JSON-LD syntax and type`,
    );
    check(
      'headings',
      data.headings.every((h, i, all) => i === 0 || h.level <= all[i - 1].level + 1),
      `${path}: heading hierarchy`,
      true,
    );
    check(
      'performance',
      row.htmlBytes < 1_000_000,
      `${path}: HTML ${row.htmlBytes} bytes (local payload budget)`,
      true,
    );
    for (const href of data.links)
      if (href.startsWith('/') && !href.startsWith('//')) links.add(href.split('#')[0]);
  }
  for (const field of ['title', 'description']) {
    const indexed = report.pages.filter((p) => !p.robots.includes('noindex'));
    const repeated = indexed
      .filter((p, i) => indexed.slice(0, i).some((prev) => prev[field] === p[field]))
      .map((p) => p.path);
    check(
      'metadata',
      !repeated.length,
      `Unique ${field}: ${repeated.join(', ') || 'no duplicates'}`,
    );
  }
  const known = new Set(report.pages.map((p) => p.path));
  const missing = [...links].filter((p) => p && !known.has(p));
  const broken = [],
    redirects = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < missing.length) {
        const path = missing[cursor++];
        const result = await fetch(`${base}${path}`, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(30000),
        });
        const response = {
          status: () => result.status,
          headers: () => Object.fromEntries(result.headers),
          dispose: async () => {},
        };
        if (response.status() >= 400) broken.push({ path, status: response.status() });
        if (response.status() >= 300 && response.status() < 400)
          redirects.push({ path, status: response.status(), target: response.headers().location });
        await response.dispose();
      }
    }),
  );
  report.links = { discovered: links.size, additionalChecked: missing.length, broken, redirects };
  check(
    'internal links',
    !broken.length && !redirects.length,
    'All discovered internal links resolve directly',
  );
  check(
    'internal links',
    [...sitemapPaths].every((path) => path === '/' || links.has(path)),
    'Every sitemap page has an incoming crawlable link',
  );
  for (const path of [
    '/seo-does-not-exist',
    '/match/seo-does-not-exist',
    '/equipe/seo-does-not-exist',
    '/joueur/seo-does-not-exist',
    '/competition/seo-does-not-exist',
    '/comparateur/unknown',
    '/equipes?page=999999',
  ]) {
    const response = await request.get(`${base}${path}`);
    check('404', response.status() === 404, `${path}: HTTP ${response.status()}`);
  }
  const slash = await request.get(`${base}/equipes/`, { maxRedirects: 0 });
  check(
    'redirects',
    [301, 308].includes(slash.status()) && slash.headers().location?.endsWith('/equipes'),
    'Trailing slash has a direct permanent redirect',
  );
  if (catalog.matches?.[0]) {
    const m = catalog.matches[0];
    const alias = await request.get(`${base}/match/${m.id}`, { maxRedirects: 0 });
    check(
      'redirects',
      m.id === m.slug ||
        ([301, 308].includes(alias.status()) &&
          alias.headers().location?.endsWith(`/match/${m.slug}`)),
      'Technical fixture ID redirects to the canonical slug',
    );
  }
  for (const path of ['/?statut=finished', '/matchs?date=2024-01-01', '/equipes?page=1']) {
    await page.goto(`${base}${path}`);
    const canonical = await page.locator('link[rel=canonical]').getAttribute('href');
    check(
      'duplication',
      pathOf(canonical) === new URL(path, base).pathname,
      `${path}: filter/query canonical`,
    );
  }
  const images = new Set(report.pages.map((p) => p.og.image).filter(Boolean));
  for (const image of images)
    check(
      'Open Graph',
      (await request.get(`${base}${pathOf(image)}`)).ok(),
      'Social image responds',
    );
  await context.close();
  const dynamic = report.pages.find((p) => p.path.startsWith('/equipe/'))?.path;
  const matchPath = report.pages.find((p) => p.path.startsWith('/match/'))?.path;
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const p = await context.newPage();
    await p.addInitScript(() => {
      window.__seoVitals = { lcp: null, cls: 0 };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__seoVitals.lcp = e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__seoVitals.cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    let errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    for (const path of ['/', '/equipes', '/classements', '/parametres', dynamic, matchPath].filter(
      Boolean,
    )) {
      errors = [];
      await p.goto(`${base}${path}`, { waitUntil: 'networkidle' });
      const metrics = await p.evaluate(() => ({
        ...window.__seoVitals,
        overflow: document.documentElement.scrollWidth > innerWidth,
        resources: performance.getEntriesByType('resource').length,
        jsBytes: performance
          .getEntriesByType('resource')
          .filter((e) => e.initiatorType === 'script')
          .reduce((sum, e) => sum + e.encodedBodySize, 0),
      }));
      const axe = await new AxeBuilder({ page: p }).withTags(['wcag2a', 'wcag2aa']).analyze();
      const violations = axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        targets: v.nodes.map((n) => n.target),
      }));
      report.browser.push({ width, path, errors: [...errors], ...metrics, violations });
      check(
        'browser',
        !errors.length && !metrics.overflow,
        `${path} @${width}: no browser error or horizontal overflow`,
      );
      check('accessibility', !violations.length, `${path} @${width}: axe WCAG A/AA`);
    }
    await context.close();
  }
} finally {
  await browser.close();
  await mkdir('artifacts', { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2));
}
const failures = report.checks.filter((c) => c.status === 'FAIL');
const warnings = report.checks.filter((c) => c.status === 'WARNING');
console.log(
  JSON.stringify(
    {
      pages: report.pages.length,
      checks: report.checks.length,
      browserViews: report.browser.length,
      links: report.links,
      failures,
      warnings,
      report: output,
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
