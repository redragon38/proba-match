import { describe, expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { publicPredictionIds } from '@/services/prediction-visibility';

describe('public prediction visibility', () => {
  it('keeps a delayed scheduled fixture consistent across pages after its theoretical kickoff', () => {
    const data = createDemoDataset(new Date('2026-09-11T12:00:00Z'));
    const base = data.matches[0];
    const ids = publicPredictionIds([
      { ...base, id: 'delayed', status: 'scheduled', kickoff: '2026-09-11T10:00:00Z' },
      { ...base, id: 'future', status: 'scheduled', kickoff: '2026-09-12T10:00:00Z' },
      { ...base, id: 'live', status: 'live' },
      { ...base, id: 'finished', status: 'finished' },
    ]);

    expect([...ids]).toEqual(['delayed', 'future']);
  });
});
