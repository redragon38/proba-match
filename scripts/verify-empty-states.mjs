/** Separate server with no database: controls meaningful empty and unavailable states. */
import { spawn } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
const server = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--port', '3003', '--hostname', '127.0.0.1'],
  {
    env: { ...process.env, DATABASE_URL: '', MATCHSCORE_DEMO: 'false', APP_ENV: 'preview' },
    stdio: 'ignore',
  },
);
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      ready = (await fetch('http://127.0.0.1:3003/api/matches')).ok;
    } catch {}
    if (ready) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw Error('EMPTY_SERVER_UNAVAILABLE');
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL ?? 'chromium' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const path of ['/', '/matchs', '/live', '/joueurs', '/equipes', '/comparateur/equipes']) {
    const response = await page.goto('http://127.0.0.1:3003' + path);
    if (response.status() !== 200) throw Error(path + ' HTTP ' + response.status());
    await expect(page.locator('main h1')).toBeVisible();
    if (path === '/joueurs')
      await expect(
        page.getByText('Les données des joueurs ne sont pas disponibles pour le moment.', {
          exact: true,
        }),
      ).toBeVisible();
    if (path === '/matchs')
      await expect(page.getByText('Aucune rencontre pour cette sélection')).toBeVisible();
  }
  const payload = await (await fetch('http://127.0.0.1:3003/api/matches')).json();
  if (payload.matches.length) throw Error('MOCK_DATA_IN_EMPTY_PRODUCTION_BUILD');
  if (errors.length) throw Error(errors.join('\n'));
  console.info(
    JSON.stringify({ status: 'PASS', views: 6, scope: 'isolated_no_database', mockData: false }),
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
