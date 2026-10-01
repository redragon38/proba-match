import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PredictionEngine } from '../src/prediction-engine';
import { scoreDistribution } from '../src/prediction-engine/poisson';
import { shrinkExpectedGoals } from '../src/prediction-engine/calibration';
import { metrics } from '../src/prediction-engine/evaluation';
import type { EvaluatedPrediction, Match, Prediction } from '../src/types/football';

const input = process.argv[2];
const output = process.argv[3] ?? '.local/reports/prediction-backtest.json';
if (!input) throw new Error('Usage: backtest-predictions <matches.json> [report.json]');

const source = JSON.parse(await readFile(input, 'utf8')) as Match[];
const finished = source
  .filter(
    (match) =>
      match.status === 'finished' &&
      match.homeScore !== null &&
      match.awayScore !== null &&
      Number.isFinite(Date.parse(match.kickoff)),
  )
  .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id));

const engine = new PredictionEngine(60, 60, 1, 'elo-poisson-1.1.0');
const rows: EvaluatedPrediction[] = [];
const history: Match[] = [];
let available = 0;
for (const match of finished) {
  const kickoff = Date.parse(match.kickoff);
  // A result is treated as available only from the next day. The source does not
  // expose its actual publication timestamp, so this remains a retrospective test.
  while (
    available < finished.length &&
    Date.parse(finished[available].kickoff) + 24 * 3600_000 < kickoff
  ) {
    history.push(finished[available]);
    available++;
  }
  const asOf = new Date(kickoff - 1000).toISOString();
  const target: Match = {
    ...match,
    status: 'scheduled',
    homeScore: null,
    awayScore: null,
    lineups: [],
    events: [],
    statistics: [],
  };
  const prediction = engine.predict(target, history, asOf);
  if (!prediction) continue;
  rows.push({
    prediction,
    homeScore: match.homeScore!,
    awayScore: match.awayScore!,
    competitionId: match.competitionId,
    kickoff: match.kickoff,
  });
}

function adjusted(prediction: Prediction, strength: number): Prediction {
  if (strength === 1) return prediction;
  const { home: expectedHome, away: expectedAway } = shrinkExpectedGoals(
    prediction.expectedHome,
    prediction.expectedAway,
    strength,
  );
  const distribution = scoreDistribution(expectedHome, expectedAway);
  return {
    ...prediction,
    expectedHome,
    expectedAway,
    home: distribution.home,
    draw: distribution.draw,
    away: distribution.away,
    likelyScore: `${distribution.scores[0].home}–${distribution.scores[0].away}`,
    scores: distribution.scores.slice(0, 6),
    cleanHome: Math.exp(-expectedAway),
    cleanAway: Math.exp(-expectedHome),
  };
}

function evaluate(subset: EvaluatedPrediction[], strength: number) {
  const changed = subset.map((row) => ({
    ...row,
    prediction: adjusted(row.prediction, strength),
  }));
  const base = metrics(changed);
  if (!base) return null;
  const n = changed.length;
  const calibrationError = base.calibration.reduce(
    (sum, bucket) => sum + bucket.count * Math.abs(bucket.predicted - bucket.actual),
    0,
  ) / (3 * n);
  return {
    ...base,
    calibrationError,
    homeGoalMae:
      changed.reduce((sum, row) => sum + Math.abs(row.prediction.expectedHome - row.homeScore), 0) /
      n,
    awayGoalMae:
      changed.reduce((sum, row) => sum + Math.abs(row.prediction.expectedAway - row.awayScore), 0) /
      n,
    exactScoreAccuracy:
      changed.filter(
        (row) =>
          row.prediction.likelyScore === `${row.homeScore}–${row.awayScore}`,
      ).length / n,
  };
}

const train = rows.filter((row) => row.kickoff < '2025-01-01');
const validation = rows.filter(
  (row) => row.kickoff >= '2025-01-01' && row.kickoff < '2026-01-01',
);
const test = rows.filter((row) => row.kickoff >= '2026-01-01');
const candidates = [0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1];
const grid = candidates.map((strength) => ({ strength, train: evaluate(train, strength) }));
const selected = grid.reduce((best, candidate) =>
  candidate.train &&
  (!best.train ||
    candidate.train.brier < best.train.brier ||
    (candidate.train.brier === best.train.brier &&
      candidate.train.logLoss < best.train.logLoss))
    ? candidate
    : best,
);
const summarize = (subset: EvaluatedPrediction[]) => ({
  baseline: evaluate(subset, 1),
  candidate: evaluate(subset, selected.strength),
});
const competitionIds = [...new Set(rows.map((row) => row.competitionId))].sort();
const report = {
  generatedAt: new Date().toISOString(),
  source: input,
  method: 'walk-forward; target score and post-match details removed; prior scores embargoed 24h',
  limitation:
    'OpenFootball historical results have no original publication timestamp. This retrospective test cannot establish the accuracy of predictions actually published before kickoff.',
  modelVersion: rows[0]?.prediction.version ?? null,
  testedMatches: rows.length,
  parameterSelection: {
    period: 'before 2025-01-01',
    metric: 'Brier',
    selectedStrength: selected.strength,
    grid: grid.map(({ strength, train }) => ({
      strength,
      sample: train?.sample ?? 0,
      brier: train?.brier ?? null,
      logLoss: train?.logLoss ?? null,
    })),
  },
  periods: {
    train: summarize(train),
    validation2025: summarize(validation),
    test2026: summarize(test),
    all: summarize(rows),
  },
  byCompetition: Object.fromEntries(
    competitionIds.map((id) => {
      const subset = rows.filter((row) => row.competitionId === id && row.kickoff >= '2025-01-01');
      return [id, summarize(subset)];
    }),
  ),
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    testedMatches: report.testedMatches,
    selectedStrength: selected.strength,
    train: report.periods.train,
    validation2025: report.periods.validation2025,
    test2026: report.periods.test2026,
    report: output,
  }),
);
