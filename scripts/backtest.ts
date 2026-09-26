import { readFile, writeFile } from 'node:fs/promises';
import { createDemoDataset } from '../src/services/football/providers/mock';
import { metrics } from '../src/prediction-engine/evaluation';
import { walkForwardBacktest } from '../src/prediction-engine/backtest';
import type { Match } from '../src/types/football';
const path = process.argv[2];
const matches: Match[] = path
  ? JSON.parse(await readFile(path, 'utf8'))
  : createDemoDataset(new Date('2026-09-11T12:00:00Z')).matches;
const rows = walkForwardBacktest(matches);
const output = {
  source: path ? 'historical-import' : 'demo',
  warning: path
    ? 'Vérifiez les horodatages et la provenance du fichier importé.'
    : 'Simulation sur données fictives. Ne mesure pas une performance réelle.',
  metrics: metrics(rows),
  rows,
};
await writeFile('backtest-results.json', JSON.stringify(output, null, 2));
console.log(
  JSON.stringify({ source: output.source, warning: output.warning, ...output.metrics }, null, 2),
);
