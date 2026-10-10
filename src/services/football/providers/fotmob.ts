import { z } from 'zod';
import type { MatchStat, PlayerStats } from '@/types/football';

const finite = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;

const team = z.object({ id: z.number().int().positive(), name: z.string().trim().min(1) });
const listedMatch = z.object({
  id: z.number().int().positive(),
  home: team.extend({ score: z.number().int().nonnegative().nullish() }),
  away: team.extend({ score: z.number().int().nonnegative().nullish() }),
  status: z.object({
    utcTime: z.string(),
    finished: z.boolean().optional(),
    started: z.boolean().optional(),
    ongoing: z.boolean().optional(),
    cancelled: z.boolean().optional(),
    liveTime: z.object({ short: z.union([z.string(), z.number()]).optional() }).nullish(),
    reason: z.object({ short: z.string().optional() }).nullish(),
  }),
});

export type FotmobListedMatch = z.infer<typeof listedMatch>;

export function parseFotmobMatches(input: unknown): FotmobListedMatch[] {
  const root = z
    .object({ leagues: z.array(z.object({ matches: z.array(listedMatch).max(100) })).max(250) })
    .parse(input);
  return root.leagues.flatMap((league) => league.matches);
}

const compactName = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(fc|cf|sc|ac|afc|club|football|futebol|deportivo)\b/g, '')
    .replace(/[^a-z0-9]/g, '');

/** Scores, kickoff and both teams must agree; a name alone can never bind a match. */
export function identifyFotmobMatch(
  rows: FotmobListedMatch[],
  expected: {
    kickoff: string;
    homeName: string;
    awayName: string;
    homeScore: number | null;
    awayScore: number | null;
  },
) {
  const kickoff = Date.parse(expected.kickoff);
  const candidates = rows.filter(
    (row) =>
      row.status.finished === true &&
      Number.isFinite(kickoff) &&
      Math.abs(Date.parse(row.status.utcTime) - kickoff) <= 15 * 60_000 &&
      row.home.score === expected.homeScore &&
      row.away.score === expected.awayScore &&
      compactName(row.home.name) === compactName(expected.homeName) &&
      compactName(row.away.name) === compactName(expected.awayName),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

/** A future/live fixture is bound only when kickoff and both normalized team names agree uniquely. */
export function identifyFotmobFixture(
  rows: FotmobListedMatch[],
  expected: { kickoff: string; homeName: string; awayName: string },
) {
  const kickoff = Date.parse(expected.kickoff);
  const candidates = rows.filter(
    (row) =>
      Number.isFinite(kickoff) &&
      Math.abs(Date.parse(row.status.utcTime) - kickoff) <= 15 * 60_000 &&
      compactName(row.home.name) === compactName(expected.homeName) &&
      compactName(row.away.name) === compactName(expected.awayName),
  );
  return candidates.length === 1 ? candidates[0] : null;
}

type ProviderPlayer = {
  externalId: string;
  teamExternalId: string;
  name: string;
  stats: Pick<PlayerStats, 'xg' | 'xgot' | 'xa'>;
};

const teamLabels: Record<string, { label: string; unit?: string }> = {
  expected_goals: { label: 'xG' },
  expected_goals_on_target: { label: 'xGOT' },
  touches_opp_box: { label: 'Touches dans la surface' },
  big_chance: { label: 'Grosses occasions' },
  big_chance_missed_title: { label: 'Grosses occasions manquées' },
  ShotsOffTarget: { label: 'Tirs non cadrés' },
  shots_inside_box: { label: 'Tirs dans la surface' },
  shots_outside_box: { label: 'Tirs hors surface' },
  duel_won: { label: 'Duels gagnés' },
};

export function parseFotmobDetails(input: unknown) {
  const root = z
    .object({
      general: z.object({
        matchId: z.string().regex(/^\d+$/),
        homeTeam: team,
        awayTeam: team,
      }),
      content: z.object({
        stats: z.object({ Periods: z.record(z.string(), z.unknown()) }),
        playerStats: z.record(z.string(), z.unknown()).optional().default({}),
      }),
    })
    .parse(input);
  const all = root.content.stats.Periods.All;
  const groups = z
    .object({
      stats: z.array(
        z.object({
          stats: z.array(
            z.object({
              key: z.string(),
              rawStats: z.array(z.unknown()).length(2).nullish(),
              type: z.string().optional(),
            }),
          ),
        }),
      ),
    })
    .parse(all);
  const seen = new Set<string>();
  const statistics: MatchStat[] = [];
  for (const row of groups.stats.flatMap((group) => group.stats)) {
    const config = teamLabels[row.key];
    if (!config || seen.has(config.label) || row.type === 'title') continue;
    const home = finite((row.rawStats?.[0] as { value?: unknown } | null)?.value);
    const away = finite((row.rawStats?.[1] as { value?: unknown } | null)?.value);
    if (home === null && away === null) continue;
    seen.add(config.label);
    statistics.push({
      label: config.label,
      home,
      away,
      ...(config.unit ? { unit: config.unit } : {}),
    });
  }
  const players: ProviderPlayer[] = [];
  for (const [externalId, raw] of Object.entries(root.content.playerStats)) {
    const player = z
      .object({
        name: z.string().trim().min(1),
        teamId: z.number().int().positive(),
        stats: z.array(
          z.object({
            stats: z.record(
              z.string(),
              z.object({
                key: z.string().nullish(),
                stat: z.object({ value: z.number().nullish() }),
              }),
            ),
          }),
        ),
      })
      .safeParse(raw);
    if (!player.success) continue;
    const values = new Map<string, number>();
    for (const item of player.data.stats.flatMap((group) => Object.values(group.stats))) {
      const value = finite(item.stat.value);
      if (item.key && value !== null) values.set(item.key, value);
    }
    const stats = {
      xg: values.get('expected_goals') ?? null,
      xgot: values.get('expected_goals_on_target_variant') ?? null,
      xa: values.get('expected_assists') ?? null,
    };
    if (Object.values(stats).every((value) => value === null)) continue;
    players.push({
      externalId,
      teamExternalId: String(player.data.teamId),
      name: player.data.name,
      stats,
    });
  }
  const xa = (teamId: number) => {
    const values = players
      .filter((player) => player.teamExternalId === String(teamId) && player.stats.xa != null)
      .map((player) => player.stats.xa!);
    return values.length ? Number(values.reduce((sum, value) => sum + value, 0).toFixed(2)) : null;
  };
  const homeXa = xa(root.general.homeTeam.id),
    awayXa = xa(root.general.awayTeam.id);
  if (homeXa !== null || awayXa !== null)
    statistics.push({ label: 'xA', home: homeXa, away: awayXa });
  return {
    matchId: root.general.matchId,
    teams: [root.general.homeTeam, root.general.awayTeam],
    statistics,
    players,
  };
}

export class FotmobProvider {
  requests = 0;
  constructor(private transport: typeof fetch = fetch) {}
  private async get(path: string) {
    this.requests++;
    const response = await this.transport(`https://www.fotmob.com/api/data/${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': 'ProbaMatch/1.0 data-sync' },
    });
    if (!response.ok) throw new Error(`FOTMOB_HTTP_${response.status}`);
    const text = await response.text();
    if (text.length > 20_000_000) throw new Error('FOTMOB_RESPONSE_TOO_LARGE');
    return JSON.parse(text) as unknown;
  }
  async matches(date: string) {
    if (!/^\d{8}$/.test(date)) throw new Error('FOTMOB_INVALID_DATE');
    return parseFotmobMatches(await this.get(`matches?date=${date}`));
  }
  async details(matchId: string) {
    if (!/^\d+$/.test(matchId)) throw new Error('FOTMOB_INVALID_MATCH');
    return parseFotmobDetails(await this.get(`matchDetails?matchId=${matchId}`));
  }
}
