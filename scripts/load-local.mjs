/** Small, bounded local-only load probe. Never accepts a public or staging hostname. */
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.LOAD_URL ?? 'http://127.0.0.1:3000';
const url = new URL(base);
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
  url.username ||
  url.password ||
  url.protocol !== 'http:'
)
  throw new Error('LOCAL_HTTP_TARGET_REQUIRED');
const paths = [
  '/',
  '/matchs',
  '/api/matches',
  '/api/search?q=ronlado',
  '/api/search?scope=catalogue&category=Joueur&q=messi',
];
const catalog = await (await fetch(`${base}/api/matches`)).json();
const match = catalog.matches?.[0];
if (match)
  paths.push(
    `/match/${match.slug}`,
    `/api/matches/${match.id}`,
    `/api/competitions/${match.competitionId}`,
  );
const playerCatalog = await (
  await fetch(`${base}/api/search?scope=catalogue&category=Joueur`)
).json();
if (playerCatalog.results?.[0]) paths.push(playerCatalog.results[0].href);
const rows = [];
for (const path of paths) {
  await fetch(base + path).then((r) => r.arrayBuffer());
  const durations = [],
    statuses = [],
    sizes = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (cursor < 20) {
        cursor++;
        const start = performance.now();
        try {
          const response = await fetch(base + path, { signal: AbortSignal.timeout(30000) });
          sizes.push((await response.arrayBuffer()).byteLength);
          statuses.push(response.status);
        } catch {
          statuses.push(0);
        }
        durations.push(performance.now() - start);
      }
    }),
  );
  durations.sort((a, b) => a - b);
  rows.push({
    path,
    samples: durations.length,
    concurrency: 4,
    p50Ms: Math.round(durations[9]),
    p95Ms: Math.round(durations[18]),
    errors: statuses.filter((s) => s < 200 || s >= 400).length,
    statuses: [...new Set(statuses)],
    maxBytes: Math.max(...sizes),
  });
}
let health = null;
if (process.env.CRON_SECRET) {
  const response = await fetch(`${base}/api/health`, {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  const data = await response.json();
  health = {
    httpStatus: response.status,
    status: data.status,
    cache: data.cache,
    datasetCache: data.datasetCache,
    telemetry: data.telemetry,
  };
}
const report = {
  generatedAt: new Date().toISOString(),
  base,
  rows,
  health,
  scope: 'local cloud instance; not public production capacity or field Core Web Vitals',
  failures: rows.reduce((n, r) => n + r.errors, 0),
};
await mkdir('.local/hardening', { recursive: true });
await writeFile('.local/hardening/load.json', JSON.stringify(report, null, 2));
console.info(JSON.stringify(report, null, 2));
if (report.failures) process.exitCode = 1;
