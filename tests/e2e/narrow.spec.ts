import { expect, test, type Page } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

// The narrowest phones (320 px): nothing scrolls sideways, and no word, date or code is split across two lines.
test.use({ viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true });

/**
 * Words the layout broke in the middle: letters of one word on more than one line. A compound that wraps
 * after its hyphen ("e-" / "signature") is ordinary typography, so each hyphenated part is measured alone.
 */
async function splitWords(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest('.visually-hidden, [aria-hidden="true"], svg')) continue;
      const style = getComputedStyle(parent);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const text = node.textContent ?? '';
      for (const match of text.matchAll(/[^\s -]+-?/g)) {
        const word = match[0];
        // Marks that only steer direction or joining are not letters.
        if (word.replace(/[⁠⁦-⁩‎‏]/g, '').length < 2) continue;
        range.setStart(node, match.index);
        range.setEnd(node, match.index + word.length);
        const lines = new Set([...range.getClientRects()].filter((rect) => rect.width > 0.5).map((rect) => Math.round(rect.top)));
        if (lines.size > 1) found.add(word);
      }
    }
    return [...found];
  });
}

async function sidewaysScroll(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function go(page: Page, route: string): Promise<void> {
  await page.evaluate((hash) => {
    window.location.hash = hash;
  }, route);
  await expect(page.getByRole('main')).toBeVisible();
  // Let the screen settle: fonts are in, the list has rendered.
  await page.waitForTimeout(350);
}

const ROUTES = ['/', '/services', '/requests', '/requests/r94', '/notifications', '/zones', '/account', '/account/plots', '/account/plots/BA-121', '/account/wallet', '/account/payments', '/account/support', '/account/about', '/gallery'];

for (const lang of ['ar', 'en'] as const) {
  test(`at 320 px nothing scrolls sideways and no word is split (${lang})`, async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page, { lang });
    const problems: string[] = [];
    for (const route of ROUTES) {
      await go(page, route);
      if (route === '/services') {
        // The full catalogue, where every row carries its standard and status.
        await page.getByRole('radio', { name: lang === 'ar' ? 'الكل' : 'All' }).click();
        await page.waitForTimeout(250);
      }
      const split = await splitWords(page);
      const overflow = await sidewaysScroll(page);
      if (split.length > 0) problems.push(`${route}: split ${JSON.stringify(split.slice(0, 6))}`);
      if (overflow > 1) problems.push(`${route}: scrolls sideways by ${overflow}px`);
    }
    expect(problems).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test('at 320 px and the largest text the pages still hold together (ar)', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { lang: 'ar', text: 3 });
  const problems: string[] = [];
  for (const route of ['/', '/requests', '/account', '/account/payments', '/account/plots/BA-121']) {
    await go(page, route);
    const overflow = await sidewaysScroll(page);
    if (overflow > 1) problems.push(`${route}: scrolls sideways by ${overflow}px`);
  }
  expect(problems).toEqual([]);
  expect(errors).toEqual([]);
});
