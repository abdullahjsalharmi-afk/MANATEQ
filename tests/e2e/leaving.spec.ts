import { expect, test, type Page } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

// A payment or a signature the person confirmed is not lost when they leave the screen while the sheet says
// "processing" (Back, a link, the page itself): it happens once, it is recorded, and they are told.

interface SavedWorld {
  invoices: { id: string; ref: string; status: string; receiptDocId?: string }[];
  docs: { id: string; ref: string; kind: string }[];
  notifications: { id: string }[];
  requests: { id: string; serviceId: string; status: string; current: number | null; visits: { step: number }[] }[];
}

/** The world as the app saved it (it saves shortly after each change). */
async function saved(page: Page): Promise<SavedWorld> {
  await page.waitForTimeout(400);
  return page.evaluate(() => JSON.parse(window.localStorage.getItem('manateq-one:v1') ?? '{}').world as SavedWorld);
}

/** No sheet is left behind and the page scrolls. */
async function expectPageFree(page: Page): Promise<void> {
  await expect(page.locator('dialog')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
}

const go = (page: Page, route: string) => page.evaluate((hash) => void (window.location.hash = hash), route);

/** Invoice inv51 is paid, with one receipt and one note, and nothing else was paid with it. */
async function expectRentPaidOnce(page: Page): Promise<void> {
  const world = await saved(page);
  const invoice = world.invoices.find((candidate) => candidate.ref === 'INV-2026-0051');
  expect(invoice?.status).toBe('paid');
  expect(world.docs.filter((doc) => doc.ref === 'RCP-2026-0051')).toHaveLength(1);
  expect(world.notifications.filter((note) => note.id === `pay-${invoice?.receiptDocId}`)).toHaveLength(1);
}

for (const [lang, how] of [
  ['en', 'back'],
  ['ar', 'link'],
] as const) {
  test(`a payment confirmed on Home is made once when the person leaves while it is processing (${lang}, ${how})`, async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page, { route: '/account', lang, speed: 1 });
    await go(page, '#/');
    const main = page.getByRole('main');
    await main.getByRole('button', { name: lang === 'ar' ? 'ادفع' : 'Pay', exact: true }).click();
    const sheet = page.getByRole('dialog');
    await sheet.getByRole('button', { name: lang === 'ar' ? /^ادفع\s/ : /^Pay QAR/ }).click();
    await expect(sheet.getByText(lang === 'ar' ? 'جارٍ تنفيذ الدفع…' : 'Processing the payment…').first()).toBeVisible();

    if (how === 'back') await page.goBack();
    else await go(page, '#/notifications');
    await expect(page).toHaveURL(how === 'back' ? /#\/account$/ : /#\/notifications$/);

    // Told on the screen they went to, in the words of every other payment.
    await expect(page.getByText(lang === 'ar' ? /^تم الدفع\. الإيصال.*في «وثائقي وتصاريحي»\.$/ : /^Paid\. Receipt.*is in Documents and passes\.$/)).toBeVisible();
    await expectPageFree(page);
    await expectRentPaidOnce(page);

    // The wait that was left running does not pay a second time.
    await page.waitForTimeout(2600);
    await expectRentPaidOnce(page);
    await go(page, '#/account/payments');
    await expect(page.getByRole('main').getByRole('button', { name: lang === 'ar' ? /^ادفع/ : /^Pay/ })).toHaveCount(0);
    await expectPageFree(page);
    expect(errors).toEqual([]);
  });
}

test('a payment is recorded when the person goes Back from its confirmation without pressing Done', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/account', lang: 'en', speed: 1 });
  await go(page, '#/account/payments');
  await page.getByRole('main').getByRole('button', { name: /^Pay/ }).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: /^Pay QAR/ }).click();
  await expect(sheet.getByText('Payment complete').first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/account$/);
  await expect(page.getByText(/^Paid\. Receipt.*is in Documents and passes\.$/)).toBeVisible();
  await expectPageFree(page);
  await expectRentPaidOnce(page);
  expect(errors).toEqual([]);
});

test('a payment confirmed just before the page is closed is still made, once', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/account/payments', lang: 'en', speed: 1 });
  await page.getByRole('main').getByRole('button', { name: /^Pay/ }).first().click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: /^Pay QAR/ }).click();
  await expect(sheet.getByText('Processing the payment…').first()).toBeVisible();
  // The page goes (closed, reloaded, another address) and the app is opened again later, as it was left.
  const file = page.url().split('?')[0];
  await page.goto('about:blank');
  await page.goto(`${file}#/account/payments`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expectRentPaidOnce(page);
  await expect(page.getByRole('main').getByRole('button', { name: /^Pay/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('the renewal: a signature left before its payment completes nothing and says so; a payment left while processing renews once', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/requests', lang: 'en', speed: 1 });
  await page.getByRole('link', { name: /Your lease renewal offer/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Waiting for you' })).toBeVisible();
  const id = page.url().split('/').pop() ?? '';
  const renewal = async () => (await saved(page)).requests.find((request) => request.id === id);
  const before = await renewal();
  expect(before?.status).toBe('needs_you');
  const receiptsBefore = (await saved(page)).docs.filter((doc) => doc.kind === 'receipt').length;

  const sheet = page.getByRole('dialog');
  const acceptAndSign = async () => {
    await page.getByRole('button', { name: 'Accept and renew' }).click();
    await sheet.getByRole('button', { name: 'I agree' }).click();
    await sheet.getByRole('button', { name: 'Adopt my signature' }).click();
    await sheet.getByText('I have read the document and agree to sign it electronically.').click();
    await sheet.getByRole('button', { name: 'Sign', exact: true }).click();
  };

  // Signed, then gone before the payment: the step's tasks are completed together or not at all.
  await acceptAndSign();
  await expect(sheet.getByText('Signing…').first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/requests$/);
  await expect(page.getByText('Not completed: the payment was not made, so your signature was not saved. Open the request to do it again.')).toBeVisible();
  await expectPageFree(page);
  expect(await renewal()).toEqual(before);

  // Again, to the end: the confirmation of the signature says what is left instead of claiming the document is saved.
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Waiting for you' })).toBeVisible();
  await acceptAndSign();
  await expect(sheet.getByText('One step left: the payment. The signed document is saved once it is made.')).toBeVisible();
  await expect(sheet.getByText('The signed document is saved in Documents and passes.')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Continue to payment' }).click();
  await sheet.getByRole('button', { name: /^Pay QAR/ }).click();
  await expect(sheet.getByText('Processing the payment…').first()).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/requests$/);
  await expect(page.getByText(/^Paid\. Receipt.*is in Documents and passes\.$/)).toBeVisible();
  await expectPageFree(page);

  // Renewed once: the step is done, one receipt was filed, and waiting longer adds nothing.
  await page.waitForTimeout(2600);
  const after = await renewal();
  expect(after?.status).not.toBe('needs_you');
  expect(after?.visits.filter((visit) => visit.step === before?.current)).toHaveLength(1);
  expect((await saved(page)).docs.filter((doc) => doc.kind === 'receipt')).toHaveLength(receiptsBefore + 1);
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Waiting for you' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Accept and renew' })).toHaveCount(0);
  expect(errors).toEqual([]);
});
