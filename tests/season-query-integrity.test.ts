import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { cataloguePage } from '@/services/seo';
import { catalogueQuery, competitionQuery, competitionAliasTarget } from '@/lib/catalogue-query';
import { catalogueMetadata } from '@/lib/seo';
import { competitionView } from '@/services/competition-view';
import { createDemoDataset } from '@/services/football/providers/mock';
const original = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
const competition = original.competitions[0];
const match = original.matches.find((m) => m.competitionId === competition.id)!;
const finished = { ...match, status: 'finished' as const, homeScore: 2, awayScore: 1 };
describe('Season and query integrity', () => {
  it('does not reuse unspecified-season matches across historical seasons', () => {
    const data = {
      ...original,
      matches: [
        { ...finished, id: 'past', season: competition.season - 1 },
        { ...finished, id: 'unspecified', season: undefined },
      ],
    };
    const past = competitionView(data, competition, { saison: String(competition.season - 1) });
    expect(past.metrics).toEqual({ matches: 1, finished: 1, goals: 3 });
    expect(past.matches.map((m) => m.id)).toEqual(['past']);
    expect(past.seasonInferredCount).toBe(0);
    const current = competitionView(data, competition);
    expect(current.metrics.matches).toBe(1);
    expect(current.seasonInferredCount).toBe(1);
  });
  it('does not include invalid final scores in competition goal totals', () => {
    const data = {
      ...original,
      matches: [
        { ...finished, season: competition.season },
        ...[-1, NaN, Infinity, 1.5].map((score, i) => ({
          ...finished,
          id: `bad-${i}`,
          season: competition.season,
          homeScore: score,
        })),
      ],
    };
    const view = competitionView(data, competition, { statut: 'finished' });
    expect(view.metrics).toEqual({
      matches: 5,
      finished: 1,
      goals: 3,
    });
    expect(view.matches.filter((m) => m.id.startsWith('bad-'))).toHaveLength(4);
    for (const invalid of view.matches.filter((m) => m.id.startsWith('bad-'))) {
      expect(invalid.homeScore).toBeNull();
      expect(invalid.awayScore).toBeNull();
    }
  });
  it('ranks genuine zero counters and excludes missing or invalid individual counters', () => {
    const player = original.players.find((p) => p.teamId === match.homeId)!;
    const data = {
      ...original,
      matches: [{ ...finished, season: competition.season }],
      players: [0, -1, NaN, Infinity, 1.5, null].map((value, i) => ({
        ...player,
        id: `p-${i}`,
        stats: { ...player.stats, goals: value, assists: value },
      })),
    };
    const view = competitionView(data, competition);
    expect(view.scorers.map((p) => p.id)).toEqual(['p-0']);
    expect(view.passers.map((p) => p.id)).toEqual(['p-0']);
  });
  it('preserves the explicitly unknown kickoff date in the client projection', () => {
    const data = {
      ...original,
      matches: [
        {
          ...match,
          status: 'scheduled' as const,
          season: competition.season,
          kickoffKnown: false,
          sourceDate: '2026-09-12',
        },
      ],
    };
    expect(competitionView(data, competition).matches[0].sourceDate).toBe('2026-09-12');
  });
  it('flags an unavailable season while retaining the existing current-season fallback', () => {
    expect(competitionView(original, competition, { saison: 'not-a-season' }).seasonFallback).toBe(
      true,
    );
    expect(competitionView(original, competition).seasonFallback).toBe(false);
  });
  it('handles repeated search and filter parameters deterministically', () => {
    expect(catalogueQuery({ page: ['2', '3'], q: ['Paris', 'Lyon'] })).toEqual({
      page: '2',
      q: 'Paris',
    });
    expect(catalogueQuery({ q: 'x'.repeat(150) }).q).toHaveLength(100);
    expect(competitionQuery({ saison: ['2024', '2025'], statut: ['finished', 'live'] })).toEqual({
      saison: '2024',
      statut: 'finished',
    });
    expect(
      competitionAliasTarget('ligue-1-canonical', { saison: '2024', statut: 'finished' }),
    ).toBe('/competition/ligue-1-canonical?saison=2024&statut=finished');
  });
  it('rejects mathematical page notation and out-of-range pages without a server failure', () => {
    for (const value of ['1e0', '0x1', '-1', '1.5', ' ', '0', '999'])
      expect(() => cataloguePage(value, 100)).toThrow();
    expect(cataloguePage('2', 100)).toBe(2);
    expect(cataloguePage(undefined, 0)).toBe(1);
  });
  it('describes the actual search result count with an encoded self-canonical and noindex', () => {
    const metadata = catalogueMetadata('/equipes', 25, 2, true, 'Paris & Lyon');
    expect(metadata.description).toContain('25 résultats');
    expect(metadata.description).toContain('Page 2 sur 2');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
    const url = new URL(String(metadata.alternates?.canonical));
    expect(url.searchParams.get('q')).toBe('Paris & Lyon');
    expect(url.searchParams.get('page')).toBe('2');
  });
});
