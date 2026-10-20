import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { crawlSeo, monitorMarkdown } from '../src/lib/seo-monitor.mjs';
const output = process.env.SEO_MONITOR_REPORT ?? 'artifacts/seo-monitor.json';
let previousCount;
try {
  previousCount = JSON.parse(await readFile(output, 'utf8')).sitemapCount;
} catch {}
const report = await crawlSeo({
  baseUrl: process.env.VERIFY_URL ?? 'http://localhost:3000',
  canonicalOrigin:
    process.env.SEO_CANONICAL_ORIGIN ?? process.env.VERIFY_URL ?? 'http://localhost:3000',
  maxPages: Number(process.env.SEO_MAX_PAGES ?? 60),
  delayMs: Number(process.env.SEO_DELAY_MS ?? 200),
  previousCount,
});
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2));
await writeFile(output.replace(/\.json$/, '') + '.md', monitorMarkdown(report));
console.log(
  JSON.stringify({
    event: 'SEO_MONITOR_COMPLETED',
    pages: report.pages.length,
    sitemapCount: report.sitemapCount,
    errors: report.errors,
    warnings: report.warnings,
    report: output,
  }),
);
if (report.errors) process.exitCode = 1;
