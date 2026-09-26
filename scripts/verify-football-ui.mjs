import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'chrome' : 'chromium',
});
const results = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } });
    const page = await context.newPage();
    let errors = [],
      external = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (request) => {
      if (/raw\.githubusercontent\.com|api-sports\.io|api-football\.com/.test(request.url()))
        external.push(request.url().split('?')[0]);
    });
    const matchesResponse = await page.request.get('http://localhost:3000/api/matches/today');
    const catalog = await matchesResponse.json();
    if (catalog.source !== 'openfootball' || !catalog.matches?.length)
      throw new Error('REAL_LOCAL_MATCHES_REQUIRED');
    const match = catalog.matches[0];
    const team = await (
      await page.request.get(`http://localhost:3000/api/teams/${match.homeId}`)
    ).json();
    const competition = await (
      await page.request.get(`http://localhost:3000/api/competitions/${match.competitionId}`)
    ).json();
    const routes = [
      '/',
      '/matchs',
      '/live',
      '/equipes',
      '/joueurs',
      '/competitions',
      '/classements',
      '/comparateur/equipes',
      '/comparateur/joueurs',
      '/recherche',
      `/match/${match.slug}`,
      `/match/${match.slug}?onglet=statistiques`,
      `/equipe/${team.slug}`,
      `/competition/${competition.slug}`,
    ];
    if (process.env.ADMIN_SECRET) {
      const response = await page.request.post('http://localhost:3000/api/admin/session', {
        headers: { Origin: 'http://localhost:3000' },
        data: { secret: process.env.ADMIN_SECRET },
      });
      if (!response.ok()) throw new Error('ADMIN_LOGIN_FAILED');
      routes.push('/admin');
    }
    for (const route of routes) {
      errors = [];
      external = [];
      if (route === '/' && width === 1440) await page.clock.install({ time: new Date() });
      const response = await page.goto(`http://localhost:3000${route}`, {
        waitUntil: 'networkidle',
      });
      if (route === '/' && width === 1440) {
        await page
          .getByRole('button', { name: 'Afficher les filtres pays et compétition' })
          .click();
        await Promise.all([
          page.waitForResponse((r) => r.url().includes('/api/live?'), { timeout: 15000 }),
          page.clock.fastForward(31000),
        ]);
        await expect(page.getByText('Actualisation interrompue.', { exact: false })).toHaveCount(0);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      const demo = await page.getByText('Mode démonstration', { exact: true }).count();
      results.push({
        width,
        route,
        status: response.status(),
        overflow,
        demo,
        errors: [...errors],
        external: [...external],
      });
      if (route === '/' || route === '/admin' || route.includes('onglet=statistiques'))
        await page.screenshot({
          path: `artifacts/openfootball-${route === '/' ? 'home' : route === '/admin' ? 'admin' : 'stats'}-${width}.png`,
          fullPage: true,
        });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
await writeFile('artifacts/openfootball-browser.json', JSON.stringify(results, null, 2));
const failures = results.filter(
  (r) => r.status !== 200 || r.overflow || r.demo || r.errors.length || r.external.length,
);
console.log(JSON.stringify({ views: results.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
