import { randomUUID } from 'node:crypto';
import { db } from '@/database/client';
import { cronHandler } from '@/services/football/cron';
import { footballHealth } from '@/services/football/health';
import { crawlSeo } from '@/lib/seo-monitor.mjs';
import { siteOrigin } from '@/lib/seo';
import { log } from '@/lib/logger';

export const maxDuration = 300;
export const GET = cronHandler(async () => {
  const token = randomUUID();
  const acquired = await db.$queryRaw<{ key: string }[]>`
    INSERT INTO "SyncLock" ("key","token","expiresAt")
    VALUES ('seo-monitor',${token},(NOW() AT TIME ZONE 'UTC') + INTERVAL '10 minutes')
    ON CONFLICT ("key") DO UPDATE SET "token"=EXCLUDED."token", "expiresAt"=EXCLUDED."expiresAt"
    WHERE "SyncLock"."expiresAt" < (NOW() AT TIME ZONE 'UTC') RETURNING "key"
  `;
  if (!acquired.length) return { status: 'busy' };
  try {
    const previous = await db.cacheEntry.findUnique({
      where: { key: 'seo:monitor' },
      select: { payload: true },
    });
    const previousCount = (previous?.payload as { sitemapCount?: number } | undefined)
      ?.sitemapCount;
    const report = await crawlSeo({
      baseUrl: siteOrigin(),
      maxPages: 24,
      timeoutMs: 8000,
      delayMs: 250,
      previousCount,
    });
    const health = await footballHealth();
    const payload = JSON.parse(JSON.stringify({ ...report, dataHealth: health }));
    const expiresAt = new Date(Date.now() + 2 * 86400000);
    await db.cacheEntry.upsert({
      where: { key: 'seo:monitor' },
      create: { key: 'seo:monitor', payload, expiresAt, staleUntil: expiresAt },
      update: { payload, expiresAt, staleUntil: expiresAt },
      select: { key: true },
    });
    log('SEO_MONITOR_COMPLETED', {
      count: report.errors,
      code:
        health.status === 'fail'
          ? 'DATA_HEALTH_FAILED'
          : health.status === 'warning'
            ? 'DATA_HEALTH_WARNING'
            : report.errors
              ? 'SEO_ERRORS'
              : 'OK',
    });
    return {
      status: report.errors || report.warnings || health.status !== 'pass' ? 'warning' : 'success',
      pages: report.pages.length,
      sitemapCount: report.sitemapCount,
      errors: report.errors,
      warnings: report.warnings,
      dataHealth: health.status,
    };
  } finally {
    await db.syncLock.deleteMany({ where: { key: 'seo-monitor', token } });
  }
});
