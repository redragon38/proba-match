import type { Dataset, Match, MatchPlayerPerformance, Player, PlayerStats } from '@/types/football';
import { slugify } from '@/lib/format';
import { log } from '@/lib/logger';

const unknownPlayerStats: PlayerStats = {
  appearances: null,
  starts: null,
  minutes: null,
  goals: null,
  assists: null,
  rating: null,
};

/** A lineup ID is provider-confirmed, but a same-name roster profile is not a safe cross-provider match. */
export function addObservedPlayerProfiles(data: Dataset, match: Match) {
  const known = new Set(data.players.map((player) => player.id));
  const observed = new Map<
    string,
    {
      id: string;
      name: string;
      teamId: string;
      number: number | null;
      performance?: MatchPlayerPerformance;
    }
  >();
  for (const lineup of match.lineups)
    for (const row of [...lineup.starters, ...lineup.substitutes])
      observed.set(row.id, {
        id: row.id,
        name: row.name,
        teamId: lineup.teamId,
        number: row.number,
      });
  for (const performance of match.performances ?? [])
    observed.set(performance.playerId, {
      id: performance.playerId,
      name: performance.name,
      teamId: performance.teamId,
      number: performance.number,
      performance,
    });
  const added: Player[] = [];
  for (const row of observed.values()) {
    if (known.has(row.id)) {
      const index = data.players.findIndex((player) => player.id === row.id);
      if (index >= 0 && row.performance?.photo && !data.players[index].photo)
        data.players[index] = { ...data.players[index], photo: row.performance.photo };
      continue;
    }
    if (row.teamId !== match.homeId && row.teamId !== match.awayId) {
      log('PLAYER_WITHOUT_TEAM', { code: 'MATCH_TEAM_MISMATCH' });
      continue;
    }
    if (
      data.players.some(
        (player) => player.teamId === row.teamId && slugify(player.name) === slugify(row.name),
      )
    )
      log('DUPLICATE_PLAYER_CANDIDATE', { code: 'CROSS_PROVIDER_NAME_MATCH' });
    const profile: Player = {
      id: row.id,
      slug: `${slugify(row.name)}-${row.id.slice(0, 8)}`,
      name: row.name,
      teamId: row.teamId,
      position: row.performance?.position ?? 'Non disponible',
      number: row.number,
      photo: row.performance?.photo,
      source: 'api-football',
      updatedAt: match.updatedAt,
      stats: { ...unknownPlayerStats },
    };
    known.add(row.id);
    added.push(profile);
  }
  data.players.push(...added);
  return added.length;
}
