import { describe, it, expect, vi } from 'vitest';
import {
  parseEspnFixtures,
  parseEspnRoster,
  parseEspnSummary,
  expandedScopes,
  espnTeamCountry,
  EspnProvider,
} from '@/services/football/providers/espn';
import { derivedStandings } from '@/services/derived-standings';
const event = (id = '1', slug = 'regular-season') => ({
  id,
  date: '2026-03-15T23:30Z',
  season: { year: 2026, slug },
  competitions: [
    {
      timeValid: true,
      status: { type: { name: 'STATUS_FULL_TIME', completed: true, state: 'post' } },
      competitors: [
        {
          homeAway: 'home',
          score: '2',
          team: { id: '10', displayName: 'Club Home' },
          statistics: [{ name: 'possessionPct', displayValue: '60' }],
        },
        {
          homeAway: 'away',
          score: '1',
          team: { id: '20', displayName: 'Club Away' },
          statistics: [{ name: 'possessionPct', displayValue: '40' }],
        },
      ],
    },
  ],
});
describe('Expanded leagues: real feed normalization', () => {
  it('keeps Canadian MLS clubs in Canada while the competition is hosted in the USA', () => {
    expect(espnTeamCountry('usa.1', '9727')).toBe('Canada');
    expect(espnTeamCountry('usa.1', '20232')).toBe('USA');
  });
  it('selects calendar and split-year seasons independently in January', () => {
    const scopes = expandedScopes(false, new Date('2026-01-05'));
    expect(scopes.find((s) => s.league === 'bra.1')?.season).toBe(2026);
    expect(scopes.find((s) => s.league === 'por.1')?.season).toBe(2025);
    expect(expandedScopes(true, new Date('2026-01-05'))).toHaveLength(20);
  });
  it('preserves UTC, reported statistics and distinct repeated playoff fixtures', () => {
    const rows = parseEspnFixtures(
      { events: [event(), event('2', 'eastern-conference-playoffs---round-one')] },
      'usa.1',
      2026,
    );
    expect(rows[0].kickoff).toBe('2026-03-15T23:30:00.000Z');
    expect(rows[0].statistics).toEqual([{ label: 'Possession', home: 60, away: 40, unit: '%' }]);
    expect(rows[1].externalId).not.toBe(rows[0].externalId);
    expect(rows[1].countsForStandings).toBe(false);
    const table = derivedStandings(
      rows.map((r) => ({ ...r, competitionId: 'mls', homeId: 'h', awayId: 'a' })),
      'mls',
      'general',
    );
    expect(table.find((t) => t.teamId === 'h')?.played).toBe(1);
  });
  it('retains a missing opposing value and reads numeric provider values', () => {
    const payload = event();
    payload.competitions[0].competitors[0].statistics = [{ name: 'totalShots', value: 0 }] as never;
    payload.competitions[0].competitors[1].statistics = [];
    expect(parseEspnFixtures({ events: [payload] }, 'usa.1', 2026)[0].statistics).toEqual([
      { label: 'Tirs', home: 0, away: null },
    ]);
  });
  it('does not include another season or the all-star exhibition', () => {
    expect(parseEspnFixtures({ events: [event('1', 'all-star-game')] }, 'usa.1', 2026)).toEqual([]);
    expect(parseEspnFixtures({ events: [event()] }, 'usa.1', 2025)).toEqual([]);
  });
  it('accepts an absent club logo without discarding its fixtures', () => {
    const e = event();
    const input = {
      ...e,
      competitions: [
        {
          ...e.competitions[0],
          competitors: e.competitions[0].competitors.map((c) => ({
            ...c,
            team: { ...c.team, logo: '' },
          })),
        },
      ],
    };
    expect(parseEspnFixtures({ events: [input] }, 'ksa.1', 2026)).toHaveLength(1);
  });
  it('excludes the MLS exhibition even when the feed labels it regular season', () => {
    const e = event();
    e.competitions[0].competitors[0].team.id = '9817';
    expect(parseEspnFixtures({ events: [e] }, 'usa.1', 2026)).toEqual([]);
  });
  it('rejects duplicate identifiers and missing final scores', () => {
    expect(() => parseEspnFixtures({ events: [event(), event()] }, 'usa.1', 2026)).toThrow(
      'ESPN_DUPLICATE_FIXTURE',
    );
    const invalid = event();
    invalid.competitions[0].competitors[0].score = '';
    expect(() => parseEspnFixtures({ events: [invalid] }, 'usa.1', 2026)).toThrow(
      'ESPN_INVALID_SCORE',
    );
  });
  it('does not publish a static in-progress game as live or assign scheduled scores', () => {
    const live = event();
    live.competitions[0].status.type = {
      name: 'STATUS_IN_PROGRESS',
      completed: false,
      state: 'in',
    };
    expect(parseEspnFixtures({ events: [live] }, 'usa.1', 2026)[0]).toMatchObject({
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      statistics: [],
    });
  });
  it('validates roster scope and keeps absent season statistics unknown', () => {
    const payload = {
      team: { id: '10' },
      season: { year: 2026 },
      athletes: [
        {
          id: '42',
          displayName: 'Player',
          position: { abbreviation: 'F', name: 'Forward' },
          statistics: {
            splits: {
              categories: [
                {
                  stats: [
                    { name: 'totalGoals', value: 0 },
                    { name: 'appearances', value: 5 },
                    { name: 'subIns', value: 1 },
                  ],
                },
              ],
            },
          },
        },
      ],
    };
    const player = parseEspnRoster(payload, '10', 2026)[0];
    expect(player.stats).toMatchObject({
      goals: 0,
      assists: null,
      appearances: 5,
      starts: 4,
      minutes: null,
    });
    expect(() => parseEspnRoster(payload, '99', 2026)).toThrow('ESPN_ROSTER_SCOPE_MISMATCH');
    expect(() => parseEspnRoster(payload, '10', 2025)).toThrow('ESPN_ROSTER_SCOPE_MISMATCH');
  });
  it('maps provider-reported formations, player stats and extended team statistics', () => {
    const player = (id: string, starter: boolean) => ({
      active: true,
      starter,
      jersey: '9',
      athlete: { id, displayName: `Player ${id}` },
      position: { abbreviation: 'F', name: 'Forward' },
      stats: [
        { name: 'appearances', value: 1 },
        { name: 'totalGoals', value: id === '1' ? 1 : 0 },
      ],
    });
    const summary = parseEspnSummary({
      boxscore: {
        teams: [
          {
            team: { id: '10' },
            homeAway: 'home',
            statistics: [
              { name: 'totalPasses', displayValue: '500' },
              { name: 'passPct', displayValue: '0.8' },
              { name: 'totalTackles', displayValue: '12' },
            ],
          },
          {
            team: { id: '20' },
            homeAway: 'away',
            statistics: [
              { name: 'totalPasses', displayValue: '300' },
              { name: 'passPct', displayValue: '0.7' },
              { name: 'totalTackles', displayValue: '18' },
            ],
          },
        ],
      },
      rosters: [
        { team: { id: '10' }, formation: '4-3-3', roster: [player('1', true)] },
        { team: { id: '20' }, formation: '4-4-2', roster: [player('2', false)] },
      ],
    });
    expect(summary.statistics).toEqual([
      { label: 'Passes', home: 500, away: 300 },
      { label: 'Précision des passes', home: 80, away: 70, unit: '%' },
      { label: 'Tacles', home: 12, away: 18 },
    ]);
    expect(summary.lineups[0]).toMatchObject({ formation: '4-3-3', confirmed: true });
    expect(summary.performances[0]).toMatchObject({ playerId: '1', stats: { goals: 1 } });
    expect(summary.performances[1].stats.minutes).toBeNull();
  });
  it('merges two calendar responses by stable event id for split-year leagues', async () => {
    const transport = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify({ events: [event()] })));
    const rows = await new EspnProvider(transport).season('ksa.1', 2026);
    expect(rows).toHaveLength(1);
    expect(transport).toHaveBeenCalledTimes(2);
  });
  it('rejects potentially truncated responses at the provider limit', () => {
    expect(() =>
      parseEspnFixtures(
        { events: Array.from({ length: 1000 }, (_, i) => event(String(i))) },
        'usa.1',
        2026,
      ),
    ).toThrow();
  });
});
