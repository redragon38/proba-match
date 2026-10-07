import { afterEach, expect, it, vi } from 'vitest';
import { footballLease } from '@/services/football/lease-context';
import { createDemoDataset } from '@/services/football/providers/mock';
const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  create: vi.fn(),
  version: vi.fn(),
  predict: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  marker: vi.fn(),
  updateMarker: vi.fn(),
  fence: vi.fn(),
  commit: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/database/client', () => {
  const client = {
    prediction: { findMany: mocks.find, findUnique: mocks.findUnique, upsert: mocks.upsert },
    predictionResult: { create: mocks.create },
    predictionVersion: { upsert: mocks.version },
    cacheEntry: { findUnique: mocks.marker, update: mocks.updateMarker },
    $queryRaw: mocks.fence,
  };
  return {
    db: {
      ...client,
      $transaction: async (work: (tx: typeof client) => Promise<void>) => {
        await work(client);
        mocks.commit();
      },
    },
  };
});
vi.mock('@/prediction-engine', () => ({
  predictionEngine: { predict: mocks.predict },
  MODEL_VERSION: 'test',
  MODEL_PARAMETERS: {},
}));
import { persistPredictions, getEvaluations } from '@/services/predictions';
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
it('evaluates immutable forecasts using corrected results and excludes abandoned matches', async () => {
  vi.stubEnv('DATABASE_URL', 'test');
  const row = {
    payload: { home: 0.6, draw: 0.2, away: 0.2 },
    result: { homeScore: 1, awayScore: 0 },
    match: {
      status: 'finished',
      homeScore: 0,
      awayScore: 2,
      kickoff: new Date('2026-09-10T12:00:00Z'),
      season: { competitionId: 'league' },
      payload: { status: 'finished', homeScore: 0, awayScore: 2, resultPeriod: 'regulation' },
    },
  };
  mocks.find.mockResolvedValue([
    row,
    {
      ...row,
      match: {
        ...row.match,
        status: 'abandoned',
        payload: { ...row.match.payload, status: 'abandoned' },
      },
    },
  ]);
  const rows = await getEvaluations();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ homeScore: 0, awayScore: 2 });
  expect(rows[0].prediction).toEqual(row.payload);
});
it('evaluates pending predictions against their own final scores without historical N+1 reads', async () => {
  vi.stubEnv('DATABASE_URL', 'test');
  const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
  data.source = 'openfootball';
  const template = data.matches[0];
  data.matches = Array.from({ length: 200 }, (_, i) => ({
    ...template,
    id: `finished-${i}`,
    status: 'finished' as const,
    homeScore: i === 0 ? 1 : 0,
    awayScore: i === 0 ? 0 : 2,
  }));
  const payload = { home: 0.6, draw: 0.2, away: 0.2 };
  mocks.find
    .mockResolvedValueOnce([
      { id: 'home-prediction', matchId: 'finished-0', payload },
      { id: 'away-prediction', matchId: 'finished-1', payload },
    ])
    .mockResolvedValueOnce([]);
  await persistPredictions(data);
  expect(mocks.find).toHaveBeenCalledTimes(2); // pending batch plus aggregate evaluation history
  expect(mocks.find.mock.calls[0][0].where.matchId.in).toHaveLength(200);
  expect(mocks.create).toHaveBeenCalledTimes(2);
  expect(mocks.create.mock.calls[0][0].data).toMatchObject({
    id: 'home-prediction',
    homeScore: 1,
    awayScore: 0,
  });
  expect(mocks.create.mock.calls[1][0].data).toMatchObject({
    id: 'away-prediction',
    homeScore: 0,
    awayScore: 2,
  });
  expect(mocks.predict).not.toHaveBeenCalled();
});
it('archives a real pre-match projection 15 days ahead during background sync', async () => {
  vi.stubEnv('DATABASE_URL', 'test');
  const now = new Date('2026-09-26T12:00:00Z');
  const data = createDemoDataset(now);
  data.source = 'openfootball';
  data.matches = [
    {
      ...data.matches[0],
      id: 'upcoming',
      status: 'scheduled',
      kickoff: '2026-10-11T18:45:00Z',
      kickoffKnown: true,
      lineups: [],
    },
  ];
  mocks.find.mockResolvedValue([]);
  mocks.findUnique.mockResolvedValue(null);
  mocks.predict.mockReturnValue({
    id: 'projection',
    matchId: 'upcoming',
    cutoff: now.toISOString(),
    home: 0.4,
    draw: 0.3,
    away: 0.3,
    confidence: 50,
    inputHash: 'hash',
    lineupConfirmed: false,
  });
  mocks.marker.mockResolvedValue({ updatedAt: now });
  await persistPredictions(data, now);
  expect(mocks.predict).toHaveBeenCalledOnce();
  expect(mocks.upsert).toHaveBeenCalledOnce();
  expect(mocks.upsert.mock.calls[0][0].create).toMatchObject({
    matchId: 'upcoming',
    kind: 'initial',
  });
  expect(mocks.updateMarker).toHaveBeenCalledOnce();
  expect(mocks.updateMarker.mock.calls[0][0].data.updatedAt.getTime()).toBeGreaterThan(
    now.getTime(),
  );
  mocks.predict.mockClear();
  mocks.upsert.mockClear();
  mocks.updateMarker.mockClear();
  mocks.findUnique.mockResolvedValue({ id: 'projection' });
  await persistPredictions(data, now);
  expect(mocks.predict).not.toHaveBeenCalled();
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(mocks.updateMarker).not.toHaveBeenCalled();
});

it.each([
  { token: 'other', active: true },
  { token: 'current', active: false },
])('does not commit forecast publication with a replaced or expired lease: %j', async (lease) => {
  vi.stubEnv('DATABASE_URL', 'test');
  const data = {
    ...createDemoDataset(new Date('2026-09-11T12:00:00Z')),
    source: 'openfootball' as const,
    matches: [],
  };
  mocks.find.mockResolvedValue([]);
  mocks.fence.mockResolvedValue([lease]);
  await expect(
    footballLease.run({ token: 'current', lost: false }, () => persistPredictions(data)),
  ).rejects.toThrow('SYNC_LEASE_LOST');
  expect(mocks.fence).toHaveBeenCalledOnce();
  expect(mocks.commit).not.toHaveBeenCalled();
});
