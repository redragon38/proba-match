import { expect, test } from '@playwright/test';

test('the contact form sends from the page and shows delivery confirmation', async ({ page }) => {
  let submitted: Record<string, string> | null = null;
  await page.route('**/api/contact', async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.goto('/contact');
  await page.getByLabel('Votre nom').fill('Alex Martin');
  await page.getByLabel('Votre adresse e-mail').fill('alex@example.com');
  await page.getByLabel('Motif de votre message').selectOption('Proposition de collaboration');
  await page.getByLabel('Sujet').fill('Partenariat médias');
  await page.getByRole('textbox', { name: 'Votre message' }).fill('Bonjour, je souhaite discuter d’un partenariat.');
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page.getByRole('status')).toContainText('Message envoyé');
  expect(submitted).toMatchObject({ reason: 'Proposition de collaboration' });
  await expect(page).toHaveURL(/\/contact$/);
});

test('the contact form keeps the message after a delivery error', async ({ page }) => {
  await page.route('**/api/contact', (route) =>
    route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Envoi temporairement indisponible."}' }),
  );
  await page.goto('/contact');
  await page.getByLabel('Votre nom').fill('Alex Martin');
  await page.getByLabel('Votre adresse e-mail').fill('alex@example.com');
  await page.getByLabel('Motif de votre message').selectOption('Question générale');
  await page.getByLabel('Sujet').fill('Question football');
  await page.getByRole('textbox', { name: 'Votre message' }).fill('Bonjour, je souhaite poser une question.');
  await page.getByRole('button', { name: 'Envoyer le message' }).click();
  await expect(page.locator('.contact-form-error')).toContainText('Envoi temporairement indisponible');
  await expect(page.getByRole('textbox', { name: 'Votre message' })).toHaveValue('Bonjour, je souhaite poser une question.');
});
