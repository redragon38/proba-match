import { expect, test } from '@playwright/test';
import type { Match } from '@/types/football';

test('plusieurs vrais matchs affichent leurs profils disponibles et la navigation joueur', async ({
  page,
  request,
}) => {
  let verified = 0;
  for (const status of ['scheduled', 'finished']) {
    const response = await request.get(`/api/matches?status=${status}&limit=12`);
    const { matches } = (await response.json()) as { matches: Match[] };
    for (const match of matches) {
      await page.goto(`/match/${match.slug}?onglet=joueurs`);
      const links = page.locator('.match-player-row a[href^="/joueur/"]');
      if ((await links.count()) < 2) continue;
      // List API intentionally omits details to bound its payload. Read the actual fixture.
      const details = (await (await request.get(`/api/matches/${match.id}`)).json()) as Match;
      await expect(page.getByRole('heading', { name: 'Joueurs', exact: true })).toBeVisible();
      if (match.status === 'scheduled' && !details.lineups.length)
        await expect(page.getByText('participation non confirmée').first()).toBeVisible();
      else if (match.status === 'scheduled' && details.lineups.some((l) => !l.confirmed))
        await expect(
          page.getByText('Composition transmise, statut ou contenu incomplet').first(),
        ).toBeVisible();
      else await expect(page.locator('.match-player-row').first()).toBeVisible();
      const href = await links.first().getAttribute('href');
      expect(href).toContain(`match=${encodeURIComponent(match.slug)}`);
      await links.first().click();
      await expect(page.getByRole('link', { name: '← Retour au match' })).toBeVisible();
      await page.getByRole('link', { name: '← Retour au match' }).click();
      await expect(page).toHaveURL(/onglet=joueurs/);
      verified++;
      if (verified >= (status === 'scheduled' ? 2 : 4)) break;
    }
  }
  expect(verified).toBeGreaterThanOrEqual(4);
});

test('joueurs et statistiques restent lisibles aux six largeurs', async ({ page, request }) => {
  const { matches } = (await (
    await request.get('/api/matches?status=scheduled&limit=1')
  ).json()) as { matches: Match[] };
  test.skip(!matches.length, 'Aucun match réel à venir dans la base isolée');
  for (const width of [375, 390, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ['joueurs', 'statistiques']) {
      await page.goto(`/match/${matches[0].slug}?onglet=${tab}`);
      await expect(page.locator('main')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      if ([375, 1440].includes(width))
        await page.screenshot({
          path: test.info().outputPath(`match-${tab}-${width}.png`),
          fullPage: true,
        });
    }
  }
});
