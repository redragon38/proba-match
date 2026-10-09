import { PGlite } from '@electric-sql/pglite';
import { afterEach, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/database/client', () => ({ db: { $queryRaw: mocks.query } }));
import { playerHistory } from '@/services/profile-history';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it('selects only the latest valid season observations in PostgreSQL before transfer, respecting the cutoff', async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://isolated.example/test');
  const database = new PGlite();
  try {
    await database.exec(`
      CREATE TABLE "Competition" ("id" text, "name" text);
      CREATE TABLE "Season" ("id" text, "competitionId" text, "year" integer);
      CREATE TABLE "PlayerStatistics" ("id" text, "playerId" text, "seasonId" text, "asOf" timestamptz, "payload" jsonb);
      INSERT INTO "Competition" VALUES ('c', 'Test competition');
      INSERT INTO "Season" VALUES ('season', 'c', 2026);
    `);
    for (const [id, playerId, day, verified, competitionId, goals] of [
      ['a', 'p', 1, true, 'c', 0],
      ['b', 'p', 2, true, 'c', 1],
      ['c', 'p', 2, true, 'c', 2],
      ['d', 'p', 3, false, 'c', 3],
      ['e', 'p', 4, true, 'wrong', 4],
      ['f', "quote' OR TRUE --", 5, true, 'c', 5],
    ] as const) {
      await database.query('INSERT INTO "PlayerStatistics" VALUES ($1,$2,$3,$4,$5::jsonb)', [
        id,
        playerId,
        'season',
        `2026-10-0${day}T00:00:00Z`,
        JSON.stringify({ goals, scope: { verified, competitionId, season: 2026 } }),
      ]);
    }
    mocks.query.mockImplementation(
      async (sql: Prisma.Sql) => (await database.query(sql.text, sql.values)).rows,
    );
    const history = await playerHistory('p');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      season: 2026,
      competition: 'Test competition',
      stats: { goals: 2 },
    });
    expect((await playerHistory('p', '2026-10-01T12:00:00Z'))[0].stats.goals).toBe(0);
    expect((await playerHistory("quote' OR TRUE --"))[0].stats.goals).toBe(5);
    expect(await playerHistory('missing')).toEqual([]);
  } finally {
    await database.close();
  }
}, 30000);
