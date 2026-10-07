import { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Dataset, Match } from '@/types/football';

const adapter = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/database/client', () => ({ db: { $queryRaw: adapter.query } }));
import { healthSnapshot } from '@/services/football/health-snapshot';
import { hasLateOpenResults } from '@/services/football/freshness';

describe('SQL and in-memory results freshness agree', () => {
  let db: PGlite;
  const now = Date.parse('2026-10-07T07:00:00.123Z');
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(
      'CREATE TABLE "CacheEntry" ("key" TEXT PRIMARY KEY, "payload" JSONB, "updatedAt" TIMESTAMP NOT NULL)',
    );
    adapter.query.mockImplementation(
      async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, '');
        return (
          await db.query(
            sql,
            values.map((value) => (value instanceof Date ? value.toISOString() : value)),
          )
        ).rows;
      },
    );
  }, 30000);
  afterAll(async () => {
    await db?.close();
  });

  it('does not report an absent snapshot as healthy', async () => {
    expect(await healthSnapshot(now)).toBeNull();
  });
  it.each(['openfootball', 'espn', 'api-football'] as const)(
    'preserves exact millisecond deadlines and status rules for %s',
    async (source) => {
      for (const snapshotSource of ['openfootball', 'espn', 'api-football'] as const) {
        for (const known of [true, false, undefined]) {
          for (const offset of [-1, 0, 1]) {
            for (const status of [
              'scheduled',
              'finished',
              'live',
              'postponed',
              'cancelled',
              'abandoned',
            ] as const) {
              const hours = known === false ? 24 : 6;
              const match = {
                source,
                status,
                kickoffKnown: known,
                kickoff: new Date(now - hours * 3600000 - offset).toISOString(),
              } as Match;
              const payload: Pick<Dataset, 'source' | 'matches'> = {
                source: snapshotSource,
                matches: [match],
              };
              await db.query(
                'INSERT INTO "CacheEntry" ("key", "payload", "updatedAt") VALUES ($1, $2, $3) ON CONFLICT ("key") DO UPDATE SET "payload" = EXCLUDED."payload"',
                ['football:dataset', JSON.stringify(payload), new Date(now).toISOString()],
              );
              const result = await healthSnapshot(now);
              expect(
                result?.lateResults,
                JSON.stringify({ snapshotSource, source, known, offset, status }),
              ).toBe(hasLateOpenResults(payload, now));
            }
          }
        }
      }
    },
    30000,
  );
});
