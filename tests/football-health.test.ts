import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  sources: vi.fn(),
  runs: vi.fn(),
  quota: vi.fn(),
  readiness: vi.fn(),
}));
vi.mock('@/database/client', () => ({
  db: {
    $queryRaw: mocks.readiness,
    cacheEntry: { findUnique: mocks.snapshot },
    dataSource: { findMany: mocks.sources },
    syncRun: { findMany: mocks.runs },
    apiQuota: { findUnique: mocks.quota },
  },
}));
vi.mock('@/services/football/openfootball-sync', () => ({
  openScopes: () => [{ league: 'fr.1', season: 2026 }],
}));
vi.mock('@/services/football/providers/espn', () => ({
  expandedScopes: () => [{ league: 'por.1', season: 2026 }],
}));
import { footballHealth } from '@/services/football/health';
import { GET } from '@/app/api/health/route';
const now = Date.now();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('DATABASE_URL', 'test');
  vi.stubEnv('VERCEL', '');
  vi.stubEnv('FOOTBALL_API_KEY', '');
  vi.stubEnv('CRON_SECRET', 'a'.repeat(32));
  mocks.snapshot.mockImplementation(async ({ where }: { where: { key: string } }) =>
    where.key === 'football:dataset'
      ? { updatedAt: new Date(now) }
      : {
          payload: {
            checkedAt: new Date(now).toISOString(),
            nextOpen: new Date(now).toISOString(),
            secondaryStatus: 'disabled',
          },
        },
  );
  mocks.sources.mockResolvedValue([
    { id: 'openfootball:fr.1:2026', lastSyncedAt: new Date(now) },
    { id: 'espn:por.1:2026', lastSyncedAt: new Date(now) },
  ]);
  mocks.runs.mockResolvedValue([]);
  mocks.quota.mockResolvedValue(null);
  mocks.readiness.mockResolvedValue([{ updatedAt: new Date(now), lateResults: false }]);
});
afterEach(() => vi.unstubAllEnvs());
describe('Operational readiness', () => {
  it('escalates repeated provider failures and exposes bounded, non-sensitive job details', async () => {
    mocks.runs.mockResolvedValue(
      Array.from({ length: 3 }, () => ({
        provider: 'espn',
        status: 'failed',
        startedAt: new Date(now - 1000),
        finishedAt: new Date(now),
        matches: 0,
        requests: 1,
        errorCode: 'ESPN_HTTP_503',
      })),
    );
    expect(await footballHealth(now)).toMatchObject({
      status: 'fail',
      issues: ['espn:REPEATED_SYNC_FAILURE'],
      providerStatus: {
        espn: { consecutiveFailures: 3, durationMs: 1000, lastError: { code: 'ESPN_HTTP_503' } },
      },
    });
  });
  it('does not query the database without authentication', async () => {
    const response = await GET(new Request('http://localhost/api/health'));
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.snapshot).not.toHaveBeenCalled();
    expect(mocks.readiness).not.toHaveBeenCalled();
  });
  it('signals unavailable live coverage without claiming the source is broken', async () => {
    expect(await footballHealth(now)).toMatchObject({
      status: 'warning',
      warnings: ['SECONDARY_NOT_CONFIGURED'],
      issues: [],
    });
  });
  it('does not hide stale sources behind a recent no-op job', async () => {
    mocks.sources.mockResolvedValue([
      { id: 'openfootball:fr.1:2026', lastSyncedAt: new Date(now - 8 * 3600000) },
      { id: 'espn:por.1:2026', lastSyncedAt: new Date(now) },
    ]);
    mocks.runs.mockResolvedValue([
      { provider: 'openfootball', status: 'success', startedAt: new Date(now) },
    ]);
    expect(await footballHealth(now)).toMatchObject({
      status: 'fail',
      issues: ['OPENFOOTBALL_STALE'],
    });
  });
  it('warns when a freshly fetched source still lacks past results', async () => {
    mocks.readiness.mockResolvedValue([{ updatedAt: new Date(now), lateResults: true }]);
    mocks.snapshot.mockImplementation(async ({ where }: { where: { key: string } }) =>
      where.key === 'football:dataset'
        ? {
            updatedAt: new Date(now),
            payload: {
              source: 'openfootball',
              matches: [
                {
                  source: 'openfootball',
                  status: 'scheduled',
                  kickoffKnown: true,
                  kickoff: new Date(now - 7 * 3600000).toISOString(),
                },
              ],
            },
          }
        : {
            payload: {
              checkedAt: new Date(now).toISOString(),
              nextOpen: new Date(now).toISOString(),
              secondaryStatus: 'disabled',
            },
          },
    );
    expect(await footballHealth(now)).toMatchObject({
      status: 'warning',
      issues: [],
      warnings: ['OPENFOOTBALL_RESULTS_LATE', 'SECONDARY_NOT_CONFIGURED'],
    });
    expect(mocks.snapshot).toHaveBeenCalledTimes(1);
  });
  it('allows the documented daily Vercel cadence without requiring a local worker', async () => {
    vi.stubEnv('VERCEL', '1');
    mocks.snapshot.mockResolvedValue({ updatedAt: new Date(now) });
    mocks.sources.mockResolvedValue([
      { id: 'openfootball:fr.1:2026', lastSyncedAt: new Date(now - 25 * 3600000) },
      { id: 'espn:por.1:2026', lastSyncedAt: new Date(now - 25 * 3600000) },
    ]);
    expect(await footballHealth(now)).toMatchObject({ status: 'warning', issues: [] });
  });
  it('reports quota exhaustion and refuses database errors without leaking details', async () => {
    vi.stubEnv('FOOTBALL_API_KEY', 'test-only');
    mocks.quota.mockResolvedValue({ count: 1000 });
    mocks.runs.mockResolvedValue([
      {
        provider: 'api-football',
        status: 'success',
        startedAt: new Date(now),
        finishedAt: new Date(now),
      },
    ]);
    expect(await footballHealth(now)).toMatchObject({ warnings: ['SECONDARY_QUOTA_EXHAUSTED'] });
    mocks.snapshot.mockRejectedValue(new Error('secret database connection'));
    const response = await GET(
      new Request('http://localhost/api/health', {
        headers: { Authorization: `Bearer ${'a'.repeat(32)}` },
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('secret');
  });
});
