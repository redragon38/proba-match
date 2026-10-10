import { z } from 'zod';
import type { MatchStat } from '@/types/football';

const base = 'https://raw.githubusercontent.com/statsbomb/open-data/master/data';
const team = z.object({
  home_team_id: z.number().int().positive().optional(),
  away_team_id: z.number().int().positive().optional(),
  home_team_name: z.string().optional(),
  away_team_name: z.string().optional(),
});

export const statsbombCompetitionSchema = z.object({
  competition_id: z.number().int().positive(),
  season_id: z.number().int().positive(),
  competition_name: z.string(),
  season_name: z.string(),
});
export type StatsbombCompetition = z.infer<typeof statsbombCompetitionSchema>;

const matchSchema = z.object({
  match_id: z.number().int().positive(),
  match_date: z.iso.date(),
  kick_off: z.string(),
  home_team: team,
  away_team: team,
  home_score: z.number().int().nonnegative(),
  away_score: z.number().int().nonnegative(),
});
export type StatsbombMatch = z.infer<typeof matchSchema>;

const eventSchema = z.object({
  type: z.object({ name: z.string() }),
  team: z.object({ id: z.number().int().positive(), name: z.string() }),
  location: z.array(z.number()).min(2).max(3).optional(),
  pass: z
    .object({
      end_location: z.array(z.number()).min(2).max(3),
      outcome: z.object({ name: z.string() }).optional(),
    })
    .optional(),
  carry: z.object({ end_location: z.array(z.number()).min(2).max(3) }).optional(),
});

const xtGrid = [
  [
    0.00638303, 0.00779616, 0.00844854, 0.00977659, 0.01126267, 0.01248344, 0.01473596, 0.0174506,
    0.02122129, 0.02756312, 0.03485072, 0.0379259,
  ],
  [
    0.00750072, 0.00878589, 0.00942382, 0.0105949, 0.01214719, 0.0138454, 0.01611813, 0.01870347,
    0.02401521, 0.02953272, 0.04066992, 0.04647721,
  ],
  [
    0.0088799, 0.00977745, 0.01001304, 0.01110462, 0.01269174, 0.01429128, 0.01685596, 0.01935132,
    0.0241224, 0.02855202, 0.05491138, 0.06442595,
  ],
  [
    0.00941056, 0.01082722, 0.01016549, 0.01132376, 0.01262646, 0.01484598, 0.01689528, 0.0199707,
    0.02385149, 0.03511326, 0.10805102, 0.25745362,
  ],
  [
    0.00941056, 0.01082722, 0.01016549, 0.01132376, 0.01262646, 0.01484598, 0.01689528, 0.0199707,
    0.02385149, 0.03511326, 0.10805102, 0.25745362,
  ],
  [
    0.0088799, 0.00977745, 0.01001304, 0.01110462, 0.01269174, 0.01429128, 0.01685596, 0.01935132,
    0.0241224, 0.02855202, 0.05491138, 0.06442595,
  ],
  [
    0.00750072, 0.00878589, 0.00942382, 0.0105949, 0.01214719, 0.0138454, 0.01611813, 0.01870347,
    0.02401521, 0.02953272, 0.04066992, 0.04647721,
  ],
  [
    0.00638303, 0.00779616, 0.00844854, 0.00977659, 0.01126267, 0.01248344, 0.01473596, 0.0174506,
    0.02122129, 0.02756312, 0.03485072, 0.0379259,
  ],
] as const;

const cell = ([x, y]: number[]) =>
  xtGrid[Math.min(7, Math.max(0, Math.floor(y / 10)))][
    Math.min(11, Math.max(0, Math.floor(x / 10)))
  ];

/** Reproducible event-data metrics. Missing denominators remain unavailable. */
export function metricsFromStatsbombEvents(input: unknown, homeId: number, awayId: number) {
  const events = z.array(eventSchema).max(10000).parse(input);
  const ids = [homeId, awayId] as const;
  const ppda = new Map<number, { passes: number; actions: number }>(
    ids.map((id) => [id, { passes: 0, actions: 0 }]),
  );
  const finalThird = new Map(ids.map((id) => [id, 0]));
  const xt = new Map(ids.map((id) => [id, 0]));
  const defensive = new Set([
    'Pressure',
    'Duel',
    'Interception',
    'Block',
    'Clearance',
    'Foul Committed',
    'Ball Recovery',
  ]);
  for (const event of events) {
    if (!ids.includes(event.team.id as (typeof ids)[number]) || !event.location) continue;
    const opponent = event.team.id === homeId ? awayId : homeId;
    if (event.type.name === 'Pass' && event.pass) {
      if (event.location[0] < 72) ppda.get(opponent)!.passes++;
      if (!event.pass.outcome && event.pass.end_location[0] >= 80)
        finalThird.set(event.team.id, finalThird.get(event.team.id)! + 1);
      if (!event.pass.outcome)
        xt.set(
          event.team.id,
          xt.get(event.team.id)! +
            Math.max(0, cell(event.pass.end_location) - cell(event.location)),
        );
    }
    if (defensive.has(event.type.name) && event.location[0] >= 48)
      ppda.get(event.team.id)!.actions++;
    if (event.type.name === 'Carry' && event.carry)
      xt.set(
        event.team.id,
        xt.get(event.team.id)! + Math.max(0, cell(event.carry.end_location) - cell(event.location)),
      );
  }
  const ratio = (id: number) => {
    const value = ppda.get(id)!;
    return value.actions ? Number((value.passes / value.actions).toFixed(2)) : null;
  };
  const totalThird = finalThird.get(homeId)! + finalThird.get(awayId)!;
  const statistics: MatchStat[] = [
    { label: 'PPDA', home: ratio(homeId), away: ratio(awayId) },
    {
      label: 'Field tilt',
      home: totalThird ? Number(((finalThird.get(homeId)! / totalThird) * 100).toFixed(1)) : null,
      away: totalThird ? Number(((finalThird.get(awayId)! / totalThird) * 100).toFixed(1)) : null,
      unit: '%',
    },
    {
      label: 'xT',
      home: Number(xt.get(homeId)!.toFixed(2)),
      away: Number(xt.get(awayId)!.toFixed(2)),
    },
  ];
  return statistics.filter((row) => row.home !== null || row.away !== null);
}

export class StatsbombProvider {
  requests = 0;
  constructor(private transport: typeof fetch = fetch) {}
  private async get(path: string) {
    this.requests++;
    const response = await this.transport(`${base}/${path}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`STATSBOMB_HTTP_${response.status}`);
    const text = await response.text();
    if (text.length > 20_000_000) throw new Error('STATSBOMB_RESPONSE_TOO_LARGE');
    return JSON.parse(text) as unknown;
  }
  async competitions() {
    return z
      .array(statsbombCompetitionSchema)
      .max(500)
      .parse(await this.get('competitions.json'));
  }
  async matches(competitionId: number, seasonId: number) {
    return z
      .array(matchSchema)
      .max(1000)
      .parse(await this.get(`matches/${competitionId}/${seasonId}.json`));
  }
  async metrics(match: StatsbombMatch) {
    return metricsFromStatsbombEvents(
      await this.get(`events/${match.match_id}.json`),
      match.home_team.home_team_id!,
      match.away_team.away_team_id!,
    );
  }
}
