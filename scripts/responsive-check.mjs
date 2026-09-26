import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const base = process.env.VERIFY_URL || 'http://localhost:3000';
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'chrome' : 'chromium',
});
const results = [];
const interactions = [];
const discovery = await browser.newContext();
const discoverPage = await discovery.newPage();
const { matches = [] } = await (await discovery.request.get(`${base}/api/matches/today`)).json();
let match = matches[0];
if (!match) {
  const { results } = await (
    await discovery.request.get(`${base}/api/search?scope=catalogue&category=Match`)
  ).json();
  if (results?.[0])
    match = await (
      await discovery.request.get(`${base}/api/matches/${results[0].href.split('/').pop()}`)
    ).json();
}
const team = match
  ? await (await discovery.request.get(`${base}/api/teams/${match.homeId}`)).json()
  : null;
const competition = match
  ? await (await discovery.request.get(`${base}/api/competitions/${match.competitionId}`)).json()
  : null;
await discoverPage.goto(`${base}/joueurs`);
const player = discoverPage.locator('main a[href^="/joueur/"]').first();
const playerPath = (await player.count()) ? await player.getAttribute('href') : null;
await discovery.close();
const routes = [
  '/',
  '/matchs',
  '/live',
  '/equipes',
  '/joueurs',
  '/classements',
  '/comparateur/equipes',
  '/recherche',
  '/favoris',
  '/parametres',
  ...(match ? [`/match/${match.slug}`] : []),
  ...(team ? [`/equipe/${team.slug}`] : []),
  ...(competition ? [`/competition/${competition.slug}`] : []),
  ...(playerPath ? [playerPath] : []),
  '/prelaunch-not-found',
];
try {
  for (const theme of ['dark', 'light']) {
    for (const width of [320, 360, 375, 390, 430, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } }),
        page = await context.newPage();
      await context.addInitScript(
        (value) => localStorage.setItem('matchscore-theme', value),
        theme,
      );
      let errors = [],
        failedAssets = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('requestfailed', (request) => {
        if (['image', 'stylesheet', 'script', 'font'].includes(request.resourceType()))
          failedAssets.push(new URL(request.url()).pathname);
      });
      for (const route of routes) {
        errors = [];
        failedAssets = [];
        const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        results.push({
          width,
          theme,
          route,
          status: response.status(),
          expected: route === '/prelaunch-not-found' ? 404 : 200,
          overflow,
          errors: [...errors],
          failedAssets: [...failedAssets],
          brokenImages: await page.evaluate(() =>
            [...document.images]
              .filter((i) => i.complete && !i.naturalWidth)
              .map((i) => i.getAttribute('src')),
          ),
        });
      }
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.keyboard.press('Control+k');
      await expect(page.getByRole('dialog', { name: 'Recherche globale' })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Recherche globale' })).not.toBeVisible();
      if (width < 768) {
        const menu = page.locator('header button[aria-controls="site-sidebar"]');
        await menu.click();
        await expect(menu).toHaveAttribute('aria-expanded', 'true');
        await page.keyboard.press('Escape');
        await expect(menu).toHaveAttribute('aria-expanded', 'false');
      }
      interactions.push({
        width,
        theme,
        keyboardSearch: 'PASS',
        mobileMenu: width < 768 ? 'PASS' : 'not applicable',
      });
      if ([390, 1440].includes(width))
        await page.screenshot({ path: `artifacts/prelaunch-${theme}-${width}.png` });
      await context.close();
    }
  }
} finally {
  await browser.close();
  await writeFile(
    'artifacts/responsive.json',
    JSON.stringify({ results, interactions, playerAvailable: !!playerPath }, null, 2),
  );
}
const failures = results.filter(
  (r) =>
    r.status !== r.expected ||
    r.overflow ||
    r.errors.length ||
    r.failedAssets.length ||
    r.brokenImages.length,
);
console.log(
  JSON.stringify(
    {
      views: results.length,
      interactions: interactions.length,
      playerAvailable: !!playerPath,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
