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
  await expect(page.getByRole('link', { name: /Report a maintenance issue/ })).toHaveAttribute('href', /start\/D1\?plot=AK-113/);

  await openApp(page, { route: '/account/team', lang: 'en' });
  const switches = page.getByRole('switch');
  await expect(switches).toHaveCount(3);
  const last = switches.last();
  const before = await last.getAttribute('aria-checked');
  await last.click();
  await expect(last).not.toHaveAttribute('aria-checked', before ?? '');

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
