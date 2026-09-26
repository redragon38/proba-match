import { describe, expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { homeFormLeaders, teamSummary } from '@/services/statistics';
import { normalizeSearch, searchAutocomplete, searchIndex, searchResults } from '@/services/search-index';

describe('optimized public hot paths', () => {
  it('keeps the home form ranking equal to individual team history', () => {
    const data = createDemoDataset(new Date('2026-09-12T12:00:00Z'));
    const cutoff = '2026-09-12T12:00:00.000Z';
    const expected = data.teams
      .map((team) => ({ team, summary: teamSummary(data, team.id, cutoff) }))
      .filter(({ summary }) => summary.lastTen.length >= 5)
      .map(({ team, summary }) => {
        const lastFive = summary.lastTen.slice(0, 5);
        return {
          team,
          form: summary.form,
          points: lastFive.reduce((sum, row) => sum + (row.gf > row.ga ? 3 : row.gf === row.ga ? 1 : 0), 0),
          goals: lastFive.reduce((sum, row) => sum + row.gf, 0),
        };
      })
      .sort((a, b) => b.points - a.points || b.goals - a.goals)
      .slice(0, 6);
    expect(homeFormLeaders(data, cutoff)).toEqual(expected);
  });

  it('preserves autocomplete ordering and updates when a new dataset arrives', () => {
    const data = createDemoDataset(new Date('2026-09-12T12:00:00Z'));
    data.source = 'openfootball';
    const query = 'paris';
    const expected = searchIndex(data)
      .filter((row) => normalizeSearch(row.name).includes(query))
      .sort((a, b) => Number(normalizeSearch(b.name).startsWith(query)) - Number(normalizeSearch(a.name).startsWith(query)))
      .slice(0, 10);
    expect(searchAutocomplete(data, query)).toEqual(expected);
    expect(searchResults(data, { q: query }).results).toEqual(
      searchIndex(data).filter((row) => normalizeSearch(row.name).includes(query)).slice(0, 25),
    );
    const next = { ...data, teams: data.teams.map((team, i) => i === 0 ? { ...team, name: 'Paris unique' } : team) };
    expect(searchAutocomplete(next, 'paris unique')[0]?.name).toBe('Paris unique');
  });
});
