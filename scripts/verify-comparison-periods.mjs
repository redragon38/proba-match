import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { strict as assert } from 'node:assert';
const project = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const script = await build({
  entryPoints: [project + '/tests/fixtures/comparison-periods.tsx'],
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
              ? 'export function useRouter(){return {replace(){}}};'
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
          '"><head><title>Comparateur · fixture fictive</title><style>' +
          css +
          '</style></head><body><div id="root"></div></body></html>',
      );
      await page.addScriptTag({
        content:
          'window.process={env:{NODE_ENV:"production",__NEXT_ROUTER_BASEPATH:""}};' +
          script.outputFiles[0].text,
      });
      await page.getByRole('heading', { level: 1 }).waitFor({ timeout: 5000 });
      assert.equal(
        (await page.locator('body').innerText()).includes('Tirs : 20 matchs documentés'),
        true,
      );
      assert.equal(
        (await page.locator('body').innerText()).includes('Tirs : 2 matchs documentés'),
        true,
      );
      assert.equal((await page.locator('body').innerText()).includes('source api-football'), true);
      await page.getByLabel('Période comparée', { exact: true }).selectOption('common');
      await page.getByRole('button', { name: 'Appliquer la période' }).click();
      await page
        .getByText('Période commune : 2025-01-10 à 2025-01-20.', { exact: false })
        .waitFor();
      assert.equal(
        (await page.locator('body').innerText()).includes('Tirs : 11 matchs documentés'),
        true,
      );
      assert.equal(
        (await page.locator('body').innerText()).includes('Tirs : 2 matchs documentés'),
        true,
      );
      await page.getByRole('button', { name: 'Toutes les statistiques', exact: true }).click();
      const shots = page
        .getByRole('row')
        .filter({ has: page.getByRole('rowheader', { name: 'Tirs moyens', exact: true }) });
      assert.deepEqual(await shots.getByRole('cell').allTextContents(), ['4', '6']);
      if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)))
        console.log(
          await page.evaluate(() =>
            [...document.querySelectorAll('*')]
              .filter((e) => e.getBoundingClientRect().right > innerWidth)
              .map((e) => ({
                tag: e.tagName,
                class: e.className,
                width: e.getBoundingClientRect().width,
                text: e.textContent?.slice(0, 60),
              }))
              .slice(0, 20),
          ),
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
        path: project + '/artifacts/audit-comparison-periods-' + width + '-' + theme + '.png',
        fullPage: true,
      });
      views.push({
        width,
        theme,
        periodFilters: 2,
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
  project + '/artifacts/AUDIT-FIX-COMPARISON-UI.json',
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      scope:
        'Actual Comparator component bundled locally, synthetic explicitly demo fixture. Not production DB or full routed application.',
      views,
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(views));
