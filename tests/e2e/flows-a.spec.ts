import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

/** Journey 1: from the eligibility check to a submitted land application, as a new investor. */
test('a new investor checks eligibility, applies for a plot and lands on the request', async ({ page }) => {
  const errors = watchErrors(page);
  await openApp(page, { route: '/eligibility', demo: 'prospect', lang: 'en' });

  // 1 · the activity
  // The common activities come first; the whole register is in a sheet.
  await page.getByRole('button', { name: 'All activities' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Food products manufacturing' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // 2 · the solution
  await expect(page.getByRole('radiogroup', { name: 'Solution' })).toBeVisible();
  await page.getByRole('radio', { name: /Logistics solutions/ }).click();
  await expect(page.getByRole('radio', { name: /Logistics solutions/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // 3 · area, any zone
  await page.getByRole('button', { name: /^5,000 m²/ }).first().click();
  await page.getByRole('button', { name: 'Any zone' }).click();
  await page.getByRole('button', { name: 'Check eligibility', exact: true }).click();

  // The result: eligible, with the four logistics parks.
  await expect(page.getByRole('heading', { name: 'Your activity fits.' })).toBeVisible();
  for (const zone of ['Al Wakra Logistics Park', 'Birkat Al Awamer Logistics Park', 'Jery Al Samur Logistics Park', 'Aba Saleel Logistics Park']) {
    await expect(page.getByRole('heading', { name: zone })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Apply for land', exact: true }).click();

  // The application, pre-filled.
  await expect(page).toHaveURL(/#\/start\/A4\?activity=ACT-101/);
  await expect(page.getByText(/Eligibility result: Eligible/)).toBeVisible();
  await page.getByText('Company, activity and zone are correct').click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await page.locator('[data-plot]:not([disabled])').first().click();
  await expect(page.getByRole('heading', { name: 'Your chosen plot' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  // Documents: two sample files, each checked on the spot.
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Use a sample file' }).first().click();
    await expect(page.getByText('Checking the document…')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  // Review: consent is needed before submitting.
  await page.getByRole('button', { name: 'Submit application', exact: true }).click();
  await expect(page.getByText('Agree to the terms to submit.')).toBeVisible();
  await page.getByText('I confirm the details are correct').click();
  await page.getByRole('button', { name: 'Submit application', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Your application is in.' })).toBeVisible();
  // The reference keeps a word joiner after each hyphen, so it never breaks across lines.
  await expect(page.getByText(/MQ-\u2060?\d{4}-\u2060?\d{4}/)).toBeVisible();
  await page.getByRole('button', { name: 'Track the request', exact: true }).click();
  await expect(page).toHaveURL(/#\/requests\/r\d+/);
  expect(errors).toEqual([]);
});

test('the application keeps a draft and asks before closing', async ({ page }) => {
  await openApp(page, { route: '/start/A4?zone=AW', demo: 'prospect', lang: 'en' });
  await page.getByText('Company, activity and zone are correct').click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Close the application' }).click();
  await expect(page.getByRole('dialog')).toContainText('Close the application?');
  await page.getByRole('button', { name: 'Close and keep the draft' }).click();
  await page.goto(page.url().replace(/#.*$/, '#/start/A4').replace('reset=1', 'reset=0'));
  await expect(page.getByRole('heading', { name: 'Choose your plot.' })).toBeVisible();
});

test('a non-targeted activity goes straight to the result, which recaps the activity only', async ({ page }) => {
  await openApp(page, { route: '/eligibility', demo: 'prospect', lang: 'en' });
  await page.getByLabel('Search activities').fill('retail malls');
  await page.getByRole('button', { name: 'Retail malls' }).click();
  await page.getByRole('button', { name: 'Check eligibility', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Not targeted.' })).toBeVisible();
  const answers = page.getByRole('list', { name: 'Your answers' });
  await expect(answers.getByRole('button')).toHaveCount(1);
});

test('Continue without a plot brings the message into view', async ({ page }) => {
  await openApp(page, { route: '/start/A4?zone=AW', demo: 'prospect', lang: 'en' });
  await page.getByText('Company, activity and zone are correct').click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const message = page.getByText('Choose a free plot on the layout.');
  await expect(message).toBeInViewport();
  await expect(message).toBeFocused();
});
