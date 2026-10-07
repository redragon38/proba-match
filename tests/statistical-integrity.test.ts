import { describe, expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { teamMetricAverage, teamMetricSummary, teamSummary } from '@/services/statistics';
import { comparisonView } from '@/services/football/read-model';
import { playerPerformance, playerWatch, playerImpact } from '@/prediction-engine/player';
import { number } from '@/lib/format';

const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
const player = data.players[0];
const attackingStats = {
  ...player.stats,
  minutes: 900,
  rating: 7,
  goals: 2,
  assists: 3,
  shots: 12,
};

describe('Player statistics integrity', () => {
  it.each([NaN, Infinity, -Infinity, -1])('refuses invalid minutes and ratings: %s', (invalid) => {
    expect(playerPerformance({ ...attackingStats, minutes: invalid }, 'Attaquant')).toBeNull();
    expect(playerPerformance({ ...attackingStats, rating: invalid }, 'Attaquant')).toBeNull();
    expect(
      playerImpact({ ...player, stats: { ...attackingStats, minutes: invalid } }, 900),
    ).toBeNull();
    expect(playerImpact({ ...player, stats: attackingStats }, invalid)).toBeNull();
  });
  it.each([NaN, Infinity, -1, 1.5])('refuses invalid event counts: %s', (invalid) => {
    expect(playerPerformance({ ...attackingStats, goals: invalid }, 'Attaquant')).toBeNull();
    expect(
      playerPerformance({ ...attackingStats, tackles: invalid, interceptions: 2 }, 'Défenseur'),
    ).toBeNull();
    expect(
      playerPerformance({ ...attackingStats, saves: invalid, conceded: 2 }, 'Gardien'),
    ).toBeNull();
    expect(playerWatch({ ...player, stats: { ...player.stats, starts: invalid } })).toBeNull();
  });
  it('does not conceal inconsistent counts with clamping', () => {
    expect(playerPerformance({ ...attackingStats, rating: 11 }, 'Attaquant')).toBeNull();
    expect(playerPerformance({ ...attackingStats, goals: 13 }, 'Attaquant')).toBeNull();
    expect(
      playerWatch({ ...player, stats: { ...player.stats, starts: 11, appearances: 10 } }),
    ).toBeNull();
    expect(playerImpact({ ...player, stats: { ...attackingStats, rating: 11 } }, 900)).toBeNull();
  });
  it('preserves the documented heuristic on valid input, including genuine zeros', () => {
    expect(playerPerformance(attackingStats, 'Attaquant')).toBe(52);
    expect(
      playerPerformance({ ...attackingStats, goals: 0, assists: 0, shots: 0 }, 'Attaquant'),
    ).toBe(42);
    expect(playerWatch({ ...player, stats: { ...player.stats, starts: 0 } })).toBe(0);
  });
  it('never prints nonfinite values as statistics', () => {
    for (const value of [null, undefined, NaN, Infinity, -Infinity])
      expect(number(value)).toBe('Non disponible');
    expect(number(0)).toBe('0');
    expect(number(1.25, 1)).toBe('1,3');
  });
});

describe('Metric samples and comparison scope', () => {
  const base = data.matches.find((m) => m.status === 'finished')!;
  const cutoff = '2026-10-05T00:00:00Z';
  it('counts only documented valid values; missing matches are never zero', () => {
    const matches = [
      { ...base, statistics: [{ label: 'Possession', home: 60, away: 40 }] },
      { ...base, statistics: [] },
      ...[NaN, Infinity, -1, 101].map((home) => ({
        ...base,
        statistics: [{ label: 'Possession', home, away: 40 }],
      })),
      {
        ...base,
        kickoff: '2027-01-01T00:00:00Z',
        statistics: [{ label: 'Possession', home: 90, away: 10 }],
      },
      { ...base, homeScore: null, statistics: [{ label: 'Possession', home: 90, away: 10 }] },
    ];
    expect(
      teamMetricSummary({ ...data, matches }, base.homeId, 'Possession', 'all', cutoff),
    ).toMatchObject({
      average: 60,
      sample: 1,
      sources: ['demo'],
      from: base.kickoff,
      to: base.kickoff,
    });
    expect(
      teamMetricSummary({ ...data, matches }, base.homeId, 'Tirs', 'all', cutoff),
    ).toMatchObject({
      average: null,
      sample: 0,
    });
  });
  it('uses the selected venue and accepts a recorded zero', () => {
    const matches = [
      { ...base, statistics: [{ label: 'Tirs', home: 0, away: 3 }] },
      {
        ...base,
        homeId: base.awayId,
        awayId: base.homeId,
        statistics: [{ label: 'Tirs', home: 3, away: 10 }],
      },
    ];
    const scoped = { ...data, matches };
    expect(teamMetricSummary(scoped, base.homeId, 'Tirs', 'home', cutoff)).toMatchObject({
      average: 0,
      sample: 1,
    });
    expect(teamMetricSummary(scoped, base.homeId, 'Tirs', 'away', cutoff)).toMatchObject({
      average: 10,
      sample: 1,
    });
    expect(teamMetricSummary(scoped, base.homeId, 'Tirs', 'all', cutoff)).toMatchObject({
      average: 5,
      sample: 2,
    });
  });
  it('preserves comparison results for every team and venue, including teams without history', () => {
    const scoped = { ...data, teams: [...data.teams, { ...data.teams[0], id: 'without-history' }] };
    const actual = comparisonView(scoped);
    for (const team of scoped.teams) {
      for (const venue of ['all', 'home', 'away'] as const)
        expect(actual[team.id][venue]).toEqual({
          ...teamSummary(scoped, team.id, undefined, venue),
          matches: [],
          lastTen: [],
        });
      expect(actual[team.id].xg).toEqual(teamMetricAverage(scoped, team.id, 'xG'));
      expect(actual[team.id].shots).toEqual(teamMetricAverage(scoped, team.id, 'Tirs'));
      expect(actual[team.id].possession).toEqual(teamMetricAverage(scoped, team.id, 'Possession'));
    }
  });
});
