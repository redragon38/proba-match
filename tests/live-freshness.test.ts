import { describe, expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { mergeLiveMatches } from '@/features/matches/use-live';

describe('live score freshness', () => {
  it('never lets a late older response replace a newer saved score', () => {
    const match = {
      ...createDemoDataset(new Date('2026-09-11T12:00:00Z')).matches[0],
      status: 'live' as const,
      homeScore: 2,
      awayScore: 1,
      minute: 70,
      updatedAt: '2026-09-11T14:30:00Z',
    };
    const [merged] = mergeLiveMatches([match], {
      [match.id]: {
        homeScore: 1,
        awayScore: 1,
        minute: 65,
        updatedAt: '2026-09-11T14:25:00Z',
      },
    });
    expect(merged).toEqual(match);
  });

  it('accepts a newer official correction as one coherent patch', () => {
    const match = {
      ...createDemoDataset(new Date('2026-09-11T12:00:00Z')).matches[0],
      status: 'live' as const,
      homeScore: 2,
      awayScore: 1,
      minute: 70,
      updatedAt: '2026-09-11T14:30:00Z',
    };
    const [merged] = mergeLiveMatches([match], {
      [match.id]: {
        homeScore: 1,
        awayScore: 1,
        minute: 71,
        updatedAt: '2026-09-11T14:31:00Z',
      },
    });
    expect(merged.homeScore).toBe(1);
    expect(merged.minute).toBe(71);
    expect(merged.updatedAt).toBe('2026-09-11T14:31:00Z');
  });
});
