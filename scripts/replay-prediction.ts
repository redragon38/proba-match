import { readFile } from 'node:fs/promises';
import { PredictionEngine } from '../src/prediction-engine';
import type { Prediction } from '../src/types/football';
const file = process.argv[2];
if (!file) throw new Error('Usage: node --import tsx scripts/replay-prediction.ts prediction.json');
const saved: Prediction = JSON.parse(await readFile(file, 'utf8'));
const archive = saved.inputArchive;
if (!archive || archive.schemaVersion !== 1) throw new Error('INPUT_ARCHIVE_NOT_AVAILABLE');
const p = archive.parameters;
const engine = new PredictionEngine(
  Number(p.homeAdvantage),
  Number(p.halfLifeDays),
  Number(p.goalStrength),
  archive.modelVersion,
  archive.availabilityMode,
);
const replay = engine.predict(archive.target, archive.matches, archive.cutoff);
if (
  !replay ||
  replay.inputHash !== saved.inputHash ||
  ['home', 'draw', 'away', 'expectedHome', 'expectedAway', 'confidence'].some(
    (key) => replay[key as keyof Prediction] !== saved[key as keyof Prediction],
  )
)
  throw new Error('REPLAY_MISMATCH');
console.log(
  JSON.stringify({
    matchId: saved.matchId,
    version: saved.version,
    inputHash: saved.inputHash,
    result: 'PASS',
  }),
);
