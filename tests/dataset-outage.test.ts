import { afterEach, expect, it, vi } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
const mocks = vi.hoisted(() => ({ marker: vi.fn(), read: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/database/client', () => ({ db: { cacheEntry: { findUnique: mocks.marker } } }));
vi.mock('@/services/football/local-store', () => ({
  readLocalDataset: mocks.read,
  emptyDataset: vi.fn(),
}));
vi.mock('@/services/cache', () => {
  const cache = { get: async (_key: string, work: () => Promise<unknown>) => work() };
  return { cache, datasetCache: cache };
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

it('reports an outage rather than inventing an empty catalogue on a cold process', async () => {
  vi.resetModules();
  vi.stubEnv('DATABASE_URL', 'postgresql://fixture-only/unused');
  mocks.marker.mockRejectedValue(new Error('private database detail'));
  const { getDataset } = await import('@/services/football');
  await expect(getDataset()).rejects.toThrow('FOOTBALL_TEMPORARILY_UNAVAILABLE');
});
it('keeps the last successful dataset readable during an outage', async () => {
  vi.resetModules();
  vi.stubEnv('DATABASE_URL', 'postgresql://fixture-only/unused');
  const data = createDemoDataset();
  data.source = 'openfootball';
  mocks.marker
    .mockResolvedValueOnce({ updatedAt: new Date(), expiresAt: new Date(Date.now() + 3600000) })
    .mockRejectedValueOnce(new Error('connection failed'));
  mocks.read.mockResolvedValue(data);
  const { getDataset } = await import('@/services/football');
  await getDataset();
  const fallback = await getDataset();
  expect(fallback.matches).toEqual(data.matches);
  expect(fallback.degraded).toBe(true);
  expect(fallback.warning).toContain('La base est temporairement indisponible');
});

it('does not report missing entities when the database has no published snapshot', async () => {
  vi.resetModules();
  vi.stubEnv('DATABASE_URL', 'postgresql://fixture-only/unused');
  mocks.marker.mockResolvedValue(null);
  mocks.read.mockResolvedValue({ ...createDemoDataset(), matches: [], teams: [] });
  const { getDataset } = await import('@/services/football');
  await expect(getDataset()).rejects.toThrow('FOOTBALL_TEMPORARILY_UNAVAILABLE');
});

it('preserves public URLs and sitemap eligibility when a published snapshot disappears', async () => {
  vi.resetModules();
  vi.stubEnv('DATABASE_URL', 'postgresql://fixture-only/unused');
  const data = createDemoDataset();
  data.source = 'openfootball';
  mocks.marker
    .mockResolvedValueOnce({ updatedAt: new Date(), expiresAt: new Date(Date.now() + 3600000) })
    .mockResolvedValueOnce(null);
  mocks.read
    .mockResolvedValueOnce(data)
    .mockResolvedValueOnce({ ...data, matches: [], teams: [], players: [], competitions: [] });
  const { getDataset } = await import('@/services/football');
  const { indexablePaths } = await import('@/lib/seo');
  const original = await getDataset();
  const fallback = await getDataset();
  expect(fallback.degraded).toBe(true);
  expect(fallback.matches).toEqual(original.matches);
  expect(fallback.teams).toEqual(original.teams);
  expect(indexablePaths(fallback)).toEqual(indexablePaths(original));
});
