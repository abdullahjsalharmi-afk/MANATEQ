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
  // The pass is sent to the visitor by message: the mobile number is asked (gate n=19).
  await page.getByRole('button', { name: 'متابعة' }).click();
  await expect(page.getByText('اكتب رقم جوال الزائر.')).toBeVisible();
  await page.getByRole('textbox', { name: /رقم جوال الزائر/ }).fill('5512');
  await page.getByRole('button', { name: 'متابعة' }).click();
  await expect(page.getByText('اكتب رقم جوال صحيحًا، من 8 أرقام على الأقل.')).toBeVisible();
  await page.getByRole('textbox', { name: /رقم جوال الزائر/ }).fill('+974 5512 3456');
  await page.getByRole('button', { name: 'متابعة' }).click();
  await expect(main.getByText('+974 5512 3456')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'راجِع وأصدِر' })).toBeVisible();
  await page.getByRole('button', { name: 'أصدِر التصريح' }).click();

  await expect(page.getByRole('heading', { name: 'التصريح جاهز.' })).toBeVisible();
  await expect(main.getByText(/في هذه النسخة التجريبية لا تُرسل رسالة إلى/)).toBeVisible();
  const qr = main.getByRole('img', { name: /رمز تصريح الدخول/ });
  await expect(qr).toBeVisible();
  const code = ((await qr.getAttribute('aria-label')) ?? '').replace('رمز تصريح الدخول', '').trim();
  expect(code).not.toEqual('');

  // The confirmation shows the same start and end, date and time, as the wallet does for the same pass.
  const validity = async () => ({
    from: await main.locator('dt', { hasText: 'صالح من' }).first().locator('xpath=following-sibling::dd[1]').innerText(),
    to: await main.locator('dt', { hasText: 'حتى' }).first().locator('xpath=following-sibling::dd[1]').innerText(),
  });
  const issued = await validity();
  expect(issued.from).toMatch(/\d{4}،\s*\d{1,2}:\d{2}/);

  await page.getByRole('link', { name: 'اعرضه في «وثائقي وتصاريحي»' }).click();
  await expect(page).toHaveURL(/#\/account\/wallet\/[^/]+$/);
  await expect(page.getByText(code).first()).toBeVisible();
  expect(await validity()).toEqual(issued);
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

test('a pass that starts on a later day says so on its confirmation (gate n=16)', async ({ page }) => {
  await openApp(page, { route: '/start/D2?plot=BA-121', lang: 'en' });
  const main = page.locator('main');
  await main.getByRole('radio', { name: /Worker/ }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByLabel(/Worker/).fill('Ali');
  await page.getByLabel(/QID/).fill('28763412345');
  await main.getByRole('button', { name: 'Other dates' }).click();
  const dates = main.locator('input[type=date]');
  await dates.nth(0).fill('2026-12-01');
  await dates.nth(1).fill('2026-12-10');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Issue the pass' }).click();
  const card = main.locator('article[data-status]');
  await expect(card).toHaveAttribute('data-status', 'upcoming');
  await expect(card.getByText('Upcoming', { exact: true })).toBeVisible();
  await expect(card.getByText('Active', { exact: true })).toHaveCount(0);
  await expect(main.getByText('It starts on 1 Dec 2026. Show the code at the gate from that day.')).toBeVisible();
});
