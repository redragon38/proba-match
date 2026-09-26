import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';
const base = 'http://localhost:3000';
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'chrome' : 'chromium',
});
const report = { views: [], interactions: [], assets: [] };
try {
  const catalogue = await (await fetch(`${base}/api/search?scope=catalogue&category=Match`)).json();
  const match = catalogue.results[0]?.href;
  const paths = [
    '/',
    '/matchs',
    '/live',
    '/classements',
    '/equipes',
    '/joueurs',
    '/comparateur/equipes',
    '/recherche',
    ...(match ? [match] : []),
  ];
  for (const theme of ['dark', 'light']) {
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(
        (theme) => localStorage.setItem('matchscore-theme', theme),
        theme,
      );
      const page = await context.newPage();
      let errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      for (const path of paths) {
        errors = [];
        const response = await page.goto(base + path, { waitUntil: 'networkidle' });
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        const image = page.locator('.brand img:visible');
        await expect(image).toHaveCount(1);
        expect(await image.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
        expect(await image.getAttribute('src')).toContain(
          width < 600 ? 'icon-192' : `logo-${theme}`,
        );
        expect(await page.locator('body').innerText()).not.toMatch(/MatchScore|ScoreMatch/);
        const axe = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        report.views.push({
          path,
          width,
          theme,
          status: response.status(),
          overflow,
          errors: [...errors],
          violations: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            targets: v.nodes.map((n) => n.target),
          })),
        });
        if (path === '/') await page.screenshot({ path: `artifacts/brand-${theme}-${width}.png` });
      }
      await page.goto(base + '/');
      await page.getByRole('button', { name: 'Rechercher une équipe ou un joueur' }).click();
      await expect(page.getByRole('combobox')).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      if (width < 600) {
        await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click();
        await expect(page.locator('#site-sidebar')).toHaveClass(/is-open/);
        await page.keyboard.press('Escape');
        await expect(page.locator('#site-sidebar')).not.toHaveClass(/is-open/);
      }
      report.interactions.push({
        width,
        theme,
        searchKeyboard: 'PASS',
        menuEscape: width < 600 ? 'PASS' : 'not applicable',
      });
      await context.close();
    }
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + '/');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    report.interactions.push({ width, headerOverflow: false });
  }
  await page.goto(base + '/');
  for (const rel of ['icon', 'apple-touch-icon']) {
    const path = await page.locator(`link[rel="${rel}"]`).first().getAttribute('href');
    const r = await fetch(new URL(path, base));
    expect(r.ok).toBe(true);
    report.assets.push({ rel, path, status: r.status });
  }
  const manifest = await (await fetch(base + '/manifest.webmanifest')).json();
  expect(manifest.name).toContain('Proba Match');
  for (const icon of manifest.icons) {
    const r = await fetch(base + icon.src);
    expect(r.ok).toBe(true);
    report.assets.push({ path: icon.src, status: r.status });
  }
  const og = await fetch(base + '/opengraph-image');
  expect(og.ok).toBe(true);
  await context.close();
} finally {
  await browser.close();
  await writeFile('artifacts/brand-accessibility.json', JSON.stringify(report, null, 2));
}
const failures = report.views.filter(
  (v) => v.status !== 200 || v.overflow || v.errors.length || v.violations.length,
);
console.log(
  JSON.stringify(
    {
      views: report.views.length,
      failures,
      interactions: report.interactions,
      assets: report.assets,
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;
