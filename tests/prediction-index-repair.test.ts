import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { expect, it, vi } from 'vitest';
// Maintenance scripts intentionally run independently of the application build.
import { repairPredictionIndex } from '../scripts/repair-prediction-index.mjs';

it('skips valid indexes and refuses duplicate archives without deleting anything', async () => {
  const db = {
    $queryRaw: vi.fn().mockResolvedValueOnce([{ valid: true, immediate: true }]),
    $executeRawUnsafe: vi.fn(),
  };
  expect(await repairPredictionIndex(db)).toEqual({ status: 'success', index: 'already-valid' });
  expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
  db.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ groups: 2 }]);
  await expect(repairPredictionIndex(db)).rejects.toThrow('PREDICTION_DUPLICATES_REQUIRE_REVIEW');
  expect(db.$executeRawUnsafe).not.toHaveBeenCalled();
});

it('builds the missing unique index concurrently outside a transaction', async () => {
  const db = {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ groups: 0 }]),
    $executeRawUnsafe: vi.fn(),
  };
  expect(await repairPredictionIndex(db)).toEqual({ status: 'success', index: 'created' });
  expect(db.$executeRawUnsafe.mock.calls[0][0]).toMatch(
    /^CREATE UNIQUE INDEX CONCURRENTLY "Prediction_match_version_kind_repair_\d+" ON "Prediction"/,
  );
});

it('reproduces 42P10 and restores conflict inference on PostgreSQL without losing archives', async () => {
  const database = new PGlite();
  try {
    await database.exec(`CREATE TABLE "Prediction" (id text PRIMARY KEY, "matchId" text,
      "versionId" text, kind text, payload jsonb);
      INSERT INTO "Prediction" VALUES ('old','m','v','initial','{"archive":"preserved"}');`);
    const sql = `INSERT INTO "Prediction" VALUES ('new','m','v','initial','{}')
      ON CONFLICT ("matchId", "versionId", "kind") DO NOTHING`;
    await expect(database.exec('EXPLAIN ' + sql)).rejects.toMatchObject({ code: '42P10' });
    const migration = await readFile(
      'prisma/migrations/202610200001_prediction_unique_repair/migration.sql',
      'utf8',
    );
    await database.exec(migration);
    await database.exec(migration);
    const adapter = {
      $queryRaw: async (parts: TemplateStringsArray) => (await database.query(parts.join(''))).rows,
    };
    expect(await repairPredictionIndex(adapter)).toEqual({
      status: 'success',
      index: 'already-valid',
    });
    await database.exec(sql);
    expect((await database.query('SELECT id,payload FROM "Prediction"')).rows).toEqual([
      { id: 'old', payload: { archive: 'preserved' } },
    ]);
  } finally {
    await database.close();
  }
}, 30000);
