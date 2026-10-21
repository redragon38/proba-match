import { expect, it } from 'vitest';
import { scoreDistribution } from '@/prediction-engine/poisson';
import { formatProbability, scoreScenarioPercentages } from '@/lib/probability-format';

it('Levante–Athletic f851aa7b: the 1–0 score has the same rounding in every section', () => {
  // Real public forecast observed on 2026-10-21; no invented match result.
  const distribution = scoreDistribution(1.399692705313297, 1.5366951694991);
  const scores = distribution.scores.slice(0, 5);
  const index = scores.findIndex((s) => s.home === 1 && s.away === 0);
  expect(index).toBe(4);
  expect(scores[index].probability).toBeCloseTo(0.074263540188123, 12);
  expect(formatProbability(scores[index].probability)).toBe('7 %');
  expect(scoreScenarioPercentages(scores.map((s) => s.probability))[index]).toBe(7);
  expect(distribution.home + distribution.draw + distribution.away).toBeCloseTo(1, 12);
  expect(distribution.scores.reduce((sum, s) => sum + s.probability, 0)).toBeCloseTo(1, 12);
});
