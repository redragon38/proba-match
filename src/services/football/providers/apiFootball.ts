import { z } from 'zod';
import { slugify, dateKey } from '@/lib/format';
import { mapMatchPlayers, mapPosition } from './player-mapping';
import type { Competition, Injury, Match, Player, Standing, Team } from '@/types/football';
import type { FootballDataProvider, FixtureBatch } from '../provider';
import { log } from '@/lib/logger';

const teamSchema = z.object({ id: z.number(), name: z.string(), logo: z.string().nullish() });
const nullableNumber = z.number().nullish();
const fixtureSchema = z.object({
  fixture: z.object({
    id: z.number(),
    date: z.string(),
    referee: z.string().nullish(),
    venue: z.object({ name: z.string().nullish() }).nullish(),
    status: z.object({ short: z.string(), elapsed: nullableNumber, extra: nullableNumber }),
  }),
  league: z.object({
    id: z.number(),
    name: z.string(),
    country: z.string(),
    season: z.number(),
    round: z.string().nullish(),
    logo: z.string().nullish(),
  }),
  teams: z.object({ home: teamSchema, away: teamSchema }),
  goals: z.object({ home: nullableNumber, away: nullableNumber }),
  score: z
    .object({
      halftime: z.object({ home: nullableNumber, away: nullableNumber }).optional(),
      fulltime: z.object({ home: nullableNumber, away: nullableNumber }).optional(),
      extratime: z.object({ home: nullableNumber, away: nullableNumber }).optional(),
      penalty: z.object({ home: nullableNumber, away: nullableNumber }).optional(),
    })
    .optional(),
  events: z
    .array(
      z.object({
        time: z.object({ elapsed: z.number(), extra: nullableNumber }),
        team: z.object({ id: z.number() }),
        player: z.object({ name: z.string().nullish() }),
        assist: z.object({ name: z.string().nullish() }).nullish(),
        type: z.string(),
        detail: z.string().nullish(),
      }),
    )
    .optional(),
  statistics: z
    .array(
      z.object({
        team: z.object({ id: z.number() }),
        statistics: z.array(
          z.object({ type: z.string(), value: z.union([z.number(), z.string(), z.null()]) }),
        ),
      }),
    )
    .optional(),
  lineups: z
    .array(
      z.object({
        team: z.object({ id: z.number() }),
        formation: z.string().nullish(),
        coach: z.object({ name: z.string().nullish() }).nullish(),
        startXI: z.array(
          z.object({
            player: z.object({
              id: z.number(),
              name: z.string(),
              number: nullableNumber,
              grid: z.string().nullish(),
            }),
          }),
        ),
        substitutes: z.array(
          z.object({
            player: z.object({ id: z.number(), name: z.string(), number: nullableNumber }),
          }),
        ),
      }),
    )
    .optional(),
});
const statLabels: Record<string, string> = {
  'Ball Possession': 'Possession',
  'Total Shots': 'Tirs',
  'Shots on Goal': 'Tirs cadrés',
  'Shots off Goal': 'Tirs non cadrés',
  'Blocked Shots': 'Tirs bloqués',
  'Shots insidebox': 'Tirs dans la surface',
  'Shots outsidebox': 'Tirs hors surface',
  'Big Chances': 'Grosses occasions',
  'Big Chances Missed': 'Grosses occasions manquées',
  'Corner Kicks': 'Corners',
  Fouls: 'Fautes',
  'Yellow Cards': 'Cartons jaunes',
  'Red Cards': 'Cartons rouges',
  Offsides: 'Hors-jeu',
  'Goalkeeper Saves': 'Arrêts',
  'Total passes': 'Passes',
  'Passes accurate': 'Passes réussies',
  'Accurate Passes': 'Passes réussies',
  'Passes %': 'Précision des passes',
  Tackles: 'Tacles',
  Interceptions: 'Interceptions',
  Clearances: 'Dégagements',
  'Total Duels': 'Duels',
  'Duels won': 'Duels gagnés',
  expected_goals: 'xG',
  'Expected Goals': 'xG',
};
const numeric = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const n = typeof value === 'string' ? Number(value.replace('%', '')) : Number(value);
  return Number.isFinite(n) ? n : null;
};
export function mapFixture(input: unknown, now = new Date()): FixtureBatch {
  const f = fixtureSchema.parse(input);
  const competition: Competition = {
    id: String(f.league.id),
    slug: `${slugify(f.league.name)}-${f.league.id}`,
    name: f.league.name,
    country: f.league.country,
    season: f.league.season,
    flag: '⚽',
    logo: f.league.logo ?? undefined,
  };
  const teams: Team[] = [f.teams.home, f.teams.away].map((t) => ({
    id: String(t.id),
    slug: `${slugify(t.name)}-${t.id}`,
    name: t.name,
    short: t.name.slice(0, 3).toUpperCase(),
    color: '#365e6d',
    country: f.league.country,
    competitionId: competition.id,
    logo: t.logo ?? undefined,
  }));
  const short = f.fixture.status.short;
  const status: Match['status'] = ['FT', 'AET', 'PEN'].includes(short)
    ? 'finished'
    : ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(short)
      ? 'live'
      : ['PST', 'SUSP', 'INT', 'TBD'].includes(short)
        ? 'postponed'
        : short === 'ABD'
          ? 'abandoned'
          : ['CANC', 'AWD', 'WO'].includes(short)
            ? 'cancelled'
            : 'scheduled';
  const match: Match = {
    id: String(f.fixture.id),
    slug: `${teams[0].slug}-${teams[1].slug}-${f.fixture.id}`,
    homeId: teams[0].id,
    awayId: teams[1].id,
    competitionId: competition.id,
    kickoff: f.fixture.date,
    status,
    phase: short === 'HT' ? 'halftime' : status === 'live' ? 'playing' : undefined,
    minute: f.fixture.status.elapsed,
    extra: f.fixture.status.extra,
    homeScore: f.goals.home ?? null,
    awayScore: f.goals.away ?? null,
    scoreBreakdown: f.score,
    round: f.league.round ?? '',
    venue: f.fixture.venue?.name ?? undefined,
    referee: f.fixture.referee ?? undefined,
    updatedAt: now.toISOString(),
    source: 'api-football',
    events: [],
    lineups: [],
    statistics: [],
  };
  match.events = (f.events ?? []).flatMap((e) => {
    const type =
      e.type === 'Goal'
        ? e.detail?.toLowerCase().includes('missed penalty')
          ? 'penalty-miss'
          : 'goal'
        : e.type === 'Card'
          ? e.detail?.includes('Red')
            ? 'red'
            : 'yellow'
          : e.type === 'subst'
            ? 'substitution'
            : e.type === 'Var'
              ? 'var'
              : null;
    return type
      ? [
          {
            minute: e.time.elapsed,
            extra: e.time.extra,
            teamId: String(e.team.id),
            type,
            player: e.player.name ?? 'Joueur non renseigné',
            assist: e.assist?.name,
            detail: e.detail ?? undefined,
          },
        ]
      : [];
  });
  const homeStats = f.statistics?.find((s) => String(s.team.id) === match.homeId)?.statistics ?? [],
    awayStats = f.statistics?.find((s) => String(s.team.id) === match.awayId)?.statistics ?? [];
  match.statistics = [...new Set([...homeStats, ...awayStats].map((stat) => stat.type))]
    .map((key) => ({
      label: statLabels[key] ?? key,
      home: numeric(homeStats.find((s) => s.type === key)?.value),
      away: numeric(awayStats.find((s) => s.type === key)?.value),
      unit: key === 'Ball Possession' || key === 'Passes %' || key.includes('%') ? '%' : undefined,
    }))
    .filter((stat) => stat.home !== null || stat.away !== null);
  match.lineups = (f.lineups ?? []).map((l) => ({
    teamId: String(l.team.id),
    formation: l.formation ?? 'Non disponible',
    coach: l.coach?.name ?? undefined,
    confirmed: l.startXI.length === 11,
    starters: l.startXI.map(({ player: p }, i) => ({
      id: String(p.id),
      name: p.name,
      number: p.number ?? null,
      row: p.grid ? Number(p.grid.split(':')[0]) : Math.floor(i / 4) + 1,
      column: p.grid ? Number(p.grid.split(':')[1]) : (i % 4) + 1,
    })),
    substitutes: l.substitutes.map(({ player: p }) => ({
      id: String(p.id),
      name: p.name,
      number: p.number ?? null,
    })),
  }));
  const extra = z.object({ players: z.unknown().optional() }).parse(input);
  match.performances = mapMatchPlayers(extra.players);
  return { matches: [match], teams, competitions: [competition] };
}
export class ApiFootballProvider implements FootballDataProvider {
  readonly name = 'api-football';
  private pages = 1;
  constructor(
    private key: string,
    private reserve: () => Promise<void>,
    private fetcher: typeof fetch = fetch,
  ) {}
  private async request(endpoint: string, params: Record<string, string>): Promise<unknown[]> {
    await this.reserve();
    const response = await this.fetcher(
      `https://v3.football.api-sports.io/${endpoint}?${new URLSearchParams(params)}`,
      {
        headers: { 'x-apisports-key': this.key },
        signal: AbortSignal.timeout(15000),
        cache: 'no-store',
      },
    );
    if (!response.ok) throw new Error(`API_HTTP_${response.status}`);
    const body = z
      .object({
        errors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
        response: z.array(z.unknown()),
        paging: z.object({ total: z.number() }).optional(),
      })
      .parse(await response.json());
    if (Object.keys(body.errors).length) throw new Error('API_PROVIDER_ERROR');
    this.pages = body.paging?.total ?? 1;
    return body.response;
  }
  private batch(rows: unknown[]): FixtureBatch {
    const mapped = rows.map((r) => mapFixture(r));
    return {
      matches: mapped.flatMap((r) => r.matches),
      teams: [...new Map(mapped.flatMap((r) => r.teams).map((t) => [t.id, t])).values()],
      competitions: [
        ...new Map(mapped.flatMap((r) => r.competitions).map((c) => [c.id, c])).values(),
      ],
    };
  }
  async fixtures(date: string) {
    return this.batch(await this.request('fixtures', { date, timezone: 'Europe/Paris' }));
  }
  async discover(league: string, date: string) {
    return this.batch(await this.request('fixtures', { league, date, timezone: 'UTC' }));
  }
  async details(ids: string[], detailedIds: string[] = []) {
    if (!ids.length)
      return { matches: [], teams: [], competitions: [], enriched: [], detailFailed: false };
    if (ids.length > 20) throw new Error('MAX_20_FIXTURES');
    const requested = new Set(detailedIds.slice(0, 1));
    const enriched: string[] = [];
    const rows = await this.request('fixtures', { ids: ids.join('-') });
    for (const row of rows) {
      const id = z.object({ fixture: z.object({ id: z.number() }) }).parse(row).fixture.id;
      if (!requested.has(String(id))) continue;
      const fields = row as Record<string, unknown>;
      try {
        // These are separate API-Football endpoints; the fixtures response alone has no match detail.
        fields.events = await this.request('fixtures/events', { fixture: String(id) });
        fields.statistics = await this.request('fixtures/statistics', { fixture: String(id) });
        fields.lineups = await this.request('fixtures/lineups', { fixture: String(id) });
        fields.players = await this.request('fixtures/players', { fixture: String(id) });
        enriched.push(String(id));
      } catch {
        log('SECONDARY_DETAILS_UNAVAILABLE', { code: 'DETAIL_OR_QUOTA_FAILURE' });
      }
    }
    const batch = this.batch(rows);
    batch.matches = batch.matches.map((m) => ({
      ...m,
      detailsUpdatedAt: new Date().toISOString(),
    }));
    return { ...batch, enriched, detailFailed: requested.size > enriched.length };
  }
  async standings(competitionId: string, season: number): Promise<Standing[]> {
    const rows = await this.request('standings', { league: competitionId, season: String(season) });
    const schema = z.object({
      league: z.object({
        standings: z.array(
          z.array(
            z.object({
              rank: z.number(),
              team: teamSchema,
              points: z.number(),
              form: z.string().nullish(),
              all: z.object({
                played: z.number(),
                win: z.number(),
                draw: z.number(),
                lose: z.number(),
                goals: z.object({ for: z.number(), against: z.number() }),
              }),
            }),
          ),
        ),
      }),
    });
    // Grouped competitions need separate tables; don't silently flatten groups.
    if (!rows.length) return [];
    const groups = schema.parse(rows[0]).league.standings;
    if (groups.length !== 1) return [];
    return groups[0].map((r) => ({
      teamId: String(r.team.id),
      position: r.rank,
      played: r.all.played,
      won: r.all.win,
      drawn: r.all.draw,
      lost: r.all.lose,
      scored: r.all.goals.for,
      conceded: r.all.goals.against,
      points: r.points,
      form: (r.form ?? '').split('').map((v) => (v === 'W' ? 'V' : v === 'D' ? 'N' : 'D')),
    }));
  }
  async players(teamId: string, season: number, competitionId?: string): Promise<Player[]> {
    const scope = {
      team: teamId,
      season: String(season),
      ...(competitionId ? { league: competitionId } : {}),
    };
    const rows = await this.request('players', scope);
    const pages = this.pages;
    if (pages > 20) throw new Error('API_PAGINATION_LIMIT');
    for (let page = 2; page <= pages; page++)
      rows.push(
        ...(await this.request('players', {
          ...scope,
          page: String(page),
        })),
      );
    const schema = z.object({
      player: z.object({
        id: z.number(),
        name: z.string(),
        nationality: z.string().nullish(),
        photo: z.string().nullish(),
        height: z.string().nullish(),
        birth: z.object({ date: z.string().nullish() }),
      }),
      statistics: z.array(
        z.object({
          games: z.object({
            appearences: nullableNumber,
            lineups: nullableNumber,
            minutes: nullableNumber,
            number: nullableNumber,
            position: z.string().nullish(),
            rating: z.string().nullish(),
          }),
          goals: z.object({
            total: nullableNumber,
            assists: nullableNumber,
            saves: nullableNumber,
            conceded: nullableNumber,
          }),
          shots: z.object({ total: nullableNumber, on: nullableNumber }),
          cards: z.object({ yellow: nullableNumber, red: nullableNumber }),
        }),
      ),
    });
    return rows.map((row) => {
      const r = schema.parse(row),
        s = r.statistics[0];
      return {
        id: String(r.player.id),
        slug: `${slugify(r.player.name)}-${r.player.id}`,
        name: r.player.name,
        updatedAt: new Date().toISOString(),
        teamId,
        position: mapPosition(s?.games.position),
        number: s?.games.number ?? null,
        nationality: r.player.nationality ?? undefined,
        photo: r.player.photo ?? undefined,
        height: r.player.height ?? undefined,
        birthDate: r.player.birth.date ?? undefined,
        stats: {
          appearances: s?.games.appearences ?? null,
          starts: s?.games.lineups ?? null,
          minutes: s?.games.minutes ?? null,
          goals: s?.goals.total ?? null,
          assists: s?.goals.assists ?? null,
          rating: numeric(s?.games.rating),
          shots: s?.shots.total ?? null,
          shotsOnTarget: s?.shots.on ?? null,
          saves: s?.goals.saves ?? null,
          conceded: s?.goals.conceded ?? null,
          yellow: s?.cards.yellow ?? null,
          red: s?.cards.red ?? null,
        },
      };
    });
  }
  async teams(competitionId: string, season: number): Promise<Team[]> {
    const rows = await this.request('teams', { league: competitionId, season: String(season) });
    const schema = z.object({
      team: teamSchema.extend({ country: z.string().nullish() }),
      venue: z.object({ name: z.string().nullish() }),
    });
    return rows.map((row) => {
      const { team: t, venue } = schema.parse(row);
      return {
        id: String(t.id),
        slug: `${slugify(t.name)}-${t.id}`,
        name: t.name,
        short: t.name.slice(0, 3).toUpperCase(),
        country: t.country ?? 'Non disponible',
        competitionId,
        logo: t.logo ?? undefined,
        color: '#365e6d',
        venue: venue.name ?? undefined,
      };
    });
  }
  async injuries(competitionId: string, season: number): Promise<Injury[]> {
    const rows = await this.request('injuries', {
      league: competitionId,
      season: String(season),
      date: dateKey(),
    });
    const schema = z.object({
      player: z.object({ id: z.number(), reason: z.string(), type: z.string() }),
      team: z.object({ id: z.number() }),
      fixture: z.object({ id: z.number() }),
    });
    return rows.map((row) => {
      const r = schema.parse(row);
      return {
        id: `${r.fixture.id}-${r.player.id}`,
        playerId: String(r.player.id),
        teamId: String(r.team.id),
        reason: r.player.reason,
        status:
          r.player.type === 'Missing Fixture'
            ? 'Absent'
            : r.player.type === 'Questionable'
              ? 'Incertain'
              : 'Non disponible',
      };
    });
  }
}
