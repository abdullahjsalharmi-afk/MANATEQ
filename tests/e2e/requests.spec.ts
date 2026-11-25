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

test('the signing sheet stays in place at the largest text: its title and close button never leave the screen', async ({ page }) => {
  const errors = watchErrors(page);
  for (const [lang, agree, accept, sign] of [
    ['en', 'I agree', 'Accept and renew', 'Sign'],
    ['ar', 'أوافق', 'اقبل وجدّد', 'وقّع'],
  ] as const) {
    await openApp(page, { route: '/requests/r85', lang, text: 3, speed: 1 });
    await page.getByRole('main').getByRole('button', { name: accept }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: agree, exact: true }).click();
    // Refuse to sign: focus goes to the signature, and the line that says what is missing is brought into view.
    await sheet.getByRole('button', { name: sign, exact: true }).click();
    await page.waitForTimeout(400);
    const box = await page.evaluate(() => {
      const dialog = document.querySelector('dialog[open]') as HTMLElement;
      const panel = (dialog.firstElementChild as HTMLElement).getBoundingClientRect();
      const close = dialog.querySelector('button[aria-label]')?.getBoundingClientRect();
      const error = dialog.querySelector('[id$="-error"]')?.getBoundingClientRect();
      const footer = dialog.querySelector('[class*="footer"]')?.getBoundingClientRect();
      return { scrollTop: dialog.scrollTop, scrollHeight: dialog.scrollHeight, clientHeight: dialog.clientHeight, top: panel.top, bottom: panel.bottom, closeTop: close?.top ?? -1, errorBottom: error?.bottom ?? -1, footerTop: footer?.top ?? 0, height: window.innerHeight };
    });
    expect([lang, box.scrollTop]).toEqual([lang, 0]);
    expect(box.scrollHeight).toBe(box.clientHeight);
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(box.height + 1);
    expect(box.closeTop).toBeGreaterThanOrEqual(0);
    // The message under the signature is visible above the Sign button.
    expect(box.errorBottom).toBeGreaterThan(0);
    expect(box.errorBottom).toBeLessThanOrEqual(box.footerTop + 1);
  }
  expect(errors).toEqual([]);
});

test('closing the signing sheet gives the page back: it scrolls, and focus returns to what opened the sheets', async ({ page }) => {
  const errors = watchErrors(page);
  for (const close of ['Escape', 'button'] as const) {
    await openApp(page, { route: '/requests/r85', lang: 'en', speed: 1 });
    const opener = page.getByRole('main').getByRole('button', { name: 'Accept and renew' });
    await opener.focus();
    await page.keyboard.press('Enter');
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: 'I agree', exact: true }).click();
    await expect(sheet.getByRole('button', { name: 'Sign', exact: true })).toBeVisible();
    // The accepting sheet has finished closing: only the signing sheet is left. Leave it without signing.
    await expect(page.getByRole('dialog')).toHaveCount(1);
    if (close === 'Escape') await page.keyboard.press('Escape');
    else await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // The page behind is no longer held still (the signing sheet had opened while the accepting sheet was closing).
    expect([close, await page.evaluate(() => document.documentElement.style.overflow)]).toEqual([close, '']);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
    // Focus is back on the button that started the task, for the keyboard and for a screen reader.
    await expect(opener).toBeFocused();
    // And the rest of the app scrolls too.
    await page.evaluate(() => (window.location.hash = '#/account/about'));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.mouse.wheel(0, 600);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
  }
  expect(errors).toEqual([]);
});

test('a sheet survives the browser closing its dialog: Escape twice in a row never freezes the page or loses a payment', async ({ page }) => {
  const errors = watchErrors(page);
  const scrolls = async () => {
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.wheel(0, 500);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(50);
  };

  // 1. While a payment is being processed the sheet cannot be dismissed. A browser closes a dialog on a second
  //    Escape in a row whatever the page says: the sheet comes back, and the payment is not lost.
  await openApp(page, { route: '/account/payments', lang: 'en', speed: 1 });
  await page.getByRole('main').getByRole('button', { name: /^Pay/ }).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: /^Pay QAR/ }).click();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(50);
  await page.keyboard.press('Escape');
  await expect(sheet.getByRole('button', { name: 'Done', exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(sheet.getByText(/^RCP-\d{4}-\d{4}$/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(/^Paid\. Receipt/)).toBeVisible();
  // The invoice is paid: nothing is due any more.
  await expect(page.getByRole('main').getByRole('button', { name: /^Pay/ })).toHaveCount(0);
  await scrolls();

  // 2. Opened and closed quickly from the keyboard, several times: the page is never left held, and the
  //    button that opens the sheet still opens it.
  await openApp(page, { route: '/requests', lang: 'en', speed: 1 });
  await page.evaluate(() => (window.location.hash = '#/requests/r85'));
  const opener = page.getByRole('main').getByRole('button', { name: 'Accept and renew' });
  await expect(opener).toBeVisible();
  for (let i = 0; i < 4; i++) {
    await opener.focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(60);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(60);
  }
  await opener.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog').getByRole('button', { name: 'I agree', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await scrolls();
  await opener.click();
  await expect(page.getByRole('dialog').getByRole('button', { name: 'I agree', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('after a task is completed, focus is on the screen, not lost at the top of the page', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/account/payments', lang: 'en' });
  const pay = page.getByRole('main').getByRole('button', { name: /^Pay/ }).first();
  await pay.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: /^Pay QAR/ }).click();
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // The "Pay" button is gone with the debt: focus rests on the main content, and the page did not jump.
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('MAIN');
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
  // The sheet rises into place first; the dialog itself never scrolls to meet a control.
  await expect(sheet.getByRole('radio').first()).toBeInViewport();
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
