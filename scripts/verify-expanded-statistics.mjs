import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
const project = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const script = await build({
  entryPoints: [project + '/tests/fixtures/expanded-statistics.tsx'],
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
      await page.getByText('Voir l’analyse détaillée', { exact: true }).click();
      assert.equal(await page.getByRole('table').count(), 1);
      assert.equal(
        await page.getByRole('heading', { name: 'Un éventail de buts possibles' }).isVisible(),
        true,
      );
      assert.equal(
        await page.getByText('Au moins 3 buts au total', { exact: true }).isVisible(),
        true,
      );
      await page.getByLabel('Comprendre les probabilités', { exact: true }).click();
      assert.equal(
        await page
          .getByText(
            'Estimation statistique de la fréquence à laquelle chaque issue pourrait se produire.',
            { exact: true },
          )
          .isVisible(),
        true,
      );
      await page.getByLabel('Comprendre Possession', { exact: true }).click();
      assert.equal(
        await page
          .getByText('Part du temps de possession attribuée à l’équipe par le fournisseur.', {
            exact: false,
          })
          .isVisible(),
        true,
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
        path: project + '/artifacts/stats-expanded-' + width + '-' + theme + '.png',
        fullPage: true,
      });
      views.push({
        width,
        theme,
        detailInteraction: true,
        helpInteractions: 2,
        overflow: false,
        pageErrors: errors,
        accessibilityViolations: accessibility.violations.length,
      });
      await page.getByRole('button', { name: 'Tester des probabilités incohérentes' }).click();
      assert.equal(
        await page
          .getByText('Probabilités non disponibles pour cette rencontre.', { exact: true })
          .isVisible(),
        true,
      );
      await page.getByRole('button', { name: 'Restaurer la fixture valide' }).click();
      assert.equal(
        await page.getByRole('heading', { name: 'Probabilités du match', exact: true }).isVisible(),
        true,
      );
      assert.deepEqual(errors, []);
      await context.close();
    }
} finally {
  await browser.close();
}
await writeFile(
  project + '/artifacts/STATS-EXPANSION-UI.json',
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scope:
        'Actual ProbabilitySummary and MatchStatistics components bundled locally, synthetic explicitly demo fixture. Not production DB or full routed application.',
      views,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(views));
