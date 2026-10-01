import { afterEach, expect, it, vi } from 'vitest';
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
}));
vi.mock('server-only', () => ({}));
vi.mock('@/database/client', () => ({
  db: {
    prediction: { findMany: mocks.find, findUnique: mocks.findUnique, upsert: mocks.upsert },
    predictionResult: { create: mocks.create },
    predictionVersion: { upsert: mocks.version },
    cacheEntry: { findUnique: mocks.marker, update: mocks.updateMarker },
  },
}));
vi.mock('@/prediction-engine', () => ({
  predictionEngine: { predict: mocks.predict },
  MODEL_VERSION: 'test',
  MODEL_PARAMETERS: {},
}));
import { persistPredictions } from '@/services/predictions';
afterEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
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
  data.matches = [{
    ...data.matches[0], id: 'upcoming', status: 'scheduled',
    kickoff: '2026-10-11T18:45:00Z', kickoffKnown: true, lineups: [],
  }];
  mocks.find.mockResolvedValue([]);
  mocks.findUnique.mockResolvedValue(null);
  mocks.predict.mockReturnValue({
    id: 'projection', matchId: 'upcoming', cutoff: now.toISOString(),
    home: .4, draw: .3, away: .3, confidence: 50, inputHash: 'hash', lineupConfirmed: false,
  });
  mocks.marker.mockResolvedValue({ updatedAt: now });
  await persistPredictions(data, now);
  expect(mocks.predict).toHaveBeenCalledOnce();
  expect(mocks.upsert).toHaveBeenCalledOnce();
  expect(mocks.upsert.mock.calls[0][0].create).toMatchObject({matchId: 'upcoming', kind: 'initial'});
  expect(mocks.updateMarker).toHaveBeenCalledOnce();
  expect(mocks.updateMarker.mock.calls[0][0].data.updatedAt.getTime()).toBeGreaterThan(now.getTime());
  mocks.predict.mockClear();
  mocks.upsert.mockClear();
  mocks.updateMarker.mockClear();
  mocks.findUnique.mockResolvedValue({id: 'projection'});
  await persistPredictions(data, now);
  expect(mocks.predict).not.toHaveBeenCalled();
  expect(mocks.upsert).not.toHaveBeenCalled();
  expect(mocks.updateMarker).not.toHaveBeenCalled();
});
