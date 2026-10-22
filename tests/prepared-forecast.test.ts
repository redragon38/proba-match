import { expect, it } from 'vitest';
import { PredictionEngine } from '@/prediction-engine';
import { createDemoDataset } from '@/services/football/providers/mock';

it('keeps batched forecasts and immutable archives identical to individual forecasts', () => {
  const now = '2026-09-11T12:00:00Z';
  const data = createDemoDataset(new Date(now));
  const engine = new PredictionEngine();
  const batch = engine.prepare(data.matches, now);
  const reconstructed = engine.prepareReconstructed(data.matches, now);
  const targets = data.matches.filter(m => m.status === 'scheduled' && Date.parse(m.kickoff) > Date.parse(now)).slice(0, 4);
  expect(targets.length).toBeGreaterThan(1);
  for (const match of targets) {
    const individual = engine.predict(match, data.matches, now);
    expect(individual).not.toBeNull();
    expect(batch(match)).toEqual(individual);
    expect(reconstructed(match)).toEqual(engine.predictReconstructed(match, data.matches, now));
  }
});
