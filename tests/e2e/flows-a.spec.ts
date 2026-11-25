import { expect, test } from '@playwright/test';
import { openApp, watchErrors } from './helpers';

/** Journey 1: from the eligibility check to a submitted land application, as a new investor. */
test('a new investor checks eligibility, applies for a plot and lands on the request', async ({ page }) => {
  const errors = watchErrors(page);
  // A slow clock, so the confirmation and the request page are read at the same step.
  await openApp(page, { route: '/eligibility', demo: 'prospect', lang: 'en', speed: 1 });

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
  await expect(page.getByText(/MQ-\u2060?\d{4}-\u2060?\d{4}/).first()).toBeVisible();
  // What happens now is read from the request (gate n=2): the step it names first is the one the request
  // page shows as current, not a fixed "evaluation by the rules".
  const first = page.getByRole('list', { name: 'Next steps' }).getByRole('listitem').first();
  await expect(first).toBeVisible();
  await expect(page.locator('main')).not.toContainText('Evaluation by the rules');
  // The title line starts with its state for screen readers ("Current step: …").
  const step = (await first.locator('p').first().innerText()).replace(/^[^:]+:\s*/, '').trim();
  expect(step).not.toEqual('');
  await page.getByRole('button', { name: 'Track request', exact: true }).click();
  await expect(page).toHaveURL(/#\/requests\/r\d+/);
  await expect(page.locator('main')).toContainText(step);
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

test('no "another option" when no alternative has a free plot of the size (gate n=4)', async ({ page }) => {
  await openApp(page, { route: '/eligibility?activity=ACT-101', demo: 'prospect', lang: 'en' });
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('radio', { name: /Commercial solutions/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('spinbutton', { name: /Area needed/ }).or(page.getByRole('textbox', { name: /Area needed/ })).first().fill('45000');
  await page.getByRole('button', { name: 'Check eligibility', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your activity is targeted, but no plot of this size is free now.' })).toBeVisible();
  await expect(page.getByText('Eligible with another option.')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Follow plot availability' })).toBeVisible();
});

test('an unlisted activity is described before it is sent for review (gate n=5)', async ({ page }) => {
  await openApp(page, { route: '/eligibility', demo: 'prospect', lang: 'en' });
  await page.getByRole('button', { name: /My activity is not listed/ }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const field = page.getByRole('textbox', { name: /Describe your activity/ });
  await expect(page.getByText('Describe your activity so the planning team can review it.')).toBeVisible();
  await expect(field).toBeFocused();
  await field.fill('Assembly of small drones');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Check eligibility', exact: true }).click();
  await expect(page.getByText('An unlisted activity: Assembly of small drones')).toBeVisible();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page).toHaveURL(/#\/requests\/r\d+/);
});
