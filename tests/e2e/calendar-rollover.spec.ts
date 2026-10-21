import { test, expect } from '@playwright/test';

test('midnight updates today while preserving an explicitly selected date', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-21T21:59:50Z') });
  await page.goto('/matchs?date=2026-10-20&timezone=Europe%2FParis');
  const context = page.getByTestId('calendar-context');
  await expect(context).toContainText('Aujourd’hui : 2026-10-21');
  const refresh = page.waitForRequest(
    (request) => new URL(request.url()).pathname === '/matchs' && request.headers()['rsc'] === '1',
  );
  await page.clock.fastForward(40000);
  await refresh;
  await expect(context).toContainText('Aujourd’hui : 2026-10-22');
  await expect(context).toContainText('Journée sélectionnée : 2026-10-20');
  await expect(page).toHaveURL(/date=2026-10-20/);
});

test('unfiltered calendar explicitly represents all dates', async ({ page }) => {
  await page.goto('/matchs');
  await expect(page.getByTestId('calendar-context')).toContainText(
    'Calendrier complet, toutes les dates',
  );
});
