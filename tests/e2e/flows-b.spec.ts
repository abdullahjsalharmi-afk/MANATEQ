import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

/** Console noise that is not an error of the app: a view transition cut short by the next navigation. */
const real = (errors: string[]) => errors.filter((error) => !error.includes('Transition was skipped'));

test('the tenant reports a street-light fault with a photo and reaches its request page', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/start/D1' });
  const main = page.locator('main');

  await expect(page.getByRole('heading', { name: 'ما العطل؟' })).toBeVisible();
  await main.getByRole('radio', { name: 'الإنارة' }).click();
  await expect(main.getByRole('radio', { name: 'الإنارة' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'متابعة' }).click();

  await expect(page.getByRole('heading', { name: 'أين؟' })).toBeVisible();
  await main.getByRole('radio', { name: /BA-121/ }).click();
  await page.getByRole('button', { name: 'استخدم صورة تجريبية' }).click();
  await page.getByRole('button', { name: 'متابعة' }).click();

  await expect(page.getByRole('heading', { name: 'صِف العطل' })).toBeVisible();
  await page.getByLabel('وصف قصير (اختياري)').fill('عمود الإنارة مطفأ');
  await expect(main.getByText('مرفقة')).toBeVisible();
  await page.getByRole('button', { name: 'أرسِل البلاغ' }).click();

  await expect(page.getByRole('heading', { name: 'استُلم بلاغك.' })).toBeVisible();
  await expect(main.getByText(/^MQ-\d{4}-\d{4}$/)).toBeVisible();
  await expect(main.getByRole('list', { name: 'حالة البلاغ' })).toBeVisible();
  await page.getByRole('link', { name: 'تتبّع البلاغ' }).click();
  await expect(page).toHaveURL(/#\/requests\/[^/]+$/);
  expect(real(errors)).toEqual([]);
});

test('the tenant issues a visitor pass for today and finds its QR in the wallet', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/start/D2?plot=BA-121' });
  const main = page.locator('main');

  await main.getByRole('radio', { name: /زائر/ }).click();
  await page.getByRole('button', { name: 'متابعة' }).click();
  await page.getByLabel('اسم الزائر').fill('سارة الكعبي');
  await expect(main.getByRole('button', { name: 'اليوم' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'متابعة' }).click();

  await expect(page.getByRole('heading', { name: 'راجِع وأصدِر' })).toBeVisible();
  await page.getByRole('button', { name: 'أصدِر التصريح' }).click();

  await expect(page.getByRole('heading', { name: 'التصريح جاهز.' })).toBeVisible();
  const qr = main.getByRole('img', { name: /رمز تصريح الدخول/ });
  await expect(qr).toBeVisible();
  const code = ((await qr.getAttribute('aria-label')) ?? '').replace('رمز تصريح الدخول', '').trim();
  expect(code).not.toEqual('');

  await page.getByRole('link', { name: 'اعرضه في وثائقي' }).click();
  await expect(page).toHaveURL(/#\/account\/wallet\/[^/]+$/);
  await expect(page.getByText(code).first()).toBeVisible();
  await expect(page.locator('main svg[role="img"]').first()).toBeVisible();
  expect(real(errors)).toEqual([]);
});

test('an emergency: one tap on the type, then send', async ({ page }) => {
  await openApp(page, { route: '/start/D3', lang: 'en' });
  await expect(page.getByRole('link', { name: 'Call emergency 999' })).toHaveAttribute('href', 'tel:999');
  await page.locator('main').getByRole('radio', { name: 'Fire' }).click();
  await page.getByRole('button', { name: 'Send the report' }).click();
  await expect(page.getByRole('heading', { name: 'Your report is in.' })).toBeVisible();
  await expect(page.getByText('Civil Defence')).toBeVisible();
});
