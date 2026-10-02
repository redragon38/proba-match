import type { Match, Player } from '@/types/football';

/** Report inconsistent provider records; never rewrite a surprising value into a plausible one. */
export function matchQualityIssues(match: Match, players: Player[]) {
  const issues = new Set<string>();
  const teams = new Set([match.homeId, match.awayId]);
  const profiles = new Map(players.map((player) => [player.id, player]));
  for (const stat of match.statistics)
    for (const value of [stat.home, stat.away])
      if (value != null && (!Number.isFinite(value) || value < 0)) issues.add('MATCH_STAT_INVALID');
  const possession = match.statistics.find((stat) => stat.label === 'Possession');
  if (
    possession?.home != null &&
    possession.away != null &&
    Math.abs(possession.home + possession.away - 100) > 2
  )
    issues.add('POSSESSION_INCONSISTENT');
  for (const event of match.events) if (!teams.has(event.teamId)) issues.add('EVENT_TEAM_MISMATCH');
  for (const lineup of match.lineups) {
    if (!teams.has(lineup.teamId)) issues.add('LINEUP_TEAM_MISMATCH');
    for (const row of [...lineup.starters, ...lineup.substitutes]) {
      const profile = profiles.get(row.id);
      if (!profile) issues.add('LINEUP_WITHOUT_PLAYER');
      else if (profile.teamId !== lineup.teamId) issues.add('PLAYER_WITHOUT_TEAM');
    }
  }
  for (const performance of match.performances ?? []) {
    const profile = profiles.get(performance.playerId);
    if (!profile) issues.add('PLAYER_STATS_WITHOUT_PLAYER');
    else if (profile.teamId !== performance.teamId || !teams.has(performance.teamId))
      issues.add('PLAYER_WITHOUT_TEAM');
  }
  return [...issues];
}
