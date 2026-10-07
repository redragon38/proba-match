import { test, expect } from '@playwright/test';

test('discovers the glossary and verifies its definitions and source navigation', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('footer').getByRole('link', { name: 'Lexique football', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Lexique des probabilités et statistiques football',
  );
  await page
    .getByRole('navigation', { name: 'Termes du lexique' })
    .getByRole('link', { name: 'xG — expected goals', exact: true })
    .click();
  await expect(page).toHaveURL(/#xg$/);
  await expect(page.locator('#xg')).toContainText(
    'ne peuvent pas alimenter une prédiction pré-match',
  );
  await page
    .getByRole('navigation', { name: 'Guides et transparence' })
    .getByRole('link', { name: 'Sources et couverture' })
    .click();
  await expect(page).toHaveURL(/\/sources-donnees$/);
  await expect(page.locator('#manquantes')).toContainText('Une valeur absente ne devient pas zéro');
  await page
    .getByRole('navigation', { name: 'Sommaire des sources' })
    .getByRole('link', { name: 'Dates et fraîcheur' })
    .click();
  await expect(page).toHaveURL(/#fraicheur$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('keeps FAQ text accessible and consistent with machine-readable answers without JavaScript', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto('/comprendre-probabilites');
    const questions = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll(
        (nodes) =>
          nodes.map((n) => JSON.parse(n.textContent ?? '{}')).find((j) => j['@type'] === 'FAQPage')
            ?.mainEntity,
      );
    expect(questions).toHaveLength(6);
    for (const q of questions) {
      await expect(
        page.locator('#questions').getByRole('heading', { name: q.name, exact: true }),
      ).toBeVisible();
      await expect(
        page.locator('#questions').getByText(q.acceptedAnswer.text, { exact: true }),
      ).toBeVisible();
    }
  } finally {
    await context.close();
  }
});
