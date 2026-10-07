import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { walkForwardBacktest } from '../src/prediction-engine/backtest';
import { temporalModelSelection } from '../src/prediction-engine/validation';
import { dixonColesDistribution } from '../src/prediction-engine/dixon-coles';
import type { Match } from '../src/types/football';

const input = process.argv[2];
if (!input || input.startsWith('--'))
  throw new Error(
    'Usage: node --import tsx scripts/compare-score-models.ts matches.json [--reconstructed]',
  );
const raw = await readFile(input, 'utf8');
const matches: Match[] = JSON.parse(raw);
const mode = process.argv.includes('--reconstructed') ? 'reconstructed' : 'observed';
const reference = walkForwardBacktest(matches, mode);
const years = matches.map((m) => new Date(m.kickoff).getUTCFullYear()).filter(Number.isFinite);
if (!years.length) throw new Error('NO_VALID_DATES');
const boundaries = Array.from(
  { length: Math.max(...years) - Math.min(...years) + 2 },
  (_, i) => `${Math.min(...years) + i}-07-01T00:00:00Z`,
);
const rhos = [0, -0.05, -0.1, 0.03];
const candidates = rhos.map((rho) => ({
  id: rho === 0 ? 'poisson-reference' : `dc-correction-${rho}`,
  rows:
    rho === 0
      ? reference
      : reference.map((row) => {
          const distribution = dixonColesDistribution(
            row.prediction.expectedHome,
            row.prediction.expectedAway,
            rho,
          );
          return {
            ...row,
            prediction: {
              ...row.prediction,
              id: `${row.prediction.id}-research-dc-${rho}`,
              version: `research-dc-correction-${rho}`,
              home: distribution.home,
              draw: distribution.draw,
              away: distribution.away,
              scores: distribution.scores.slice(0, 6),
              likelyScore: `${distribution.scores[0].home}–${distribution.scores[0].away}`,
            },
          };
        }),
}));
const result = temporalModelSelection(matches, candidates, boundaries, mode);
const report = {
  generatedAt: new Date().toISOString(),
  inputSha256: createHash('sha256').update(raw).digest('hex'),
  warning:
    'Recherche seulement : correction Dixon-Coles sur les buts attendus existants, pas un réentraînement complet Dixon-Coles. Mode reconstruit non certifiant ; aucun changement du moteur actif. Corpus déjà exploré, non indépendant.',
  rhos,
  source: 'https://arxiv.org/pdf/2307.02139',
  ...result,
};
const output =
  process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) ||
  'score-model-comparison.json';
await writeFile(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      folds: result.folds.map(({ start, selected, trainingSample, testSample }) => ({
        start,
        selected,
        trainingSample,
        testSample,
      })),
      selectedMetrics: result.selectedMetrics && {
        sample: result.selectedMetrics.sample,
        brier: result.selectedMetrics.brier,
        logLoss: result.selectedMetrics.logLoss,
        accuracy: result.selectedMetrics.accuracy,
      },
      referenceMetrics: result.referenceMetrics && {
        sample: result.referenceMetrics.sample,
        brier: result.referenceMetrics.brier,
        logLoss: result.referenceMetrics.logLoss,
        accuracy: result.referenceMetrics.accuracy,
      },
    },
    null,
    2,
  ),
);
