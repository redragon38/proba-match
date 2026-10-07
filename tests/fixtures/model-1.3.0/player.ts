import type { Player, PlayerStats, Position } from '@/types/football';
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const nonnegative = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0;
const count = (n: number | null | undefined): n is number =>
  nonnegative(n) && Number.isSafeInteger(n);
const rating = (n: number | null | undefined): n is number => nonnegative(n) && n <= 10;
/** Position-aware heuristic; missing essential metrics never become zero. */
export function playerPerformance(stats: PlayerStats, position: Position): number | null {
  if (position === 'Non disponible') return null;
  if (!nonnegative(stats.minutes) || stats.minutes < 90 || !rating(stats.rating)) return null;
  const per90 = (n: number) => (n * 90) / stats.minutes!;
  let score: number;
  if (position === 'Gardien') {
    if (!count(stats.saves) || !count(stats.conceded)) return null;
    score =
      stats.rating * 6 +
      Math.min(30, per90(stats.saves) * 6) -
      Math.min(12, per90(stats.conceded) * 3);
  } else if (position === 'Défenseur') {
    if (!count(stats.tackles) || !count(stats.interceptions)) return null;
    score = stats.rating * 7 + Math.min(25, per90(stats.tackles + stats.interceptions) * 6);
  } else {
    if (!count(stats.goals) || !count(stats.assists) || !count(stats.shots)) return null;
    if (stats.goals > stats.shots) return null;
    score =
      stats.rating * 6 +
      Math.min(
        35,
        per90(
          stats.goals * (position === 'Milieu' ? 15 : 20) + stats.assists * 18 + stats.shots * 0.7,
        ),
      );
  }
  return Number.isFinite(score) ? Math.round(clamp(score)) : null;
}
export function playerWatch(player: Player): number | null {
  const performance = playerPerformance(player.stats, player.position);
  if (
    performance === null ||
    !count(player.stats.starts) ||
    !count(player.stats.appearances) ||
    player.stats.appearances === 0 ||
    player.stats.starts > player.stats.appearances
  )
    return null;
  return Math.round(
    clamp(performance * Math.min(1, player.stats.starts / player.stats.appearances) ** 0.3),
  );
}
export function playerImpact(player: Player, teamMinutes: number): number | null {
  if (
    !nonnegative(player.stats.minutes) ||
    !rating(player.stats.rating) ||
    !Number.isFinite(teamMinutes) ||
    teamMinutes <= 0
  )
    return null;
  return Math.min(
    0.05,
    (((player.stats.minutes / teamMinutes) * Math.max(0, player.stats.rating - 5)) / 5) * 0.05,
  );
}
