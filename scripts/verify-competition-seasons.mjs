import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
const project = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const script = await build({
  entryPoints: [project + '/tests/fixtures/competition-seasons.tsx'],
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
        b.onResolve({ filter: /^next\/(link|image|navigation)$/ }, (a) => ({
          path: a.path,
          namespace: 'next-adapter',
        }));
        b.onLoad({ filter: /.*/, namespace: 'next-adapter' }, (a) => ({
          contents:
            a.path === 'next/navigation'
              ? `export function useSearchParams(){return new URLSearchParams(location.hash.slice(1))};export function useRouter(){return {replace(query){location.hash=query;window.dispatchEvent(new Event('fixture-query'))}}};`
              : `import mod from ${JSON.stringify(project + '/node_modules/' + a.path + '.js')};export default mod.default || mod;`,
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
          '"><head><title>Fiche compétition · fixture de test</title><style>' +
          css +
          '</style></head><body><div id="root"></div></body></html>',
      );
      await page.addScriptTag({
        content:
          'window.process={env:{NODE_ENV:"production",__NEXT_ROUTER_BASEPATH:""}};' +
          script.outputFiles[0].text,
      });
      await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 5000 });
      const season = page.getByRole('combobox', { name: 'Saison', exact: true });
      const options = await season
        .locator('option')
        .evaluateAll((nodes) => nodes.map((n) => n.value));
      const metric = (label) =>
        page.locator('.metric').filter({ hasText: label }).locator('strong');
      assert.equal(await metric('Rencontres disponibles').innerText(), '3');
      assert.equal(await metric('Résultats exploitables').innerText(), '2');
      assert.equal(await metric('Buts recensés').innerText(), '13');
      assert.equal(
        await page
          .getByText('attribution ne confirme pas leur saison réelle', { exact: false })
          .count(),
        1,
      );
      await season.selectOption(options[1]);
      await page.waitForFunction(
        () =>
          document.querySelector('.season-picker select').value ===
          String(
            Math.max(
              ...Array.from(document.querySelectorAll('.season-picker option')).map((n) =>
                Number(n.value),
              ),
            ) - 1,
          ),
      );
      assert.equal(await metric('Rencontres disponibles').innerText(), '1');
      assert.equal(await metric('Résultats exploitables').innerText(), '1');
      assert.equal(await metric('Buts recensés').innerText(), '1');
      assert.equal(
        await page
          .getByText('attribution ne confirme pas leur saison réelle', { exact: false })
          .count(),
        0,
      );
      await page.getByRole('button', { name: 'Tester une saison indisponible' }).click();
      await page.getByRole('status').filter({ hasText: 'La saison demandée' }).waitFor();
      assert.equal(await metric('Buts recensés').innerText(), '13');
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
        path: project + '/artifacts/seo-seasons-competition-' + width + '-' + theme + '.png',
        fullPage: true,
      });
      views.push({
        width,
        theme,
        seasonSelections: 2,
        metricAssertions: 7,
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
  project + '/artifacts/SEO-SEASONS-COMPETITION-UI.json',
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scope:
        'Actual CompetitionProfile with server aggregation, explicitly demo fixture and navigation adapter. Not production DB or full routed application.',
      views,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(views));
