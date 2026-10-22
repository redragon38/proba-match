import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
let script = '',
  css = '';
test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['tests/fixtures/performance-report.tsx'],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    tsconfig: 'tsconfig.json',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [
      {
        name: 'next-browser-adapter',
        setup(b) {
          b.onResolve({ filter: /^next\/(link|image|navigation)$/ }, (args) => ({
            path: args.path,
            namespace: 'next-adapter',
          }));
          b.onLoad({ filter: /.*/, namespace: 'next-adapter' }, (args) => ({
            contents: args.path === 'next/navigation'
              ? 'export function useRouter(){return {push(){throw new Error("Unexpected fixture navigation")}}}'
              : `import mod from ${JSON.stringify(path.resolve('node_modules', args.path + '.js'))}; export default mod.default||mod;`,
            loader: 'js',
            resolveDir: process.cwd(),
          }));
        },
      },
    ],
  });
  script = bundle.outputFiles[0].text;
  const files = (await readdir('.next/static/chunks')).filter((f) => f.endsWith('.css'));
  css = (await Promise.all(files.map((f) => readFile('.next/static/chunks/' + f, 'utf8')))).join(
    '\n',
  );
});

test('controlled evaluation report preserves filters and fits mobile and desktop', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.setContent(
      `<html lang="fr"><head><style>${css}</style></head><body><div id="fixture"></div></body></html>`,
    );
    await page.addScriptTag({
      content: 'window.process={env:{NODE_ENV:"production",__NEXT_ROUTER_BASEPATH:""}};' + script,
    });
    await expect(
      page.getByRole('heading', { name: 'Notre modèle, à livre ouvert.' }),
    ).toBeVisible();
    await expect(page.getByText('2 prédictions initiales sur', { exact: false })).toBeVisible();
    await page.getByRole('combobox', { name: /Version du modèle/ }).selectOption('v2');
    await expect(page.getByText('1 prédictions initiales sur', { exact: false })).toBeVisible();
    await page.getByRole('combobox', { name: /Version du modèle/ }).selectOption('all');
    await expect(page.getByText('2 prédictions initiales sur', { exact: false })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath('performance-' + width + '.png') });
  }
  expect(errors).toEqual([]);
});
