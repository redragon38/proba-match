import type { Player, PlayerStats, Position } from '@/types/football';
const clamp = (n: number) => Math.max(0, Math.min(100, n));
/** Position-aware heuristic; missing essential metrics never become zero. */
export function playerPerformance(stats: PlayerStats, position: Position): number | null {
  if (position === 'Non disponible') return null;
  if (stats.minutes == null || stats.minutes < 90 || stats.rating == null) return null;
  const per90 = (n: number) => (n * 90) / stats.minutes!;
  let score: number;
  if (position === 'Gardien') {
    if (stats.saves == null || stats.conceded == null) return null;
    score =
      stats.rating * 6 +
      Math.min(30, per90(stats.saves) * 6) -
      Math.min(12, per90(stats.conceded) * 3);
  } else if (position === 'Défenseur') {
    if (stats.tackles == null || stats.interceptions == null) return null;
    score = stats.rating * 7 + Math.min(25, per90(stats.tackles + stats.interceptions) * 6);
  } else {
    if (stats.goals == null || stats.assists == null || stats.shots == null) return null;
    score =
      stats.rating * 6 +
      Math.min(
        35,
        per90(
          stats.goals * (position === 'Milieu' ? 15 : 20) + stats.assists * 18 + stats.shots * 0.7,
        ),
      );
  }
  return Math.round(clamp(score));
}
export function playerWatch(player: Player): number | null {
  const performance = playerPerformance(player.stats, player.position);
  if (performance === null || player.stats.starts == null || !player.stats.appearances) return null;
  return Math.round(
    clamp(performance * Math.min(1, player.stats.starts / player.stats.appearances) ** 0.3),
  );
}
export function playerImpact(player: Player, teamMinutes: number): number | null {
  if (player.stats.minutes == null || player.stats.rating == null || teamMinutes <= 0) return null;
  return Math.min(
    0.05,
    (((player.stats.minutes / teamMinutes) * Math.max(0, player.stats.rating - 5)) / 5) * 0.05,
  );
}
