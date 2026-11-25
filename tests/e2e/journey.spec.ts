import { expect, test, type Locator, type Page } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

/** Moves the demo clock forward until `target` shows (a step that waits for the investor, or a result). */
async function advanceUntil(page: Page, target: Locator): Promise<void> {
  const forward = page.getByRole('button', { name: 'Move time forward (demo)' });
  for (let i = 0; i < 80; i++) {
    if (await target.first().isVisible()) return;
    // The control goes away as soon as the step moves on by itself: never wait long for it.
    if (await forward.isVisible()) await forward.click({ timeout: 1500 }).catch(() => undefined);
    await page.waitForTimeout(250);
  }
  await expect(target.first()).toBeVisible();
}

/**
 * Journey 1 to its end, through the screens: the application, the offer and its deposit, the contract, the
 * guarantee, and the handover of the plot. The handover's own confirmation stays on screen after the plot is
 * handed over (second review: the plot gate had replaced it).
 */
test('from the application to a handed-over plot, and the handover confirmation stays', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await openApp(page, { route: '/start/A4?zone=AW', demo: 'prospect', lang: 'en', speed: 20 });
  const main = page.getByRole('main');

  // The application.
  await page.getByText('Company, activity and zone are correct').click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.locator('[data-plot]:not([disabled])').first().click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Use a sample file' }).first().click();
    await expect(page.getByText('Checking the document…')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByText('I confirm the details are correct').click();
  await page.getByRole('button', { name: 'Submit application', exact: true }).click();
  await page.getByRole('button', { name: 'Track request', exact: true }).click();
  await expect(page).toHaveURL(/#\/requests\/r\d+/);

  // The offer: accept and pay the deposit.
  const offer = main.getByRole('link', { name: /Your plot offer/ });
  await advanceUntil(page, offer);
  await offer.first().click();
  const accept = main.getByRole('button', { name: 'Accept and pay', exact: true });
  await advanceUntil(page, accept);
  await accept.click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'I agree', exact: true }).click();
  await sheet.getByRole('button', { name: /^Pay QAR/ }).click();
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByText(/^Paid\. Receipt/)).toBeVisible();

  // The contract: sign it.
  const contract = main.getByRole('link', { name: /Your lease contract/ });
  await advanceUntil(page, contract);
  await contract.first().click();
  const sign = main.getByRole('button', { name: /^Sign/ });
  await advanceUntil(page, sign);
  await sign.first().click();
  await sheet.getByRole('button', { name: 'Adopt my signature' }).click();
  await sheet.getByText('I have read the document and agree to sign it electronically.').click();
  await sheet.getByRole('button', { name: 'Sign', exact: true }).click();
  await sheet.getByRole('button', { name: 'Done', exact: true }).click();
  await advanceUntil(page, main.getByRole('heading', { name: 'Request complete' }));

  // The plot is leased: the handover can be booked from its service page, and takes the one plot by itself.
  await page.evaluate(() => (window.location.hash = '#/services/A8'));
  await page.getByRole('link', { name: 'Start', exact: true }).or(page.getByRole('button', { name: 'Start', exact: true })).first().click();
  await expect(page).toHaveURL(/#\/start\/A8/);
  await expect(main.getByText(/AW-\W*\d+/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'The details' })).toBeVisible();
  const slot = new Date();
  slot.setDate(slot.getDate() + 3);
  const iso = `${slot.getFullYear()}-${String(slot.getMonth() + 1).padStart(2, '0')}-${String(slot.getDate()).padStart(2, '0')}`;
  await main.locator('input[type=date]').first().fill(iso);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Check and send' })).toBeVisible();
  await page.getByRole('checkbox', { name: /I confirm the information is correct/ }).check({ force: true });
  await page.getByRole('button', { name: 'Send request' }).click();

  // The confirmation, with its reference and the way to the request.
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible();
  const track = page.getByRole('button', { name: 'Track request', exact: true });
  await expect(track).toBeVisible();
  // At this speed the handover completes within seconds and the plot becomes handed over. The confirmation
  // stays: it is not replaced by "None of your plots needs this service now".
  await page.waitForTimeout(6000);
  await expect(page).toHaveURL(/#\/start\/A8/);
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible();
  await expect(track).toBeVisible();
  await expect(main).not.toContainText('None of your plots needs this service now');

  // The request finished, and the plot reads handed over.
  await track.click();
  await expect(page).toHaveURL(/#\/requests\/r\d+/);
  await advanceUntil(page, main.getByRole('heading', { name: 'Request complete' }));
  await page.evaluate(() => (window.location.hash = '#/account/plots'));
  await expect(main.getByText('Handed over').first()).toBeVisible();
  // Home is now the tenant's: the journey of the new plot, not the introduction for newcomers.
  await page.evaluate(() => (window.location.hash = '#/'));
  await expect(main.getByRole('heading', { name: 'Your journey' })).toBeVisible();
  await expect(main.getByText('How the journey goes')).toHaveCount(0);
  // Opened again, the service now says that no plot needs it: the gate is judged when a flow opens.
  await page.evaluate(() => (window.location.hash = '#/start/A8'));
  await expect(main.getByText('None of your plots needs this service now')).toBeVisible();
  expect(errors).toEqual([]);
});
