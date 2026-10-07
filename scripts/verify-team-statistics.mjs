import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
const project = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const script = await build({
  entryPoints: [project + '/tests/fixtures/team-statistics.tsx'],
  absWorkingDir: project,
  nodePaths: [project + '/node_modules'],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  jsx: 'automatic',
  tsconfig: project + '/tsconfig.json',
  define: { 'process.env.NODE_ENV': '"production"' },
  loader: { '.woff2': 'dataurl' },
  plugins: [
    {
      name: 'next-default-adapter',
      setup(b) {
        b.onResolve({ filter: /^next\/(link|image)$/ }, (a) => ({
          path: a.path,
          namespace: 'next-adapter',
        }));
        b.onLoad({ filter: /.*/, namespace: 'next-adapter' }, (a) => ({
          contents: `import mod from ${JSON.stringify(project + '/node_modules/' + a.path + '.js')};export default mod.default || mod;`,
          loader: 'js',
          resolveDir: project,
        }));
      },
    },
  ],
});
const folder = project + '/.next/static/chunks';
const names = (await readdir(folder)).filter((n) => n.endsWith('.css'));
const css = (await Promise.all(names.map((n) => readFile(folder + '/' + n, 'utf8')))).join('\n');
const browser = await chromium.launch({ headless: true });
const views = [];
try {
  for (const width of [320, 390, 768, 1440])
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => {
        errors.push(e.message);
        console.log(e.stack);
      });
      await page.route('**/*', (r) => r.abort());
      await page.setContent(
        '<html lang="fr" data-theme="' +
          theme +
          '"><head><title>Fiche équipe · fixture de test</title><style>' +
          css +
          '</style></head><body><div id="root"></div></body></html>',
      );
      await page.addScriptTag({
        content:
          'window.process={env:{NODE_ENV:"production",__NEXT_ROUTER_BASEPATH:""}};' +
          script.outputFiles[0].text,
      });
      await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 5000 });
      for (const [venue, value, shots, sample] of [
        ['Tous', '40 %', '5', '2 matchs documentés'],
        ['Domicile', '60 %', '0', '1 match documenté'],
        ['Extérieur', '20 %', '10', '1 match documenté'],
      ]) {
        await page.getByRole('button', { name: venue, exact: true }).click();
        const possession = page.locator('.metric').filter({ hasText: 'Possession moyenne' });
        assert.equal((await possession.innerText()).includes(value), true);
        assert.equal((await possession.innerText()).includes(sample), true);
        const shot = page.locator('.metric').filter({ hasText: 'Tirs moyens' });
        assert.equal(await shot.locator('strong').innerText(), shots);
      }
      await page.getByRole('button', { name: '10 matchs', exact: true }).click();
      assert.equal(
        await page
          .getByRole('button', { name: '10 matchs', exact: true })
          .getAttribute('aria-pressed'),
        'true',
      );
      assert.equal(
        await page
          .getByRole('button', { name: '5 matchs', exact: true })
          .getAttribute('aria-pressed'),
        'false',
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      assert.deepEqual(errors, []);
      const accessibility = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      assert.deepEqual(
        accessibility.violations.map((v) => v.id),
        [],
      );
      await page.screenshot({
        path: project + '/artifacts/continuation-team-statistics-' + width + '-' + theme + '.png',
        fullPage: true,
      });
      views.push({
        width,
        theme,
        venueFilters: 3,
        metricAssertions: 9,
        overflow: false,
        pageErrors: errors,
        accessibilityViolations: accessibility.violations.length,
      });
      await context.close();
    }
} finally {
  await browser.close();
}
await writeFile(
  project + '/artifacts/CONTINUATION-TEAM-UI.json',
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scope:
        'Actual TeamProfile component bundled locally, synthetic explicitly demo fixture. Not production DB or full routed application.',
      views,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(views));
