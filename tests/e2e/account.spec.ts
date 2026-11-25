import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('account home leads to the company, plots, a plot and the team', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/account', lang: 'en' });

  await expect(page.getByRole('heading', { level: 1, name: 'Account' })).toBeVisible();
  await expect(page.getByText('Verified').first()).toBeVisible();

  await page.getByRole('link', { name: /Verified company profile/ }).click();
  await expect(page.getByRole('heading', { name: 'Company details' })).toBeVisible();
  await page.getByRole('button', { name: 'Update now' }).click();
  await expect(page.getByText('Your details match their source')).toBeVisible({ timeout: 4000 });

  await openApp(page, { route: '/account/plots', lang: 'en' });
  await page.getByRole('link', { name: /Plot AK-113/ }).click();
  await expect(page.getByRole('heading', { name: 'Plot and lease' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Services for this plot' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Report a fault/ })).toHaveAttribute('href', /start\/D1\?plot=AK-113/);

  await openApp(page, { route: '/account/team', lang: 'en' });
  const switches = page.getByRole('switch');
  await expect(switches).toHaveCount(3);
  const last = switches.last();
  const before = await last.getAttribute('aria-checked');
  await last.click();
  await expect(last).not.toHaveAttribute('aria-checked', before ?? '');

  expect(errors).toEqual([]);
});

test('a plot page opens the checklist of each stage of that plot’s journey', async ({ page }) => {
  const errors = watchErrors(page);
  // Home shows the journey of the plot furthest behind; every plot shows its own on its page.
  await openApp(page, { route: '/account/plots/BA-121', lang: 'en' });
  await page.getByRole('main').getByRole('button', { name: /Operate/ }).first().click();
  const operate = page.getByRole('dialog', { name: 'Operate' });
  // The code is kept whole and left to right with invisible marks, so match around them.
  await expect(operate.getByText(/Plot\W*BA\W+121/)).toBeVisible();
  // The fault report that is open on this plot is in progress and leads to its request.
  const report = operate.getByRole('link', { name: /Fault report/ });
  await expect(report).toContainText('In progress');
  // The services of this stage repeat: none reads "Done" without a finished request, none reads "Next".
  await expect(operate.getByRole('link', { name: /rent invoices/i })).toContainText('Payment due');
  await expect(operate.getByRole('link', { name: /rent invoices/i })).toHaveAttribute('href', '#/account/payments');
  await expect(operate.getByRole('link', { name: /Gate pass/ })).toContainText('When you need it');
  await expect(operate.getByRole('link', { name: /inspections/i })).toContainText('Starts by itself');
  await expect(operate.getByRole('link', { name: /renewal/i })).toContainText('Starts by itself');
  await expect(operate.getByText('Done', { exact: true })).toHaveCount(0);
  await expect(operate.getByText('Next', { exact: true })).toHaveCount(0);
  await report.click();
  await expect(page).toHaveURL(/#\/requests\/r94/);

  await page.evaluate(() => (window.location.hash = '#/account/plots/AW-116'));
  await page.getByRole('main').getByRole('button', { name: /Build/ }).first().click();
  const build = page.getByRole('dialog', { name: 'Build' });
  await expect(build.getByText(/Plot\W*AW\W+116/)).toBeVisible();
  await expect(build.getByRole('link', { name: /building permit/i })).toContainText('In progress');
  await expect(build.getByRole('link', { name: /^Design review/ })).toContainText('Done');
  // Rent is already billed for this plot and paid: its stage says so, while its other services have not begun.
  await build.getByRole('button', { name: /Operate/ }).click();
  const later = page.getByRole('dialog', { name: 'Operate' });
  await expect(later.getByRole('link', { name: /rent invoices/i })).toContainText('Nothing due');
  await expect(later.getByRole('link', { name: /Gate pass/ })).toContainText('Done');
  await expect(later.getByRole('link', { name: /Fault report/ })).toContainText('Not started yet');
  expect(errors).toEqual([]);
});

test('an unknown plot shows a way back', async ({ page }) => {
  await openApp(page, { route: '/account/plots/XX-000', lang: 'en' });
  await expect(page.getByRole('heading', { name: 'We could not find this plot' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open my plots' })).toBeVisible();
});

test('a prospect without land sees the empty state', async ({ page }) => {
  await openApp(page, { route: '/account/plots', demo: 'prospect', lang: 'ar' });
  await expect(page.getByRole('heading', { name: 'لا قطع بعد' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'افحص أهلية نشاطك' })).toBeVisible();
});

test('a guest is invited to sign in', async ({ page }) => {
  await openApp(page, { route: '/account', demo: 'guest', lang: 'en' });
  await expect(page.getByRole('link', { name: 'Demo sign-in' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Settings/ })).toBeVisible();
});

test('About shows each simulation disclosure in full, never clamped (n=32)', async ({ page }) => {
  for (const [lang, width] of [['en', 390], ['ar', 320]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await openApp(page, { route: '/account/about', lang, theme: 'dark' });
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: lang === 'en' ? 'What is simulated here' : 'ما الذي يُحاكى هنا' }) });
    await expect(section.getByText(lang === 'en' ? /National Authentication System \(Tawtheeq\)\.$/ : /توثيق/).first()).toBeVisible();
    const clipped = await section.evaluate((root) =>
      [...root.querySelectorAll('li span, li p')]
        .filter((el) => el.scrollHeight > el.clientHeight + 1 || getComputedStyle(el).webkitLineClamp !== 'none' || (getComputedStyle(el).textOverflow === 'ellipsis' && getComputedStyle(el).overflow !== 'visible'))
        .map((el) => el.textContent),
    );
    expect(clipped).toEqual([]);
  }
});

test('dates and references in plot and payment rows stay whole at 320 px and the largest text (n=26, n=30)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  const whole = (pattern: string) =>
    page.getByRole('main').evaluate((main, source) => {
      const found: { text: string; lines: number; clipped: boolean }[] = [];
      const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
      const rx = new RegExp(source, 'g');
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent ?? '';
        for (const match of text.matchAll(rx)) {
          const range = document.createRange();
          range.setStart(node, match.index ?? 0);
          range.setEnd(node, (match.index ?? 0) + match[0].length);
          const rects = [...range.getClientRects()].filter((rect) => rect.width > 0);
          const parent = (node.parentElement as HTMLElement).getBoundingClientRect();
          const box = range.getBoundingClientRect();
          found.push({ text: match[0], lines: new Set(rects.map((rect) => Math.round(rect.top))).size, clipped: box.left < parent.left - 1 || box.right > parent.right + 1 });
        }
      }
      return found;
    }, pattern);

  for (const lang of ['ar', 'en'] as const) {
    for (const text of [0, 3] as const) {
      await openApp(page, { route: '/account/plots/BA-121', lang, text });
      const dates = await whole(lang === 'ar' ? '\\d{1,2}[\\s\\u2060]+[\\u0621-\\u064A]+[\\s\\u2060]+\\d{4}' : '\\d{1,2}[\\s\\u2060]+[A-Z][a-z]{2}[\\s\\u2060]+\\d{4}');
      expect(dates.length).toBeGreaterThan(0);
      for (const date of dates) expect(date, `${lang} ${text} ${date.text}`).toMatchObject({ lines: 1, clipped: false });

      await openApp(page, { route: '/account/payments', lang, text });
      const refs = await whole('RCP[\\u2060-]+\\d{4}[\\u2060-]+\\d{4}');
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) expect(ref, `${lang} ${text} ${ref.text}`).toMatchObject({ lines: 1, clipped: false });
    }
  }
});
