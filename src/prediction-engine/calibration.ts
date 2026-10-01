/** Shrink the home/away goal ratio while preserving its geometric mean. */
export function shrinkExpectedGoals(home: number, away: number, strength: number) {
  if (
    ![home, away, strength].every(Number.isFinite) ||
    home <= 0 ||
    away <= 0 ||
    strength <= 0 ||
    strength > 1
  )
    throw new Error('INVALID_GOAL_SHRINKAGE');
  const mean = Math.sqrt(home * away);
  const ratio = (home / away) ** (strength / 2);
  return { home: mean * ratio, away: mean / ratio };
}
