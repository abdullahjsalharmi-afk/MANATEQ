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
  // What is agreed (n=10): the new end date and term, the rate and yearly rent, and no incentive that does not exist.
  await expect(sheet.getByText('Renewed lease ends on')).toBeVisible();
  await expect(sheet.getByText('5 Mar 2028')).toBeVisible();
  await expect(sheet.getByText('Renewal term')).toBeVisible();
  await expect(sheet.getByText(/per m² a year/)).toBeVisible();
  await expect(sheet.getByText('Yearly rent')).toBeVisible();
  await expect(sheet.getByText(/incentive/i)).toHaveCount(0);
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
  // The confirmation names the receipt that was really filed (the invoice's number), not the request's.
  const receipt = pay.getByText(/^RCP-\d{4}-\d{4}$/);
  await expect(receipt).toBeVisible();
  const ref = (await receipt.textContent())?.trim() ?? '';
  await pay.getByRole('button', { name: 'Done' }).click();

  // The same words as every other payment (n=11).
  await expect(page.getByText(new RegExp(`^Paid\\. Receipt\\W*${ref.replace(/-/g, '\\W+')}\\W* is in Documents and passes\\.$`))).toBeVisible();
  await expect(page.getByRole('main').getByText(ref).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Waiting for you' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Accept and renew' })).toHaveCount(0);

  // A payment made inside a request leaves the same note as one made from Payments, and it opens the receipt.
  await page.evaluate(() => (window.location.hash = '#/notifications'));
  const note = page.getByRole('main').getByRole('button', { name: /Payment received/ }).first();
  await expect(note).toBeVisible();
  await note.click();
  await expect(page).toHaveURL(/#\/account\/wallet\//);
  await expect(page.getByRole('main').getByText(ref).first()).toBeVisible();
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
  // The holder is the entity, named the same way in both languages; the building permit has no day clock.
  await expect(page.getByRole('heading', { name: 'Ministry of Municipality' })).toBeVisible();
  await expect(page.getByText(/Day 1 of 1/)).toHaveCount(0);
  await page.getByRole('button', { name: 'Move time forward (demo)' }).click();
  await expect(page.getByRole('heading', { name: 'Ministry of Municipality' })).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: /The request (moved on|is complete)/ })).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('the list switches to completed requests and groups a thread', async ({ page }) => {
  await openApp(page, { route: '/requests', lang: 'ar' });
  await page.getByRole('radio', { name: /مكتملة/ }).or(page.getByRole('tab', { name: /مكتملة/ })).or(page.getByRole('button', { name: /مكتملة/ })).first().click();
  await expect(page.getByText(/جزء من: طلب أرض/)).toBeVisible();
});

test('a withdrawn fault report shows its open step as stopped, never as done (n=7)', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/requests/r94', lang: 'en' });
  await page.getByRole('button', { name: 'Cancel the request' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel the request' }).click();
  await expect(page.getByRole('heading', { name: 'Request closed' })).toBeVisible();
  const timeline = page.getByRole('main');
  await expect(timeline.getByText('The request stopped at this step')).toBeVisible();
  // The crew never fixed it: nothing says the repair step was done.
  const rows = await timeline.locator('li').allInnerTexts();
  const repair = rows.filter((text) => text.includes('Crew fixes'));
  expect(repair.length).toBeGreaterThan(0);
  for (const text of repair) expect(text).not.toMatch(/^Done:/m);
  expect(errors).toEqual([]);
});

test('a low rating reopens the fault report, the page says so and asks again (n=15)', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/start/D1', lang: 'en' });
  await page.getByText('Street lighting', { exact: true }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByText('BA-121').first().click();
  await page.getByRole('button', { name: /sample photo/i }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Send/ }).last().click();
  await page.getByRole('link', { name: /Track/ }).first().click();

  const rateNow = page.getByRole('button', { name: 'Rate now' });
  const forward = page.getByRole('button', { name: /Move time forward/ });
  for (let i = 0; i < 20 && !(await rateNow.isVisible()); i++) {
    if (await forward.isVisible()) await forward.click();
    await page.waitForTimeout(500);
  }
  await rateNow.click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio').first().check({ force: true });
  await sheet.locator('textarea').fill('Still dark');
  await sheet.getByRole('button', { name: 'Submit' }).click();

  // Not complete: the rating is shown, with what it did.
  await expect(page.getByRole('heading', { name: 'Request complete' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Your rating' })).toBeVisible();
  await expect(page.getByText('1 of 5')).toBeVisible();
  await expect(page.getByText('This rating reopened the report for the supervisor.')).toBeVisible();
  // The workflow comes back to the rating step and asks again.
  await expect(page.getByText(/Rate the fix again; your earlier rating was 1 of 5\./)).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
