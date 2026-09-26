import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});
test('recherche clavier et catalogue', async ({ page }) => {
  await page.goto('/equipes');
  const item = page.locator('.catalog-item h2').first();
  const name = (await item.count()) ? await item.innerText() : 'inexistant';
  await page.getByRole('button', { name: 'Rechercher une équipe ou un joueur' }).click();
  await page.getByRole('combobox', { name: 'Rechercher partout' }).fill(name);
  if (name !== 'inexistant') await expect(page.getByRole('option').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Rechercher une équipe ou un joueur' }),
  ).toBeFocused();
});
test('compétitions repliables', async ({ page }) => {
  await page.goto('/');
  const group = page.locator('.match-group').first();
  test.skip(!(await group.count()), 'Aucune rencontre aujourd’hui.');
  const count = await group.locator('.match-row').count();
  await group.getByRole('button', { name: /Replier/ }).click();
  await expect(group.locator('.match-row')).toHaveCount(0);
  await group.getByRole('button', { name: /Déplier/ }).click();
  await expect(group.locator('.match-row')).toHaveCount(count);
});
test('recherche depuis la page 404', async ({ page }) => {
  await page.goto('/match/inexistant');
  await page.getByRole('searchbox').fill('football');
  await page.getByRole('button', { name: 'Rechercher', exact: true }).click();
  await expect(page).toHaveURL(/recherche\?q=football/);
  await expect(page.getByRole('searchbox')).toHaveValue('football');
});
test('actualisation automatique sans recharger le document', async ({ page }) => {
  await page.clock.install({ time: new Date() });
  await page.goto('/live', { waitUntil: 'networkidle' });
  await expect(page.getByRole('heading', { name: 'Le football en direct.' })).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.testMarker = 'retained';
  });
  // Empty live lists still discover new fixtures through the global revision poll.
  // Per-match /api/live?ids polling intentionally requires at least one fixture.
  const [response] = await Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname === '/api/updates'),
    page.clock.fastForward(31000),
  ]);
  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toBe('no-store');
  expect((await response.json()).revision).toEqual(expect.any(String));
  await expect(page.locator('html')).toHaveAttribute('data-test-marker', 'retained');
});
