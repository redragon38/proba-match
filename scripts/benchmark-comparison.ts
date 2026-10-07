import { readFile, writeFile } from 'node:fs/promises';
import { deepStrictEqual } from 'node:assert';
import { performance } from 'node:perf_hooks';
import { comparisonView } from '../src/services/football/read-model';
import { teamSummary, teamMetricAverage } from '../src/services/statistics';
import { createDemoDataset } from '../src/services/football/providers/mock';
import type { Match, Team } from '../src/types/football';

const input = process.argv[2];
if (!input)
  throw new Error('Usage: node --import tsx scripts/benchmark-comparison.ts matches.json');
const matches: Match[] = JSON.parse(await readFile(input, 'utf8'));
const teams: Team[] = [...new Set(matches.flatMap((m) => [m.homeId, m.awayId]))].map((id) => ({
  id,
  slug: id,
  name: id,
  short: id,
  color: '#000000',
  country: '',
  competitionId: '',
}));
// Identity placeholders are only local benchmark inputs, never displayed or saved to the application.
const data = { ...createDemoDataset(), matches, teams, players: [], injuries: [] };
const reference = () =>
  Object.fromEntries(
    teams.map((team) => {
      const summary = (venue: 'all' | 'home' | 'away') => ({
        ...teamSummary(data, team.id, undefined, venue),
        matches: [],
        lastTen: [],
      });
      return [
        team.id,
        {
          all: summary('all'),
          home: summary('home'),
          away: summary('away'),
          xg: teamMetricAverage(data, team.id, 'xG'),
          possession: teamMetricAverage(data, team.id, 'Possession'),
          shots: teamMetricAverage(data, team.id, 'Tirs'),
        },
      ];
    }),
  );
const optimized = () => comparisonView(data);
deepStrictEqual(optimized(), reference());
const milliseconds = (fn: () => unknown) => {
  const start = performance.now();
  for (let i = 0; i < 20; i++) fn();
  return (performance.now() - start) / 20;
};
reference();
optimized();
const before: number[] = [],
  after: number[] = [];
for (let run = 0; run < 7; run++) {
  // Alternate order to reduce systematic warmup/order effects.
  if (run % 2) {
    after.push(milliseconds(optimized));
    before.push(milliseconds(reference));
  } else {
    before.push(milliseconds(reference));
    after.push(milliseconds(optimized));
  }
}
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const report = {
  generatedAt: new Date().toISOString(),
  matches: matches.length,
  teams: teams.length,
  identicalOutput: true,
  iterationsPerSeries: 20,
  series: 7,
  beforeMs: before,
  afterMs: after,
  medianBeforeMs: median(before),
  medianAfterMs: median(after),
  limitation:
    'Local function microbenchmark using the same current statistics safeguards in both versions. Does not measure page latency or field Core Web Vitals.',
};
await writeFile(
  'artifacts/CONTINUATION-COMPARISON-BENCHMARK.json',
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
