import { PGlite } from '@electric-sql/pglite';
import { expect, it } from 'vitest';
import {
  latestPublicPredictionsSql,
  evaluatedPredictionsSql,
} from '@/services/prediction-read-sql';

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

it('projects evaluated forecasts without archives and reads the current confirmed result', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE "Prediction" ("id" text,"matchId" text,"createdAt" timestamptz,"payload" jsonb,"kind" text);
  CREATE TABLE "PredictionResult" ("predictionId" text);
  CREATE TABLE "Match" ("id" text,"seasonId" text,"kickoff" timestamptz,"payload" jsonb);
  CREATE TABLE "Season" ("id" text,"competitionId" text,"year" int);
  INSERT INTO "Season" VALUES ('season','league',2026);
  INSERT INTO "PredictionResult" VALUES ('forecast');`);
    await db.query('INSERT INTO "Prediction" VALUES ($1,$2,$3,$4::jsonb,$5)', [
      'forecast',
      'match',
      '2026-10-01',
      JSON.stringify({
        home: 0.5,
        draw: 0.25,
        away: 0.25,
        inputArchive: { secret: 'large archive' },
        factors: [{ detail: 'large commentary' }],
      }),
      'initial',
    ]);
    await db.query('INSERT INTO "Match" VALUES ($1,$2,$3,$4::jsonb)', [
      'match',
      'season',
      '2026-10-21',
      JSON.stringify({
        status: 'finished',
        homeScore: 2,
        awayScore: 1,
        resultPeriod: 'regulation',
        events: ['unneeded'],
        lineups: ['unneeded'],
      }),
    ]);
    const sql = evaluatedPredictionsSql();
    const { rows } = await db.query(sql.text, sql.values);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      season: 2026,
      competitionId: 'league',
      prediction: { home: 0.5, draw: 0.25, away: 0.25 },
      match: { status: 'finished', homeScore: 2, awayScore: 1, resultPeriod: 'regulation' },
    });
    expect(JSON.stringify(rows)).not.toMatch(/secret|archive|commentary|unneeded/);
  } finally {
    await db.close();
  }
}, 30000);
