import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

test.describe('zones explorer', () => {
  test('map → zone card → zone page → plot → land application', async ({ page }) => {
    const errors = watchErrors(page);
    await openApp(page, { route: '/zones', lang: 'en' });
    await expect(page.getByRole('heading', { level: 1, name: 'Zones' })).toBeVisible();
    await expect(page.getByText('Schematic map, positions are approximate.', { exact: false })).toBeVisible();

    // Filter by logistics, then choose Birkat Al Awamer on the map.
    await page.getByRole('button', { name: 'Logistics', exact: true }).click();
    await page.locator('[data-zone="BA"]').click();
    await expect(page.getByRole('heading', { level: 2, name: 'Birkat Al Awamer Logistics Park' })).toBeVisible();
    await expect(page.getByText('From QAR 15 / m² / year').first()).toBeVisible();
    await page.getByRole('link', { name: 'View zone' }).click();

    await expect(page).toHaveURL(/#\/zones\/BA/);
    await expect(page.getByRole('link', { name: 'Check your eligibility' })).toHaveAttribute('href', /eligibility\?zone=BA/);
    await expect(page.getByText('Illustrative data').first()).toBeVisible();

    // Follow the zone for availability alerts.
    const follow = page.getByRole('button', { name: 'Follow this zone' });
    await follow.click();
    await expect(page.getByRole('button', { name: 'Following this zone' })).toHaveAttribute('aria-pressed', 'true');

    // Choose an available plot and apply for it.
    const free = page.locator('#plots button[data-plot]:not([disabled])').first();
    const plotId = await free.getAttribute('data-plot');
    await free.click();
    const apply = page.getByRole('link', { name: 'Apply for this plot' });
    await expect(apply).toHaveAttribute('href', new RegExp(`start/A4\\?zone=BA&plot=${plotId}`));
    expect(errors).toEqual([]);
  });

  test('list view groups land zones and parks', async ({ page }) => {
    await openApp(page, { route: '/zones', lang: 'ar' });
    await page.getByRole('radio', { name: 'قائمة' }).or(page.getByRole('tab', { name: 'قائمة' })).or(page.getByRole('button', { name: 'قائمة' })).first().click();
    await expect(page.getByRole('heading', { name: 'المناطق الاقتصادية' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'مجمّعات التخزين' })).toBeVisible();
    await expect(page.locator('a[href="#/zones/WK"]')).toBeVisible();
    await expect(page.locator('a[href="#/zones/WK"]')).toContainText('حسب المشغّل');
  });

  test('tapping a marker brings the zone card into view on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page, { route: '/zones', lang: 'ar' });
    await page.locator('[data-zone="BA"]').click();
    await expect(page.getByRole('link', { name: 'عرض المنطقة' })).toBeInViewport();
  });

  test('a park offers an operator referral', async ({ page }) => {
    await openApp(page, { route: '/zones/WK', lang: 'en' });
    await expect(page.getByRole('heading', { level: 2, name: 'Al Wukair Warehousing Park' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ask for an operator referral' })).toHaveAttribute('href', /start\/F1\?zone=WK/);
  });

  test('solutions estimate the yearly rent', async ({ page }) => {
    await openApp(page, { route: '/solutions', lang: 'en' });
    await page.getByRole('button', { name: 'Commercial solutions' }).click();
    await page.getByLabel('Area').fill('2000');
    await expect(page.getByText('QAR 100,000 a year')).toBeVisible();
    await page.getByRole('button', { name: 'Warehousing solutions' }).click();
    await expect(page.getByText('The operator sets the warehousing price')).toBeVisible();
  });

  test('an unknown zone shows a not-found state', async ({ page }) => {
    await openApp(page, { route: '/zones/XX', lang: 'en' });
    await expect(page.getByRole('heading', { name: 'We could not find this zone' })).toBeVisible();
  });
});
