import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { footballLease } from '@/services/football/lease-context';
import { createDemoDataset } from '@/services/football/providers/mock';
const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  create: vi.fn(),
  version: vi.fn(),
  predict: vi.fn(),
  prepare: vi.fn(),
  findUnique: vi.fn(),
  insert: vi.fn(),
  inTransaction: false,
  marker: vi.fn(),
  updateMarker: vi.fn(),
  fence: vi.fn(),
  commit: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/database/client', () => {
  const client = {
    prediction: { findMany: mocks.find, findUnique: mocks.findUnique, upsert: vi.fn() },
    predictionResult: { create: mocks.create },
    predictionVersion: { upsert: mocks.version },
    cacheEntry: { findUnique: mocks.marker, update: mocks.updateMarker },
    $queryRaw: mocks.fence,
    $executeRaw: mocks.insert,
  };
  return {
    db: {
      ...client,
      $transaction: async (work: (tx: typeof client) => Promise<void>) => {
        mocks.inTransaction = true;
        try {
          const result = await work(client);
          mocks.commit();
          return result;
        } finally {
          mocks.inTransaction = false;
        }
      },
    },
  };
});
vi.mock('@/prediction-engine', () => ({
  predictionEngine: { predict: mocks.predict, prepare: mocks.prepare },
  MODEL_VERSION: 'test',
  MODEL_PARAMETERS: {},
}));
import { persistPredictions, getEvaluations } from '@/services/predictions';

beforeEach(() => {
  mocks.insert.mockResolvedValue(1);
});

it('prepares the shared corpus once and computes outside publication transactions', async () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const data = createDemoDataset(now);
  data.source = 'openfootball';
  const template = data.matches[0];
  data.matches = ['first', 'second'].map((id) => ({
    ...template,
    id,
    status: 'scheduled',
    kickoff: id === 'first' ? '2026-10-24T18:45:00Z' : '2026-10-23T18:45:00Z',
    kickoffKnown: true,
    lineups: [],
  }));
  mocks.find.mockResolvedValue([]);
  mocks.findUnique.mockResolvedValue(null);
  const forecast = vi.fn((match) => {
    expect(mocks.inTransaction).toBe(false);
    if (match.id === 'first') expect(mocks.commit).toHaveBeenCalledOnce();
    return {
      id: `p-${match.id}`,
      matchId: match.id,
      cutoff: now.toISOString(),
      home: 0.4,
      draw: 0.3,
      away: 0.3,
      confidence: 50,
      inputHash: 'hash',
      lineupConfirmed: false,
    };
  });
  mocks.prepare.mockReturnValue(forecast);
  await persistPredictions(data, now);
  expect(mocks.prepare).toHaveBeenCalledOnce();
  expect(forecast).toHaveBeenCalledTimes(2);
  expect(mocks.predict).not.toHaveBeenCalled();
  expect(mocks.insert).toHaveBeenCalledTimes(2);
});
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
  expect(mocks.insert).toHaveBeenCalledOnce();
  const [sql, ...values] = mocks.insert.mock.calls[0];
  expect(sql.join('?')).toContain('ON CONFLICT ("matchId", "versionId", "kind") DO NOTHING');
  expect(values.slice(0, 4)).toEqual(['projection', 'upcoming', 'test', 'initial']);
  expect(JSON.parse(values.at(-1))).toEqual(mocks.predict.mock.results[0].value);
  expect(mocks.updateMarker.mock.calls[0][0].select).toEqual({ key: true });
  expect(mocks.updateMarker).toHaveBeenCalledOnce();
  expect(mocks.updateMarker.mock.calls[0][0].data.updatedAt.getTime()).toBeGreaterThan(
    now.getTime(),
  );
  mocks.predict.mockClear();
  mocks.insert.mockClear();
  mocks.updateMarker.mockClear();
  mocks.findUnique.mockResolvedValue({ id: 'projection' });
  await persistPredictions(data, now);
  expect(mocks.predict).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
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

it('keeps the first publication committed if the next forecast fails', async () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const data = createDemoDataset(now);
  data.source = 'openfootball';
  data.matches = ['one', 'two'].map((id) => ({
    ...data.matches[0],
    id,
    status: 'scheduled',
    kickoff: '2026-10-23T18:45:00Z',
    kickoffKnown: true,
    lineups: [],
  }));
  mocks.findUnique.mockResolvedValue(null);
  mocks.prepare.mockReturnValue(
    vi
      .fn()
      .mockReturnValueOnce({
        id: 'p-one',
        cutoff: now.toISOString(),
        home: 0.4,
        draw: 0.3,
        away: 0.3,
        confidence: 50,
        inputHash: 'hash',
        inputArchive: { history: ['immutable'] },
      })
      .mockImplementationOnce(() => {
        throw new Error('NEXT_FORECAST_FAILED');
      }),
  );
  await expect(persistPredictions(data, now)).rejects.toThrow('NEXT_FORECAST_FAILED');
  expect(mocks.insert).toHaveBeenCalledOnce();
  expect(mocks.commit).toHaveBeenCalledOnce();
  expect(JSON.parse(mocks.insert.mock.calls[0].at(-1)).inputArchive).toEqual({
    history: ['immutable'],
  });
});

it('rolls back the individual publication when ownership changes after computation', async () => {
  const now = new Date('2026-10-20T12:00:00Z');
  const data = createDemoDataset(now);
  data.source = 'openfootball';
  data.matches = [
    {
      ...data.matches[0],
      status: 'scheduled',
      kickoff: '2026-10-23T18:45:00Z',
      kickoffKnown: true,
      lineups: [],
    },
  ];
  mocks.findUnique.mockResolvedValue(null);
  mocks.predict.mockReturnValue({
    id: 'p',
    cutoff: now.toISOString(),
    home: 0.4,
    draw: 0.3,
    away: 0.3,
    confidence: 50,
    inputHash: 'hash',
  });
  mocks.fence.mockResolvedValue([{ token: 'other', active: true }]);
  await expect(
    footballLease.run({ token: 'current', lost: false }, () => persistPredictions(data, now)),
  ).rejects.toThrow('SYNC_LEASE_LOST');
  expect(mocks.insert).toHaveBeenCalledOnce();
  expect(mocks.commit).not.toHaveBeenCalled();
});

it('inserts serialized archives using PostgreSQL constraints and preserves conflicts', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const { readFile } = await import('node:fs/promises');
  const database = new PGlite();
  const now = new Date();
  const data = createDemoDataset(now);
  data.source = 'openfootball';
  data.matches = [
    {
      ...data.matches[0],
      id: 'future',
      status: 'scheduled',
      kickoff: new Date(+now + 86400000).toISOString(),
      kickoffKnown: true,
      lineups: [],
    },
  ];
  mocks.find.mockResolvedValue([]);
  mocks.findUnique.mockResolvedValue(null);
  const prediction = {
    id: 'p',
    cutoff: now.toISOString(),
    home: 0.4,
    draw: 0.3,
    away: 0.3,
    confidence: 50,
    inputHash: 'hash',
    inputArchive: { history: ["quotes' and $1 remain data"], cutoff: now.toISOString() },
  };
  mocks.predict.mockReturnValue(prediction);
  await persistPredictions(data, now);
  const [strings, ...values] = mocks.insert.mock.calls[0];
  const sql = strings.reduce(
    (text: string, part: string, i: number) => text + (i ? '$' + i : '') + part,
    '',
  );
  try {
    for (const migration of ['202609110001_init', '202609110002_integrity']) {
      await database.exec(
        await readFile('prisma/migrations/' + migration + '/migration.sql', 'utf8'),
      );
    }
    await database.exec(`
      INSERT INTO "Country" (id,name) VALUES ('fr','France');
      INSERT INTO "Competition" (id,slug,name,"countryId") VALUES ('c','ligue','Ligue','fr');
      INSERT INTO "Season" (id,year,"competitionId") VALUES ('s',2026,'c');
      INSERT INTO "Team" (id,slug,name,"countryId") VALUES ('h','home','Home','fr'),('a','away','Away','fr');
      INSERT INTO "Match" (id,slug,"seasonId","homeId","awayId",kickoff,status,source,payload,"updatedAt")
        VALUES ('future','future','s','h','a',NOW()+INTERVAL '1 day','scheduled','api-football','{}',NOW());
      INSERT INTO "PredictionVersion" (id,description,parameters) VALUES ('test','Test','{}');
    `);
    expect((await database.query(sql, values)).affectedRows).toBe(1);
    expect((await database.query(sql, values)).affectedRows).toBe(0);
    expect(
      (await database.query<{ payload: unknown }>('SELECT payload FROM "Prediction"')).rows[0]
        .payload,
    ).toEqual(prediction);
    await expect(database.exec('UPDATE "Prediction" SET confidence=99')).rejects.toThrow(
      'immutable',
    );
    await database.exec(`UPDATE "Match" SET kickoff=NOW()-INTERVAL '1 day'`);
    await expect(database.query(sql, ['late', ...values.slice(1)])).rejects.toThrow(
      'before kickoff',
    );
  } finally {
    await database.close();
  }
}, 30000);
