import { describe, expect, it } from 'vitest';
import { updateElo } from '@/prediction-engine/elo';
import { poisson, scoreDistribution } from '@/prediction-engine/poisson';
import { confidenceScore } from '@/prediction-engine/confidence';
import { playerPerformance, playerWatch, playerImpact } from '@/prediction-engine/player';
import { PredictionEngine } from '@/prediction-engine';
import { metrics } from '@/prediction-engine/evaluation';
import { walkForwardBacktest } from '@/prediction-engine/backtest';
import { createDemoDataset } from '@/services/football/providers/mock';
const now = new Date('2026-09-11T12:00:00Z');
const data = createDemoDataset(now);
describe('Elo', () => {
  it('conserve le total et récompense une victoire', () => {
    const r = updateElo(1500, 1500, 2, 0);
    expect(r.home).toBeGreaterThan(1500);
    expect(r.home + r.away).toBeCloseTo(3000);
  });
  it('récompense davantage la victoire contre un adversaire fort', () => {
    expect(updateElo(1500, 1750, 1, 0).home).toBeGreaterThan(updateElo(1500, 1250, 1, 0).home);
  });
  it('augmente prudemment avec la marge et refuse NaN', () => {
    expect(updateElo(1500, 1500, 3, 0).home).toBeGreaterThan(updateElo(1500, 1500, 1, 0).home);
    expect(() => updateElo(NaN, 1500, 1, 0)).toThrow();
  });
});
describe('Poisson', () => {
  it('reproduit la masse analytique en zéro', () =>
    expect(poisson(2, 0)).toBeCloseTo(Math.exp(-2), 12));
  it('conserve la symétrie à forces égales', () => {
    const p = scoreDistribution(1.4, 1.4);
    expect(p.home).toBeCloseTo(p.away, 12);
  });
  it('normalise toutes les probabilités y compris aux limites', () => {
    for (const h of [0, 0.15, 1, 2.5, 4.5, 10])
      for (const a of [0, 0.15, 1, 2.5, 4.5, 10]) {
        const p = scoreDistribution(h, a);
        expect(p.home + p.draw + p.away).toBeCloseTo(1, 12);
        expect(p.scores.reduce((s, r) => s + r.probability, 0)).toBeCloseTo(1, 12);
        expect([p.home, p.draw, p.away].every((n) => n >= 0 && n <= 1)).toBe(true);
      }
  });
  it('rejette les paramètres invalides', () => {
    expect(() => poisson(-1, 0)).toThrow();
    expect(() => scoreDistribution(NaN, 1)).toThrow();
    expect(() => scoreDistribution(11, 1)).toThrow();
  });
});
describe('Qualité et joueurs', () => {
  it('borne le score et récompense des informations disponibles', () => {
    const minimal = {
      sample: 0,
      daysOld: 80,
      lineups: false,
      injuries: false,
      stability: 0,
      coverage: 0,
    };
    expect(confidenceScore(minimal)).toBe(0);
    expect(
      confidenceScore({
        sample: 100,
        daysOld: 0,
        lineups: true,
        injuries: true,
        stability: 1,
        coverage: 1,
      }),
    ).toBe(100);
  });
  it('ne calcule pas un score avec des métriques essentielles manquantes', () => {
    expect(playerPerformance({ ...data.players[0].stats, saves: null }, 'Gardien')).toBeNull();
    expect(playerPerformance({ ...data.players[0].stats, minutes: 0 }, 'Attaquant')).toBeNull();
    expect(
      playerWatch({ ...data.players[0], stats: { ...data.players[0].stats, starts: null } }),
    ).toBeNull();
  });
  it('évalue selon le poste et borne les impacts', () => {
    const p = data.players[0];
    const g = playerPerformance(p.stats, 'Gardien');
    expect(g).not.toBeNull();
    expect(g!).toBeGreaterThanOrEqual(0);
    expect(g!).toBeLessThanOrEqual(100);
    expect(playerImpact(p, 90)).toBeLessThanOrEqual(0.05);
  });
});
describe('Prédiction et backtest', () => {
  const engine = new PredictionEngine();
  const match = data.matches.find((m) => m.id === 'demo-0-2')!;
  it('est déterministe et refuse un historique insuffisant', () => {
    const a = engine.predict(match, data.matches, now.toISOString());
    const b = engine.predict(match, data.matches, now.toISOString());
    expect(a).toEqual(b);
    expect(a?.sample).toBeGreaterThanOrEqual(5);
    expect(engine.predict(match, [], now.toISOString())).toBeNull();
  });
  it('ne lit pas les résultats futurs ni ceux du match cible', () => {
    const baseline = engine.predict(match, data.matches, now.toISOString());
    const polluted = data.matches.map((m) =>
      new Date(m.kickoff) >= now
        ? { ...m, status: 'finished' as const, homeScore: 12, awayScore: 7 }
        : m,
    );
    expect(engine.predict(match, polluted, now.toISOString())).toEqual(baseline);
  });
  it('exclut les matchs commencés mais non terminés au moment cible', () => {
    const baseline = engine.predict(match, data.matches, now.toISOString());
    const added = {
      ...match,
      id: 'not-yet-finished',
      status: 'finished' as const,
      kickoff: new Date(now.getTime() - 3600_000).toISOString(),
      homeScore: 15,
      awayScore: 0,
    };
    expect(engine.predict(match, [...data.matches, added], now.toISOString())).toEqual(baseline);
  });
  it('conserve un cutoff avant chaque coup d’envoi', () => {
    const rows = walkForwardBacktest(data.matches.slice(0, 100));
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every((r) => r.prediction.createdAt < r.kickoff && r.prediction.cutoff < r.kickoff),
    ).toBe(true);
  });
  it('mesure correctement un modèle parfait et uniforme', () => {
    const prediction = engine.predict(match, data.matches, now.toISOString())!;
    const perfect = metrics([
      {
        prediction: { ...prediction, home: 1, draw: 0, away: 0 },
        homeScore: 1,
        awayScore: 0,
        competitionId: '61',
        kickoff: match.kickoff,
      },
    ])!;
    expect(perfect.brier).toBe(0);
    expect(perfect.logLoss).toBe(0);
    expect(perfect.accuracy).toBe(1);
    const uniform = metrics([
      {
        prediction: { ...prediction, home: 1 / 3, draw: 1 / 3, away: 1 / 3 },
        homeScore: 1,
        awayScore: 0,
        competitionId: '61',
        kickoff: match.kickoff,
      },
    ])!;
    expect(uniform.brier).toBeCloseTo(2 / 3);
    expect(uniform.logLoss).toBeCloseTo(Math.log(3));
    expect(metrics([])).toBeNull();
  });
});
