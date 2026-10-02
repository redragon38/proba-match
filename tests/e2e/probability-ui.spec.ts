import { expect, test } from '@playwright/test';

test('probabilités réelles lisibles sur mobile, tablette et desktop', async ({ page }) => {
  await page.goto('/');
  const link = page.locator('a[href*="onglet=prediction"]').first();
  await expect(link).toBeVisible();
  const href = (await link.getAttribute('href'))!;

  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(href);
    await expect(page.getByRole('heading', { name: 'Probabilités du match' })).toBeVisible();
    await expect(page.locator('.prediction-outcome')).toHaveCount(3);
    await expect(page.locator('.prediction-outcome strong').first()).toContainText('%');
    await expect(page.locator('.prediction-essential.score')).toContainText(
      '% pour ce score précis',
    );
    await expect(page.locator('.prediction-essential.confidence')).toContainText(
      'Qualité des données',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    if (width === 375)
      await page.locator('.prediction-summary').screenshot({
        path: test.info().outputPath('probability-simple-375.png'),
      });
    await page.getByText('Voir l’analyse détaillée').click();
    await expect(page.getByText('Autres scénarios probables')).toBeVisible();
    await expect(page.getByText('Nombre total de buts')).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath(`probability-${width}.png`),
      fullPage: width === 375,
    });
  }
});

test('la projection reste lisible sans JavaScript et une URL inconnue répond 404', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('http://localhost:3000/');
    const href = await page.locator('a[href*="onglet=prediction"]').first().getAttribute('href');
    expect(href).toBeTruthy();
    await page.goto(`http://localhost:3000${href}`);
    await expect(page.getByRole('heading', { name: 'Probabilités du match' })).toBeVisible();
    const missing = await page.goto('http://localhost:3000/match/inconnu');
    expect(missing?.status()).toBe(404);
  } finally {
    await context.close();
  }
});
