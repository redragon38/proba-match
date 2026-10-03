/** Isolated integration contract: never modifies the application's football corpus. */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
const admin = new PrismaClient();
const name = `expanded_test_${Date.now()}`;
const originalUrl = process.env.DATABASE_URL;
if (!originalUrl) throw Error('DATABASE_NOT_CONFIGURED');
const testUrl = new URL(originalUrl);
testUrl.pathname = `/${name}`;
const originalFetch = globalThis.fetch;
let client: PrismaClient | undefined;
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  process.env.DATABASE_URL = testUrl.toString();
  const migration = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env: process.env, encoding: 'utf8' },
  );
  assert.equal(migration.status, 0);
  const { db } = await import('../src/database/client');
  client = db;
  const { syncExpandedFootball, syncExpandedPlayers } =
    await import('../src/services/football/espn-sync');
  const { expandedSeason } = await import('../src/services/football/providers/espn');
  const season = expandedSeason('por.1');
  let fail = false;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    assert.equal(url.hostname, 'site.api.espn.com');
    if (fail) return new Response('', { status: 503 });
    const year = Number(url.searchParams.get('dates'));
    if (url.pathname.endsWith('/scoreboard'))
      return Response.json({
        events: [
          {
            id: String(year),
            date: `${year}-08-01T19:00Z`,
            season: { year, slug: 'regular-season' },
            competitions: [
              {
                status: { type: { name: 'STATUS_FULL_TIME', completed: true, state: 'post' } },
                competitors: [
                  {
                    homeAway: 'home',
                    score: '2',
                    team: { id: '10', displayName: 'Verified Home' },
                    statistics: [{ name: 'totalShots', displayValue: '8' }],
                  },
                  {
                    homeAway: 'away',
                    score: '0',
                    team: { id: '20', displayName: 'Verified Away' },
                    statistics: [{ name: 'totalShots', displayValue: '3' }],
                  },
                ],
              },
            ],
          },
        ],
      });
    const teamId = url.pathname.split('/').at(-2)!;
    return Response.json({
      team: { id: teamId },
      season: { year: season },
      athletes: [
        {
          id: `${teamId}42`,
          displayName: `Verified Player ${teamId}`,
          position: { abbreviation: 'F', name: 'Forward' },
          statistics: {
            splits: {
              categories: [
                {
                  stats: [
                    { name: 'totalGoals', value: 2 },
                    { name: 'appearances', value: 5 },
                  ],
                },
              ],
            },
          },
        },
      ],
    });
  };
  const first = await syncExpandedFootball({ history: true, leagues: ['por.1'] });
  assert.equal(first.failures, 0);
  assert.equal(first.matches, 4);
  assert.equal(await db.competition.count(), 1);
  assert.equal(await db.team.count(), 2);
  assert.equal(await db.match.count(), 4);
  assert.equal(await db.season.count(), 4);
  const again = await syncExpandedFootball({ history: true, leagues: ['por.1'] });
  assert.equal(again.requests, 0);
  assert.equal(await db.match.count(), 4);
  const refreshed = await syncExpandedFootball({ history: true, force: true, leagues: ['por.1'] });
  assert.equal(refreshed.matches, 4);
  assert.equal(await db.match.count(), 4);
  const players = await syncExpandedPlayers(30);
  assert.equal(players.players, 2);
  assert.equal(players.remaining, 0);
  assert.equal(await db.player.count(), 2);
  assert.equal(await db.playerStatistics.count(), 2);
  const snapshot = await db.cacheEntry.findUniqueOrThrow({ where: { key: 'football:dataset' } });
  const data = snapshot.payload as unknown as {
    players: { stats: { goals: number; minutes: null } }[];
  };
  assert.equal(data.players.length, 2);
  assert.equal(data.players[0].stats.goals, 2);
  assert.equal(data.players[0].stats.minutes, null);
  assert.equal((await syncExpandedPlayers()).requests, 0);
  fail = true;
  const unavailable = await syncExpandedFootball({ force: true, leagues: ['por.1'] });
  assert.equal(unavailable.status, 'partial');
  assert.equal(await db.match.count(), 4);
  assert.equal(await db.player.count(), 2);
  assert.equal(await db.syncLock.count(), 0);
  const { persistDataset } = await import('../src/services/football/persistence');
  const { readLocalDataset } = await import('../src/services/football/local-store');
  const countries = await readLocalDataset();
  countries.teams = countries.teams.map((t) => ({ ...t, country: 'Canada' }));
  await persistDataset(countries, new Set(), { profiles: false });
  assert.equal(
    await db.team.count({ where: { countryId: 'canada' } }),
    2,
    'Concurrent clubs can share a newly created country',
  );
  console.log(
    'PASS: expanded DB import, four seasons, stable identities, refresh, TTL, real roster/statistics persistence and failure preservation.',
  );
} finally {
  globalThis.fetch = originalFetch;
  await client?.$disconnect();
  process.env.DATABASE_URL = originalUrl;
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.$disconnect();
}
