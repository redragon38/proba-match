import { db } from '@/database/client';
import { expandedScopes } from './providers/espn';
import { openScopes } from './openfootball-sync';
import { secondaryBudget } from './quota';
import { workerHealth } from './worker-health';
import { healthSnapshot } from './health-snapshot';
import { cache, datasetCache } from '@/services/cache';
import { telemetrySnapshot, timed } from '@/services/telemetry';

/** Read-only readiness: source checks, not empty successful jobs, establish freshness. */
export async function footballHealth(now = Date.now()) {
  if (!process.env.DATABASE_URL)
    return { status: 'fail' as const, issues: ['DATABASE_NOT_CONFIGURED'] };
  const [snapshot, heartbeat, sources, latest, quota] = await timed('db:health', () =>
    Promise.all([
      healthSnapshot(now),
      db.cacheEntry.findUnique({ where: { key: 'football:worker' }, select: { payload: true } }),
      db.dataSource.findMany({
        where: {
          id: {
            in: [
              ...openScopes().map((s) => `openfootball:${s.league}:${s.season}`),
              ...expandedScopes().map((s) => `espn:${s.league}:${s.season}`),
            ],
          },
        },
        select: { id: true, lastSyncedAt: true },
      }),
      db.syncRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 50,
        select: {
          provider: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          errorCode: true,
          matches: true,
          requests: true,
        },
      }),
      db.apiQuota.findUnique({ where: { day: new Date(now).toISOString().slice(0, 10) } }),
    ]),
  );
  const issues: string[] = [];
  const warnings: string[] = [];
  const datasetStats = datasetCache.stats();
  if (datasetStats.requests >= 50 && datasetStats.hitRate != null && datasetStats.hitRate < 0.5)
    warnings.push('DATASET_CACHE_LOW_HIT_RATE');
  const telemetry = telemetrySnapshot();
  for (const [operation, metrics] of Object.entries(telemetry.operations)) {
    if (metrics.errors && operation.startsWith('/api/'))
      warnings.push(`SERVER_ERRORS:${operation}`);
    if (metrics.count >= 5 && metrics.p95Ms != null && metrics.p95Ms > 1000)
      warnings.push(`SLOW_OPERATION:${operation}`);
  }
  const worker = workerHealth(heartbeat?.payload, now);
  // Hobby cron has a daily cadence and an hour of scheduling tolerance.
  const maxSourceAge = process.env.VERCEL ? 26 * 3600000 : 7 * 3600000;
  if (!snapshot) issues.push('DATASET_MISSING');
  if (snapshot?.lateResults)
    warnings.push('OPENFOOTBALL_RESULTS_LATE');
  if (
    sources.filter((s) => s.id.startsWith('openfootball:')).length !== openScopes().length ||
    sources
      .filter((s) => s.id.startsWith('openfootball:'))
      .some(
        (s) =>
          !s.lastSyncedAt ||
          now < s.lastSyncedAt.getTime() ||
          now - s.lastSyncedAt.getTime() > maxSourceAge,
      )
  )
    issues.push('OPENFOOTBALL_STALE');
  const expanded = sources.filter((s) => s.id.startsWith('espn:'));
  if (
    expanded.length !== expandedScopes().length ||
    expanded.some(
      (s) =>
        !s.lastSyncedAt ||
        now < s.lastSyncedAt.getTime() ||
        now - s.lastSyncedAt.getTime() > maxSourceAge,
    )
  )
    issues.push('ESPN_STALE');
  if (!process.env.VERCEL && worker.state !== 'active') issues.push('WORKER_INACTIVE');
  if (!process.env.VERCEL && worker.status === 'DEGRADED') warnings.push('WORKER_DEGRADED');
  const providers = ['openfootball', 'api-football', 'espn', 'espn-players', 'thesportsdb'];
  const providerStatus = Object.fromEntries(
    providers.map((provider) => {
      const runs = latest.filter((r) => r.provider === provider && r.status !== 'running');
      let consecutiveFailures = 0;
      for (const run of runs) {
        if (!['partial', 'failed'].includes(run.status)) break;
        consecutiveFailures++;
      }
      if (consecutiveFailures >= 3) issues.push(`${provider}:REPEATED_SYNC_FAILURE`);
      const last = runs[0];
      const success = runs.find((r) => r.status === 'success');
      const failure = runs.find((r) => ['partial', 'failed'].includes(r.status));
      return [
        provider,
        {
          lastSync: last?.finishedAt ?? last?.startedAt ?? null,
          lastSuccessfulSync: success?.finishedAt ?? success?.startedAt ?? null,
          lastError: failure
            ? {
                at: failure.finishedAt ?? failure.startedAt,
                code: failure.errorCode ?? 'PARTIAL_SYNC',
              }
            : null,
          durationMs: last?.finishedAt
            ? last.finishedAt.getTime() - last.startedAt.getTime()
            : null,
          importedElements: last?.matches ?? null,
          requests: last?.requests ?? null,
          consecutiveFailures,
          historyScope: 'latest_50_jobs_all_providers',
        },
      ];
    }),
  );
  for (const provider of providers) {
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
    providerStatus,
    thresholds: { sourceMaxAgeMs: maxSourceAge, repeatedFailures: 3, slowOperationMs: 1000 },
    dataFreshness: sources.map((s) => ({
      source: s.id,
      updatedAt: s.lastSyncedAt,
      ageMs: s.lastSyncedAt ? Math.max(0, now - s.lastSyncedAt.getTime()) : null,
    })),
    cache: cache.stats(),
    telemetry,
    datasetUpdatedAt: snapshot?.updatedAt.toISOString() ?? null,
    worker: process.env.VERCEL ? { state: 'external_scheduler' } : worker,
    sources,
    recentRuns: latest,
    secondary: { configured: secondaryEnabled, remaining },
  };
}
