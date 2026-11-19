import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test('the app opens on Home in Arabic, right to left', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('navigation')).toBeVisible();
  expect(errors).toEqual([]);
});

test('the app opens in English, left to right', async ({ page }) => {
  await openApp(page, { lang: 'en' });
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('link', { name: 'Services' })).toBeVisible();
});
