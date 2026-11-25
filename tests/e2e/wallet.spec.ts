import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('pay the due invoice from payments and find its receipt in the wallet', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/account/payments', lang: 'en' });

  // One invoice is due: open the sheet from its card and confirm.
  await expect(page.getByRole('heading', { name: 'Due', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Pay Rent, Q4 2026/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: /^Pay QAR 37,500/ }).click();
  await expect(sheet.getByRole('button', { name: 'Done' })).toBeVisible();
  await sheet.getByRole('button', { name: 'Done' }).click();

  // The calm state replaces the total, and the payment is in the statement.
  await expect(page.getByText('Nothing due')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Due', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Rent, Q4 2026[\s\S]*BA\W*121[\s\S]*RCP\W*2026\W*0051/ })).toBeVisible();

  // The receipt is in the wallet, under receipts, and opens with its verification code.
  await page.evaluate(() => {
    window.location.hash = '#/account/wallet';
  });
  await page.getByRole('button', { name: 'Receipts' }).click();
  const receipt = page.getByRole('link', { name: /Rent, Q4 2026[\s\S]*BA\W*121/ });
  await expect(receipt).toBeVisible();
  await receipt.click();
  await expect(page.getByRole('heading', { name: /Rent, Q4 2026[\s\S]*BA\W*121/ })).toBeVisible();
  await expect(page.getByText(/^TSD\W*[A-Z0-9]{4}\W*[A-Z0-9]{4}$/).first()).toBeVisible();

  // The simulated check confirms it.
  await page.getByRole('button', { name: 'Verify document' }).click();
  await expect(page.getByRole('dialog').getByText('A valid document issued by Manateq')).toBeVisible({ timeout: 4000 });
  expect(errors).toEqual([]);
});

test('the public verification page works for a guest, with a found and an unknown code', async ({ page }) => {
  await openApp(page, { route: '/account/wallet/d42', lang: 'en' });
  const code = (await page.getByText(/^TSD\W*[A-Z0-9]{4}\W*[A-Z0-9]{4}$/).first().textContent())?.trim() ?? '';
  expect(code).toMatch(/^TSD-/);

  await page.evaluate((value) => {
    window.location.hash = `#/verify?code=${value}`;
  }, code.toLowerCase());
  await expect(page.getByText('A valid document issued by Manateq')).toBeVisible({ timeout: 4000 });

  await openApp(page, { route: '/verify', demo: 'guest', lang: 'en' });
  await page.getByLabel('Verification code').fill('TSD-0000-0000');
  await page.getByRole('button', { name: 'Verify', exact: true }).click();
  await expect(page.getByText('No document has this code')).toBeVisible({ timeout: 4000 });
});
