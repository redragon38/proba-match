import { describe, expect, it } from 'vitest';
import {
  expiredSnapshotWarning,
  hasLateOpenResults,
  lateResultsWarning,
  withSnapshotExpiry,
  withSourceFreshness,
} from '@/services/football/freshness';
import type { Dataset, Match, MatchStatus } from '@/types/football';

const now = Date.parse('2026-09-20T20:00:00Z');
const match: Match = {
  id: 'match',
  slug: 'match',
  competitionId: 'league',
  homeId: 'home',
  awayId: 'away',
  kickoff: new Date(now - 6 * 3600000).toISOString(),
  kickoffKnown: true,
  status: 'scheduled',
  homeScore: null,
  awayScore: null,
  round: '1',
  events: [],
  lineups: [],
  statistics: [],
  source: 'openfootball',
  updatedAt: new Date(now).toISOString(),
};
const dataset = (changes: Partial<Match> = {}): Dataset => ({
  source: 'openfootball',
  updatedAt: new Date(now).toISOString(),
  competitions: [],
  teams: [],
  players: [],
  matches: [{ ...match, ...changes }],
  injuries: [],
  standings: {},
});

describe('Source results freshness', () => {
  it('marks a cached snapshot late when its DB deadline passes without a new revision', () => {
    const data = dataset({ status: 'finished' });
    expect(withSnapshotExpiry(data, now + 1, now)).toBe(data);
    const expired = withSnapshotExpiry(data, now - 1, now);
    expect(expired).toMatchObject({ degraded: true, warning: expiredSnapshotWarning });
    expect(withSnapshotExpiry(expired, now - 1, now).warning).toBe(expiredSnapshotWarning);
    expect(data.degraded).toBeUndefined();
  });
  it('warns after six hours without treating elapsed time as a final score', () => {
    const data = dataset();
    expect(hasLateOpenResults(data, now)).toBe(false);
    const result = withSourceFreshness(data, now + 1);
    expect(result.warning).toBe(lateResultsWarning);
    expect(result.degraded).toBe(true);
    expect(result.matches).toBe(data.matches);
    expect(result.matches[0]).toMatchObject({
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
    });
    expect(data.warning).toBeUndefined();
  });
  it('waits 24 hours when the kickoff time is unknown', () => {
    const data = dataset({
      kickoffKnown: false,
      kickoff: new Date(now - 24 * 3600000).toISOString(),
    });
    expect(hasLateOpenResults(data, now)).toBe(false);
    expect(hasLateOpenResults(data, now + 1)).toBe(true);
  });
  it.each<MatchStatus>(['postponed', 'cancelled', 'abandoned', 'finished', 'live'])(
    'does not warn for an explicitly %s match',
    (status) => {
      expect(hasLateOpenResults(dataset({ status }), now + 86400000)).toBe(false);
    },
  );
  it('does not warn for a future match or a secondary-provider schedule', () => {
    expect(
      hasLateOpenResults(dataset({ kickoff: new Date(now + 3600000).toISOString() }), now),
    ).toBe(false);
    expect(hasLateOpenResults(dataset({ source: 'api-football' }), now + 86400000)).toBe(false);
  });
  it('preserves existing warnings and degradation, without duplicating its message', () => {
    const data = { ...dataset(), warning: 'Dernières données sauvegardées.', degraded: true };
    const result = withSourceFreshness(data, now + 1);
    expect(result.warning).toBe(`${data.warning} ${lateResultsWarning}`);
    expect(withSourceFreshness(result, now + 2).warning).toBe(result.warning);
    expect(withSourceFreshness({ ...data, matches: [] }, now)).toMatchObject({
      warning: data.warning,
      degraded: true,
    });
  });
});
