export function confidenceScore({
  sample,
  daysOld,
  lineups,
  injuries,
  stability,
  coverage,
}: {
  sample: number;
  daysOld: number;
  lineups: boolean;
  injuries: boolean;
  stability: number;
  coverage: number;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
  return Math.round(
    35 * clamp(sample / 20) +
      20 * clamp(1 - Math.max(0, daysOld) / 60) +
      10 * Number(lineups) +
      5 * Number(injuries) +
      15 * clamp(stability) +
      15 * clamp(coverage),
  );
}
