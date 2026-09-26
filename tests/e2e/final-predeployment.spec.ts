import { test, expect } from '@playwright/test';
test('real match tabs, pagination, upcoming cards and public cleanup', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const [status, label] of [
    ['all', 'Tous les matchs'],
    ['scheduled', 'À venir'],
    ['live', 'En direct'],
    ['finished', 'Terminés'],
  ]) {
    const response = await request.get(`/api/matches?statut=${status}`);
    expect(response.status()).toBe(200);
    const result = await response.json();
    expect(result.matches.length).toBeLessThanOrEqual(24);
    await page.goto(`/matchs?statut=${status}`);
    await expect(
      page.getByRole('button', { name: label, exact: status !== 'live' }).first(),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.match-row')).toHaveCount(result.matches.length);
    if (result.total === 0)
      await expect(page.getByText('Aucune rencontre pour cette sélection')).toBeVisible();
    if (result.pages > 1) {
      await page.getByRole('link', { name: 'Suivant', exact: true }).click();
      await expect(page).toHaveURL(/page=2/);
      await page.getByRole('button', { name: 'Terminés', exact: true }).click();
      await expect(page).not.toHaveURL(/page=2/);
    }
  }
  const allTab = page.getByRole('button', { name: 'Tous les matchs', exact: true });
  await allTab.focus();
  await allTab.press('Enter');
  await expect(allTab).toHaveAttribute('aria-pressed', 'true');
  await page.goto('/');
  await expect(page.locator('a[href*="performance-modele"]')).toHaveCount(0);
  await expect(page.getByText('Source OpenFootball.', { exact: false })).toHaveCount(0);
  const featured = await (await request.get('/api/matches?featured=true')).json();
  expect(featured.matches.length).toBeGreaterThan(0);
  await expect(page.locator('.upcoming-grid .sport-match-card')).toHaveCount(
    featured.matches.length,
  );
  const link = page.locator('.upcoming-grid a[href^="/match/"]').first();
  const href = await link.getAttribute('href');
  await link.click();
  await expect(page).toHaveURL(new RegExp(href!));
  expect((await request.get('/performance-modele')).status()).toBe(404);
  const admin = await request.get('/admin/performance-modele', { maxRedirects: 0 });
  expect([200, 307, 308]).toContain(admin.status());
  expect(await admin.text()).not.toContain('Prédictions évaluées');
  await page.goto('/admin/performance-modele');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.locator('#admin-secret')).toBeVisible();
  expect(await (await request.get('/sitemap.xml')).text()).not.toContain('performance-modele');
  await page.goto('/joueurs');
  await expect(
    page.getByText('Les données des joueurs ne sont pas disponibles pour le moment.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
