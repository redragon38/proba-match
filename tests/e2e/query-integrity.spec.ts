import { test, expect } from '@playwright/test';

for (const route of ['/equipes', '/joueurs']) {
  test(`${route}: repeated searches keep the first term and a matching noindex canonical`, async ({
    page,
  }) => {
    const response = await page.goto(`${route}?q=Paris%20%26%20Lyon&q=ignored`);
    expect(response?.status()).toBe(200);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(new URL(canonical!).searchParams.get('q')).toBe('Paris & Lyon');
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('h1')).toBeVisible();
  });

  test(`${route}: non-decimal pagination returns 404 instead of a server failure`, async ({
    request,
  }) => {
    for (const value of ['1e0', '0x1', '-1', '1.5']) {
      const response = await request.get(`${route}?page=${encodeURIComponent(value)}`);
      expect(response.status()).toBe(404);
    }
  });
}
