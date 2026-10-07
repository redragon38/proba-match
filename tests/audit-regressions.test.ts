import { describe, it, expect } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { regulationResult } from '@/prediction-engine/result-period';
import { observeResult, resultAt, resultAvailable } from '@/prediction-engine/availability';
import { eloHistory } from '@/prediction-engine/elo';
import { PredictionEngine } from '@/prediction-engine';
import { mergeDetailRevisions } from '@/services/football/detail-revisions';
import { selectLiveMatches } from '@/services/football/live-selection';
import { comparisonView, commonComparisonPeriod } from '@/services/football/read-model';
import { competitionView } from '@/services/competition-view';
import { compareEventTime, eventMinute } from '@/lib/event-time';
import {
  footballLease,
  assertJobActive,
  fencePublication,
} from '@/services/football/lease-context';
import type { Prisma } from '@prisma/client';
const now = '2026-09-11T12:00:00Z';
const data = createDemoDataset(new Date(now));
const target = data.matches.find((m) => m.id === 'demo-0-2')!;
const base = {
  ...data.matches.find((m) => m.status === 'finished')!,
  source: 'api-football' as const,
  resultPeriod: 'regulation' as const,
  kickoff: '2026-01-01T12:00:00Z',
  homeScore: 1,
  awayScore: 0,
};
describe('Audit: regulation and point-in-time observations', () => {
  it('evaluates a 1–1 regulation draw despite a 2–1 extra-time final', () => {
    const final = {
      ...base,
      homeScore: 2,
      awayScore: 1,
      resultPeriod: 'extra-time' as const,
      scoreBreakdown: { fulltime: { home: 1, away: 1 }, extratime: { home: 2, away: 1 } },
    };
    expect(regulationResult(final)).toMatchObject({ homeScore: 1, awayScore: 1 });
    expect(regulationResult({ ...final, scoreBreakdown: undefined })).toBeNull();
    expect(regulationResult({ ...base, resultPeriod: undefined })).toBeNull();
  });
  it('does not count penalty shootout goals as regulation goals', () => {
    expect(
      regulationResult({
        ...base,
        resultPeriod: 'penalties',
        scoreBreakdown: { fulltime: { home: 0, away: 0 }, penalty: { home: 5, away: 4 } },
      }),
    ).toMatchObject({ homeScore: 0, awayScore: 0 });
  });
  it('retains the old score before a correction and the corrected score afterwards', () => {
    const first = observeResult(base, undefined, '2026-01-01T15:00:00Z');
    const revised = observeResult(
      { ...first, homeScore: 0, awayScore: 1 },
      first,
      '2026-01-03T12:00:00Z',
    );
    expect(revised.resultRevisions).toHaveLength(2);
    expect(resultAt(revised, '2026-01-02T12:00:00Z')).toMatchObject({ homeScore: 1, awayScore: 0 });
    expect(resultAvailable(revised, '2026-01-02T12:00:00Z')).toBe(true);
    expect(resultAt(revised, '2026-01-04T12:00:00Z')).toMatchObject({ homeScore: 0, awayScore: 1 });
  });
  it('a withdrawal does not revive an older final and retries do not add duplicate observations', () => {
    const first = observeResult(base, undefined, '2026-01-01T15:00:00Z');
    const retry = observeResult(first, first, '2026-01-02T12:00:00Z');
    expect(retry.resultRevisions).toHaveLength(1);
    const withdrawn = observeResult(
      { ...first, status: 'abandoned' },
      first,
      '2026-01-03T12:00:00Z',
    );
    expect(resultAvailable(withdrawn, '2026-01-04T12:00:00Z')).toBe(false);
    expect(resultAvailable(withdrawn, '2026-01-02T12:00:00Z')).toBe(true);
  });
  it('a result received on Jan 3 cannot change Elo known before Jan 2', () => {
    const delayed = { ...base, id: 'delayed', resultObservedAt: '2026-01-03T12:00:00Z' };
    const next = {
      ...base,
      id: 'next',
      kickoff: '2026-01-02T12:00:00Z',
      resultObservedAt: '2026-01-02T15:00:00Z',
    };
    const replay = eloHistory([delayed, next], '2026-01-04T12:00:00Z');
    expect(
      replay.history.find((r) => r.matchId === 'next' && r.teamId === base.homeId)?.before,
    ).toBe(1500);
    expect(eloHistory([next, delayed], '2026-01-04T12:00:00Z')).toEqual(replay);
  });
  it('reproduces a prediction entirely from its immutable input package', () => {
    const engine = new PredictionEngine();
    const original = engine.predict(target, data.matches, now)!;
    expect(original.inputArchive).toBeDefined();
    const archive = JSON.parse(JSON.stringify(original.inputArchive)) as NonNullable<
      typeof original.inputArchive
    >;
    expect(engine.predict(archive.target, archive.matches, archive.cutoff)).toEqual(original);
  });
  it('refuses five raw matches when four have negligible temporal weight', () => {
    const histories = [target.homeId, target.awayId].flatMap((id, team) =>
      Array.from({ length: 5 }, (_, i) => ({
        ...base,
        source: 'demo' as const,
        id: `sample-${team}-${i}`,
        homeId: id,
        awayId: `opponent-${team}-${i}`,
        kickoff: i === 0 ? '2026-09-10T12:00:00Z' : '2020-01-01T12:00:00Z',
        resultObservedAt: undefined,
      })),
    );
    expect(new PredictionEngine().predict(target, histories, now)).toBeNull();
  });
  it('removes the Elo home bonus on a confirmed neutral field', () => {
    const normal = eloHistory(
      [{ ...base, resultObservedAt: '2026-01-01T15:00:00Z', homeScore: 0, awayScore: 0 }],
      '2026-01-02T00:00:00Z',
    );
    const neutral = eloHistory(
      [
        {
          ...base,
          resultObservedAt: '2026-01-01T15:00:00Z',
          homeScore: 0,
          awayScore: 0,
          neutralVenue: true,
        },
      ],
      '2026-01-02T00:00:00Z',
    );
    expect(neutral.ratings.get(base.homeId)).toBe(1500);
    expect(normal.ratings.get(base.homeId)).not.toBe(1500);
  });
});
describe('Audit: scopes, detail fallback and notifications', () => {
  it('does not migrate a player total to another team, league or season', () => {
    const c = data.competitions[0],
      m = data.matches.find((m) => m.competitionId === c.id)!;
    const p = data.players.find((p) => p.teamId === m.homeId)!;
    const scoped = {
      ...p,
      stats: { ...p.stats, goals: 2 },
      statsScope: {
        competitionId: c.id,
        season: c.season,
        teamId: p.teamId,
        source: 'api-football',
        observedAt: now,
        type: 'season' as const,
        verified: true,
      },
    };
    const real = { ...data, source: 'api-football' as const, players: [scoped] };
    expect(competitionView(real, c).scorers).toHaveLength(1);
    for (const statsScope of [
      { ...scoped.statsScope, season: c.season - 1 },
      { ...scoped.statsScope, competitionId: 'other' },
      { ...scoped.statsScope, teamId: 'old-team' },
      undefined,
    ])
      expect(
        competitionView({ ...real, players: [{ ...scoped, statsScope }] }, c).scorers,
      ).toHaveLength(0);
  });
  it('preserves missing detail timestamp but clears explicit empty details', () => {
    const old = {
      ...base,
      statistics: [{ label: 'Tirs', home: 2, away: 1 }],
      detailObservedAt: { statistics: '2026-01-01T15:00:00Z' },
      detailSource: { statistics: 'espn' as const },
    };
    const missing = mergeDetailRevisions(old, {
      ...base,
      updatedAt: now,
      statistics: [],
      detailPresence: { statistics: false },
    });
    expect(missing.statistics).toEqual(old.statistics);
    expect(missing.detailObservedAt?.statistics).toBe(old.detailObservedAt.statistics);
    expect(missing.detailFallback).toContain('statistics');
    expect(missing.detailSource?.statistics).toBe('espn');
    expect(
      comparisonView({ ...data, matches: [missing] })[missing.homeId].coverage.Tirs.sources,
    ).toEqual(['espn']);
    const cleared = mergeDetailRevisions(old, {
      ...base,
      updatedAt: now,
      statistics: [],
      detailPresence: { statistics: true },
    });
    expect(cleared.statistics).toEqual([]);
    expect(cleared.detailObservedAt?.statistics).toBe(now);
    expect(cleared.detailSource?.statistics).toBe('api-football');
  });
  it('keeps a favorite beyond the first 100 matches', () => {
    const matches = Array.from({ length: 150 }, (_, i) => ({ ...target, id: `m-${i}` }));
    const selected = selectLiveMatches(
      matches,
      new URLSearchParams({ favorites: 'match:m-149' }),
      Date.parse(now),
    );
    expect(selected.matches.map((m) => m.id)).toEqual(['m-149']);
    expect(selected.truncated).toBe(false);
  });
  it('reports truncation for a non-targeted feed', () => {
    const matches = Array.from({ length: 150 }, (_, i) => ({
      ...target,
      id: `m-${i}`,
      kickoff: now,
    }));
    expect(selectLiveMatches(matches, new URLSearchParams(), Date.parse(now))).toMatchObject({
      truncated: true,
      total: 150,
    });
  });
  it('formats and orders added time within its football period', () => {
    expect(eventMinute({ minute: 45, extra: 3 })).toBe('45+3');
    expect(compareEventTime({ minute: 45, extra: 1 }, { minute: 45, extra: 3 })).toBeLessThan(0);
    expect(compareEventTime({ minute: 45, extra: 10 }, { minute: 46 })).toBeLessThan(0);
  });
});
describe('Audit: lost lease prevents publication', () => {
  it('fails closed after an unsuccessful heartbeat', () => {
    footballLease.run({ token: 'old', lost: true }, () =>
      expect(assertJobActive).toThrow('SYNC_LEASE_LOST'),
    );
  });
  it.each([
    { token: 'other', active: true },
    { token: 'old', active: false },
  ])('refuses an expired or replaced lease', async (row) => {
    await footballLease.run({ token: 'old', lost: false }, async () => {
      const tx = { $queryRaw: async () => [row] } as unknown as Prisma.TransactionClient;
      await expect(fencePublication(tx)).rejects.toThrow('SYNC_LEASE_LOST');
    });
  });
});

describe('Audit: comparable team periods and metric provenance', () => {
  it('limits both teams to the actual common interval, with individual denominators and sources', () => {
    const teams = data.teams.slice(0, 2);
    const make = (id: string, team: string, date: string, shots: number) => ({
      ...base,
      id,
      homeId: team,
      awayId: 'opponent',
      kickoff: date,
      statistics: [{ label: 'Tirs', home: shots, away: 1, unit: '' }],
      provenance: { schedule: 'openfootball' as const, details: 'api-football' as const },
    });
    const scoped = {
      ...data,
      teams,
      matches: [
        make('a-old', teams[0].id, '2025-01-01T12:00:00Z', 99),
        make('a-new', teams[0].id, '2025-03-01T12:00:00Z', 4),
        make('b-start', teams[1].id, '2025-02-01T12:00:00Z', 6),
        make('b-end', teams[1].id, '2025-04-01T12:00:00Z', 99),
      ],
    };
    const common = commonComparisonPeriod(scoped, teams[0].id, teams[1].id, '2026-01-01T00:00:00Z');
    expect(common.from).toBe('2025-02-01T12:00:00.000Z');
    expect(common.to).toBe('2025-03-01T12:00:00.000Z');
    const views = comparisonView(common.data);
    expect(views[teams[0].id].coverage.Tirs).toMatchObject({
      sample: 1,
      average: 4,
      sources: ['api-football'],
    });
    expect(views[teams[1].id].coverage.Tirs).toMatchObject({
      sample: 1,
      average: 6,
      sources: ['api-football'],
    });
  });
  it('does not manufacture a comparison when team histories do not overlap', () => {
    const scoped = {
      ...data,
      matches: [
        { ...base, homeId: 'a', awayId: 'x', kickoff: '2025-01-01T12:00:00Z' },
        { ...base, id: 'b', homeId: 'b', awayId: 'y', kickoff: '2025-02-01T12:00:00Z' },
      ],
    };
    expect(commonComparisonPeriod(scoped, 'a', 'b').data.matches).toHaveLength(0);
    expect(commonComparisonPeriod(scoped, 'a', 'b').from).toBeUndefined();
  });
});
