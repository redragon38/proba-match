/** Largest-remainder apportionment keeps the displayed total at exactly 100. */
export function roundedPercentages(input: number[]): number[] {
  const sum = input.reduce((a, b) => a + b, 0);
  if (input.some((v) => !Number.isFinite(v) || v < 0) || sum <= 0)
    throw new Error('INVALID_PROBABILITIES');
  const raw = input.map((v) => (v / sum) * 100),
    out = raw.map(Math.floor);
  const order = input.map((_, index) => index).sort((a, b) => raw[b] - out[b] - (raw[a] - out[a]));
  const remaining = 100 - out.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remaining; i++) out[order[i]]++;
  return out;
}
export function probabilityPercentages(home: number, draw: number, away: number): number[] {
  return roundedPercentages([home, draw, away]);
}
