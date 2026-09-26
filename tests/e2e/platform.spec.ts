import { test, expect } from '@playwright/test';
import type { Match } from '@/types/football';
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});
test('accueil, filtres et navigation calendrier', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main h1')).toHaveText('Le football, aujourd’hui.');
  await page
    .getByRole('group', { name: 'Filtrer les matchs' })
    .getByRole('button', { name: 'Terminés' })
    .click();
  await expect(page).toHaveURL(/statut=finished/);
  await page.getByRole('button', { name: 'Jour suivant' }).click();
  await expect(page).toHaveURL(/date=/);
  expect(new URL(page.url()).searchParams.get('statut')).toBe('finished');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('onglets match et liens vers les équipes du catalogue réel', async ({ page, request }) => {
  const { matches } = (await (await request.get('/api/matches')).json()) as {
    matches: Match[];
  };
  test.skip(
    !matches.length,
    'Catalogue vide : les fixtures contrôlées sont vérifiées par test:football-db.',
  );
  await page.goto('/match/' + matches[0].slug);
  await expect(page.locator('main h1')).toHaveCount(1);
  for (const tab of ['Statistiques', 'Compositions', 'Événements']) {
    await page
      .getByRole('navigation', { name: 'Rubriques du match' })
      .getByRole('link', { name: tab, exact: true })
      .click();
    await expect(page.locator('main')).toBeVisible();
  }
  await page.locator('.match-headline a[href^="/equipe/"]').first().click();
  await expect(page.locator('main h1')).toBeVisible();
});
test('favoris et préférences persistants', async ({ page }) => {
  await page.goto('/parametres');
  await page.getByRole('button', { name: 'Sombre', exact: true }).click();
  await page.getByRole('button', { name: 'Compact', exact: true }).click();
  const favorite = page.locator('.settings-row .favorite-button').first();
  const hasFavorite = await favorite.count();
  if (hasFavorite) await favorite.click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-density', 'compact');
  if (hasFavorite) {
    await expect(favorite).toHaveAttribute('aria-pressed', 'true');
    await page.goto('/favoris');
    await expect(page.locator('.search-result')).toHaveCount(1);
  }
});
test('comparateur et classements ne dépendent pas de données fictives', async ({ page }) => {
  await page.goto('/comparateur/equipes');
  const first = page.getByLabel('Première équipe');
  if (await first.count()) {
    const value = await first.inputValue();
    await page.getByLabel('Deuxième équipe').selectOption(value);
    await expect(
      page.getByRole('heading', { name: 'Choisissez deux profils différents' }),
    ).toBeVisible();
  }
  await page.goto('/classements');
  await page.getByRole('button', { name: '5 derniers matchs', exact: true }).click();
  await expect(
    page.getByText('Calcul Proba Match sur les rencontres synchronisées', { exact: false }),
  ).toBeVisible();
});
test('protection admin et véritables erreurs HTTP 404', async ({ page, request }) => {
  await page.goto('/admin');
  await expect(page.getByLabel('Clé administrateur')).toBeVisible();
  expect((await request.get('/api/cron/sync')).status()).toBe(401);
  expect((await request.post('/api/admin/sync', { data: {} })).status()).toBe(401);
  const response = await page.goto('/match/inconnu');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Cette page est introuvable.' })).toBeVisible();
});
test('routes publiques et thème', async ({ page }) => {
  for (const path of [
    '/competitions',
    '/live',
    '/equipes',
    '/a-propos',
    '/contact',
    '/joueurs',
    '/methodologie',
    '/confidentialite',
    '/cookies',
    '/mentions-legales',
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('main h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});
