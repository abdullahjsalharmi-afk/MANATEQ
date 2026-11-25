import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test('the investor accepts, signs and pays the renewal, and the request moves on', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/requests', lang: 'en', speed: 1 });
  await expect(page.getByRole('heading', { level: 1, name: 'My requests' })).toBeVisible();

  // The request waiting for the investor comes first.
  const renewal = page.getByRole('link', { name: /Your lease renewal offer/ });
  await expect(renewal.first()).toBeVisible();
  await renewal.first().click();
  await expect(page.getByRole('heading', { name: 'Waiting for you' })).toBeVisible();

  await page.getByRole('button', { name: 'Accept and renew' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('Step 1 of 3')).toBeVisible();
  await sheet.getByRole('button', { name: 'I agree' }).click();

  // Signature (a simulation).
  const sign = page.getByRole('dialog', { name: /renewal/i });
  await sign.getByRole('button', { name: 'Adopt my signature' }).click();
  await sign.getByText('I have read the document and agree to sign it electronically.').click();
  await sign.getByRole('button', { name: 'Sign', exact: true }).click();
  await sign.getByRole('button', { name: 'Done' }).click();

  // Payment (a simulation).
  const pay = page.getByRole('dialog');
  await pay.getByRole('button', { name: /^Pay QAR/ }).click();
  await pay.getByRole('button', { name: 'Done' }).click();

  await expect(page.getByText('Done. The request moves on.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Waiting for you' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Accept and renew' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('declining the offer records nothing and keeps the request waiting', async ({ page }) => {
  await openApp(page, { route: '/requests', lang: 'en', speed: 1 });
  await page.getByRole('link', { name: /Your lease renewal offer/ }).first().click();
  await page.getByRole('button', { name: 'Accept and renew' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'I do not agree' }).click();
  await expect(page.getByText('Nothing is recorded now')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
  await expect(page.getByRole('heading', { name: 'Waiting for you' })).toBeVisible();
});

test('a running request moves on when time is moved forward', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/requests', lang: 'en', speed: 1 });
  await page.getByRole('link', { name: /Your building permit status/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Ministry of Municipality permits' })).toBeVisible();
  const tagline = await page.locator('main').getByText('NOC and conditions exchanged electronically').first().isVisible();
  expect(tagline).toBe(true);
  await page.getByRole('button', { name: 'Move time forward (demo)' }).click();
  await expect(page.getByRole('heading', { name: 'Ministry of Municipality permits' })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: /The request (moved on|is complete)/ })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('the list switches to completed requests and groups a thread', async ({ page }) => {
  await openApp(page, { route: '/requests', lang: 'ar' });
  await page.getByRole('radio', { name: /مكتملة/ }).or(page.getByRole('tab', { name: /مكتملة/ })).or(page.getByRole('button', { name: /مكتملة/ })).first().click();
  await expect(page.getByText(/جزء من: قدّم طلب أرض/)).toBeVisible();
});
