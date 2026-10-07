import { reportedStatistics } from '../reported-statistics';
import { timed } from '@/services/telemetry';
import { z } from 'zod';
import type { MatchStat, MatchStatus, PlayerStats, Position } from '@/types/football';

export const EXPANDED_LEAGUES = {
  'por.1': {
    name: 'Liga Portugal',
    country: 'Portugal',
    flag: '🇵🇹',
    apiId: '94',
    calendar: false,
    logo: 'liga-portugal',
  },
  'ned.1': {
    name: 'Eredivisie',
    country: 'Netherlands',
    flag: '🇳🇱',
    apiId: '88',
    calendar: false,
    logo: 'eredivisie',
  },
  'bra.1': {
    name: 'Brasileirão',
    country: 'Brazil',
    flag: '🇧🇷',
    apiId: '71',
    calendar: true,
    logo: 'brasileirao',
  },
  'ksa.1': {
    name: 'Saudi Pro League',
    country: 'Saudi Arabia',
    flag: '🇸🇦',
    apiId: '307',
    calendar: false,
    logo: 'saudi-pro-league',
  },
  'usa.1': {
    name: 'Major League Soccer',
    country: 'USA',
    flag: '🇺🇸',
    apiId: '253',
    calendar: true,
    logo: 'major-league-soccer',
  },
} as const;
export function espnTeamCountry(league: ExpandedLeague, teamId: string) {
  return league === 'usa.1' && ['7318', '9720', '9727'].includes(teamId)
    ? 'Canada'
    : EXPANDED_LEAGUES[league].country;
}
export type ExpandedLeague = keyof typeof EXPANDED_LEAGUES;
export function expandedSeason(league: ExpandedLeague, now = new Date()) {
  return (
    now.getUTCFullYear() - (!EXPANDED_LEAGUES[league].calendar && now.getUTCMonth() < 6 ? 1 : 0)
  );
}
export function expandedScopes(history = false, now = new Date()) {
  return (Object.keys(EXPANDED_LEAGUES) as ExpandedLeague[]).flatMap((league) => {
    const current = expandedSeason(league, now);
    return (history ? [current - 3, current - 2, current - 1, current] : [current]).map(
      (season) => ({ league, season }),
    );
  });
}
const id = z.string().regex(/^\d{1,12}$/);
const stat = z.object({
  name: z.string(),
  displayValue: z.string().optional(),
  value: z.number().optional(),
});
const team = z.object({
  id,
  displayName: z.string().trim().min(1),
  abbreviation: z.string().optional(),
  color: z.string().optional(),
  logo: z.preprocess((v) => (v === '' || v === null ? undefined : v), z.string().url().optional()),
});
const event = z.object({
  id,
  date: z.string(),
  season: z.object({ year: z.number().int(), slug: z.string() }),
  competitions: z
    .array(
      z.object({
        timeValid: z.boolean().optional(),
        venue: z.object({ fullName: z.string().optional() }).optional(),
        status: z.object({
          period: z.number().optional(),
          type: z.object({ name: z.string(), completed: z.boolean(), state: z.string() }),
        }),
        competitors: z
          .array(
            z.object({
              homeAway: z.enum(['home', 'away']),
              score: z.string().optional(),
              team,
              statistics: z.array(stat).optional(),
            }),
          )
          .length(2),
      }),
    )
    .length(1),
});
const number = (value: string | number | undefined) => {
  if (value == null || (typeof value === 'string' && !value.trim())) return null;
  const n = Number(String(value).replace('%', ''));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const labels: Record<string, string> = {
  possessionPct: 'Possession',
  totalShots: 'Tirs',
  shotsOnTarget: 'Tirs cadrés',
  wonCorners: 'Corners',
  foulsCommitted: 'Fautes',
  yellowCards: 'Cartons jaunes',
  redCards: 'Cartons rouges',
  offsides: 'Hors-jeu',
};
export function parseEspnFixtures(input: unknown, league: ExpandedLeague, season: number) {
  const root = z.object({ events: z.array(event).max(999) }).parse(input);
  const seen = new Set<string>();
  return root.events
    .filter(
      (e) =>
        e.season.year === season &&
        !e.season.slug.includes('all-star') &&
        !(
          league === 'usa.1' &&
          e.competitions[0].competitors.some((t) => ['9817', '20279'].includes(t.team.id))
        ),
    )
    .map((e) => {
      if (seen.has(e.id)) throw new Error('ESPN_DUPLICATE_FIXTURE');
      seen.add(e.id);
      const c = e.competitions[0],
        h = c.competitors.find((t) => t.homeAway === 'home'),
        a = c.competitors.find((t) => t.homeAway === 'away');
      if (!h || !a || h.team.id === a.team.id || !Number.isFinite(Date.parse(e.date)))
        throw new Error('ESPN_INVALID_FIXTURE');
      const s = c.status.type;
      // This cached schedule is not a real-time feed: an in-progress game stays scheduled until confirmed final.
      const status: MatchStatus = /POSTPONED|SUSPENDED/.test(s.name)
        ? 'postponed'
        : /CANCEL/.test(s.name)
          ? 'cancelled'
          : /ABANDON/.test(s.name)
            ? 'abandoned'
            : s.completed
              ? 'finished'
              : 'scheduled';
      const homeScore = status === 'finished' ? number(h.score) : null,
        awayScore = status === 'finished' ? number(a.score) : null;
      if (
        status === 'finished' &&
        (homeScore == null ||
          awayScore == null ||
          !Number.isInteger(homeScore) ||
          !Number.isInteger(awayScore))
      )
        throw new Error('ESPN_INVALID_SCORE');
      const rawStatistics: MatchStat[] =
        status === 'finished'
          ? Object.entries(labels).flatMap(([key, label]) => {
              const hv = number(h.statistics?.find((s) => s.name === key)?.displayValue),
                av = number(a.statistics?.find((s) => s.name === key)?.displayValue);
              return hv != null && av != null ? [{ label, home: hv, away: av }] : [];
            })
          : [];
      return {
        externalId: e.id,
        home: h.team,
        away: a.team,
        kickoff: new Date(e.date).toISOString(),
        kickoffKnown: c.timeValid !== false,
        status,
        resultPeriod: (s.completed && c.status.period === 2 ? 'regulation' : 'unknown') as
          'regulation' | 'unknown',
        homeScore,
        awayScore,
        statistics: reportedStatistics(rawStatistics),
        venue: c.venue?.fullName,
        round: e.season.slug === 'regular-season' ? 'Saison régulière' : e.season.slug,
        countsForStandings:
          !e.season.slug.includes('playoff') && !e.season.slug.includes('mls-cup'),
      };
    });
}
const athlete = z.object({
  id,
  displayName: z.string().trim().min(1),
  jersey: z.string().optional(),
  dateOfBirth: z.string().optional(),
  citizenship: z.string().optional(),
  height: z.number().optional(),
  position: z.object({ abbreviation: z.string(), name: z.string() }).optional(),
  statistics: z
    .object({ splits: z.object({ categories: z.array(z.object({ stats: z.array(stat) })) }) })
    .optional(),
});
export function parseEspnRoster(input: unknown, teamId: string, season: number) {
  const root = z
    .object({
      team: z.object({ id }),
      season: z.object({ year: z.number().int() }),
      athletes: z.array(athlete).max(100),
    })
    .parse(input);
  if (root.team.id !== teamId || root.season.year !== season)
    throw new Error('ESPN_ROSTER_SCOPE_MISMATCH');
  const positions: Record<string, Position> = {
    G: 'Gardien',
    GK: 'Gardien',
    D: 'Défenseur',
    M: 'Milieu',
    F: 'Attaquant',
  };
  const seen = new Set<string>();
  return root.athletes.map((a) => {
    if (seen.has(a.id)) throw new Error('ESPN_DUPLICATE_PLAYER');
    seen.add(a.id);
    const values = a.statistics?.splits.categories.flatMap((c) => c.stats) ?? [];
    const get = (key: string) => {
      const s = values.find((s) => s.name === key);
      return number(s?.value ?? s?.displayValue);
    };
    const appearances = get('appearances'),
      substitute = get('subIns');
    const stats: PlayerStats = {
      appearances,
      starts:
        appearances != null && substitute != null && appearances >= substitute
          ? appearances - substitute
          : null,
      minutes: get('minutesPlayed'),
      goals: get('totalGoals'),
      assists: get('goalAssists'),
      rating: null,
      shots: get('totalShots'),
      shotsOnTarget: get('shotsOnTarget'),
      saves: get('saves'),
      conceded: get('goalsConceded'),
      cleanSheets: get('cleanSheets'),
      yellow: get('yellowCards'),
      red: get('redCards'),
      fouls: get('foulsCommitted'),
      keyPasses: get('shotAssists'),
    };
    return {
      externalId: a.id,
      name: a.displayName,
      position: positions[a.position?.abbreviation ?? ''] ?? 'Non disponible',
      number: /^\d{1,2}$/.test(a.jersey ?? '') ? Number(a.jersey) : null,
      nationality: a.citizenship,
      birthDate:
        a.dateOfBirth && Number.isFinite(Date.parse(a.dateOfBirth))
          ? new Date(a.dateOfBirth).toISOString().slice(0, 10)
          : undefined,
      height: a.height ? `${Math.round(a.height * 2.54)} cm` : undefined,
      stats,
    };
  });
}
export class EspnProvider {
  requests = 0;
  private lastRequest = 0;
  constructor(private transport: typeof fetch = fetch) {}
  async get(path: string) {
    const wait = Math.max(0, 500 - (Date.now() - this.lastRequest));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequest = Date.now();
    this.requests++;
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${path}`;
    const response = await timed('provider:espn_transport', () =>
      this.transport(url, {
        signal: AbortSignal.timeout(30000),
        cache: 'no-store',
      }),
    );
    if (!response.ok) throw new Error(`ESPN_HTTP_${response.status}`);
    const text = await response.text();
    if (text.length > 20_000_000) throw new Error('ESPN_RESPONSE_TOO_LARGE');
    return JSON.parse(text) as unknown;
  }
  async season(league: ExpandedLeague, year: number) {
    const years = EXPANDED_LEAGUES[league].calendar ? [year] : [year, year + 1];
    const events = new Map<string, unknown>();
    for (const date of years) {
      const payload = z
        .object({ events: z.array(z.object({ id }).passthrough()).max(999) })
        .parse(await this.get(`${league}/scoreboard?dates=${date}&limit=1000`));
      for (const e of payload.events) events.set(e.id, e);
    }
    return parseEspnFixtures({ events: [...events.values()] }, league, year);
  }
  async roster(league: ExpandedLeague, team: string, year: number) {
    return parseEspnRoster(
      await this.get(`${league}/teams/${team}/roster?season=${year}`),
      team,
      year,
    );
  }
}
