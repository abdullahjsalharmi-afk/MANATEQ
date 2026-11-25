import path from 'node:path';
import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

const APP_FILE = path.resolve(process.env.MQ_APP_FILE ?? 'preview/index.html');

test('a first visit signs in through the demo sheet and lands on Home', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`file://${APP_FILE}?reset=1&lang=ar&theme=light#/welcome`);
  await expect(page.getByRole('heading', { name: 'خمسون خدمة. رحلة واحدة.' })).toBeVisible();

  await page.getByRole('button', { name: 'الدخول عبر «توثيق»' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('دخول تجريبي')).toBeVisible();
  await expect(sheet.getByText('شركة النموذج للتجارة')).toBeVisible();
  await sheet.getByRole('radio', { name: /مستثمر جديد/ }).click();
  await sheet.getByRole('button', { name: 'دخول', exact: true }).click();
  await expect(sheet.getByRole('status')).toBeVisible();

  await expect(page).toHaveURL(/#\/$/, { timeout: 5000 });
  const persona = await page.evaluate(() => JSON.stringify(localStorage).includes('prospect'));
  expect(persona).toBe(true);
  expect(errors).toEqual([]);
});

test('browsing without signing in opens Home as a guest', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`file://${APP_FILE}?reset=1&lang=en&theme=dark#/welcome`);
  await page.getByRole('button', { name: 'Browse without signing in' }).click();
  await expect(page).toHaveURL(/#\/$/);
  expect(errors).toEqual([]);
});

test('a deep link carried to the welcome opens after entering', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`file://${APP_FILE}?reset=1&lang=en&theme=light#/welcome?next=${encodeURIComponent('/services/A4')}`);
  await page.getByRole('button', { name: 'Browse without signing in' }).click();
  await expect(page).toHaveURL(/#\/services\/A4$/);
  expect(errors).toEqual([]);
});

test('settings flip the language and the text size at once', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/account/settings', lang: 'ar' });
  await page.getByRole('radio', { name: 'English' }).or(page.getByRole('button', { name: 'English' })).first().click();
  await expect(page.getByRole('heading', { name: 'Display and reading' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByRole('button', { name: 'Largest' }).click();
  await expect(page.getByText('This is how your requests and appointments read in Manateq One.')).toBeVisible();
  expect(errors).toEqual([]);
});

test('support cancels an upcoming appointment', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/account/support', lang: 'en' });
  await expect(page.getByRole('link', { name: /Open the chat/ })).toHaveAttribute('href', 'https://wa.me/97440323333');
  await page.getByRole('button', { name: /Cancel the appointment/ }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel the appointment' }).click();
  await expect(page.getByText('No upcoming appointments')).toBeVisible();
  expect(errors).toEqual([]);
});

test('about resets the demo behind a confirmation', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/account/about', lang: 'en' });
  await expect(page.getByRole('heading', { name: 'The six rules' })).toBeVisible();
  await page.getByText('Reset the demo').first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page).toHaveURL(/#\/$/);
  expect(errors).toEqual([]);
});
