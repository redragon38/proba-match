import { describe, expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { normalizeSearch, searchResults } from '@/services/search-index';

const data = createDemoDataset(new Date('2026-09-12T12:00:00Z'));

describe('alias de recherche vérifiés', () => {
  it.each([
    ['OL', 'Olympique Lyonnais'],
    ['OM', 'Olympique de Marseille'],
    ['PSG', 'Paris Saint-Germain'],
    ['Bayern', 'Bayern Munich'],
  ])('relie %s uniquement au club vérifié', (query, expected) => {
    const teams = searchResults(data, { q: query, category: 'Équipe' }).results;
    expect(teams.some((row) => row.name === expected)).toBe(true);
  });

  it('gère accents, apostrophes, tirets et casse de façon uniforme', () => {
    expect(normalizeSearch('PARIS–Saint‑Germain')).toBe('paris saint germain');
    expect(normalizeSearch('Barça')).toBe('barca');
  });

  it('retrouve une confrontation à partir de deux noms courts', () => {
    const lyon = data.teams.find((team) => team.name === 'Olympique Lyonnais')!;
    const paris = data.teams.find((team) => team.name === 'Paris Saint-Germain')!;
    const match = { ...data.matches[0], id: 'alias-fixture', homeId: lyon.id, awayId: paris.id };
    const rows = searchResults(
      { ...data, matches: [match] },
      { q: 'OL PSG', category: 'Match' },
    ).results;
    expect(rows.some((row) => row.id === 'match:alias-fixture')).toBe(true);
  });
});
