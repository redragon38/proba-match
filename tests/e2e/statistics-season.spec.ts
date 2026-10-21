import { expect, test } from '@playwright/test';

test('team statistics expose their period and keep season selection usable', async ({ page }) => {
  await page.goto('/equipes');
  await page.locator('main a[href^="/equipe/"]').first().click();
  const selector = page.getByLabel('Saison des statistiques', { exact: true });
  await expect(selector).toHaveValue('all');
  await expect(page.getByText('Historique cumulé, plusieurs saisons possibles')).toBeVisible();
  const available = await selector
    .locator('option')
    .evaluateAll((options) =>
      options
        .map((option) => (option as HTMLOptionElement).value)
        .filter((value) => value !== 'all'),
    );
  expect(available.length).toBeGreaterThan(0);
  await selector.selectOption(available[0]);
  await expect(selector).toHaveValue(available[0]);
  await expect(
    page.getByText('La couverture peut être partielle.', { exact: false }).first(),
  ).toBeVisible();
  await selector.selectOption('all');
  await expect(selector).toHaveValue('all');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
});
