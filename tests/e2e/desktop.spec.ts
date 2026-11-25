import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

// The wide layout: the black global bar at the top, the footer at the end, no tab bar.
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

test('the global bar leads everywhere, carries the bell and flips the language', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { lang: 'en' });
  const bar = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(bar).toHaveCount(1);
  await expect(bar.getByText('Prototype')).toBeVisible();

  // The five destinations, with the current one marked.
  await expect(bar.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  await bar.getByRole('link', { name: 'Services' }).click();
  await expect(page).toHaveURL(/#\/services$/);
  await expect(bar.getByRole('link', { name: 'Services' })).toHaveAttribute('aria-current', 'page');
  await bar.getByRole('link', { name: /^Zones/ }).click();
  await expect(page).toHaveURL(/#\/zones$/);

  // The bell lives in the bar on wide screens, on every page, and names what is unread.
  const bell = bar.getByRole('link', { name: /Notifications, \d+ unread/ });
  await expect(bell).toBeVisible();
  await bell.click();
  await expect(page).toHaveURL(/#\/notifications$/);
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible();
  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(bar.getByRole('link', { name: 'Notifications', exact: true })).toHaveAttribute('aria-current', 'page');

  // Search and the language switch sit beside it.
  await bar.getByRole('link', { name: 'Search' }).click();
  await expect(page).toHaveURL(/#\/search$/);
  await bar.getByRole('button', { name: 'العربية' }).click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.getByRole('navigation', { name: 'التنقّل الرئيسي' }).getByRole('button', { name: 'English' })).toBeVisible();

  expect(errors).toEqual([]);
});

test('Home on a wide screen: the hero, both columns and the footer, with no sideways scroll', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { lang: 'en' });
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Open requests' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Payments due' })).toBeVisible();

  // The screen's own bar keeps no second bell or search on wide screens.
  await expect(page.getByRole('link', { name: /Notifications/ })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Search', exact: true })).toHaveCount(2); // the bar and the footer

  // The footer names the documents the services come from, and links on.
  const footer = page.getByRole('contentinfo');
  await expect(footer).toContainText('version 4.1');
  await expect(footer).toContainText('version 1.1');
  await footer.getByRole('link', { name: 'Solutions and prices' }).click();
  await expect(page).toHaveURL(/#\/solutions$/);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('a guest on a wide screen has no bell, and a locked page asks to sign in', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { demo: 'guest', lang: 'en' });
  const bar = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(bar.getByRole('link', { name: 'Search' })).toBeVisible();
  await expect(bar.getByRole('link', { name: /Notifications/ })).toHaveCount(0);
  await bar.getByRole('link', { name: /^Requests/ }).click();
  await expect(page).toHaveURL(/#\/requests$/);
  // The gate says the sign-in is a simulation and leads to the demo profiles.
  const main = page.getByRole('main');
  await expect(main.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  await expect(main).toContainText('simulated');
  await main.getByRole('link', { name: 'Demo sign-in' }).click();
  await expect(page).toHaveURL(/#\/welcome/);
  expect(errors).toEqual([]);
});
