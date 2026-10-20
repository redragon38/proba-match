import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  entry: vi.fn(),
  rows: vi.fn(),
  snapshot: vi.fn(),
  history: vi.fn(),
  ensure: vi.fn(),
  publish: vi.fn(),
  job: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/database/client', () => ({
  db: {
    cacheEntry: { findUnique: mocks.entry },
    match: { findMany: mocks.rows },
  },
}));
vi.mock('@/services/football/local-store', () => ({
  readLocalDataset: mocks.snapshot,
  readLocalHistory: mocks.history,
}));
vi.mock('@/services/football/prediction-history', () => ({
  ensurePredictionHistory: mocks.ensure,
}));
vi.mock('@/services/predictions', () => ({ persistPredictions: mocks.publish }));
vi.mock('@/services/football/jobs', () => ({ footballJob: mocks.job }));
import { GET } from '@/app/api/cron/predictions/route';
import { createDemoDataset } from '@/services/football/providers/mock';

afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});

it('publishes against complete relational history under the shared lease, not the display snapshot', async () => {
  vi.stubEnv('CRON_SECRET', 'isolated-test-secret-at-least-32-characters');
  const data = { ...createDemoDataset(new Date('2026-10-20T12:00:00Z')), source: 'openfootball' };
  const full = data.matches;
  const snapshot = { ...data, matches: [] };
  mocks.ensure.mockResolvedValue({ status: 'ready', requested: 0 });
  mocks.entry.mockResolvedValue({ payload: snapshot });
  mocks.rows.mockResolvedValue([]);
  mocks.snapshot.mockResolvedValue(snapshot);
  mocks.history.mockResolvedValue(full);
  mocks.publish.mockResolvedValue({ eligible: 2, existing: 1, created: 1, unavailable: 0 });
  mocks.job.mockImplementation(async (_name, work) => work());
  const response = await GET(
    new Request('http://localhost/api/cron/predictions', {
      headers: { authorization: 'Bearer isolated-test-secret-at-least-32-characters' },
    }),
  );
  expect(response.status).toBe(200);
  expect(mocks.job).toHaveBeenCalledWith('predictions', expect.any(Function));
  expect(mocks.publish).toHaveBeenCalledWith({ ...snapshot, matches: full });
  expect(await response.json()).toMatchObject({ status: 'success', coverage: { created: 1 } });
});

it('does not import history or publish when cron authentication fails', async () => {
  vi.stubEnv('CRON_SECRET', 'isolated-test-secret-at-least-32-characters');
  const response = await GET(new Request('http://localhost/api/cron/predictions'));
  expect(response.status).toBe(401);
  expect(mocks.ensure).not.toHaveBeenCalled();
  expect(mocks.publish).not.toHaveBeenCalled();
});

it('reports a competing import as busy without publishing or weakening the shared lease', async () => {
  vi.stubEnv('CRON_SECRET', 'isolated-test-secret-at-least-32-characters');
  mocks.ensure.mockRejectedValue(new Error('SYNC_ALREADY_RUNNING'));
  const response = await GET(
    new Request('http://localhost/api/cron/predictions', {
      headers: { authorization: 'Bearer isolated-test-secret-at-least-32-characters' },
    }),
  );
  expect(await response.json()).toEqual({ status: 'busy', reason: 'SYNC_ALREADY_RUNNING' });
  expect(mocks.publish).not.toHaveBeenCalled();
});
