import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import { latestPublicPredictionsSql } from '@/services/prediction-read-sql';

it('returns only latest requested forecasts and never transfers their input archives', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      'CREATE TABLE "Prediction" ("id" text, "matchId" text, "createdAt" timestamptz, "payload" jsonb)',
    );
    for (const [id, matchId, at, home] of [
      ['a', 'wanted', '2026-01-01', 40],
      ['b', 'wanted', '2026-01-02', 50],
      ['c', 'wanted', '2026-01-02', 60],
      ['d', 'other', '2026-01-03', 70],
      ['e', "quote' OR TRUE --", '2026-01-04', 80],
    ]) {
      await db.query('INSERT INTO "Prediction" VALUES ($1,$2,$3,$4::jsonb)', [
        id,
        matchId,
        at,
        JSON.stringify({ home, inputArchive: { history: 'private large history' } }),
      ]);
    }
    for (const ids of [['wanted'], [], ["quote' OR TRUE --"]]) {
      const sql = latestPublicPredictionsSql(ids);
      const { rows } = await db.query(sql.text, sql.values);
      expect(rows).toEqual(
        ids.map((matchId) => ({ matchId, payload: { home: matchId === 'wanted' ? 60 : 80 } })),
      );
    }
    const { rows } = await db.query('SELECT "payload" FROM "Prediction" WHERE "id" = $1', ['c']);
    expect(rows).toEqual([
      { payload: { home: 60, inputArchive: { history: 'private large history' } } },
    ]);
  } finally {
    await db.close();
  }
}, 30000);
