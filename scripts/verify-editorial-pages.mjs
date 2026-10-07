import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const base = process.env.VERIFY_URL || 'http://127.0.0.1:3000';
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'chrome' : 'chromium',
});
const views = [];
await mkdir('artifacts', { recursive: true });
try {
  for (const width of [390, 1440])
    for (const theme of ['dark', 'light']) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript(
        (value) => localStorage.setItem('matchscore-theme', value),
        theme,
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      for (const route of ['/lexique-football', '/sources-donnees']) {
        const response = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('main h1')).toHaveCount(1);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        );
        const violations = (
          await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
        ).violations;
        const row = {
          route,
          width,
          theme,
          status: response.status(),
          overflow,
          errors: [...errors],
          accessibilityViolations: violations.length,
        };
        views.push(row);
        if (row.status !== 200 || overflow || errors.length || violations.length)
          throw new Error(JSON.stringify(row));
        await page.screenshot({
          path: `artifacts/seo-geo-${route.slice(1)}-${width}-${theme}.png`,
          fullPage: true,
        });
      }
      await context.close();
    }
} finally {
  await browser.close();
  await writeFile(
    'artifacts/SEO-GEO-VISUAL.json',
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        scope:
          'Production local application, no production database; automated WCAG checks are not a full accessibility certification.',
        views,
      },
      null,
      2,
    ),
  );
}
console.log(JSON.stringify({ views: views.length, status: 'PASS' }));
