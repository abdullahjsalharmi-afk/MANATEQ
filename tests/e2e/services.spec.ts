import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('the catalogue groups by journey, filters as you type and opens a service', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/services', lang: 'en' });
  await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible();
  // The tenant's current station comes first.
  await expect(page.getByText('You are here · Stage 3 of 4')).toBeVisible();

  await page.getByRole('searchbox').fill('gate pass');
  await expect(page.getByRole('link', { name: 'Request a gate pass', exact: true })).toBeVisible();

  await page.getByRole('radio', { name: 'All' }).click();
  await page.getByRole('searchbox').fill('');
  await expect(page.getByText('50 services')).toBeVisible();
  await page.getByRole('button', { name: /Automatic/ }).click();
  await expect(page.getByText('24 services')).toBeVisible();

  await page.getByRole('link', { name: /Your rent invoices and payments/ }).click();
  await expect(page.getByRole('heading', { name: 'Your rent invoices and payments', level: 2 })).toBeVisible();
  await expect(page.getByText('How this service starts')).toBeVisible();
  await expect(page.getByRole('link', { name: 'See your invoices' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('the service page shows the published elements and starts the service', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/services/D1' });
  await expect(page.getByRole('heading', { name: 'معيار الخدمة' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ما نحتاجه منك' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'جلبناها عنك' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الخطوات' })).toBeVisible();
  const behind = page.locator('details').filter({ hasText: 'خلف الكواليس' });
  await expect(behind).not.toHaveAttribute('open', '');
  await behind.locator('summary').click();
  await expect(behind.getByText('مستوى الأتمتة')).toBeVisible();
  await page.getByRole('link', { name: 'ابدأ', exact: true }).last().click();
  await expect(page).toHaveURL(/#\/start\/D1/);
  expect(errors).toEqual([]);
});

test('an unknown service says so', async ({ page }) => {
  await openApp(page, { route: '/services/Z9' });
  await expect(page.getByRole('heading', { name: 'لم نجد هذه الخدمة' }).first()).toBeVisible();
});

test('search finds services, zones and the investor own requests, and helps when nothing matches', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/search' });
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.getByRole('button', { name: 'تصريح دخول' }).click();
  await expect(page.getByRole('heading', { name: 'خدمات' })).toBeVisible();
  await expect(page.locator('a[href="#/services/D2"]')).toBeVisible();

  await page.getByRole('searchbox').fill('رخصة البناء');
  await expect(page.getByRole('heading', { name: 'طلباتي' })).toBeVisible();

  await page.getByRole('searchbox').fill('الوكرة');
  await expect(page.getByRole('heading', { name: 'مناطق' })).toBeVisible();

  await page.getByRole('searchbox').fill('قطار سريع');
  await expect(page.getByText('لا نتائج لـ «قطار سريع»')).toBeVisible();
  await expect(page.getByRole('link', { name: 'اطلب مساعدة' })).toHaveAttribute('href', /start\/E1/);
  expect(errors).toEqual([]);
});
