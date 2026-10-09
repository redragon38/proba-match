import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { predictionEngine } from '@/prediction-engine';
import type { Prisma } from '@prisma/client';
const mocks = vi.hoisted(() => ({ forecasts: vi.fn(), playerRows: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/database/client', () => ({
  db: {
    prediction: { findMany: mocks.forecasts },
    $queryRaw: mocks.playerRows,
  },
}));
import { getPredictionHistory, getEvaluations } from '@/services/predictions';
import { playerHistory } from '@/services/profile-history';

const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
const target = data.matches.find((m) => m.id === 'demo-0-2')!;
const prediction = predictionEngine.predict(target, data.matches, '2026-09-11T12:00:00Z')!;

describe('Large histories through services with an isolated query adapter', () => {
  beforeEach(() => vi.stubEnv('DATABASE_URL', 'postgresql://fixture-only/unused'));
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });
  it('returns the most recent 100 of 140 snapshots in chronological order and strips private inputs', async () => {
    const descending = Array.from({ length: 140 }, (_, i) => ({
      payload: { ...prediction, id: `snapshot-${139 - i}` },
    }));
    mocks.forecasts.mockImplementation(async (query: { take?: number }) =>
      descending.slice(0, query.take),
    );
    const rows = await getPredictionHistory(target.id, 'api-football');
    expect(rows).toHaveLength(100);
    expect(rows[0].id).toBe('snapshot-40');
    expect(rows.at(-1)?.id).toBe('snapshot-139');
    expect(mocks.forecasts.mock.calls[0][0].orderBy).toEqual([
      { createdAt: 'desc' },
      { id: 'desc' },
    ]);
    expect(prediction.inputArchive).toBeDefined();
    expect(rows.every((p) => p.inputArchive === undefined)).toBe(true);
  });
  it('does not cap 10,002 evaluations before version/period filters and keeps regulation scores', async () => {
    const rows = Array.from({ length: 10002 }, (_, i) => ({
      payload: {
        ...prediction,
        id: `p-${i}`,
        matchId: `match-${Math.floor(i / 2)}`,
        version: i % 2 ? 'v2' : 'v1',
      },
      match: {
        kickoff: new Date('2025-01-01T12:00:00Z'),
        season: { competitionId: 'league' },
        payload: {
          ...target,
          status: 'finished',
          resultPeriod: 'extra-time',
          homeScore: 2,
          awayScore: 1,
          scoreBreakdown: { fulltime: { home: 1, away: 1 } },
        },
      },
    }));
    mocks.forecasts.mockImplementation(async (query: { take?: number }) =>
      query.take ? rows.slice(0, query.take) : rows,
    );
    const result = await getEvaluations();
    expect(result).toHaveLength(10002);
    expect(result.filter((r) => r.prediction.version === 'v2')).toHaveLength(5001);
    expect(new Set(result.map((r) => r.prediction.matchId)).size).toBe(5001);
    expect(result.at(-1)?.homeScore).toBe(1);
    expect(result.at(-1)?.awayScore).toBe(1);
    expect(result.at(-1)?.prediction.inputArchive).toBeUndefined();
  });
  it('retains the prior season after 350 newer observations and obeys the publication cutoff', async () => {
    const make = (id: string, season: number, asOf: Date, goals: number) => ({
      id,
      seasonId: `league-${season}`,
      asOf,
      season: { year: season, competitionId: 'league', competition: { name: 'League' } },
      payload: {
        goals,
        scope: { verified: true, season, competitionId: 'league', teamId: 'team' },
      },
    });
    const records = [
      make('future', 2026, new Date('2026-11-01T00:00:00Z'), 99),
      ...Array.from({ length: 350 }, (_, i) =>
        make(`current-${i}`, 2026, new Date(Date.UTC(2026, 8, 1, 0, 0, -i)), 7),
      ),
      make('previous', 2025, new Date('2025-06-01T00:00:00Z'), 3),
    ];
    mocks.playerRows.mockImplementation(async (query: Prisma.Sql) => {
      const cutoff = query.values.find((value): value is Date => value instanceof Date);
      const latest = new Map<number, (typeof records)[number]>();
      for (const row of records.filter((row) => !cutoff || row.asOf <= cutoff))
        if (!latest.has(row.season.year)) latest.set(row.season.year, row);
      return [...latest.values()].map((row) => ({
        season: row.season.year,
        competition: row.season.competition.name,
        asOf: row.asOf,
        payload: row.payload,
      }));
    });
    const result = await playerHistory('player', '2026-10-06T00:00:00Z');
    expect(result.map((r) => r.season)).toEqual([2026, 2025]);
    expect(result.map((r) => r.stats.goals)).toEqual([7, 3]);
    const query = mocks.playerRows.mock.calls[0][0] as Prisma.Sql;
    expect(query.text).toContain('DISTINCT ON');
    expect(query.text).toContain("ps.\"payload\"->'scope'->>'verified' = 'true'");
    expect(query.values).toContain('player');
    expect(query.values).toContainEqual(new Date('2026-10-06T00:00:00Z'));
  });
});
