import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
const base = 'http://localhost:3000';
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'chrome' : 'chromium',
});
const views = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  const { matches } = await (await page.request.get(`${base}/api/matches/today`)).json();
  const match = matches[0];
  const team = await (await page.request.get(`${base}/api/teams/${match.homeId}`)).json();
  const competition = await (
    await page.request.get(`${base}/api/competitions/${match.competitionId}`)
  ).json();
  await page.goto(base);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const routes = [
    '/',
    '/live',
    `/match/${match.slug}`,
    `/equipe/${team.slug}`,
    '/classements',
    '/comparateur/equipes',
    '/recherche',
    '/favoris',
    `/competition/${competition.slug}`,
  ];
  let errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const theme of ['dark', 'light']) {
    await page.evaluate((value) => localStorage.setItem('matchscore-theme', value), theme);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        errors = [];
        const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        // Decode every crest on this view, including lazy images below the fold.
        const logos = await page.locator('img.team-logo').evaluateAll(async (images) => {
          await Promise.all(
            images.map(async (img) => {
              img.loading = 'eager';
              try {
                await img.decode();
              } catch {}
            }),
          );
          return images.map((img) => ({
            src: img.getAttribute('src'),
            valid: img.naturalWidth > 0,
            alt: img.alt,
            width: img.getAttribute('width'),
            height: img.getAttribute('height'),
          }));
        });
        const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
        views.push({
          route,
          theme,
          width,
          status: response.status(),
          errors: [...errors],
          overflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
          logos: logos.length,
          broken: logos.filter((l) => !l.valid || !l.alt || !l.width || !l.height),
          violations: axe.violations.map((v) => ({
            id: v.id,
            targets: v.nodes.map((n) => n.target),
          })),
        });
        if (route === '/' || route.startsWith('/match/'))
          await page.screenshot({
            path: `artifacts/brand-${route === '/' ? 'home' : 'match'}-${theme}-${width}.png`,
          });
      }
    }
  }
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(`${base}/equipe/${team.slug}`, { waitUntil: 'networkidle' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.route('**/team-logos/**', (route) => route.abort());
  await page.reload({ waitUntil: 'networkidle' });
  await expect(page.locator('.profile-header .team-badge')).toBeVisible();
  await expect(page.locator('.profile-header img.team-logo')).toHaveCount(0);
  await context.close();
} finally {
  await browser.close();
  await writeFile(
    'artifacts/brand-verification.json',
    JSON.stringify(
      {
        views,
        fallback: 'Aborted image request on team header must show initials, without a broken image',
      },
      null,
      2,
    ),
  );
}
const failures = views.filter(
  (v) =>
    v.status !== 200 || v.errors.length || v.overflow || v.broken.length || v.violations.length,
);
console.log(JSON.stringify({ views: views.length, failures }, null, 2));
if (failures.length) process.exitCode = 1;
