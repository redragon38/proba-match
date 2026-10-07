import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { walkForwardBacktest as oldBacktest } from '../tests/fixtures/model-1.3.0/backtest';
import { walkForwardBacktest } from '../src/prediction-engine/backtest';
import { resultAvailable, resultAt } from '../src/prediction-engine/availability';
import { regulationResult } from '../src/prediction-engine/result-period';
import { scoreDistribution } from '../src/prediction-engine/poisson';
import { metrics } from '../src/prediction-engine/evaluation';
import type { Match, EvaluatedPrediction } from '../src/types/football';
const path = process.argv[2];
if (!path)
  throw new Error(
    'Usage: node --import tsx scripts/compare-audit-models.ts matches.json [--reconstructed]',
  );
const raw = await readFile(path, 'utf8');
const matches: Match[] = JSON.parse(raw);
const mode = process.argv.includes('--reconstructed') ? 'reconstructed' : 'observed';
const old = oldBacktest(matches, mode),
  current = walkForwardBacktest(matches, mode);
const oldById = new Map(old.map((r) => [r.prediction.matchId, r]));
const paired = current.filter((r) => oldById.has(r.prediction.matchId));
const frequencies: EvaluatedPrediction[] = [],
  poisson: EvaluatedPrediction[] = [];
for (const row of paired) {
  const prior = matches.flatMap((m) => {
    if (
      m.id === row.prediction.matchId ||
      m.competitionId !== row.competitionId ||
      !resultAvailable(m, row.prediction.cutoff, mode)
    )
      return [];
    const known = resultAt(m, row.prediction.cutoff, mode);
    const result = known && regulationResult(known, mode === 'reconstructed');
    return result ? [result] : [];
  });
  if (!prior.length) continue;
  const counts = [0, 0, 0];
  let home = 0,
    away = 0;
  for (const m of prior) {
    counts[m.homeScore! > m.awayScore! ? 0 : m.homeScore === m.awayScore ? 1 : 2]++;
    home += m.homeScore!;
    away += m.awayScore!;
  }
  home /= prior.length;
  away /= prior.length;
  const distribution = scoreDistribution(home, away);
  const p = {
    ...row.prediction,
    inputArchive: undefined,
    expectedHome: home,
    expectedAway: away,
    scores: distribution.scores.slice(0, 6),
  };
  frequencies.push({
    ...row,
    prediction: {
      ...p,
      version: 'baseline-past-league-frequency',
      home: counts[0] / prior.length,
      draw: counts[1] / prior.length,
      away: counts[2] / prior.length,
    },
  });
  poisson.push({
    ...row,
    prediction: {
      ...p,
      version: 'baseline-past-league-poisson',
      home: distribution.home,
      draw: distribution.draw,
      away: distribution.away,
    },
  });
}
const commonIds = new Set(frequencies.map((r) => r.prediction.matchId));
const common = paired.filter((r) => commonIds.has(r.prediction.matchId));
const report = {
  generatedAt: new Date().toISOString(),
  inputSha256: createHash('sha256').update(raw).digest('hex'),
  mode,
  warning:
    mode === 'reconstructed'
      ? 'Exploratory previously studied corpus; reconstructed reception times and legacy score periods are not certified. No untouched holdout or prospective performance.'
      : 'Strict observed availability; unknown legacy score periods excluded.',
  corpus: matches.length,
  coverage: {
    old: old.length,
    current: current.length,
    common: common.length,
    abstainedCurrent: matches.filter((m) => m.status === 'finished').length - current.length,
  },
  commonSupport: {
    old: metrics(common.map((r) => oldById.get(r.prediction.matchId)!)),
    current: metrics(common),
    leagueFrequency: metrics(frequencies),
    leaguePoisson: metrics(poisson),
  },
  allSupport: { old: metrics(old), current: metrics(current) },
};
await writeFile(`artifacts/AUDIT-FIX-MODELS-${mode}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    mode,
    coverage: report.coverage,
    output: `artifacts/AUDIT-FIX-MODELS-${mode}.json`,
  }),
);
