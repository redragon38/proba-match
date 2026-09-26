/** Largest-remainder apportionment keeps the displayed total at exactly 100. */
export function probabilityPercentages(home: number, draw: number, away: number): number[] {
  const input = [home, draw, away],
    sum = input.reduce((a, b) => a + b, 0);
  if (input.some((v) => !Number.isFinite(v) || v < 0) || sum <= 0)
    throw new Error('INVALID_PROBABILITIES');
  const raw = input.map((v) => (v / sum) * 100),
    out = raw.map(Math.floor);
  const order = [0, 1, 2].sort((a, b) => raw[b] - out[b] - (raw[a] - out[a]));
  const remaining = 100 - out.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) out[order[i]]++;
  return out;
}
