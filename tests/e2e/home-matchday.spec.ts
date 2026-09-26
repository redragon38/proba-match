import { expect, test } from '@playwright/test';

test('accueil montre une vraie journée disponible quand aujourd’hui est vide', async ({ page, request }) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const todayResponse = await request.get(`/api/matches?date=${today}`);
  const current = await todayResponse.json();
  const scheduled = await (await request.get('/api/matches?statut=scheduled')).json();
  test.skip(current.total !== 0 || !scheduled.total, 'La source possède déjà des matchs aujourd’hui ou aucun match à venir.');

  await page.goto('/');
  await expect(page.getByText('Aucune rencontre correspondant à ce filtre aujourd’hui', { exact: false })).toBeVisible();
  await expect(page.locator('.dashboard-main .match-row').first()).toBeVisible();
  await page.getByRole('group', { name: 'Filtrer les matchs' }).getByRole('button', { name: 'À venir' }).click();
  await expect(page).toHaveURL(/statut=scheduled/);
  await expect(page.locator('.dashboard-main .match-row').first()).toBeVisible();
  await expect(page.getByText('Aucune rencontre correspondant à ce filtre aujourd’hui', { exact: false })).toBeVisible();
});
