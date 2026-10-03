import { describe, expect, it } from 'vitest';
import { emptyDataset } from '@/services/football/local-store';
import { validateFootballData } from '@/services/football/data-quality';
import type { Match, Player } from '@/types/football';
import { oneEditApart, tolerantNameMatch } from '@/services/search-index';
import { legalConfig } from '@/lib/legal';
describe('Data quality and publisher honesty', () => {
  it('preserves unknown statistics and identifies invalid numbers and missing relations', () => {
    const data = emptyDataset();
    data.players = [
      {
        id: 'p',
        slug: 'p',
        name: '',
        teamId: 'missing',
        stats: { goals: null, minutes: NaN, assists: -1, appearances: 1, starts: 2 },
      } as Player,
    ];
    const report = validateFootballData(data);
    expect(report.status).toBe('FAIL');
    expect(report.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        'EMPTY_NAME',
        'PLAYER_TEAM_MISSING',
        'INVALID_STATISTIC',
        'STARTS_EXCEED_APPEARANCES',
      ]),
    );
    expect(report.issues.some((i) => i.entity.endsWith(':goals'))).toBe(false);
  });
  it('detects impossible fixtures, scores, dates and possession', () => {
    const data = emptyDataset();
    data.matches = [
      {
        id: 'm',
        slug: 'm',
        homeId: 't',
        awayId: 't',
        competitionId: 'c',
        kickoff: '2030-01-01T12:00:00Z',
        status: 'finished',
        homeScore: null,
        awayScore: -1,
        lineups: [],
        events: [],
        statistics: [{ label: 'Possession', home: 70, away: 60 }],
      } as unknown as Match,
    ];
    expect(validateFootballData(data, 0).issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        'SAME_HOME_AWAY',
        'INVALID_SCORE',
        'FINISHED_WITHOUT_SCORE',
        'FUTURE_FINISHED_MATCH',
        'INCOHERENT_POSSESSION',
      ]),
    );
  });
  it('does not invent a legal identity and rejects an invalid contact', () => {
    expect(legalConfig({ CONTACT_EMAIL: 'javascript:alert(1)' })).toMatchObject({
      editor: null,
      contact: null,
      host: 'Vercel',
    });
    expect(
      legalConfig({ LEGAL_EDITOR_NAME: 'Actual Publisher', CONTACT_EMAIL: 'contact@example.org' }),
    ).toMatchObject({ editor: 'Actual Publisher', contact: 'contact@example.org' });
  });
  it('accepts one typo and transposition without fuzzy matching short ambiguous queries', () => {
    for (const [a, b] of [
      ['ronlado', 'ronaldo'],
      ['messi', 'mesi'],
      ['pariss', 'paris'],
      ['pariz', 'paris'],
    ])
      expect(oneEditApart(a, b)).toBe(true);
    expect(oneEditApart('messi', 'ronaldo')).toBe(false);
    expect(tolerantNameMatch('cristiano ronaldo', 'ronlado')).toBe(true);
    expect(tolerantNameMatch('ajax', 'ajx')).toBe(false);
  });
});

import { reportedStatistics } from '@/services/football/reported-statistics';
it('treats impossible zero-filled possession blocks as unavailable, preserving real zeros', () => {
  expect(
    reportedStatistics([
      { label: 'Possession', home: 0, away: 0 },
      { label: 'Tirs', home: 0, away: 0 },
    ]),
  ).toEqual([]);
  expect(
    reportedStatistics([
      { label: 'Possession', home: 60, away: 40 },
      { label: 'Tirs', home: 0, away: 3 },
    ]),
  ).toEqual([
    { label: 'Possession', home: 60, away: 40 },
    { label: 'Tirs', home: 0, away: 3 },
  ]);
});
