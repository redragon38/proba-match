import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ now: 0, marker: vi.fn(), load: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/database/client', () => ({ db: { cacheEntry: { findUnique: state.marker } } }));
vi.mock('@/services/football/local-store', () => ({
  readLocalDataset: state.load,
  emptyDataset: () => ({ matches: [] }),
}));
vi.mock('@/services/cache', async (original) => {
  const actual = await original<typeof import('@/services/cache')>();
  return {
    ...actual,
    cache: new actual.MemoryCache(100, () => state.now),
    datasetCache: new actual.MemoryCache(2, () => state.now),
  };
});

import { getDataset } from '@/services/football';
import { cache, datasetCache } from '@/services/cache';
const dataset = (revision: string) => ({
  source: 'openfootball', revision, updatedAt: '2026-10-21T12:00:00Z',
  competitions: [], teams: [], matches: [], players: [], injuries: [], standings: {},
});
beforeEach(() => {
  vi.stubEnv('DATABASE_URL', 'postgresql://isolated-test.invalid/test');
  cache.clear(); datasetCache.clear(); state.marker.mockReset(); state.load.mockReset(); state.now = 0;
});
afterEach(() => vi.unstubAllEnvs());

it('awaits the current revision even immediately after publication and coalesces concurrent refreshes', async () => {
  const first = new Date('2026-10-21T12:00:00Z');
  const second = new Date('2026-10-21T12:01:00Z');
  const expiresAt = new Date('2099-01-01');
  state.marker.mockResolvedValue({ updatedAt: first, expiresAt });
  state.load.mockResolvedValue(dataset('first'));
  expect((await getDataset()).revision).toBe('first');
  state.now = 1;
  let release!: (value: { updatedAt: Date; expiresAt: Date }) => void;
  state.marker.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
  state.load.mockResolvedValue(dataset('second'));
  let settled = false;
  const pending = getDataset().then((value) => { settled = true; return value; });
  const concurrent = getDataset();
  await new Promise((resolve) => setImmediate(resolve));
  expect(settled).toBe(false);
  expect(state.marker).toHaveBeenCalledTimes(2);
  release({ updatedAt: second, expiresAt });
  expect((await pending).revision).toBe('second');
  expect((await concurrent).revision).toBe('second');
  expect(state.load).toHaveBeenCalledTimes(2);
});

it('keeps the last snapshot explicitly degraded when the fresh revision lookup fails', async () => {
  state.marker.mockResolvedValue({ updatedAt: new Date('2026-10-21T12:00:00Z'), expiresAt: new Date('2099-01-01') });
  state.load.mockResolvedValue(dataset('preserved'));
  await getDataset();
  state.now = 1;
  state.marker.mockRejectedValue(new Error('database offline'));
  const result = await getDataset();
  expect(result.revision).toBe('preserved');
  expect(result.degraded).toBe(true);
  expect(result.warning).toContain('La base est temporairement indisponible');
  expect(state.load).toHaveBeenCalledTimes(1);
});
