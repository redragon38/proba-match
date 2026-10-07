import { writeFile } from 'node:fs/promises';
import { db } from '../src/database/client';
const [id, path] = process.argv.slice(2);
if (!id || !path || !process.env.DATABASE_URL)
  throw new Error(
    'Usage: with DATABASE_URL, node --conditions=react-server --import tsx scripts/export-prediction.ts <prediction-id> <output.json>',
  );
const row = await db.prediction.findUnique({ where: { id }, select: { payload: true } });
if (!row) throw new Error('PREDICTION_NOT_FOUND');
await writeFile(path, JSON.stringify(row.payload, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
await db.$disconnect();
console.log('Prediction package exported.');
