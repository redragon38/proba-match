import { describe, expect, it } from 'vitest';
import { competitionView } from '@/services/competition-view';
import { searchIndex, searchResults, searchSource } from '@/services/search-index';
import { createDemoDataset } from '@/services/football/providers/mock';

const dataset = () => createDemoDataset(new Date('2026-09-12T12:00:00Z'));
describe('bounded search payloads', () => {
  it('keeps the entire catalogue searchable through pages without serializing match details', () => {
    const data = dataset();
    const first = data.matches[0];
    data.matches = Array.from({ length: 80 }, (_, index) => ({
      ...first,
      id: `search-${index}`,
      slug: `search-${index}`,
      referee: 'DETAILS_MUST_STAY_ON_SERVER',
    }));
    const expected = searchIndex(data);
    const collected = [];
    for (let offset = 0; offset < expected.length; offset += 25) {
      const page = searchResults(data, { offset });
      expect(page.results.length).toBeLessThanOrEqual(25);
      expect(page.total).toBe(expected.length);
      collected.push(...page.results);
    }
    expect(collected.map((row) => row.id)).toEqual(expected.map((row) => row.id));
    expect(JSON.stringify(collected)).not.toContain('DETAILS_MUST_STAY_ON_SERVER');
    expect(searchSource(data)).toEqual({
      source: data.source,
      warning: data.warning,
      updatedAt: data.updatedAt,
    });
  });
  it('filters favorites over all pages, combines accents/category, and preserves the team badge', () => {
    const data = dataset();
    data.teams[0].name = 'Équipe spéciale';
    const rows = searchIndex(data);
    const last = rows[rows.length - 1];
    const teamId = `team:${data.teams[0].id}`;
    const result = searchResults(data, {
      ids: [teamId, last.id],
      q: 'equipe speciale',
      category: 'Équipe',
    });
    expect(result.total).toBe(1);
    expect(result.results[0]).toMatchObject({ id: teamId, team: { name: 'Équipe spéciale' } });
    expect(searchResults(data, { ids: [last.id] }).results[0].id).toBe(last.id);
    expect(searchResults(data, { ids: [] })).toEqual({ total: 0, results: [] });
    expect(searchResults(data, { offset: -1 })).toEqual(searchResults(data));
  });
});

describe('competition server projection', () => {
  it('computes metrics and historical standings using every result while only shipping the visible matches', () => {
    const data = dataset();
    const competition = data.competitions[0];
    const first = data.matches.find((match) => match.competitionId === competition.id)!;
    data.matches = Array.from({ length: 80 }, (_, index) => ({
      ...first,
      id: `match-${index}`,
      slug: `match-${index}`,
      competitionId: competition.id,
      season: competition.season - 1,
      status: 'finished',
      homeScore: 2,
      awayScore: 1,
      kickoff: new Date(Date.UTC(2025, 0, 1 + index)).toISOString(),
      referee: 'DETAILS_MUST_STAY_ON_SERVER',
      events: [
        { minute: 30, teamId: first.homeId, type: 'goal', player: 'Buteur' },
        { minute: 60, teamId: first.awayId, type: 'red', player: 'Expulsé' },
      ],
    }));
    const view = competitionView(data, competition, { saison: String(competition.season - 1) });
    expect(view.metrics).toEqual({ matches: 80, finished: 80, goals: 240 });
    expect(view.matches).toHaveLength(20);
    expect(view.matches[0].id).toBe('match-79');
    expect(view.matches[0].events).toEqual([data.matches[0].events[1]]);
    expect(view.table.find((row) => row.teamId === first.homeId)?.played).toBe(80);
    expect(view.table.find((row) => row.teamId === first.homeId)?.points).toBe(240);
    expect(view.passers).toEqual([]);
    expect(view.scorers).toEqual([]);
    expect(view.seasons).toContain(competition.season);
    expect(JSON.stringify(view)).not.toContain('DETAILS_MUST_STAY_ON_SERVER');
    expect(JSON.stringify(view).length).toBeLessThan(JSON.stringify(data).length / 2);
  });
  it('preserves current-season standings, live clocks, red cards and season/status fallback', () => {
    const data = dataset();
    const competition = data.competitions[0];
    const first = data.matches.find((match) => match.competitionId === competition.id)!;
    data.matches = [
      {
        ...first,
        season: competition.season,
        status: 'live',
        minute: 63,
        phase: 'playing',
        extra: 2,
      },
    ];
    const view = competitionView(data, competition, { saison: 'invalid', statut: 'live' });
    expect(view.competition.season).toBe(competition.season);
    expect(view.matches[0]).toMatchObject({ minute: 63, phase: 'playing', extra: 2 });
    expect(view.table).toEqual(data.standings[competition.id]);
    for (const row of view.table)
      expect(view.teams.some((team) => team.id === row.teamId)).toBe(true);
    expect(competitionView(data, competition, { statut: 'invalid' }).mode).toBe('scheduled');
  });
});
