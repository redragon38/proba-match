import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { walkForwardBacktest } from '../src/prediction-engine/backtest';
import { temporalModelSelection } from '../src/prediction-engine/validation';
import { validResult } from '../src/prediction-engine/availability';
import type { Match } from '../src/types/football';

const input = process.argv[2];
if (!input || input.startsWith('--'))
  throw new Error('Usage: npm run models:validate -- matches.json [--reconstructed]');
const raw = await readFile(input, 'utf8');
const matches: Match[] = JSON.parse(raw);
if (!Array.isArray(matches)) throw new Error('EXPECTED_MATCH_ARRAY');
const mode = process.argv.includes('--reconstructed') ? 'reconstructed' : 'observed';
const years = matches.filter(validResult).map((m) => new Date(m.kickoff).getUTCFullYear());
if (!years.length) throw new Error('NO_VALID_RESULTS');
const boundaries = Array.from(
  { length: Math.max(...years) - Math.min(...years) + 2 },
  (_, i) => `${Math.min(...years) + i}-07-01T00:00:00Z`,
);
if (boundaries.length < 2) throw new Error('AT_LEAST_TWO_TIME_BOUNDARIES_REQUIRED');
// Fixed, small grid declared before evaluation. This command never updates the active model.
const strengths = [0.8, 0.6, 1];
const candidates = strengths.map((goalStrength) => ({
  id: `goal-strength-${goalStrength}`,
  rows: walkForwardBacktest(matches, mode, { goalStrength }),
}));
const result = temporalModelSelection(matches, candidates, boundaries, mode);
const report = {
  generatedAt: new Date().toISOString(),
  inputSha256: createHash('sha256').update(raw).digest('hex'),
  candidates: strengths.map((goalStrength) => ({
    goalStrength,
    homeAdvantage: 60,
    halfLifeDays: 60,
  })),
  warning:
    mode === 'observed'
      ? 'Validation limitée aux résultats dont la disponibilité est journalisée. Ne valide pas à elle seule le moteur en production.'
      : 'Reconstruction exploratoire : heures de publication inconnues, aucune certification d’exactitude réelle. Aucun changement du modèle actif.',
  ...result,
};
const output =
  process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length) ||
  'model-validation-results.json';
await writeFile(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    {
      warning: report.warning,
      commonSample: result.commonSample,
      folds: result.folds.map(({ start, trainingSample, testSample, selected, status }) => ({
        start,
        trainingSample,
        testSample,
        selected,
        status,
      })),
      selectedMetrics: result.selectedMetrics,
      referenceMetrics: result.referenceMetrics,
    },
    null,
    2,
  ),
);
