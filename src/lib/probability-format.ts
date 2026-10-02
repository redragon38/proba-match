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

export function formatProbability(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value)
    ? 'Non disponible'
    : `${Math.round(value * 100)} %`;
}

/** Presentation-only gaps between the largest and second-largest 1N2 outcomes. */
export function probabilityReading(home: number, draw: number, away: number) {
  const values = [home, draw, away];
  if (
    values.some((value) => !Number.isFinite(value) || value < 0) ||
    values.every((value) => value === 0)
  )
    return null;
  const ranked = values.map((value, index) => ({ value, index })).sort((a, b) => b.value - a.value);
  const gap = ranked[0].value - ranked[1].value;
  return {
    leader: ranked[0].index,
    gap,
    label:
      gap < 0.05
        ? 'Très équilibré'
        : gap < 0.12
          ? 'Équilibré'
          : gap < 0.25
            ? 'Léger avantage'
            : 'Avantage marqué',
    emphasize: gap >= 0.05,
  };
}
