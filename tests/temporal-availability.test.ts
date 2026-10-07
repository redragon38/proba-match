import { describe, expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { PredictionEngine } from '@/prediction-engine';
import {
  observeResult,
  resultAvailable,
  theoreticalResultTime,
} from '@/prediction-engine/availability';
import { walkForwardBacktest } from '@/prediction-engine/backtest';
import { metrics } from '@/prediction-engine/evaluation';
import { documentedResultIds, indexablePaths, matchIndexable, editorialPaths } from '@/lib/seo';
import { matchFactSummary } from '@/lib/match-facts';
import { teamSummary, teamMetricAverage } from '@/services/statistics';
import { derivedStandings } from '@/services/derived-standings';
import { eloHistory } from '@/prediction-engine/elo';

const now = '2026-09-11T12:00:00Z';
const demo = createDemoDataset(new Date(now));
const target = demo.matches.find((m) => m.id === 'demo-0-2')!;
const real = demo.matches.map((m) => ({
  ...m,
  source: 'openfootball' as const,
  resultPeriod: 'regulation' as const,
  resultObservedAt:
    m.status === 'finished'
      ? new Date(Date.parse(m.kickoff) + 3 * 3600_000).toISOString()
      : undefined,
}));
const engine = new PredictionEngine();

describe('Temporal availability safeguards', () => {
  it('orders timestamps by their instant, including offsets, and refuses an unknown kickoff in strict mode', () => {
    const row = {
      ...real.find((m) => m.status === 'finished')!,
      source: 'demo' as const,
      resultObservedAt: undefined,
    };
    const later = { ...row, id: 'later', kickoff: '2026-09-09T20:00:00-04:00' };
    const earlier = { ...row, id: 'earlier', kickoff: '2026-09-10T01:00:00+02:00' };
    expect(
      eloHistory([later, earlier], now)
        .history.filter((r) => r.teamId === row.homeId)
        .map((r) => r.matchId),
    ).toEqual(['earlier', 'later']);
    expect(engine.predict({ ...target, kickoffKnown: false }, real, now)).toBeNull();
    const after = { ...row, kickoff: '2026-09-09T23:00:00-03:00' };
    expect(
      teamSummary({ ...demo, matches: [after] }, row.homeId, '2026-09-10T00:00:00Z').played,
    ).toBe(0);
  });
  it('refuses a real historical corpus without observation timestamps', () => {
    const unknown = real.map((m) => ({ ...m, resultObservedAt: undefined }));
    expect(engine.predict(target, unknown, now)).toBeNull();
    expect(walkForwardBacktest(unknown)).toEqual([]);
    expect(walkForwardBacktest(unknown, 'reconstructed').length).toBeGreaterThan(0);
  });
  it('excludes a completed match whose result was first received after the prediction', () => {
    const late = {
      ...real.find((m) => m.status === 'finished')!,
      id: 'late',
      homeScore: 8,
      awayScore: 0,
      resultObservedAt: '2026-09-12T12:00:00Z',
    };
    expect(engine.predict(target, [...real, late], now)).toEqual(engine.predict(target, real, now));
    expect(resultAvailable({ ...late, resultObservedAt: now }, now)).toBe(false);
  });
  it('preserves the current revision observation, but resets it after score or identity corrections', () => {
    const previous = real.find((m) => m.status === 'finished')!;
    expect(observeResult(previous, previous, now).resultObservedAt).toBe(previous.resultObservedAt);
    expect(
      observeResult({ ...previous, homeScore: previous.homeScore! + 1 }, previous, now)
        .resultObservedAt,
    ).toBe(now);
    expect(
      observeResult({ ...previous, awayId: 'corrected-team' }, previous, now).resultObservedAt,
    ).toBe(now);
    expect(
      observeResult({ ...previous, status: 'abandoned' }, previous, now).resultObservedAt,
    ).toBeUndefined();
    expect(observeResult(previous, undefined, now).resultObservedAt).toBe(now);
  });
  it('refuses invalid scores and dates, post-kickoff calls and duplicate IDs', () => {
    const previous = real.find((m) => m.status === 'finished')!;
    for (const score of [NaN, -1, 1.5, Infinity])
      expect(resultAvailable({ ...previous, homeScore: score }, now)).toBe(false);
    expect(engine.predict({ ...target, kickoff: 'invalid' }, real, now)).toBeNull();
    expect(engine.predict(target, real, target.kickoff)).toBeNull();
    expect(() => walkForwardBacktest([...real, real[0]])).toThrow('DUPLICATE_MATCH_ID');
  });
  it('sanitizes the target and retains only genuinely prior information in strict replay', () => {
    const rows = walkForwardBacktest(real);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => Date.parse(r.prediction.createdAt) < Date.parse(r.kickoff))).toBe(
      true,
    );
    const polluted = real.map((m) => ({ ...m, events: [], statistics: [], lineups: [] }));
    expect(walkForwardBacktest(polluted)).toEqual(rows);
  });
  it('holds date-only results until the next day and refuses stale histories', () => {
    const dateOnly = { ...real[0], kickoffKnown: false, sourceDate: '2026-09-10' };
    expect(theoreticalResultTime(dateOnly)).toBe(Date.parse('2026-09-11T03:00:00Z'));
    const old = real.map((m) => ({
      ...m,
      kickoff: '2025-01-01T12:00:00Z',
      resultObservedAt: '2025-01-01T15:00:00Z',
    }));
    expect(engine.predict(target, old, now)).toBeNull();
  });
  it('hashes target identities and excludes impossible pre-kickoff observations', () => {
    const p = engine.predict(target, real, now)!;
    expect(p).not.toBeNull();
    expect(engine.predict({ ...target, id: 'another-fixture' }, real, now)?.inputHash).not.toBe(
      p.inputHash,
    );
    const row = real.find((m) => m.status === 'finished')!;
    expect(resultAvailable({ ...row, resultObservedAt: row.kickoff }, now)).toBe(false);
  });
});

describe('Statistical reporting and searchable facts', () => {
  it('excludes malformed results from team summaries and standings and invalid advanced values from averages', () => {
    const base = real.find((m) => m.status === 'finished')!;
    const invalid = {
      ...base,
      homeScore: NaN,
      statistics: [{ label: 'Possession', home: NaN, away: 50 }],
    };
    const data = { ...demo, matches: [invalid] };
    expect(teamSummary(data, base.homeId, now).played).toBe(0);
    expect(derivedStandings(data.matches, base.competitionId, 'general')).toEqual([]);
    expect(teamMetricAverage(data, base.homeId, 'Possession')).toBeNull();
  });
  it('measures goal errors and exact-score accuracy independently of 1N2 accuracy', () => {
    const p = engine.predict(target, real, now)!;
    const result = metrics([
      {
        prediction: {
          ...p,
          home: 1,
          draw: 0,
          away: 0,
          expectedHome: 1.5,
          expectedAway: 0.5,
          scores: [{ home: 2, away: 0, probability: 0.1 }],
        },
        homeScore: 2,
        awayScore: 0,
        competitionId: target.competitionId,
        kickoff: target.kickoff,
      },
    ])!;
    expect(result.homeGoalMae).toBe(0.5);
    expect(result.awayGoalMae).toBe(0.5);
    expect(result.totalGoalMae).toBe(0);
    expect(result.exactScoreAccuracy).toBe(1);
    expect(result.calibrationError).toBe(0);
    expect(() =>
      metrics([
        {
          prediction: { ...p, home: 0.8, draw: 0.7, away: 0.4 },
          homeScore: 2,
          awayScore: 0,
          competitionId: target.competitionId,
          kickoff: target.kickoff,
        },
      ]),
    ).toThrow('INVALID_EVALUATION_ROW');
  });
  it('uses identical chronology for single-page eligibility and the optimized sitemap', () => {
    const data = {
      ...demo,
      source: 'openfootball' as const,
      resultPeriod: 'regulation' as const,
      matches: real.map((m) => ({ ...m, events: [], lineups: [], statistics: [] })),
    };
    const ids = documentedResultIds(data);
    for (const m of data.matches) expect(matchIndexable(m, ids)).toBe(matchIndexable(m, data));
    expect(indexablePaths({ ...data, teams: [], matches: [] })).toEqual(editorialPaths);
  });
  it('describes postponements and unknown times without inventing a score', () => {
    expect(matchFactSummary({ ...target, status: 'postponed' }, 'A', 'B', 'Ligue')).toContain(
      'reporté',
    );
    expect(matchFactSummary({ ...target, kickoffKnown: false }, 'A', 'B', 'Ligue')).toContain(
      'non confirmée',
    );
    expect(
      matchFactSummary({ ...target, status: 'finished', homeScore: null }, 'A', 'B', 'Ligue'),
    ).not.toContain('Score enregistré');
  });
});
