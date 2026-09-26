import { db } from '@/database/client';
import { openScopes } from './openfootball-sync';
import { secondaryBudget } from './quota';
import { workerHealth } from './worker-health';
import { hasLateOpenResults } from './freshness';
import type { Dataset } from '@/types/football';

/** Read-only readiness: source checks, not empty successful jobs, establish freshness. */
export async function footballHealth(now = Date.now()) {
  if (!process.env.DATABASE_URL)
    return { status: 'fail' as const, issues: ['DATABASE_NOT_CONFIGURED'] };
  const [snapshot, heartbeat, sources, latest, quota] = await Promise.all([
    db.cacheEntry.findUnique({
      where: { key: 'football:dataset' },
      select: { updatedAt: true, payload: true },
    }),
    db.cacheEntry.findUnique({ where: { key: 'football:worker' }, select: { payload: true } }),
    db.dataSource.findMany({
      where: { id: { in: openScopes().map((s) => `openfootball:${s.league}:${s.season}`) } },
      select: { id: true, lastSyncedAt: true },
    }),
    db.syncRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: { provider: true, status: true, startedAt: true, finishedAt: true },
    }),
    db.apiQuota.findUnique({ where: { day: new Date(now).toISOString().slice(0, 10) } }),
  ]);
  const issues: string[] = [];
  const warnings: string[] = [];
  const worker = workerHealth(heartbeat?.payload, now);
  // Hobby cron has a daily cadence and an hour of scheduling tolerance.
  const maxSourceAge = process.env.VERCEL ? 26 * 3600000 : 7 * 3600000;
  if (!snapshot) issues.push('DATASET_MISSING');
  if (hasLateOpenResults(snapshot?.payload as unknown as Dataset | undefined, now))
    warnings.push('OPENFOOTBALL_RESULTS_LATE');
  if (
    sources.length !== openScopes().length ||
    sources.some(
      (s) =>
        !s.lastSyncedAt ||
        now < s.lastSyncedAt.getTime() ||
        now - s.lastSyncedAt.getTime() > maxSourceAge,
    )
  )
    issues.push('OPENFOOTBALL_STALE');
  if (!process.env.VERCEL && worker.state !== 'active') issues.push('WORKER_INACTIVE');
  if (!process.env.VERCEL && worker.status === 'DEGRADED') warnings.push('WORKER_DEGRADED');
  for (const provider of ['openfootball', 'api-football']) {
    const run = latest.find((r) => r.provider === provider);
    if (run && ['partial', 'failed'].includes(run.status)) warnings.push(`${provider}:SYNC_FAILED`);
  }
  const secondaryEnabled = !!process.env.FOOTBALL_API_KEY;
  const remaining = Math.max(0, secondaryBudget() - (quota?.count ?? 0));
  if (!secondaryEnabled) warnings.push('SECONDARY_NOT_CONFIGURED');
  else {
    if (!remaining) warnings.push('SECONDARY_QUOTA_EXHAUSTED');
    const secondaryRun = latest.find((r) => r.provider === 'api-football');
    if (!secondaryRun) warnings.push('SECONDARY_SYNC_MISSING');
    else if (
      now - (secondaryRun.finishedAt ?? secondaryRun.startedAt).getTime() >
      (process.env.VERCEL ? maxSourceAge : 5 * 60000)
    )
      warnings.push('SECONDARY_SYNC_LATE');
  }
  return {
    status: issues.length
      ? ('fail' as const)
      : warnings.length
        ? ('warning' as const)
        : ('pass' as const),
    issues,
    warnings,
    database: 'available',
    datasetUpdatedAt: snapshot?.updatedAt.toISOString() ?? null,
    worker: process.env.VERCEL ? { state: 'external_scheduler' } : worker,
    sources,
    recentRuns: latest,
    secondary: { configured: secondaryEnabled, remaining },
  };
}
