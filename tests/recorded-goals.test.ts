import { describe, expect, it } from 'vitest';
import { recordedGoals } from '@/services/statistics';

describe('Historical goals with incomplete results', () => {
  it('uses only complete results in the total and denominator', () => {
    expect(
      recordedGoals([
        { homeScore: 2, awayScore: 1 },
        { homeScore: null, awayScore: 4 },
        { homeScore: 0, awayScore: 0 },
        { homeScore: 3, awayScore: null },
      ]),
    ).toEqual({ matches: 2, goals: 3, average: 1.5 });
  });
  it('keeps all missing results unavailable instead of inventing a goalless history', () => {
    for (const scores of [[], [{ homeScore: null, awayScore: null }]])
      expect(recordedGoals(scores)).toEqual({ matches: 0, goals: null, average: null });
  });
  it('retains a verified zero and rejects invalid numeric scores', () => {
    expect(
      recordedGoals([
        { homeScore: 0, awayScore: 0 },
        { homeScore: NaN, awayScore: 1 },
        { homeScore: Infinity, awayScore: 1 },
        { homeScore: -1, awayScore: 1 },
        { homeScore: 0.5, awayScore: 1 },
      ]),
    ).toEqual({ matches: 1, goals: 0, average: 0 });
  });
});
