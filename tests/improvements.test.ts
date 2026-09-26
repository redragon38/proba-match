import { describe, it, expect } from 'vitest';
import { probabilityPercentages } from '@/lib/probability-format';
import { derivedStandings } from '@/services/derived-standings';
import { formIndex } from '@/prediction-engine/form';
import { WindowLimiter } from '@/lib/rate-limit';
import { createDemoDataset } from '@/services/football/providers/mock';
const data = createDemoDataset(new Date('2026-09-12T12:00:00Z'));
describe('Affichage et classements', () => {
  it('affiche 100 % sans biais systématique sur la troisième issue', () => {
    expect(probabilityPercentages(0.334, 0.333, 0.333)).toEqual([34, 33, 33]);
    expect(probabilityPercentages(0.241, 0.414, 0.345)).toEqual([24, 41, 35]);
    for (const a of [0.001, 0.2, 0.499, 0.9]) {
      const r = probabilityPercentages(a, (1 - a) / 2, (1 - a) / 2);
      expect(r.reduce((s, v) => s + v, 0)).toBe(100);
      expect(r.every((v) => v >= 0 && v <= 100)).toBe(true);
    }
  });
  it('refuse une distribution invalide', () => {
    expect(() => probabilityPercentages(0, 0, 0)).toThrow();
    expect(() => probabilityPercentages(NaN, 1, 0)).toThrow();
  });
  it('calcule les cinq derniers matchs avec un maximum de quinze points', () => {
    const rows = derivedStandings(data.matches, '61', 'last5');
    const comp = data.competitions[0].id;
    const actual = derivedStandings(data.matches, comp, 'last5');
    expect(rows).toBeDefined();
    expect(actual.length).toBeGreaterThan(0);
    expect(
      actual.every((r) => r.played <= 5 && r.points <= 15 && r.points === r.won * 3 + r.drawn),
    ).toBe(true);
  });
  it('isole les résultats à domicile et ignore les scores manquants', () => {
    const m = data.matches.find((m) => m.status === 'finished')!;
    const r = derivedStandings(
      [m, { ...m, id: 'missing', homeScore: null }],
      m.competitionId,
      'home',
    );
    expect(r).toHaveLength(1);
    expect(r[0].teamId).toBe(m.homeId);
    expect(r[0].played).toBe(1);
  });
});
describe('Forme et protection', () => {
  it('récompense davantage cinq victoires contre des adversaires forts', () => {
    const m = data.matches.find((m) => m.status === 'finished')!;
    const matches = Array.from({ length: 5 }, (_, i) => ({
      ...m,
      id: `f${i}`,
      homeId: 'a',
      awayId: 'b',
      homeScore: 1,
      awayScore: 0,
      kickoff: `2026-08-${10 + i}T12:00:00Z`,
    }));
    const ratings = (opponent: number) =>
      new Map(
        matches.flatMap(
          (m) =>
            [
              [`${m.id}:a`, 1500],
              [`${m.id}:b`, opponent],
            ] as [string, number][],
        ),
      );
    expect(formIndex('a', matches, '2026-09-01T12:00:00Z', ratings(1800))).toBeGreaterThan(
      formIndex('a', matches, '2026-09-01T12:00:00Z', ratings(1200))!,
    );
    expect(formIndex('a', matches, '2026-08-01T12:00:00Z', ratings(1800))).toBeNull();
  });
  it('limite les tentatives et rouvre la fenêtre sans conserver une liste illimitée', () => {
    const limiter = new WindowLimiter(2, 1000, 1);
    expect(limiter.take('a', 0)).toBe(true);
    expect(limiter.take('a', 1)).toBe(true);
    expect(limiter.take('a', 2)).toBe(false);
    expect(limiter.take('b', 3)).toBe(false);
    expect(limiter.take('b', 1001)).toBe(true);
  });
});
