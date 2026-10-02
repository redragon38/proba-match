import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';

const base = process.env.VERIFY_URL || 'http://localhost:3000';
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'chrome' : 'chromium',
});
const views = [],
  accessibility = [],
  interactions = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const catalog = await (await page.request.get(`${base}/api/matches/today`)).json();
  let match = catalog.matches[0];
  if (!match) {
    const scheduled = await (
      await page.request.get(`${base}/api/matches?status=scheduled&limit=1`)
    ).json();
    match = scheduled.matches?.[0];
  }
  if (!match) {
    const finished = await (
      await page.request.get(`${base}/api/matches?status=finished&limit=1`)
    ).json();
    match = finished.matches?.[0];
  }
  if (!match || catalog.source !== 'openfootball') throw new Error('Real local catalogue required');
  const team = await (await page.request.get(`${base}/api/teams/${match.homeId}`)).json();
  const competition = await (
    await page.request.get(`${base}/api/competitions/${match.competitionId}`)
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
    '/favoris',
    '/parametres',
    `/match/${match.slug}`,
    `/match/${match.slug}?onglet=statistiques`,
    `/equipe/${team.slug}`,
    `/competition/${competition.slug}`,
  ];
  let errors = [],
    external = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (/raw\.githubusercontent\.com|api-sports\.io|api-football\.com/.test(request.url()))
      external.push(request.url().split('?')[0]);
  });
  for (const theme of ['light', 'dark']) {
    await page.goto(base);
    await page.evaluate((value) => localStorage.setItem('matchscore-theme', value), theme);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        errors = [];
        external = [];
        const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        views.push({
          theme,
          width,
          route,
          status: response.status(),
          overflow,
          errors: [...errors],
          external: [...external],
        });
        if (['/', '/parametres', '/classements'].includes(route)) {
          await page.screenshot({
            path: `artifacts/product-${route === '/' ? 'home' : route.slice(1)}-${theme}-${width}.png`,
            fullPage: true,
          });
        }
        if (width === 390 && ['/', '/parametres'].includes(route)) {
          const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
          accessibility.push({
            theme,
            route,
            violations: result.violations.map((v) => ({
              id: v.id,
              impact: v.impact,
              nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
            })),
          });
        }
      }
    }
  }
  for (const width of [320, 360, 375, 430, 768, 1024, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/classements', `/match/${match.slug}`]) {
      errors = [];
      external = [];
      const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
      views.push({
        theme: 'dark',
        width,
        route,
        status: response.status(),
        overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        errors: [...errors],
        external: [...external],
      });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/parametres`);
  await page.getByRole('button', { name: 'Clair', exact: true }).click();
  await page.getByRole('button', { name: 'Compact', exact: true }).click();
  const favorite = page.locator('.settings-row .favorite-button').first();
  await favorite.click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  await expect(favorite).toHaveAttribute('aria-pressed', 'true');
  interactions.push('Theme, density and favorites persist after reload');
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await expect(page.locator('.sidebar')).toHaveClass(/is-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.sidebar')).not.toHaveClass(/is-open/);
  interactions.push('Mobile drawer opens and Escape closes it');
  await page.goto(`${base}/`);
  await page.getByRole('button', { name: 'Afficher les filtres pays et compétition' }).click();
  await page.getByLabel('Compétition', { exact: true }).selectOption(match.competitionId);
  await expect(page).toHaveURL(/competition=/);
  await page.getByRole('button', { name: 'Jour suivant', exact: true }).click();
  await expect(page).toHaveURL(/date=/);
  expect(new URL(page.url()).searchParams.get('competition')).toBe(match.competitionId);
  interactions.push('Calendar navigation preserves URL filters');
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: 'Rechercher partout' }).fill(team.name);
  await expect(page.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('ArrowDown');
  const href = await page.locator('[role=option][aria-selected=true]').getAttribute('href');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`${base}${href}`);
  interactions.push('Keyboard search navigates to selected result');
  await page.goto(`${base}/competition/${competition.slug}?saison=2023`);
  await expect(page.locator('.season-picker select')).toHaveValue('2023');
  await expect(page.getByRole('button', { name: 'Résultats', exact: true })).toHaveClass(/active/);
  const standing = page.locator('.standings-mobile details').first();
  await standing.locator('summary').click();
  await expect(standing).toHaveAttribute('open', '');
  interactions.push('Historical season opens results; mobile standings expand');
  await context.close();
} finally {
  await browser.close();
  await writeFile(
    'artifacts/product-verification.json',
    JSON.stringify({ views, accessibility, interactions }, null, 2),
  );
}
const failures = views.filter(
  (v) => v.status !== 200 || v.overflow || v.errors.length || v.external.length,
);
const violations = accessibility.flatMap((a) =>
  a.violations.map((v) => ({ theme: a.theme, route: a.route, ...v })),
);
console.log(JSON.stringify({ views: views.length, interactions, failures, violations }, null, 2));
if (failures.length || violations.length) process.exitCode = 1;
