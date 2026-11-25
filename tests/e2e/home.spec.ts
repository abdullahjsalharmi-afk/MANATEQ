import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('tenant Home: next step, the others, the journey and paying what is due', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { lang: 'en' });

  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Pay your rent invoice' })).toBeVisible();
  // One pay pill on Home: the hero's. The dues card shows the same invoice without a second one.
  await expect(main.getByRole('button', { name: 'Pay', exact: true })).toHaveCount(1);

  // The other steps behind the quiet link.
  await main.getByRole('button', { name: 'and 1 more' }).click();
  const steps = page.getByRole('dialog', { name: 'Waiting for you' });
  await expect(steps.getByRole('link')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(steps).toBeHidden();

  // A station of the journey opens its checklist.
  await main.getByRole('button', { name: /Build/ }).first().click();
  const station = page.getByRole('dialog', { name: 'Build' });
  await expect(station.getByRole('link', { name: /building permit/i }).first()).toBeVisible();
  await page.keyboard.press('Escape');

  // Pay the invoice from the hero, in place.
  await expect(main.getByRole('heading', { name: 'Payments due' })).toBeVisible();
  await main.getByRole('button', { name: 'Pay', exact: true }).click();
  const pay = page.getByRole('dialog', { name: 'Pay the invoice' });
  await pay.getByRole('button', { name: /^Pay QAR/ }).click();
  const done = page.getByRole('dialog');
  await expect(done.getByText('RCP-2026-0051')).toBeVisible();
  await done.getByRole('button', { name: 'Done' }).click();
  await expect(done).toBeHidden();
  await expect(page.getByText('Paid. The receipt is in Documents.')).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Payments due' })).toBeHidden();

  expect(errors).toEqual([]);
});

test('notifications: grouped, mark all read, a tap opens its subject', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { lang: 'en' });
  await page.getByRole('link', { name: /Notifications, \d+ unread/ }).click();
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Earlier' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark all as read' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Unread', { exact: true })).toHaveCount(0);
  // The keyboard stays on the list, not on the page body.
  await expect(page.getByRole('heading', { name: 'Today' })).toBeFocused();
  await page.getByRole('button', { name: /An invoice is due soon/ }).click();
  await expect(page).toHaveURL(/#\/account\/payments\/inv51/);
  expect(errors).toEqual([]);
});

test('guest Home welcomes and leads to the eligibility check', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { demo: 'guest' });
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'خمسون خدمة. رحلة واحدة.' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'الحلول الخمسة' })).toBeVisible();
  await main.getByRole('link', { name: 'افحص أهلية نشاطك' }).click();
  await expect(page).toHaveURL(/#\/eligibility/);
  expect(errors).toEqual([]);
});
