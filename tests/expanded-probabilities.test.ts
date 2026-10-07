import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { predictionInsights, goalRange } from '@/prediction-engine/insights';
import { dixonColesDistribution } from '@/prediction-engine/dixon-coles';
import { scoreDistribution } from '@/prediction-engine/poisson';
import { PredictionEngine } from '@/prediction-engine';
import { createDemoDataset } from '@/services/football/providers/mock';
import { sanitizeMatchStatistics, statisticValue, descriptiveRatios } from '@/lib/statistic-values';
import {
  formatProbability,
  probabilityReading,
  roundedPercentages,
} from '@/lib/probability-format';
import { ProbabilitySummary } from '@/features/matches/probability-summary';
import { plainFactor } from '@/lib/prediction-explanations';
import { MatchStatistics } from '@/features/matches/match-statistics';

const now = new Date('2026-09-11T12:00:00Z');
const data = createDemoDataset(now);
const match = data.matches.find((m) => m.id === 'demo-0-2')!;
const prediction = new PredictionEngine().predict(match, data.matches, now.toISOString())!;
const home = data.teams.find((t) => t.id === match.homeId)!;
const away = data.teams.find((t) => t.id === match.awayId)!;

describe('Expanded coherent score statistics', () => {
  it('explains recorded directions without inventing contributions or favoring a neutral team', () => {
    expect(
      plainFactor(
        { label: 'Production offensive récente', side: 'away', detail: 'Archive' },
        'A',
        'B',
      ),
    ).toContain('B a une production');
    expect(
      plainFactor(
        { label: 'Production offensive récente', side: 'neutral', detail: 'Archive' },
        'A',
        'B',
      ),
    ).toBeNull();
    expect(
      plainFactor({ label: 'Facteur inconnu', side: 'home', detail: 'Archive' }, 'A', 'B'),
    ).toBeNull();
  });
  it.each([
    [0, 0],
    [1.6, 1.1],
    [4.5, 4.5],
    [10, 10],
  ])('preserves every partition and its outcome marginals at %s/%s', (h, a) => {
    const result = predictionInsights({ ...prediction, expectedHome: h, expectedAway: a });
    for (const values of [result.homeGoals, result.awayGoals, result.scoreGrid.flat()])
      expect(values.reduce((sum, p) => sum + p, 0)).toBeCloseTo(1, 12);
    const distribution = scoreDistribution(h, a);
    expect(result.winningMargins.home.reduce((s, p) => s + p, 0)).toBeCloseTo(
      distribution.home,
      12,
    );
    expect(result.winningMargins.away.reduce((s, p) => s + p, 0)).toBeCloseTo(
      distribution.away,
      12,
    );
    expect(result.totalRange.probability).toBeGreaterThanOrEqual(0.8 - 1e-12);
    expect(result.totalAtLeast[0].probability).toBeGreaterThanOrEqual(
      result.totalAtLeast[1].probability,
    );
    expect(result.totalAtLeast[1].probability).toBeGreaterThanOrEqual(
      result.totalAtLeast[2].probability,
    );
  });
  it('finds an actual shortest range rather than an arbitrary goal cap', () => {
    expect(goalRange([0.1, 0.4, 0.4, 0.1])).toMatchObject({ from: 1, to: 2 });
    expect(goalRange([1, 0, 0])).toMatchObject({ from: 0, to: 0, probability: 1 });
    expect(() => goalRange([0.2, 0.2])).toThrow('INVALID_GOAL_RANGE');
    expect(() => goalRange([NaN])).toThrow();
  });
  it('never presents a rounded tiny probability as impossible or a near certainty as certain', () => {
    expect(formatProbability(0.00001)).toBe('< 1 %');
    expect(formatProbability(0.99999)).toBe('> 99 %');
    expect(formatProbability(0)).toBe('0 %');
    expect(formatProbability(1)).toBe('100 %');
    expect(probabilityReading(0.48, 0.3, 0.25)).toBeNull();
    expect(() => roundedPercentages([Number.MAX_VALUE, Number.MAX_VALUE])).toThrow();
  });
  it('renders the new events and their meaning on the real summary', () => {
    const html = renderToStaticMarkup(
      createElement(ProbabilitySummary, {
        prediction,
        home,
        away,
        analysis: predictionInsights(prediction),
        demo: true,
      }),
    );
    for (const text of [
      'Trois scores les plus probables',
      'Un éventail de buts possibles',
      'Explorer les scénarios de score',
      'Au moins 3 buts au total',
      'Victoire et écart de buts',
      'Ce chiffre n’est pas un indice de confiance',
    ])
      expect(html).toContain(text);
  });
});
describe('Dixon-Coles correction safeguards', () => {
  it('is exactly Poisson at rho zero', () =>
    expect(dixonColesDistribution(1.5, 1, 0)).toEqual(scoreDistribution(1.5, 1)));
  it('raises low-scoring draws while preserving normalization and team goal marginals', () => {
    const base = scoreDistribution(1.5, 1),
      adjusted = dixonColesDistribution(1.5, 1, -0.1);
    expect(adjusted.draw).toBeGreaterThan(base.draw);
    expect(adjusted.home + adjusted.draw + adjusted.away).toBeCloseTo(1, 12);
    for (let goals = 0; goals < 31; goals++)
      for (const side of ['home', 'away'] as const)
        expect(
          adjusted.scores
            .filter((s) => s[side] === goals)
            .reduce((sum, s) => sum + s.probability, 0),
        ).toBeCloseTo(
          base.scores.filter((s) => s[side] === goals).reduce((sum, s) => sum + s.probability, 0),
          12,
        );
  });
  it('refuses negative probability factors instead of silently clamping them', () => {
    for (const rho of [NaN, Infinity, -1, 0.9])
      expect(() => dixonColesDistribution(2, 2, rho)).toThrow();
  });
});
describe('Observed statistical integrity', () => {
  it('calculates descriptive shares only from coherent counters and positive denominators', () => {
    const result = descriptiveRatios([
      { label: 'Tirs', home: 10, away: 0 },
      { label: 'Tirs cadrés', home: 5, away: 0 },
      { label: 'Passes', home: 100, away: 200 },
      { label: 'Passes réussies', home: 90, away: 250 },
    ]);
    expect(result.find((r) => r.label === 'Part des tirs cadrés')).toMatchObject({
      home: 50,
      away: null,
    });
    expect(result.find((r) => r.label === 'Passes réussies (%) calculé')).toMatchObject({
      home: 90,
      away: null,
    });
    expect(descriptiveRatios([])).toEqual([]);
  });
  it('rejects impossible units/counts, retains partial observations and genuine zeros', () => {
    expect(statisticValue('Possession', 101)).toBeNull();
    expect(statisticValue('Corners', 1.5)).toBeNull();
    expect(statisticValue('xG', 1.5)).toBe(1.5);
    expect(sanitizeMatchStatistics([{ label: 'Tirs', home: 0, away: null }])).toEqual([
      { label: 'Tirs', home: 0, away: null },
    ]);
  });
  it('withholds conflicting duplicates and components exceeding their total', () => {
    const rows = sanitizeMatchStatistics([
      { label: 'Possession', home: 50, away: 50 },
      { label: 'Possession', home: 80, away: 50 },
      { label: 'Tirs', home: 5, away: 10 },
      { label: 'Tirs cadrés', home: 6, away: 3 },
    ]);
    expect(rows.find((r) => r.label === 'Possession')?.home).toBeNull();
    expect(rows.find((r) => r.label === 'Tirs cadrés')?.home).toBeNull();
    expect(rows.find((r) => r.label === 'Tirs cadrés')?.away).toBe(3);
  });
  it('does not display contaminated pre-match statistics as observations', () => {
    const html = renderToStaticMarkup(
      createElement(MatchStatistics, {
        match: {
          ...match,
          status: 'scheduled',
          statistics: [{ label: 'Possession', home: 95, away: 5 }],
        },
        home,
        away,
      }),
    );
    expect(html).not.toContain('95');
    expect(html).toContain('après le coup d’envoi');
  });
});
