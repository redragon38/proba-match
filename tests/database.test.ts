import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
describe('Migrations PostgreSQL et historique immuable', () => {
  let db: PGlite;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(await readFile('prisma/migrations/202609110001_init/migration.sql', 'utf8'));
    await db.exec(await readFile('prisma/migrations/202609110002_integrity/migration.sql', 'utf8'));
    await db.exec(
      await readFile('prisma/migrations/202609120001_read_indexes/migration.sql', 'utf8'),
    );
    await db.exec(
      await readFile('prisma/migrations/202609130001_openfootball/migration.sql', 'utf8'),
    );
    await db.exec(
      await readFile('prisma/migrations/202610060001_result_observations/migration.sql', 'utf8'),
    );
    await db.exec(
      `INSERT INTO "Country" (id,name) VALUES ('fr','France'); INSERT INTO "Competition" (id,slug,name,"countryId") VALUES ('c','ligue','Ligue','fr'); INSERT INTO "Season" (id,year,"competitionId") VALUES ('s',2026,'c'); INSERT INTO "Team" (id,slug,name,"countryId") VALUES ('h','home','Home','fr'),('a','away','Away','fr'); INSERT INTO "Match" (id,slug,"seasonId","homeId","awayId",kickoff,status,source,payload,"updatedAt") VALUES ('future','future','s','h','a',NOW()+INTERVAL '1 day','scheduled','api-football','{}',NOW()),('past','past','s','h','a',NOW()-INTERVAL '1 day','finished','api-football','{}',NOW()); INSERT INTO "PredictionVersion" (id,description,parameters) VALUES ('v1','Test','{}');`,
    );
  }, 30000);
  afterAll(async () => {
    await db.close();
  });
  const insert = (id: string, match = 'future', home = 0.5, draw = 0.25, away = 0.25) =>
    `INSERT INTO "Prediction" (id,"matchId","versionId","createdAt",cutoff,home,draw,away,confidence,"inputHash",payload) VALUES ('${id}','${match}','v1',NOW(),NOW(),${home},${draw},${away},75,'hash','{}')`;
  it('keeps source revisions append-only and rolls back an incomplete generation', async () => {
    await db.exec(
      `INSERT INTO "ResultObservation" (id,"matchId","receivedAt",source,payload) VALUES ('r1','past',NOW(),'api-football','{"homeScore":1}'),('r2','past',NOW(),'api-football','{"homeScore":0}')`,
    );
    await expect(
      db.exec(`UPDATE "ResultObservation" SET payload='{}' WHERE id='r1'`),
    ).rejects.toThrow('immutable');
    await expect(db.exec(`DELETE FROM "ResultObservation" WHERE id='r1'`)).rejects.toThrow(
      'immutable',
    );
    await db.exec('BEGIN');
    await db.exec(`UPDATE "Match" SET "homeScore"=9 WHERE id='past'`);
    await db.exec('ROLLBACK');
    const row = await db.query<{ homeScore: number | null }>(
      `SELECT "homeScore" FROM "Match" WHERE id='past'`,
    );
    expect(row.rows[0].homeScore).toBeNull();
    expect((await db.query('SELECT * FROM "ResultObservation"')).rows).toHaveLength(2);
  });
  it('interdit deux correspondances pour un même identifiant externe', async () => {
    await db.exec(
      `INSERT INTO "FootballIdentity" (id,provider,kind,"externalId","entityId") VALUES ('i','openfootball','team','fr:psg','h')`,
    );
    await expect(
      db.exec(
        `INSERT INTO "FootballIdentity" (id,provider,kind,"externalId","entityId") VALUES ('j','openfootball','team','fr:psg','a')`,
      ),
    ).rejects.toThrow();
  });
  it('applique le schéma et accepte une prédiction avant match', async () => {
    await db.exec(insert('p1'));
    const r = await db.query('SELECT * FROM "Prediction"');
    expect(r.rows).toHaveLength(1);
  });
  it('interdit les probabilités non normalisées', async () => {
    await expect(db.exec(insert('bad', 'future', 0.9, 0.9, 0.9))).rejects.toThrow();
  });
  it('interdit l’insertion après le coup d’envoi', async () => {
    await expect(db.exec(insert('late', 'past'))).rejects.toThrow('before kickoff');
  });
  it('interdit la modification et la suppression', async () => {
    await expect(db.exec(`UPDATE "Prediction" SET home=.6 WHERE id='p1'`)).rejects.toThrow(
      'immutable',
    );
    await expect(db.exec(`DELETE FROM "Prediction" WHERE id='p1'`)).rejects.toThrow('immutable');
  });
  it('permet d’évaluer sans toucher à la prédiction', async () => {
    await db.exec(
      `INSERT INTO "PredictionResult" (id,"predictionId","homeScore","awayScore",brier,"logLoss") VALUES ('result','p1',1,0,.375,.693)`,
    );
    const r = await db.query('SELECT * FROM "PredictionResult"');
    expect(r.rows).toHaveLength(1);
  });
});
