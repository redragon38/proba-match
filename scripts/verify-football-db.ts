/** Integration check against an isolated disposable PostgreSQL database, never the app corpus. */
import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { chromium, expect, type Browser, type Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
const originalUrl = process.env.DATABASE_URL;
if (!originalUrl) throw new Error('DATABASE_NOT_CONFIGURED');
const admin = new PrismaClient();
const name = `matchscore_test_${Date.now()}`;
const testUrl = new URL(originalUrl);
testUrl.pathname = `/${name}`;
const originalFetch = globalThis.fetch;
let client: PrismaClient | undefined;
let server: ChildProcess | undefined, browser: Browser | undefined, page: Page | undefined;
try {
  await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
  process.env.DATABASE_URL = testUrl.toString();
  process.env.FOOTBALL_API_KEY = '';
  // This process and its child serve only the disposable integration database.
  process.env.CRON_SECRET = 'integration-only-cron-secret-32-chars';
  process.env.ADMIN_SECRET = 'integration-only-admin-secret-32-chars';
  const migration = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env: process.env, encoding: 'utf8' },
  );
  assert.equal(migration.status, 0, 'Test database migrations');
  const { db } = await import('../src/database/client');
  client = db;
  const { healthSnapshot } = await import('../src/services/football/health-snapshot');
  const healthNow = Date.now();
  assert.equal(await healthSnapshot(healthNow), null, 'Missing dataset is not reported healthy');
  const healthCases = [
    { hours: 7, known: true, source: 'openfootball', status: 'scheduled', late: true },
    { hours: 6, known: true, source: 'openfootball', status: 'scheduled', late: false },
    { hours: 7, known: undefined, source: 'openfootball', status: 'scheduled', late: true },
    { hours: 7, known: false, source: 'openfootball', status: 'scheduled', late: false },
    { hours: 25, known: false, source: 'openfootball', status: 'scheduled', late: true },
    { hours: 24, known: false, source: 'openfootball', status: 'scheduled', late: false },
    { hours: -2, known: true, source: 'openfootball', status: 'scheduled', late: false },
    { hours: 7, known: true, source: 'espn', status: 'scheduled', late: false },
    { hours: 7, known: true, source: 'openfootball', status: 'finished', late: false },
  ];
  for (const scenario of healthCases) {
    const payload = {
      source: 'openfootball',
      matches: [{
        source: scenario.source,
        status: scenario.status,
        kickoffKnown: scenario.known,
        kickoff: new Date(healthNow - scenario.hours * 3600000).toISOString(),
      }],
      players: [{ privateFixture: 'must not be transferred by health' }],
    };
    await db.cacheEntry.upsert({
      where: { key: 'football:dataset' },
      create: { key: 'football:dataset', payload, expiresAt: new Date(), staleUntil: new Date() },
      update: { payload },
    });
    const readiness = await healthSnapshot(healthNow);
    assert.equal(readiness?.lateResults, scenario.late, 'SQL freshness preserves 6h/24h boundaries');
    assert.deepEqual(Object.keys(readiness!).sort(), ['lateResults', 'updatedAt']);
  }
  await db.cacheEntry.update({
    where: { key: 'football:dataset' },
    data: { payload: { source: 'api-football', matches: [{ source: 'openfootball', status: 'scheduled', kickoff: new Date(healthNow - 48 * 3600000).toISOString() }] } },
  });
  assert.equal((await healthSnapshot(healthNow))?.lateResults, false, 'Secondary snapshot does not claim primary OpenFootball delay');
  await db.cacheEntry.delete({ where: { key: 'football:dataset' } });
  const { allowAdminAttempt } = await import('../src/services/admin-throttle');
  const { allowVitalsReport } = await import('../src/services/vitals-limit');
  const attempts = await Promise.all(
    Array.from({ length: 20 }, () =>
      allowAdminAttempt(new Request('http://localhost/api/admin/session')),
    ),
  );
  assert.equal(
    attempts.filter(Boolean).length,
    10,
    'PostgreSQL atomically limits concurrent admin attempts',
  );
  const measurements = await Promise.all(
    Array.from({ length: 65 }, () => allowVitalsReport(new Request('http://localhost/api/vitals'))),
  );
  assert.equal(
    measurements.filter(Boolean).length,
    60,
    'PostgreSQL atomically limits concurrent telemetry reports',
  );
  await db.cacheEntry.deleteMany({
    where: {
      OR: [{ key: { startsWith: 'admin-attempt:' } }, { key: { startsWith: 'vitals-attempt:' } }],
    },
  });
  const { syncOpenFootball, currentSeason } =
    await import('../src/services/football/openfootball-sync');
  const { syncSecondary } = await import('../src/services/football/secondary');
  const { syncSportsDbPlayers } = await import('../src/services/football/sportsdb-sync');
  const { readLocalDataset } = await import('../src/services/football/local-store');
  const { bindIdentity } = await import('../src/services/football/identities');
  const { persistDataset } = await import('../src/services/football/persistence');
  const { footballJob } = await import('../src/services/football/jobs');
  const { runWorkerLoop } = await import('../src/services/football/worker-loop');
  await footballJob('lock-verification', async () => {
    const lock = await db.syncLock.findUniqueOrThrow({ where: { key: 'football' } });
    const remaining = lock.expiresAt.getTime() - Date.now();
    assert.ok(
      remaining > 29 * 60000 && remaining <= 30 * 60000,
      'Lease expiry uses UTC regardless of PostgreSQL timezone',
    );
    await db.syncLock.update({
      where: { key: 'football' },
      data: { expiresAt: new Date(Date.now() + 30 * 60000) },
    });
    await assert.rejects(
      footballJob('overlap', async () => ({})),
      /SYNC_ALREADY_RUNNING/,
    );
    return { status: 'success' };
  });
  await assert.rejects(
    footballJob('controlled-failure', async () => {
      throw new Error('controlled');
    }),
    /SYNC_FAILED/,
  );
  assert.equal(await db.syncLock.count(), 0, 'Failed job releases its database lease');
  await footballJob('recovery', async () => ({ status: 'success' }));
  const scope = { league: 'fr.1' as const, season: currentSeason() };
  const sourceRow = {
    team1: 'Integration Home',
    team2: 'Integration Away',
    date: `${scope.season}-08-01`,
    time: '20:00',
    score: { ft: [1, 0] as number[] | undefined },
  };
  let document = { name: 'Test Ligue', matches: [sourceRow] };
  globalThis.fetch = async () => Response.json(document);
  const run = () => syncOpenFootball({ scopes: [scope], force: true });
  assert.equal((await run()).status, 'success');
  const first = await readLocalDataset(),
    id = first.matches[0].id;
  assert.match(id, /^[a-f0-9-]{36}$/);
  assert.equal(await db.team.count(), 2);
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === 'www.wikidata.org')
      return Response.json({
        entities: {
          Q59306386: {
            claims: { P18: [{ mainsnak: { datavalue: { value: 'Integration Striker.jpg' } } }] },
          },
        },
      });
    if (url.hostname === 'commons.wikimedia.org')
      return Response.json({
        query: {
          pages: {
            '1': {
              title: 'File:Integration Striker.jpg',
              imageinfo: [
                {
                  thumburl:
                    'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Integration_Striker.jpg/180px-Integration_Striker.jpg',
                  descriptionurl: 'https://commons.wikimedia.org/wiki/File:Integration_Striker.jpg',
                  extmetadata: {
                    Artist: { value: 'Integration Photographer' },
                    LicenseShortName: { value: 'CC BY 4.0' },
                    LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' },
                  },
                },
              ],
            },
          },
        },
      });
    if (url.pathname.endsWith('/searchteams.php')) {
      const name = url.searchParams.get('t')!;
      return Response.json({
        teams: [
          {
            idTeam: name === 'Integration Home' ? '101' : '102',
            strTeam: name,
            strSport: 'Soccer',
            strCountry: 'France',
          },
        ],
      });
    }
    if (url.pathname.endsWith('/lookup_all_players.php')) {
      const team = url.searchParams.get('id')!;
      return Response.json({
        player: [
          {
            idPlayer: team === '101' ? '501' : '502',
            idTeam: team,
            strPlayer: team === '101' ? 'Integration Striker' : 'Integration Keeper',
            strPosition: team === '101' ? 'Striker' : 'Goalkeeper',
            strNumber: '9',
            strNationality: 'France',
            dateBorn: '2000-01-01',
            strHeight: '1.82 m',
            strSide: 'Right',
            idWikidata: team === '101' ? 'Q59306386' : null,
          },
        ],
      });
    }
    throw new Error('Unexpected provider URL');
  };
  assert.equal((await syncSportsDbPlayers(2)).players, 2);
  assert.equal((await readLocalDataset()).players.length, 2, 'Player snapshot is refreshed');
  const enriched = (await readLocalDataset()).players.find(
    (player) => player.name === 'Integration Striker',
  )!;
  assert.equal(enriched.height, '1.82 m');
  assert.equal(enriched.foot, 'Droit');
  assert.equal(enriched.photoCredit, 'Integration Photographer');
  assert.equal(await db.player.count(), 2, 'Players are persisted in PostgreSQL');
  globalThis.fetch = async () => Response.json(document);
  document = {
    name: 'Test Ligue',
    matches: [{ ...sourceRow, date: `${scope.season}-08-08`, score: { ft: [2, 0] } }],
  };
  let schedulerTime = Date.now(),
    automaticCycles = 0;
  const automaticResults: Awaited<ReturnType<typeof run>>[] = [];
  await runWorkerLoop({
    now: () => schedulerTime,
    stopped: () => automaticCycles === 2,
    wait: async (ms) => {
      schedulerTime += ms;
    },
    nextOpen: async () => schedulerTime,
    open: async () => {
      const result = await run();
      automaticResults.push(result);
      return result;
    },
    secondaryEnabled: () => false,
    secondary: async () => ({ status: 'success' }),
    heartbeat: async () => {
      automaticCycles++;
    },
    log: () => {},
  });
  assert.equal(
    automaticResults.length,
    2,
    'Scheduler executes two autonomous imports (accelerated clock)',
  );
  assert.equal(automaticResults[0].changed, 1);
  assert.equal(automaticResults[0].resultsChanged, 1);
  assert.equal(
    automaticResults[1].changed,
    0,
    'Unchanged source is distinguishable from modified matches',
  );
  assert.equal(await db.match.count(), 1);
  assert.equal(await db.team.count(), 2);
  let data = await readLocalDataset();
  assert.equal(data.matches[0].id, id);
  assert.equal(data.matches[0].homeScore, 2);
  assert.equal(data.matches[0].sourceDate, `${scope.season}-08-08`);
  assert.equal((await syncSecondary()).requests, 0);
  const match = data.matches[0];
  match.status = 'scheduled';
  match.kickoff = new Date(Date.now() - 1800000).toISOString();
  match.homeScore = 0;
  match.awayScore = 0;
  await persistDataset(data, new Set([id]));
  await bindIdentity('api-football', 'team', '1', match.homeId);
  await bindIdentity('api-football', 'team', '2', match.awayId);
  await bindIdentity('api-football', 'match', '123', id);
  if (process.env.FOOTBALL_VERIFY_UI === 'true') {
    server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', '3001'], {
      env: { ...process.env, FOOTBALL_API_KEY: '' },
      stdio: 'ignore',
    });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        ready = (await originalFetch('http://localhost:3001/api/updates')).ok;
      } catch {
        /* startup */
      }
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, 'Isolated production server ready');
    browser = await chromium.launch({
      channel: process.platform === 'win32' ? 'chrome' : 'chromium',
    });
    page = await browser.newPage();
    await page.clock.install();
    await page.goto(`http://localhost:3001/match/${id}?onglet=evenements`);
    await expect(page.locator('.score-block > strong')).toHaveText('0 : 0');
    await page.goto('http://localhost:3001/joueurs');
    await expect(page.getByText('Integration Striker', { exact: true })).toBeVisible();
    await page.goto(`http://localhost:3001/match/${id}?onglet=evenements`);
    await page.evaluate(() => {
      window.document.documentElement.dataset.testDocument = 'unchanged';
    });
    assert.equal((await originalFetch('http://localhost:3001/api/cron/live')).status, 401);
    assert.equal(
      (
        await originalFetch('http://localhost:3001/api/cron/live', {
          headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
        })
      ).status,
      200,
    );
  }
  process.env.FOOTBALL_API_KEY = 'controlled-test-key';
  process.env.FOOTBALL_API_PROVIDER = 'api-football';
  process.env.FOOTBALL_DAILY_BUDGET = '10';
  let calls = 0;
  let final = false;
  globalThis.fetch = async (input) => {
    calls++;
    const fixture = {
      fixture: {
        id: 123,
        date: match.kickoff,
        referee: null,
        venue: { name: null },
        status: { short: final ? 'FT' : '1H', elapsed: final ? 90 : 30 },
      },
      league: { id: 61, name: 'Ligue 1', country: 'France', season: scope.season, round: '1' },
      teams: {
        home: { id: 1, name: 'Integration Home' },
        away: { id: 2, name: 'Integration Away' },
      },
      goals: { home: final ? 2 : 1, away: 0 },
      events: [
        {
          time: { elapsed: 25 },
          team: { id: 1 },
          player: { name: 'Integration Scorer' },
          type: 'Goal',
          detail: 'Normal Goal',
        },
        {
          time: { elapsed: 27 },
          team: { id: 2 },
          player: { name: 'Integration Card' },
          type: 'Card',
          detail: 'Yellow Card',
        },
        {
          time: { elapsed: 29 },
          team: { id: 1 },
          player: { name: 'Integration Sub' },
          assist: { name: 'Integration Out' },
          type: 'subst',
        },
      ],
      statistics: [
        { team: { id: 1 }, statistics: [{ type: 'Ball Possession', value: '60%' }] },
        { team: { id: 2 }, statistics: [{ type: 'Ball Possession', value: '40%' }] },
      ],
      lineups: [1, 2].map((team) => ({
        team: { id: team },
        formation: '4-4-2',
        startXI: [{ player: { id: team * 10, name: `Integration Player ${team}`, number: 10 } }],
        substitutes: [],
      })),
    };
    const path = new URL(String(input)).pathname;
    // Model the real separate endpoints, not fixture objects returned for every request.
    let response: unknown[];
    if (path === '/fixtures') {
      response = [
        {
          fixture: fixture.fixture,
          league: fixture.league,
          teams: fixture.teams,
          goals: fixture.goals,
        },
      ];
    } else if (path === '/fixtures/events') response = fixture.events;
    else if (path === '/fixtures/statistics') response = fixture.statistics;
    else if (path === '/fixtures/lineups') response = fixture.lineups;
    else if (path === '/fixtures/players') response = [];
    else throw new Error(`Unexpected fixture endpoint: ${path}`);
    return Response.json({ errors: [], response });
  };
  assert.equal((await syncSecondary()).status, 'success');
  assert.equal(calls, 5, 'One fixture request plus four detail endpoints');
  data = await readLocalDataset();
  assert.equal(data.matches[0].id, id);
  assert.equal(data.matches[0].homeId, match.homeId);
  assert.equal(data.matches[0].source, 'api-football');
  assert.equal(data.matches[0].homeScore, 1);
  assert.equal((await db.match.findUniqueOrThrow({ where: { id } })).homeScore, 1);
  assert.equal(data.matches[0].minute, 30);
  assert.deepEqual(
    data.matches[0].events.map((e) => e.type),
    ['goal', 'yellow', 'substitution'],
  );
  assert.equal(data.matches[0].statistics.find((s) => s.label === 'Possession')?.home, 60);
  assert.equal(data.matches[0].lineups.length, 2);
  if (page) {
    const live = await (await originalFetch('http://localhost:3001/api/live')).json();
    assert.equal(
      live.matches.find((m: { id: string }) => m.id === id)?.homeScore,
      1,
      'Internal live API receives updated score',
    );
    await page.clock.fastForward(31000);
    await expect(page.locator('.score-block > strong')).toHaveText('1 : 0');
    await expect(page.getByText('Integration Scorer', { exact: true })).toBeVisible();
    assert.equal(
      await page.evaluate(() => window.document.documentElement.dataset.testDocument),
      'unchanged',
    );
  }
  await syncSecondary();
  assert.equal(calls, 5, 'fresh data performs no external request');
  final = true;
  data.matches[0].detailsUpdatedAt = new Date(Date.now() - 120000).toISOString();
  await persistDataset(data, new Set([id]));
  await syncSecondary();
  data = await readLocalDataset();
  assert.equal(data.matches[0].status, 'finished');
  assert.equal(data.matches[0].homeScore, 2);
  assert.equal(
    data.standings[match.competitionId].find((s) => s.teamId === match.homeId)?.points,
    3,
  );
  assert.equal((await db.standing.findFirstOrThrow({ where: { teamId: match.homeId } })).points, 3);
  if (page) {
    await page.clock.fastForward(31000);
    await expect(page.locator('.score-block > strong')).toHaveText('2 : 0');
  }
  const day = new Date().toISOString().slice(0, 10);
  await db.apiQuota.update({ where: { day }, data: { count: 10 } });
  data.matches[0].detailsUpdatedAt = new Date(Date.now() - 7200000).toISOString();
  await persistDataset(data, new Set([id]));
  assert.equal((await syncSecondary()).status, 'partial');
  assert.equal(calls, 6, 'Cached details avoid redundant requests; quota exhaustion adds none');
  assert.equal((await readLocalDataset()).matches[0].homeScore, 2);
  globalThis.fetch = async () => {
    throw new Error('offline');
  };
  assert.equal((await run()).status, 'partial');
  assert.equal(
    (await readLocalDataset()).matches[0].homeScore,
    2,
    'OpenFootball outage preserves local data',
  );
  if (page) await page.goto(`http://localhost:3001/matchs?date=${day}`);
  document.matches.push({
    ...sourceRow,
    team2: 'Integration New Opponent',
    date: day,
    score: { ft: undefined },
  });
  globalThis.fetch = async () => Response.json(document);
  await run();
  assert.equal(await db.match.count(), 2);
  if (page) {
    await page.clock.fastForward(31000);
    await expect(
      page.locator('.match-row').filter({ hasText: 'Integration New Opponent' }),
    ).toBeVisible();
    await page.screenshot({ path: 'artifacts/automatic-sync.png' });
  }
  const added = (await readLocalDataset()).matches.find((m) => m.id !== id)!;
  assert.equal(added.competitionId, match.competitionId);
  assert.equal(added.sourceDate, day);
  if (page) await page.goto(`http://localhost:3001/match/${added.id}`);
  document.matches[1].time = '21:00';
  await run();
  const rescheduled = (await readLocalDataset()).matches.find((m) => m.id === added.id)!;
  assert.equal(Date.parse(rescheduled.kickoff) - Date.parse(added.kickoff), 3600000);
  assert.equal(await db.match.count(), 2);
  if (page) {
    await page.clock.fastForward(31000);
    await expect(page.locator('.score-block time')).toHaveAttribute(
      'datetime',
      rescheduled.kickoff,
    );
  }
  await db.apiQuota.update({ where: { day }, data: { count: 0 } });
  data = await readLocalDataset();
  data.matches.find((m) => m.id === id)!.detailsUpdatedAt = new Date().toISOString();
  await persistDataset(data, new Set([id]));
  let injured = true;
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    const rows = url.pathname.endsWith('/players')
      ? [
          {
            player: {
              id: Number(url.searchParams.get('team')) * 10,
              name: 'Integration Player',
              birth: {},
            },
            statistics: [],
          },
        ]
      : url.pathname.endsWith('/injuries') && injured
        ? [
            {
              player: { id: 10, reason: 'Integration Injury', type: 'Missing Fixture' },
              team: { id: 1 },
              fixture: { id: 123 },
            },
          ]
        : [];
    return Response.json({ errors: [], response: rows });
  };
  assert.equal((await syncSecondary({ enrich: true })).status, 'success');
  assert.equal(await db.injury.count(), 1);
  assert.equal((await readLocalDataset()).injuries[0].reason, 'Integration Injury');
  assert.notEqual(
    (await readLocalDataset()).warning,
    'Certaines statistiques live peuvent être temporairement indisponibles. Les dernières données locales restent disponibles.',
    'Successful provider recovery clears its previous warning',
  );
  injured = false;
  await db.cacheEntry.updateMany({
    where: { key: { startsWith: 'secondary:injuries:' } },
    data: { expiresAt: new Date(0) },
  });
  await syncSecondary({ enrich: true });
  assert.equal(
    await db.injury.count(),
    0,
    'Recovered injuries removed after successful provider refresh',
  );
  assert.equal((await readLocalDataset()).injuries.length, 0);
  if (page) {
    const profiles = (await readLocalDataset()).players;
    assert.ok(profiles.length, 'Controlled provider fixtures create player profiles');
    for (const profile of profiles) {
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        const response = await page.goto(`http://localhost:3001/joueur/${profile.slug}`);
        assert.equal(response?.status(), 200);
        await expect(page.getByRole('heading', { name: profile.name, exact: true })).toBeVisible();
        assert.ok(
          (await page.title()).includes(profile.name),
          'Player title uses observed identity',
        );
        const description = await page.locator('meta[name="description"]').getAttribute('content');
        assert.ok(
          description?.includes(profile.name),
          'Player description matches visible identity',
        );
        assert.ok(!/undefined|NaN|Invalid Date/.test(description!), 'No invalid metadata values');
        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
        assert.equal(new URL(canonical!).pathname, `/joueur/${profile.slug}`);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
        const schemas: Record<string, unknown>[] = await page
          .locator('script[type="application/ld+json"]')
          .evaluateAll((nodes) => nodes.map((node) => JSON.parse(node.textContent!)));
        assert.equal(
          schemas.find((schema) => schema['@type'] === 'Person')?.name,
          profile.source === 'thesportsdb' ? undefined : profile.name,
          'Person schema matches the observed profile; community fallback remains excluded',
        );
        assert.equal(
          await page.evaluate(() => window.document.documentElement.scrollWidth > innerWidth),
          false,
          `Player profile fits ${width}px`,
        );
      }
    }
  }
  if (page && process.env.ADMIN_SECRET) {
    const heartbeat = {
      checkedAt: new Date(Date.now() - 180000).toISOString(),
      nextOpen: new Date(Date.now() + 3600000).toISOString(),
      secondaryStatus: 'disabled',
    };
    await db.cacheEntry.create({
      data: {
        key: 'football:worker',
        payload: heartbeat,
        expiresAt: new Date(),
        staleUntil: new Date(),
      },
    });
    const login = await page.request.post('http://localhost:3001/api/admin/session', {
      headers: { Origin: 'http://localhost:3001' },
      data: { secret: process.env.ADMIN_SECRET },
    });
    assert.equal(login.status(), 200);
    await page.goto('http://localhost:3001/admin');
    const status = page
      .locator('.metric')
      .filter({ has: page.getByText('Worker', { exact: true }) });
    await expect(status).toContainText('En retard');
    await db.cacheEntry.update({
      where: { key: 'football:worker' },
      data: { payload: { ...heartbeat, checkedAt: new Date().toISOString() } },
    });
    await page.clock.fastForward(31000);
    await expect(status).toContainText('Actif');
    await page.screenshot({ path: 'artifacts/worker-health.png', fullPage: true });
  }
  console.log(
    'PostgreSQL integration PASS: failed lease recovery, two automatic scheduler imports (accelerated clock), imports, idempotence, reschedule, new fixtures, no key, live score/minute/events/statistics/lineups, injuries/recovery, final score/standings, quota fallback, source outage' +
      (page ? ', production cache and automatic UI refresh, cron authentication.' : '.'),
  );
} finally {
  await browser?.close();
  if (server) {
    server.kill();
    await new Promise((resolve) => server!.once('exit', resolve));
  }
  globalThis.fetch = originalFetch;
  await client?.$disconnect();
  process.env.DATABASE_URL = originalUrl;
  // Only this script-created database is removed; no app rows or historical predictions touched.
  await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.$disconnect();
}
