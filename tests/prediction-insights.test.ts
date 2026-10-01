import { describe, expect, it } from 'vitest';
import { shrinkExpectedGoals } from '@/prediction-engine/calibration';
import { informationQuality, predictionExplanation, predictionInsights } from '@/prediction-engine/insights';
import { roundedPercentages } from '@/lib/probability-format';
import type { Prediction } from '@/types/football';

const prediction: Prediction = {
  id: 'test', matchId: 'match', version: 'elo-poisson-1.2.0',
  createdAt: '2026-09-01T00:00:00Z', cutoff: '2026-09-01T00:00:00Z',
  home: 0.5, draw: 0.25, away: 0.25, expectedHome: 1.6, expectedAway: 1.1,
  likelyScore: '1–1', scores: [], cleanHome: 0, cleanAway: 0,
  confidence: 65, sample: 12, inputHash: 'test', lineupConfirmed: false,
  factors: [{ label: 'Forme récente', detail: 'Résultats antérieurs', side: 'home' }],
};

describe('Calibrage et probabilités dérivées', () => {
  it('réduit le rapport de buts sans changer leur moyenne géométrique', () => {
    const result = shrinkExpectedGoals(2, 1, 0.8);
    expect(result.home / result.away).toBeLessThan(2);
    expect(result.home).toBeGreaterThan(result.away);
    expect(result.home * result.away).toBeCloseTo(2, 12);
    expect(() => shrinkExpectedGoals(2, 1, 0)).toThrow();
  });
  it('conserve les masses et cohérences de la même matrice de scores', () => {
    const result = predictionInsights(prediction);
    expect(result.totalGoals.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
    expect(result.margin.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
    expect(result.cleanHome + result.awayScores).toBeCloseTo(1, 12);
    expect(result.cleanAway + result.homeScores).toBeCloseTo(1, 12);
    expect(result.bothScore).toBeLessThanOrEqual(result.homeScores);
    expect(result.topScores).toHaveLength(5);
    expect(roundedPercentages(result.totalGoals)).toHaveLength(6);
    expect(roundedPercentages(result.totalGoals).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it('sépare la qualité de données des probabilités et explique les facteurs observés', () => {
    expect(informationQuality(prediction).level).toBe('Moyenne');
    expect(informationQuality(prediction, true).level).toBe('Faible');
    expect(predictionExplanation(prediction, 'Domicile', 'Extérieur').summary).toContain('forme récente');
  });
});
