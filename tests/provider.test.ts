import { describe, expect, it, vi } from 'vitest';
import { ApiFootballProvider, mapFixture } from '@/services/football/providers/apiFootball';
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
  it('détecte les erreurs métier même avec HTTP 200', async () => {
    const provider = new ApiFootballProvider(
      'test',
      async () => {},
      async () => new Response(JSON.stringify({ errors: { requests: 'quota' }, response: [] })),
    );
    await expect(provider.fixtures('2026-09-11')).rejects.toThrow('API_PROVIDER_ERROR');
  });
});
