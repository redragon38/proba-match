import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('security policy, legal honesty, keyboard, empty search and zoom reflow', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /Content Security Policy|Refused to|hydration/i.test(message.text())
    )
      errors.push(message.text());
  });
  const response = await page.goto('/mentions-legales');
  expect(await response?.headerValue('content-security-policy')).toContain("default-src 'self'");
  await expect(page.locator('main')).not.toContainText('version de développement');
  for (const width of [640, 320]) {
    // Layout-equivalent 200%/400% reflow on a 1280px viewport, not a physical screen-reader test.
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/matchs', '/joueurs', '/mentions-legales']) {
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
      ).toEqual([]);
    }
  }
  await page.goto('/recherche?q=zzzzzz-no-such-person');
  await expect(page.locator('.search-result')).toHaveCount(0);
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Rechercher une équipe ou un joueur' });
  await trigger.click();
  await expect(page.getByRole('combobox', { name: 'Rechercher partout' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  expect((await request.post('/api/vitals', { data: { name: 'LCP', value: 1 } })).status()).toBe(
    404,
  );
  expect(errors).toEqual([]);
});

test('a failed search keeps the interface understandable and saved favourites intact', async ({
  page,
}) => {
  await page.route('**/api/search?scope=catalogue**', (route) =>
    route.fulfill({ status: 503, json: { error: 'Service temporairement indisponible' } }),
  );
  await page.goto('/recherche');
  await page.getByRole('searchbox').fill('test-recherche-indisponible');
  await expect(
    page.getByText('La recherche est momentanément indisponible. Vos favoris restent enregistrés.'),
  ).toBeVisible();
});
