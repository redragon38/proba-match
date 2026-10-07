import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { walkForwardBacktest } from '../src/prediction-engine/backtest';
import { predictionInsights } from '../src/prediction-engine/insights';
import type { Match } from '../src/types/football';
const input = process.argv[2];
if (!input || input.startsWith('--')) throw new Error('Historical match file required');
const raw = await readFile(input, 'utf8');
const matches: Match[] = JSON.parse(raw);
const mode = process.argv.includes('--reconstructed') ? 'reconstructed' : 'observed';
const from = process.argv.find((a) => a.startsWith('--from='))?.slice(7);
const to = process.argv.find((a) => a.startsWith('--to='))?.slice(5);
if ((from && !Number.isFinite(Date.parse(from))) || (to && !Number.isFinite(Date.parse(to))))
  throw new Error('INVALID_PERIOD');
const rows = walkForwardBacktest(matches, mode).filter(
  (r) =>
    (!from || Date.parse(r.kickoff) >= Date.parse(from)) &&
    (!to || Date.parse(r.kickoff) < Date.parse(to)),
);
const events = new Map<
  string,
  {
    count: number;
    brier: number;
    logLoss: number;
    predicted: number;
    observed: number;
    bins: { bin: number; count: number; predicted: number; observed: number }[];
  }
>();
let rangeCovered = 0,
  rangeMass = 0,
  rangeWidth = 0;
for (const row of rows) {
  const analysis = predictionInsights(row.prediction),
    total = row.homeScore + row.awayScore;
  const values: [string, number, boolean][] = [
    ['home-scores', analysis.homeScores, row.homeScore > 0],
    ['away-scores', analysis.awayScores, row.awayScore > 0],
    ['both-score', analysis.bothScore, row.homeScore > 0 && row.awayScore > 0],
    ['clean-home', analysis.cleanHome, row.awayScore === 0],
    ['clean-away', analysis.cleanAway, row.homeScore === 0],
    ...analysis.totalAtLeast.map((e): [string, number, boolean] => [
      `total-at-least-${e.goals}`,
      e.probability,
      total >= e.goals,
    ]),
  ];
  for (const [label, value, occurred] of values) {
    if (!Number.isFinite(value) || value < -1e-8 || value > 1 + 1e-8)
      throw new Error('INVALID_EVENT_PROBABILITY');
    const p = Math.max(0, Math.min(1, value)),
      y = Number(occurred);
    const metric = events.get(label) ?? {
      count: 0,
      brier: 0,
      logLoss: 0,
      predicted: 0,
      observed: 0,
      bins: Array.from({ length: 10 }, (_, bin) => ({ bin, count: 0, predicted: 0, observed: 0 })),
    };
    metric.count++;
    metric.brier += (p - y) ** 2;
    metric.logLoss -= Math.log(Math.max(1e-15, y ? p : 1 - p));
    metric.predicted += p;
    metric.observed += y;
    const bucket = metric.bins[Math.min(9, Math.floor(p * 10))];
    bucket.count++;
    bucket.predicted += p;
    bucket.observed += y;
    events.set(label, metric);
  }
  rangeCovered += Number(total >= analysis.totalRange.from && total <= analysis.totalRange.to);
  rangeMass += analysis.totalRange.probability;
  rangeWidth += analysis.totalRange.to - analysis.totalRange.from;
}
const report = {
  generatedAt: new Date().toISOString(),
  inputSha256: createHash('sha256').update(raw).digest('hex'),
  availabilityMode: mode,
  from,
  to,
  warning:
    'Évaluation exploratoire des événements dérivés du modèle actuel, sans calibrage ni modification active. Publication réelle inconnue en mode reconstruit. Les Brier binaires ne se comparent pas directement au Brier 1N2.',
  sample: rows.length,
  events: Object.fromEntries(
    [...events].map(([label, m]) => [
      label,
      {
        sample: m.count,
        brier: m.brier / m.count,
        logLoss: m.logLoss / m.count,
        meanPredicted: m.predicted / m.count,
        observedRate: m.observed / m.count,
        calibrationError:
          m.bins.reduce((sum, b) => sum + Math.abs(b.predicted - b.observed), 0) / m.count,
        calibration: m.bins
          .filter((b) => b.count)
          .map((b) => ({ ...b, predicted: b.predicted / b.count, observed: b.observed / b.count })),
      },
    ]),
  ),
  totalRange: rows.length
    ? {
        nominalMinimum: 0.8,
        meanModelCoverage: rangeMass / rows.length,
        observedCoverage: rangeCovered / rows.length,
        meanWidth: rangeWidth / rows.length,
      }
    : null,
};
const output =
  process.argv.find((a) => a.startsWith('--output='))?.slice(9) || 'derived-event-evaluation.json';
await writeFile(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
