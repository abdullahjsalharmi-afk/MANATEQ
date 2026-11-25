import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('the catalogue groups by journey, filters as you type and opens a service', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/services', lang: 'en' });
  await expect(page.getByRole('heading', { level: 1, name: 'Services' })).toBeVisible();
  // The tenant's current station comes first.
  await expect(page.getByText('You are here · Stage 3 of 4')).toBeVisible();

  // The other stations are one quiet row each, closed until opened.
  const support = page.locator('details').filter({ hasText: 'Support' });
  await expect(support).not.toHaveAttribute('open', '');
  await page.getByRole('searchbox').fill('gate pass');
  // A search opens every group that has a match.
  await expect(page.getByRole('link', { name: /^Request a gate pass/ })).toBeVisible();

  await page.getByRole('radio', { name: 'All' }).click();
  await page.getByRole('searchbox').fill('');
  await expect(page.getByText('50 services')).toBeVisible();
  await page.getByRole('button', { name: /Automatic/ }).click();
  await expect(page.getByText('24 services')).toBeVisible();

  // Further down the list, so going back has a place to restore.
  await page.getByRole('link', { name: /Your rent invoices and payments/ }).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 200));
  const top = await page.evaluate(() => window.scrollY);
  await page.getByRole('link', { name: /Your rent invoices and payments/ }).click();
  await expect(page.getByRole('heading', { name: 'Your rent invoices and payments', level: 2 })).toBeVisible();
  await expect(page.getByText('How this service starts')).toBeVisible();
  await expect(page.getByRole('link', { name: 'See your invoices' })).toBeVisible();

  // Back: the view and the filter are as they were left.
  await page.goBack();
  await expect(page).toHaveURL(/view=all&filter=automatic/);
  await expect(page.getByText('24 services')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(top);
  expect(errors).toEqual([]);
});

test('the service page shows the published elements and starts the service', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/services/D1' });
  await expect(page.getByRole('heading', { name: 'معيار الخدمة' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ما نحتاجه منك' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'جلبناها عنك' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الخطوات' })).toBeVisible();
  const behind = page.locator('details').filter({ hasText: 'خلف الكواليس' });
  await expect(behind).not.toHaveAttribute('open', '');
  await behind.locator('summary').click();
  await expect(behind.getByText('مستوى الأتمتة')).toBeVisible();
  await page.getByRole('link', { name: 'ابدأ', exact: true }).last().click();
  await expect(page).toHaveURL(/#\/start\/D1/);
  expect(errors).toEqual([]);
});

test('an unknown service says so', async ({ page }) => {
  await openApp(page, { route: '/services/Z9' });
  await expect(page.getByRole('heading', { name: 'لم نجد هذه الخدمة' }).first()).toBeVisible();
});

test('search finds services, zones and the investor own requests, and helps when nothing matches', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/search' });
  await expect(page.getByRole('searchbox')).toBeFocused();
  await page.getByRole('button', { name: 'تصريح دخول' }).click();
  await expect(page.getByRole('heading', { name: 'خدمات' })).toBeVisible();
  await expect(page.locator('a[href="#/services/D2"]')).toBeVisible();

  await page.getByRole('searchbox').fill('رخصة البناء');
  await expect(page.getByRole('heading', { name: 'طلباتي' })).toBeVisible();

  await page.getByRole('searchbox').fill('الوكرة');
  await expect(page.getByRole('heading', { name: 'مناطق' })).toBeVisible();

  await page.getByRole('searchbox').fill('قطار سريع');
  await expect(page.getByText('لا نتائج لـ «قطار سريع»')).toBeVisible();
  await expect(page.getByRole('link', { name: 'اطلب مساعدة' })).toHaveAttribute('href', /start\/E1/);
  expect(errors).toEqual([]);
});

test('search reads common English spellings and puts a named zone first (gate n=20)', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/search', lang: 'en' });
  await page.getByRole('searchbox').fill('Al Wakrah');
  await expect(page.locator('main a[href="#/zones/AW"]')).toBeVisible();
  await expect(page.locator('main a[href="#/account/plots/AW-116"]')).toBeVisible();

  await page.getByRole('searchbox').fill('al-wakrah');
  await expect(page.locator('main a[href="#/zones/AW"]')).toBeVisible();

  await openApp(page, { route: '/search', lang: 'ar' });
  await page.getByRole('searchbox').fill('أبا صليل');
  await expect(page.locator('main a[href="#/zones/AS"]')).toBeVisible();
  // The zone is the first result, and services that share one word with its name are not listed.
  const first = await page.locator('main a[href^="#/"]').first().getAttribute('href');
  expect(first).toBe('#/zones/AS');
  await expect(page.getByRole('heading', { name: 'خدمات' })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('searching one of your plot numbers puts the plot first, with the requests about it', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/search', lang: 'en' });
  for (const query of ['BA-121', 'ba 121']) {
    await page.getByRole('searchbox').fill(query);
    const main = page.getByRole('main');
    await expect(main.locator('a[href="#/account/plots/BA-121"]')).toBeVisible();
    // The plot leads; its invoices follow it.
    const links = await main.locator('a[href^="#/"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href') ?? ''));
    expect(links[0]).toBe('#/account/plots/BA-121');
    const firstInvoice = links.findIndex((href) => href.startsWith('#/account/payments/'));
    expect(firstInvoice).toBeGreaterThan(0);
    // The fault report that is open on this plot is listed, before any invoice.
    const report = links.indexOf('#/requests/r94');
    expect(report).toBeGreaterThan(0);
    expect(report).toBeLessThan(firstInvoice);
  }
  // Another plot: its two running requests are found without typing their references.
  await page.getByRole('searchbox').fill('AW-116');
  await expect(page.locator('main a[href="#/requests/r95"]')).toBeVisible();
  await expect(page.locator('main a[href="#/requests/r77"]')).toBeVisible();
  // A word that is no plot number keeps the usual order.
  await page.getByRole('searchbox').fill('rent');
  await expect(page.locator('main a[href^="#/account/payments/"]').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('a plot service offers the way to a plot, not Start, to a company without one (gate n=21)', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/services/B7', demo: 'prospect', lang: 'en' });
  await expect(page.getByText('This service opens once you lease a plot')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Apply for land' }).click();
  await expect(page).toHaveURL(/#\/start\/A4/);

  // A service open to prospects keeps its Start; a tenant with a plot keeps Start on B7.
  await openApp(page, { route: '/services/A2', demo: 'prospect', lang: 'en' });
  await expect(page.getByRole('link', { name: 'Start', exact: true })).toBeVisible();
  await openApp(page, { route: '/services/B7', lang: 'en' });
  await expect(page.getByRole('link', { name: 'Start', exact: true })).toBeVisible();

  // The catalogue card of A8 carries no Start for the prospect.
  await openApp(page, { route: '/services', demo: 'prospect', lang: 'en' });
  const card = page.locator('li').filter({ has: page.locator('h3 a[href="#/services/A8"]') });
  await expect(card.getByText('Once you lease a plot')).toBeVisible();
  await expect(card.getByRole('link', { name: /^Start/ })).toHaveCount(0);

  // The full list says it on each plot service too, and on nothing else.
  await page.getByRole('radio', { name: 'All' }).click();
  const row = (id: string) => page.locator(`main a[href="#/services/${id}"]`);
  for (const id of ['A8', 'B7', 'B8', 'C1', 'D1', 'D2']) await expect(row(id).getByText('Once you lease a plot')).toBeVisible();
  for (const id of ['A1', 'A4', 'E1', 'B1']) await expect(row(id).getByText('Once you lease a plot')).toHaveCount(0);
  // A tenant with plots is never told to lease one. The handover, which none of their plots needs any more,
  // says exactly that; a service their plots can use carries no tag.
  await openApp(page, { route: '/services?view=all', lang: 'en' });
  await expect(page.locator('main a[href="#/services/B7"]')).toBeVisible();
  await expect(page.getByRole('main').getByText('Once you lease a plot')).toHaveCount(0);
  await expect(page.locator('main a[href="#/services/A8"]').getByText('No plot needs it now')).toBeVisible();
  await expect(page.locator('main a[href="#/services/B7"]').getByText('No plot needs it now')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a service with nothing to receive leaves the section out (gate n=23)', async ({ page }) => {
  await openApp(page, { route: '/services/F2', lang: 'en' });
  await expect(page.getByRole('heading', { name: 'Steps' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What you receive' })).toHaveCount(0);
  await openApp(page, { route: '/services/D1', lang: 'en' });
  await expect(page.getByRole('heading', { name: 'What you receive' })).toBeVisible();
});

for (const { width, lang, theme, text } of [
  { width: 320, lang: 'en', theme: 'light', text: 1 },
  { width: 320, lang: 'ar', theme: 'dark', text: 3 },
  { width: 390, lang: 'en', theme: 'dark', text: 3 },
  { width: 430, lang: 'en', theme: 'light', text: 1 },
] as const) {
  test(`service rows keep whole words and clear the chevron at ${width} px, ${lang}, ${theme}, text ${text} (gate n=24, n=25)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await openApp(page, { route: '/services?view=all', lang, theme, text });
    await expect(page.locator('main li > a[href^="#/services/"]').first()).toBeVisible();
    const problems = await page.evaluate(() => {
      const out: string[] = [];
      for (const row of document.querySelectorAll<HTMLAnchorElement>('main li > a[href^="#/services/"]')) {
        const chevron = [...row.querySelectorAll('svg')].pop();
        if (!chevron) continue;
        const c = chevron.getBoundingClientRect();
        const box = row.getBoundingClientRect();
        for (const el of row.querySelectorAll('span')) {
          if (el.contains(chevron) || el.closest('.visually-hidden')) continue;
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          const overlaps = Math.min(r.right, c.right) - Math.max(r.left, c.left) > 0.5 && Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top) > 0.5;
          if (overlaps) out.push(`${row.getAttribute('href')} overlaps the chevron`);
          if (r.right > box.right + 0.5 || r.left < box.left - 0.5) out.push(`${row.getAttribute('href')} leaves the row`);
        }
        // No word of the title or the official name is split across two lines (a hyphen may break "e-signature").
        const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (node.parentElement?.closest('.visually-hidden')) continue;
          for (const match of (node.textContent ?? '').matchAll(/[^\s-]+/g)) {
            const range = document.createRange();
            range.setStart(node, match.index ?? 0);
            range.setEnd(node, (match.index ?? 0) + match[0].length);
            const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
            if (lines.size > 1) out.push(`${row.getAttribute('href')} splits "${match[0]}"`);
          }
        }
      }
      return [...new Set(out)];
    });
    expect(problems).toEqual([]);
  });
}
