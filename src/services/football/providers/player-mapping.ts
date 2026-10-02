import { z } from 'zod';
import type { MatchPlayerPerformance, PlayerStats, Position } from '@/types/football';
const nullable = z.number().nullish();
export const statsSchema = z.object({
  games: z.object({
    minutes: nullable,
    number: nullable,
    position: z.string().nullish(),
    rating: z.union([z.string(), z.number()]).nullish(),
    substitute: z.boolean().nullish(),
  }),
  goals: z
    .object({ total: nullable, assists: nullable, saves: nullable, conceded: nullable })
    .optional(),
  shots: z.object({ total: nullable, on: nullable }).optional(),
  passes: z
    .object({
      total: nullable,
      key: nullable,
      accuracy: z.union([z.string(), z.number()]).nullish(),
    })
    .optional(),
  tackles: z.object({ total: nullable, interceptions: nullable, blocks: nullable }).optional(),
  duels: z.object({ total: nullable, won: nullable }).optional(),
  dribbles: z.object({ success: nullable }).optional(),
  fouls: z.object({ committed: nullable }).optional(),
  penalty: z.object({ saved: nullable }).optional(),
  cards: z.object({ yellow: nullable, red: nullable }).optional(),
});
export function mapPosition(position: string | undefined | null): Position {
  return position === 'G' || position === 'Goalkeeper'
    ? 'Gardien'
    : position === 'D' || position === 'Defender'
      ? 'Défenseur'
      : position === 'M' || position === 'Midfielder'
        ? 'Milieu'
        : position === 'F' || position === 'Attacker'
          ? 'Attaquant'
          : 'Non disponible';
}
export function mapMatchPlayers(input: unknown): MatchPlayerPerformance[] {
  const schema = z.array(
    z.object({
      team: z.object({ id: z.number() }),
      players: z.array(
        z.object({
          player: z.object({ id: z.number(), name: z.string(), photo: z.string().url().nullish() }),
          statistics: z.array(statsSchema),
        }),
      ),
    }),
  );
  const parsed = schema.safeParse(input);
  if (!parsed.success) return [];
  return parsed.data.flatMap((t) =>
    t.players.flatMap((p) => {
      const s = p.statistics[0];
      if (!s) return [];
      const stats: PlayerStats = {
        appearances: s.games.minutes == null ? null : s.games.minutes > 0 ? 1 : 0,
        starts: s.games.substitute == null ? null : s.games.substitute ? 0 : 1,
        minutes: s.games.minutes ?? null,
        goals: s.goals?.total ?? null,
        assists: s.goals?.assists ?? null,
        rating:
          s.games.rating == null
            ? null
            : Number.isFinite(Number(s.games.rating))
              ? Number(s.games.rating)
              : null,
        shots: s.shots?.total ?? null,
        shotsOnTarget: s.shots?.on ?? null,
        keyPasses: s.passes?.key ?? null,
        passes: s.passes?.total ?? null,
        passAccuracy:
          s.passes?.accuracy == null
            ? null
            : Number.isFinite(Number(String(s.passes.accuracy).replace('%', '')))
              ? Number(String(s.passes.accuracy).replace('%', ''))
              : null,
        tackles: s.tackles?.total ?? null,
        interceptions: s.tackles?.interceptions ?? null,
        blocks: s.tackles?.blocks ?? null,
        duels: s.duels?.won ?? null,
        duelsTotal: s.duels?.total ?? null,
        dribbles: s.dribbles?.success ?? null,
        fouls: s.fouls?.committed ?? null,
        penaltiesSaved: s.penalty?.saved ?? null,
        saves: s.goals?.saves ?? null,
        conceded: s.goals?.conceded ?? null,
        yellow: s.cards?.yellow ?? null,
        red: s.cards?.red ?? null,
      };
      return [
        {
          playerId: String(p.player.id),
          name: p.player.name,
          photo: p.player.photo ?? undefined,
          teamId: String(t.team.id),
          position: mapPosition(s.games.position),
          number: s.games.number ?? null,
          stats,
        },
      ];
    }),
  );
}
