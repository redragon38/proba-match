import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
const base = 'http://localhost:3000';
const phase = process.argv[2] || 'after';
const { matches } = await (await fetch(`${base}/api/matches/today`)).json();
let match = matches[0];
if (!match) {
  const catalogue = await (await fetch(`${base}/api/search?scope=catalogue&category=Match`)).json();
  const id = catalogue.results[0]?.href.split('/').pop();
  if (id) match = await (await fetch(`${base}/api/matches/${id}`)).json();
}
const paths = [
  '/',
  '/api/live',
  '/api/updates',
  '/api/matches/today',
  '/api/search?q=paris',
  '/performance-modele',
];
if (match)
  paths.push(
    `/api/matches/${match.id}`,
    `/api/teams/${match.homeId}`,
    `/api/competitions/${match.competitionId}`,
    `/match/${match.id}`,
  );
const requests = [];
for (const path of paths) {
  const samples = [];
  let bytes = 0,
    status = 0;
  for (let i = 0; i < 8; i++) {
    const start = performance.now();
    const response = await fetch(base + path);
    bytes = (await response.arrayBuffer()).byteLength;
    status = response.status;
    samples.push(Math.round(performance.now() - start));
  }
  const warm = samples.slice(1).sort((a, b) => a - b);
  requests.push({ path, status, bytes, firstMs: samples[0], medianMs: warm[3], p95Ms: warm[6] });
}
const concurrency = await Promise.all(
  Array.from({ length: 5 }, async () => {
    const start = performance.now();
    const r = await fetch(`${base}/api/live`);
    await r.arrayBuffer();
    return { ms: Math.round(performance.now() - start), status: r.status };
  }),
);
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'chrome' : 'chromium',
});
const frontend = [];
try {
  for (const width of [390, 1440]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.localMetrics = { lcp: 0, cls: 0 };
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.localMetrics.lcp = e.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries())
          if (!e.hadRecentInput) window.localMetrics.cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    for (const path of ['/', '/matchs', '/recherche']) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      frontend.push(
        await page.evaluate(
          ({ width, path }) => {
            const nav = performance.getEntriesByType('navigation')[0];
            const resources = performance.getEntriesByType('resource');
            return {
              width,
              path,
              ...window.localMetrics,
              ttfb: nav.responseStart,
              domReady: nav.domContentLoadedEventEnd,
              jsBytes: resources
                .filter((r) => r.initiatorType === 'script')
                .reduce((sum, r) => sum + r.encodedBodySize, 0),
            };
          },
          { width, path },
        ),
      );
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile(
  `artifacts/response-${phase}.json`,
  JSON.stringify(
    {
      at: new Date().toISOString(),
      requests,
      concurrency,
      frontend,
      note: 'Local production build, no CPU/network throttling; not field Core Web Vitals. Eight sequential requests per route, five concurrent live reads.',
    },
    null,
    2,
  ),
);
console.log(JSON.stringify({ requests, concurrency, frontend }));
