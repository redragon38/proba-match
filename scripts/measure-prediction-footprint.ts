import { readFile, writeFile } from 'node:fs/promises';
import { PredictionEngine, MODEL_VERSION } from '../src/prediction-engine';
import type { Match } from '../src/types/football';
const path = process.argv[2];
if (!path)
  throw new Error('Usage: node --import tsx scripts/measure-prediction-footprint.ts matches.json');
const raw = await readFile(path, 'utf8');
const matches: Match[] = JSON.parse(raw);
const finished = matches
  .filter((m) => m.status === 'finished')
  .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
const engine = new PredictionEngine(60, 60, 0.8, MODEL_VERSION, 'reconstructed');
const durations: number[] = [],
  archived: number[] = [],
  publicBytes: number[] = [];
const rssBefore = process.memoryUsage().rss;
for (let i = 0; i < 32; i++) {
  const match = finished[Math.floor((0.1 + (0.89 * i) / 31) * (finished.length - 1))];
  const target = {
    ...match,
    status: 'scheduled' as const,
    homeScore: null,
    awayScore: null,
    events: [],
    statistics: [],
    lineups: [],
    performances: [],
    resultRevisions: [],
    resultObservedAt: undefined,
  };
  const cutoff = new Date(Date.parse(match.kickoff) - 1000).toISOString();
  const start = performance.now();
  const p = engine.predict(target, matches, cutoff);
  const elapsed = performance.now() - start;
  if (!p) continue;
  durations.push(elapsed);
  archived.push(Buffer.byteLength(JSON.stringify(p)));
  const publicPrediction = { ...p };
  delete publicPrediction.inputArchive;
  publicBytes.push(Buffer.byteLength(JSON.stringify(publicPrediction)));
}
const summary = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    sample: sorted.length,
    median: sorted[Math.ceil(sorted.length * 0.5) - 1] ?? null,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1] ?? null,
    max: sorted.at(-1) ?? null,
  };
};
const report = {
  generatedAt: new Date().toISOString(),
  scope:
    'One local Node process, 32 deterministic temporal positions, reconstructed history. No PostgreSQL, provider, network, concurrency, production latency or accuracy measurement.',
  modelVersion: MODEL_VERSION,
  corpus: matches.length,
  inputJsonBytes: Buffer.byteLength(raw),
  computationMilliseconds: summary(durations),
  archivedPredictionBytes: summary(archived),
  publicPredictionBytes: summary(publicBytes),
  rssBeforeBytes: rssBefore,
  rssAfterBytes: process.memoryUsage().rss,
};
await writeFile('artifacts/AUDIT-FIX-LOCAL-FOOTPRINT.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
