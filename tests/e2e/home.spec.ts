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
  // One wording for every payment (n=11): the receipt by its reference, the place by its screen's title.
  await expect(page.getByText(/^Paid\. Receipt\W*RCP\W+2026\W+0051\W* is in Documents and passes\.$/)).toBeVisible();
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

test('the Build checklist says a withdrawn permit request was closed, and links to it (n=8)', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/requests/r95', lang: 'en' });
  await page.getByRole('button', { name: 'Cancel the request' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel the request' }).click();
  await expect(page.getByRole('heading', { name: 'Request closed' })).toBeVisible();

  await page.evaluate(() => (window.location.hash = '#/'));
  await page.getByRole('main').getByRole('button', { name: /Build/ }).first().click();
  const station = page.getByRole('dialog', { name: 'Build' });
  const permit = station.getByRole('link', { name: /building permit/i });
  await expect(permit).toContainText('The earlier request was closed');
  await expect(permit).not.toContainText('In progress');
  // The one really running stays in progress; finished requests are named, not asked for.
  await expect(station.getByRole('link', { name: /power and water/i })).toContainText('In progress');
  await expect(station.getByRole('link', { name: /^Design review/ })).toContainText('Done');
  await permit.click();
  await expect(page).toHaveURL(/#\/requests\/r95/);
  expect(errors).toEqual([]);
});

test('paying settles its reminder: done, not "Needs you", and the bell count drops (n=6)', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { lang: 'en' });
  await expect(page.getByRole('link', { name: 'Notifications, 3 unread' }).first()).toBeAttached();
  await page.getByRole('main').getByRole('button', { name: 'Pay', exact: true }).click();
  await page.getByRole('dialog', { name: 'Pay the invoice' }).getByRole('button', { name: /^Pay QAR/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('link', { name: 'Notifications, 2 unread' }).first()).toBeAttached();
  await page.getByRole('link', { name: /Notifications, \d+ unread/ }).first().click();
  const reminder = page.getByRole('button', { name: /An invoice is due soon/ });
  await expect(reminder).toContainText('Done');
  await expect(reminder).not.toContainText('Needs you');
  await expect(reminder).not.toContainText('Unread');
  await reminder.click();
  await expect(page).toHaveURL(/#\/account\/payments\/inv51/);
  expect(errors).toEqual([]);
});

for (const [lang, text, width] of [['en', 0, 320], ['en', 3, 320], ['ar', 0, 320], ['ar', 3, 320], ['en', 0, 390]] as const) {
  test(`shortcut titles break between words only (${lang}, text ${text}, ${width} px) (n=28)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page, { lang, text });
    const shortcuts = page.getByRole('main').locator('ul').filter({ has: page.locator('a[href$="/start/E1"]') });
    await shortcuts.scrollIntoViewIfNeeded();
    const split = await shortcuts.evaluate((list) => {
      const broken: string[] = [];
      for (const el of list.querySelectorAll('h3, p')) {
        const node = el.firstChild;
        if (!node || node.nodeType !== Node.TEXT_NODE) continue;
        let at = 0;
        for (const word of (node.textContent ?? '').split(' ')) {
          const range = document.createRange();
          range.setStart(node, at);
          range.setEnd(node, at + word.length);
          if (new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size > 1) broken.push(word);
          at += word.length + 1;
        }
      }
      return broken;
    });
    expect(split).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}
