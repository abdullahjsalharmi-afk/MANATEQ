import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test('the tenant sends a complaint (E6) and lands on the request', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/start/E6', lang: 'en', speed: 1 });

  // 1. What we already know.
  await expect(page.getByRole('heading', { name: 'We already know you' })).toBeVisible();
  await expect(page.getByText('Example Industries Co.')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 2. The details: continuing empty shows the errors.
  await expect(page.getByRole('heading', { name: 'The details' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Choose the type')).toBeVisible();
  await expect(page.getByText('Write your answer')).toBeVisible();
  await page.getByRole('radio', { name: 'Complaint' }).check({ force: true });
  await page.getByRole('textbox', { name: /What happened/ }).fill('The reply to my gate pass request was three days late.');
  await expect(page.getByText('Draft saved')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 3. Documents: all optional here.
  await expect(page.getByRole('heading', { name: 'Documents' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // 4. Check and send: change an answer, come back, consent, send.
  await expect(page.getByRole('heading', { name: 'Check and send' })).toBeVisible();
  await expect(page.getByText('Complaint', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Change Type' }).click();
  await page.getByRole('radio', { name: 'Feedback' }).check({ force: true });
  await page.getByRole('button', { name: 'Back to review' }).click();
  await expect(page.getByText('Feedback', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Send request' }).click();
  await expect(page.getByText('Confirm the information to send the request')).toBeVisible();
  await page.getByRole('checkbox', { name: /I confirm the information is correct/ }).check({ force: true });
  await page.getByRole('button', { name: 'Send request' }).click();

  // 5. Received: reference, next steps, track.
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Copy reference MQ-/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What happens now' })).toBeVisible();
  await page.getByRole('button', { name: 'Track request' }).click();
  await expect(page).toHaveURL(/#\/requests\/r\d+/);
  expect(errors).toEqual([]);
});

test('closing with answers offers to keep the draft', async ({ page }) => {
  await openApp(page, { route: '/start/B8', lang: 'ar' });
  await page.getByRole('button', { name: 'متابعة' }).click();
  await page.getByRole('textbox', { name: 'الغرض' }).fill('تقديمه إلى البنك');
  await page.getByRole('button', { name: 'إغلاق الطلب' }).click();
  await expect(page.getByRole('dialog', { name: 'هل تحتفظ بما أدخلته؟' })).toBeVisible();
  await page.getByRole('button', { name: 'متابعة لاحقًا' }).click();
  await expect(page).not.toHaveURL(/#\/start\//);
  // The service page says the draft is there and continues it.
  await page.goto(page.url().replace(/#.*$/, '#/services/B8'));
  await expect(page.getByRole('link', { name: 'أكمل طلبك' })).toBeVisible();
  await expect(page.getByText('مسودة محفوظة · الخطوة 2 من 3')).toBeVisible();
});

test('the appointment day is asked only when an appointment is wanted (E1)', async ({ page }) => {
  await openApp(page, { route: '/start/E1', lang: 'en' });
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Preferred appointment day')).toHaveCount(0);
  await page.getByText('I want to book an appointment').click();
  await expect(page.getByText('Preferred appointment day').first()).toBeVisible();
  await page.getByText('I want to book an appointment').click();
  await page.getByRole('textbox', { name: /How can we help/ }).fill('A meeting about my lease');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Check and send' })).toBeVisible();
  await expect(page.getByText('Preferred appointment day')).toHaveCount(0);
});

test('a guest is asked to sign in, and an automatic service explains itself', async ({ page }) => {
  await openApp(page, { route: '/start/E6', demo: 'guest', lang: 'en' });
  await expect(page.getByRole('link', { name: 'Demo sign-in' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'We already know you' })).toHaveCount(0);
  await openApp(page, { route: '/start/B1', lang: 'en' });
  await expect(page.getByRole('heading', { name: 'This service starts without a request' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View the service' })).toBeVisible();
});
