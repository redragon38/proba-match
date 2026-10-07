import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('public pages do not expose database setup instructions', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('body')).not.toContainText('PostgreSQL non configuré');
  await expect(page.locator('body')).not.toContainText('Lancez l’import OpenFootball');
  await expect(
    page.getByRole('link', { name: 'Comprendre les probabilités', exact: true }).first(),
  ).toBeVisible();
});
for (const route of ['/comparateur/equipes', '/comparateur/joueurs']) {
  test(`${route}: suggested comparisons use an allowed named role`, async ({ page }) => {
    await page.goto(route);
    const group = page.getByRole('group', { name: 'Comparaisons suggérées' });
    await expect(group).toHaveCount(1);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
}
