import { expect, it } from 'vitest';
import { createDemoDataset } from '@/services/football/providers/mock';
import { applyFotmobListing, fotmobLiveSelection } from '@/services/football/fotmob-live-state';
import { regulationResult } from '@/prediction-engine/result-period';
import { parseFotmobMatches } from '@/services/football/providers/fotmob';

it('recovers a delayed fixture within seven days while keeping rapid polling bounded', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  const data = createDemoDataset(now);
  const fixture = {
    ...data.matches[0],
    status: 'scheduled' as const,
    source: 'openfootball' as const,
    kickoff: '2026-10-19T19:00:00Z',
    homeScore: null,
    awayScore: null,
  };
  data.matches = [
    fixture,
    { ...fixture, id: 'ancient', kickoff: '2020-01-01T12:00:00Z' },
    { ...fixture, id: 'cancelled', status: 'cancelled' },
    { ...fixture, id: 'postponed', status: 'postponed' },
  ];
  expect(fotmobLiveSelection(data, now)).toEqual([]);
  expect(fotmobLiveSelection(data, now, true)).toEqual([fixture]);
  const row = parseFotmobMatches({
    leagues: [
      {
        matches: [
          {
            id: 1,
            home: { id: 1, name: 'Home', score: 2 },
            away: { id: 2, name: 'Away', score: 1 },
            status: { finished: true, utcTime: fixture.kickoff },
          },
        ],
      },
    ],
  })[0];
  const result = applyFotmobListing(fixture, row, now.toISOString());
  expect(result).toMatchObject({
    source: 'fotmob',
    status: 'finished',
    homeScore: 2,
    awayScore: 1,
    provenance: { schedule: 'openfootball', details: 'fotmob' },
    resultPeriod: 'unknown',
  });
  expect(regulationResult(result)).toBeNull();
  expect(result.resultObservedAt).toBe(now.toISOString());
  expect(
    applyFotmobListing(
      result,
      { ...row, status: { ...row.status, finished: false } },
      now.toISOString(),
    ),
  ).toBe(result);
});
