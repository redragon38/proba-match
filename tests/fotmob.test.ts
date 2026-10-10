import { describe, expect, it } from 'vitest';
import {
  identifyFotmobMatch,
  parseFotmobDetails,
  parseFotmobMatches,
} from '@/services/football/providers/fotmob';

const listing = {
  leagues: [
    {
      matches: [
        {
          id: 5887641,
          home: { id: 9773, name: 'FC Porto', score: 3 },
          away: { id: 9772, name: 'Benfica', score: 2 },
          status: { utcTime: '2026-09-20T19:30:00.000Z', finished: true },
        },
      ],
    },
  ],
};

describe('FotMob advanced statistics', () => {
  it('requires date, final score and both teams to identify one match', () => {
    const rows = parseFotmobMatches(listing);
    expect(
      identifyFotmobMatch(rows, {
        kickoff: '2026-09-20T19:30:00.000Z',
        homeName: 'Porto',
        awayName: 'Benfica',
        homeScore: 3,
        awayScore: 2,
      })?.id,
    ).toBe(5887641);
    expect(
      identifyFotmobMatch(rows, {
        kickoff: '2026-09-20T19:30:00.000Z',
        homeName: 'Porto',
        awayName: 'Benfica',
        homeScore: 2,
        awayScore: 2,
      }),
    ).toBeNull();
  });

  it('keeps reported xG/xGOT and sums only available player xA by team', () => {
    const parsed = parseFotmobDetails({
      general: {
        matchId: '5887641',
        homeTeam: { id: 9773, name: 'FC Porto' },
        awayTeam: { id: 9772, name: 'Benfica' },
      },
      content: {
        stats: {
          Periods: {
            All: {
              stats: [
                {
                  stats: [
                    {
                      key: 'expected_goals',
                      rawStats: [{ value: 1.5 }, { value: 0.99 }],
                    },
                    {
                      key: 'expected_goals_on_target',
                      rawStats: [{ value: 2.5 }, { value: 0.82 }],
                    },
                  ],
                },
              ],
            },
          },
        },
        playerStats: {
          10: {
            name: 'Home Player',
            teamId: 9773,
            stats: [
              {
                stats: {
                  xa: { key: 'expected_assists', stat: { value: 0.18 } },
                  xg: { key: 'expected_goals', stat: { value: 0.28 } },
                  xgot: { key: 'expected_goals_on_target_variant', stat: { value: 0.59 } },
                },
              },
            ],
          },
          20: {
            name: 'Away Player',
            teamId: 9772,
            stats: [{ stats: { xa: { key: 'expected_assists', stat: { value: 0.2 } } } }],
          },
        },
      },
    });
    expect(parsed.statistics).toEqual([
      { label: 'xG', home: 1.5, away: 0.99 },
      { label: 'xGOT', home: 2.5, away: 0.82 },
      { label: 'xA', home: 0.18, away: 0.2 },
    ]);
    expect(parsed.players[0].stats).toEqual({ xg: 0.28, xgot: 0.59, xa: 0.18 });
  });
});
