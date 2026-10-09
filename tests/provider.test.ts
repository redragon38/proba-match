import { describe, expect, it, vi } from 'vitest';
import { ApiFootballProvider, mapFixture } from '@/services/football/providers/apiFootball';
import { regulationResult } from '@/prediction-engine/result-period';
const fixture = {
  fixture: {
    id: 123,
    date: '2026-09-11T19:00:00Z',
    referee: null,
    venue: { name: null },
    status: { short: 'NS', elapsed: null },
  },
  league: { id: 61, name: 'Ligue 1', country: 'France', season: 2026, round: 'Regular Season - 1' },
  teams: { home: { id: 1, name: 'Paris' }, away: { id: 2, name: 'Lyon' } },
  goals: { home: null, away: null },
};
describe('API-Football', () => {
  it('maps supplied advanced statistics and preserves missing opponents without inventing zero', () => {
    const match = mapFixture({
      ...fixture,
      statistics: [
        {
          team: { id: 1 },
          statistics: [
            { type: 'expected_goals_on_target', value: 0 },
            { type: 'expected_assists', value: '1.25' },
            { type: 'PPDA', value: 10.5 },
            { type: 'Total passes', value: ' ' },
          ],
        },
      ],
    }).matches[0];
    expect(match.statistics).toEqual([
      { label: 'xGOT', home: 0, away: null, unit: undefined },
      { label: 'xA', home: 1.25, away: null, unit: undefined },
      { label: 'PPDA', home: 10.5, away: null, unit: undefined },
    ]);
    expect(match.statistics.some((row) => row.label === 'xG')).toBe(false);
  });
  it('keeps the extra-time final separate from the regulation result', () => {
    const m = mapFixture({
      ...fixture,
      fixture: { ...fixture.fixture, status: { short: 'AET' } },
      goals: { home: 2, away: 1 },
      score: { fulltime: { home: 1, away: 1 }, extratime: { home: 2, away: 1 } },
    }).matches[0];
    expect(m.resultPeriod).toBe('extra-time');
    expect(m.homeScore).toBe(2);
    expect(regulationResult(m)).toMatchObject({ homeScore: 1, awayScore: 1 });
    expect(regulationResult({ ...m, scoreBreakdown: undefined })).toBeNull();
  });
  it('selects player statistics by team, competition and season, not the first block', async () => {
    const stat = (league: number, goals: number) => ({
      team: { id: 1 },
      league: { id: league, season: 2026 },
      games: { position: 'Attacker' },
      goals: { total: goals },
      shots: {},
      cards: {},
    });
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            errors: [],
            response: [
              {
                player: { id: 9, name: 'Player', birth: {} },
                statistics: [stat(39, 30), stat(61, 5)],
              },
            ],
          }),
        ),
    );
    const provider = new ApiFootballProvider('test', async () => {}, fetcher as typeof fetch);
    const rows = await provider.players('1', 2026, '61');
    expect(rows[0].stats.goals).toBe(5);
    expect(rows[0].statsScope).toMatchObject({
      competitionId: '61',
      teamId: '1',
      season: 2026,
      verified: true,
    });
  });
  it('does not arbitrarily pick one of two matching player statistic blocks', async () => {
    const stat = {
      team: { id: 1 },
      league: { id: 61, season: 2026 },
      games: {},
      goals: { total: 5 },
      shots: {},
      cards: {},
    };
    const provider = new ApiFootballProvider(
      'test',
      async () => {},
      async () =>
        new Response(
          JSON.stringify({
            errors: [],
            response: [
              {
                player: { id: 9, name: 'Player', birth: {} },
                statistics: [stat, { ...stat, goals: { total: 8 } }],
              },
            ],
          }),
        ),
    );
    const rows = await provider.players('1', 2026, '61');
    expect(rows[0].stats.goals).toBeNull();
    expect(rows[0].statsScope).toBeUndefined();
  });
  it('normalise sans inventer scores et statistiques', () => {
    const { matches, teams } = mapFixture(fixture);
    expect(matches[0].status).toBe('scheduled');
    expect(matches[0].homeScore).toBeNull();
    expect(matches[0].statistics.every((s) => s.home === null && s.away === null)).toBe(true);
    expect(teams[0].id).toBe('1');
  });
  it.each([
    ['1H', 'live'],
    ['HT', 'live'],
    ['FT', 'finished'],
    ['PST', 'postponed'],
    ['CANC', 'cancelled'],
    ['AWD', 'cancelled'],
  ])('mappe %s vers %s', (short, status) =>
    expect(
      mapFixture({ ...fixture, fixture: { ...fixture.fixture, status: { short } } }).matches[0]
        .status,
    ).toBe(status),
  );
  it('refuse une réponse de structure invalide', () =>
    expect(() => mapFixture({ id: 123 })).toThrow());
  it('distingue la mi-temps des 45 premières minutes', () => {
    const map = (short: string) =>
      mapFixture({ ...fixture, fixture: { ...fixture.fixture, status: { short, elapsed: 45 } } })
        .matches[0];
    expect(map('HT').phase).toBe('halftime');
    expect(map('1H').phase).toBe('playing');
  });
  it('ne transforme pas un penalty manqué en but', () => {
    const mapped = mapFixture({
      ...fixture,
      events: [
        {
          time: { elapsed: 74, extra: null },
          team: { id: 1 },
          player: { name: 'Joueur 9' },
          assist: null,
          type: 'Goal',
          detail: 'Missed Penalty',
        },
      ],
    }).matches[0];
    expect(mapped.events[0].type).toBe('penalty-miss');
  });
  it('réserve le quota avant chaque appel et garde la clé dans les headers', async () => {
    const reserve = vi.fn(async () => {});
    const fetcher = vi.fn(
      async () => new Response(JSON.stringify({ errors: [], response: [fixture] })),
    );
    const provider = new ApiFootballProvider('test-key', reserve, fetcher as typeof fetch);
    const result = await provider.fixtures('2026-09-11');
    expect(result.matches).toHaveLength(1);
    expect(reserve).toHaveBeenCalledTimes(1);
    const call = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(call[0]).not.toContain('test-key');
    expect(call[1].headers).toEqual({ 'x-apisports-key': 'test-key' });
  });
  it('ne lance pas de requête si le quota est épuisé', async () => {
    const fetcher = vi.fn();
    const provider = new ApiFootballProvider(
      'test',
      async () => {
        throw Error('quota');
      },
      fetcher,
    );
    await expect(provider.fixtures('2026-09-11')).rejects.toThrow('quota');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('récupère les endpoints de détail séparés et ne confond pas statistiques absentes et zéro', async () => {
    const responses: Record<string, unknown[]> = {
      fixtures: [
        {
          ...fixture,
          fixture: { ...fixture.fixture, status: { short: 'FT', elapsed: 90 } },
          goals: { home: 1, away: 0 },
        },
      ],
      'fixtures/events': [
        {
          time: { elapsed: 42, extra: null },
          team: { id: 1 },
          player: { name: 'Joueur 9' },
          assist: null,
          type: 'Goal',
          detail: 'Normal Goal',
        },
      ],
      'fixtures/statistics': [
        {
          team: { id: 1 },
          statistics: [
            { type: 'Ball Possession', value: '58%' },
            { type: 'Shots on Goal', value: 6 },
            { type: 'Blocked Shots', value: 0 },
          ],
        },
        {
          team: { id: 2 },
          statistics: [
            { type: 'Ball Possession', value: '42%' },
            { type: 'Shots on Goal', value: null },
          ],
        },
      ],
      'fixtures/lineups': [
        {
          team: { id: 1 },
          formation: '4-4-2',
          coach: { name: null },
          startXI: [{ player: { id: 9, name: 'Joueur 9', number: 9, grid: '1:1' } }],
          substitutes: [],
        },
      ],
      'fixtures/players': [
        {
          team: { id: 1 },
          players: [
            {
              player: { id: 9, name: 'Joueur 9', photo: 'https://example.com/player-9.png' },
              statistics: [
                {
                  games: { minutes: 90, position: 'F', number: 9, substitute: false },
                  goals: { total: 1 },
                },
              ],
            },
          ],
        },
      ],
    };
    const reserve = vi.fn(async () => {});
    const fetcher = vi.fn(
      async (url: string) =>
        new Response(
          JSON.stringify({ errors: [], response: responses[new URL(url).pathname.slice(1)] ?? [] }),
        ),
    );
    const provider = new ApiFootballProvider('test', reserve, fetcher as typeof fetch);
    const result = await provider.details(['123'], ['123']);
    expect(result.enriched).toEqual(['123']);
    expect(result.matches[0].events).toHaveLength(1);
    expect(result.matches[0].lineups[0].starters[0].id).toBe('9');
    expect(result.matches[0].performances?.[0].stats.goals).toBe(1);
    expect(result.matches[0].performances?.[0].photo).toBe('https://example.com/player-9.png');
    expect(result.matches[0].statistics.find((stat) => stat.label === 'Tirs bloqués')?.home).toBe(
      0,
    );
    expect(
      result.matches[0].statistics.find((stat) => stat.label === 'Tirs cadrés')?.away,
    ).toBeNull();
    expect(reserve).toHaveBeenCalledTimes(5);
  });
  it('détecte les erreurs métier même avec HTTP 200', async () => {
    const provider = new ApiFootballProvider(
      'test',
      async () => {},
      async () => new Response(JSON.stringify({ errors: { requests: 'quota' }, response: [] })),
    );
    await expect(provider.fixtures('2026-09-11')).rejects.toThrow('API_PROVIDER_ERROR');
  });
});
