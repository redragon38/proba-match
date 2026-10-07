import { expect, test } from '@playwright/test';

test('explains probabilities and links to the actual methodology without client-only content', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/comprendre-probabilites');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Comprendre les probabilités football' }),
  ).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Sommaire du guide' })).toBeVisible();
  await expect(
    page.getByText('Tous les chiffres des exemples de ce guide sont illustratifs', {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Lire les scores', exact: true }).click();
  await expect(page).toHaveURL(/#scores$/);
  await expect(
    page.getByRole('heading', { name: 'Le score le plus probable reste incertain' }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .getByRole('link', { name: 'Voir les coefficients, les sources et les limites du moteur →' })
    .click();
  await expect(page).toHaveURL(/\/methodologie$/);
  await expect(
    page.getByRole('heading', { name: 'Comment Proba Match calcule-t-il une probabilité ?' }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('makes the guide discoverable from the home page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Lire le guide →', exact: true }).click();
  await expect(page).toHaveURL(/\/comprendre-probabilites$/);
});
