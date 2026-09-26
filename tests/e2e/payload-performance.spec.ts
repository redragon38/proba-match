import { test, expect } from '@playwright/test';
import type { SearchResult } from '@/services/search-index';

test.beforeEach(({ page }) => {
  page.on('pageerror', (error) => {
    throw error;
  });
});

test('recherche paginée complète, filtre et favoris persistants', async ({ page, request }) => {
  const response = await request.get('/api/search?scope=catalogue');
  const initial = (await response.json()) as { results: SearchResult[]; total: number };
  test.skip(initial.total < 26, 'Le catalogue contient moins de deux pages.');
  await page.goto('/recherche');
  await expect(page.locator('.search-result')).toHaveCount(25);
  await page.getByRole('button', { name: 'Afficher 25 résultats de plus' }).click();
  await expect(page.locator('.search-result')).toHaveCount(Math.min(50, initial.total));
  await page
    .getByRole('group', { name: 'Catégories de recherche' })
    .getByRole('button', { name: 'Compétition', exact: true })
    .click();
  await expect(page.locator('.search-result .tag').first()).toHaveText('Compétition');
  await expect(page.locator('.search-result .tag').filter({ hasText: 'Équipe' })).toHaveCount(0);
  await page
    .getByRole('group', { name: 'Catégories de recherche' })
    .getByRole('button', { name: 'Tout', exact: true })
    .click();
  await expect(page.locator('.search-result')).toHaveCount(25);
  const team = initial.results.find((result) => result.kind === 'Équipe')!;
  await page.getByRole('searchbox').fill(team.name);
  await expect(page.locator('.search-result').first().getByRole('heading')).toHaveText(team.name);
  await page
    .locator('.search-result')
    .first()
    .getByRole('button', { name: /Ajouter/ })
    .click();
  await page.goto('/favoris');
  await expect(page.locator('.search-result')).toHaveCount(1);
  await expect(page.locator('.search-result img.team-logo')).toBeVisible();
  await page.reload();
  await expect(page.locator('.search-result').getByRole('heading')).toHaveText(team.name);
  await page
    .locator('.search-result')
    .getByRole('button', { name: /Retirer/ })
    .click();
  await expect(page.locator('.search-result')).toHaveCount(0);
});

test('les anciennes réponses de recherche ne remplacent pas un nouveau filtre', async ({
  page,
}) => {
  await page.route('**/api/search?scope=catalogue**', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('q') === 'ancienne') {
      await new Promise((resolve) => setTimeout(resolve, 700));
      try {
        await route.fulfill({
          json: {
            total: 1,
            results: [
              { id: 'old', name: 'Ancienne réponse', kind: 'Match', href: '/', detail: '' },
            ],
          },
        });
      } catch {
        /* Request correctly cancelled. */
      }
    } else if (url.searchParams.get('q') === 'nouvelle') {
      await route.fulfill({
        json: {
          total: 1,
          results: [{ id: 'new', name: 'Nouvelle réponse', kind: 'Match', href: '/', detail: '' }],
        },
      });
    } else await route.continue();
  });
  await page.goto('/recherche');
  await Promise.all([
    page.waitForRequest((request) => new URL(request.url()).searchParams.get('q') === 'ancienne'),
    page.getByRole('searchbox').fill('ancienne'),
  ]);
  await page.getByRole('searchbox').fill('nouvelle');
  await expect(page.locator('.search-result h2')).toHaveText('Nouvelle réponse');
  await page.waitForTimeout(800);
  await expect(page.locator('.search-result h2')).toHaveText('Nouvelle réponse');
});

test('la compétition conserve les autres saisons et filtres avec un HTML borné', async ({
  page,
  request,
}) => {
  await page.goto('/competitions');
  const link = page.locator('.catalog-item a').first();
  test.skip(!(await link.count()), 'Aucune compétition synchronisée.');
  const path = (await link.getAttribute('href'))!;
  const response = await request.get(path);
  expect(Buffer.byteLength(await response.text())).toBeLessThan(600_000);
  await page.goto(path);
  const season = page.getByLabel('Saison', { exact: true });
  const options = await season
    .locator('option')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
  if (options.length > 1) {
    await season.selectOption(options[1]);
    await expect(page).toHaveURL(new RegExp(`saison=${options[1]}`));
    await expect(page.locator('.profile-header .eyebrow')).toContainText(options[1]);
  }
  await page.getByRole('button', { name: 'Résultats', exact: true }).click();
  await expect(page).toHaveURL(/statut=finished/);
  await expect(page.getByRole('button', { name: 'Résultats', exact: true })).toHaveClass(/active/);
  await expect(page.locator('main h1')).toHaveCount(1);
});
