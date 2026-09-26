import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
  channel: process.env.PLAYWRIGHT_CHANNEL ?? (process.platform === 'win32' ? 'chrome' : 'chromium'),
});
const results = [];
const dark = process.env.VISUAL_THEME === 'dark';
for (const width of [1440, 390]) {
  const context = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 1000 },
  });
  const page = await context.newPage();
  if (dark) await context.addInitScript(() => localStorage.setItem('matchscore-theme', 'dark'));
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [name, path] of [
    ['home', '/'],
    ['match', '/match/demo-0-0'],
    ['lineups', '/match/demo-0-0?onglet=compositions'],
    ['players', '/joueurs'],
    ['comparator', '/comparateur/equipes'],
    ['live', '/live'],
    ['teams', '/equipes'],
    ['team', '/equipe/paris-saint-germain'],
    ['player', '/joueur/ousmane-dembele-t1-10'],
    ['competition', '/competition/ligue-1'],
    ['standings', '/classements'],
    ['search', '/recherche'],
  ]) {
    errors.length = 0;
    await page.goto(`http://localhost:3000${path}`, { waitUntil: 'networkidle' });
    await page.screenshot({
      path: `artifacts/${name}-${width}${dark ? '-dark' : ''}.png`,
      fullPage: true,
    });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    const overflowNodes = await page.evaluate(() =>
      Array.from(document.querySelectorAll('body *'))
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
        .slice(0, 8)
        .map((e) => ({
          tag: e.tagName,
          class: e.className,
          right: e.getBoundingClientRect().right,
        })),
    );
    const axe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    results.push({
      name,
      width,
      errors: [...errors],
      overflow,
      overflowNodes,
      violations: axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        count: v.nodes.length,
        nodes: v.nodes.slice(0, 8).map((n) => ({ target: n.target, summary: n.failureSummary })),
      })),
    });
  }
  await context.close();
}
await browser.close();
await writeFile(
  `artifacts/accessibility${dark ? '-dark' : ''}.json`,
  JSON.stringify(results, null, 2),
);
console.log(
  JSON.stringify(
    results.map((r) => ({
      ...r,
      violations: r.violations.map((v) => ({ id: v.id, count: v.count })),
    })),
    null,
    2,
  ),
);
if (results.some((r) => r.errors.length || r.overflow || r.violations.length)) process.exitCode = 1;
