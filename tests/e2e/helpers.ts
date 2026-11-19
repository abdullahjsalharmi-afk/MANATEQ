import path from 'node:path';
import type { Page } from '@playwright/test';

const APP_FILE = path.resolve(process.env.MQ_APP_FILE ?? 'preview/index.html');

export interface OpenOptions {
  /** Hash route, e.g. '/services/A4'. Default '/'. */
  route?: string;
  /** Demo profile to start with. Default 'tenant'. */
  demo?: 'tenant' | 'prospect' | 'guest';
  lang?: 'ar' | 'en';
  theme?: 'light' | 'dark';
  /** Simulation speed multiplier (the app reads ?speed=). Tests use a fast clock. */
  speed?: number;
}

/** Opens the app in a known state. Each test starts from a fresh demo world. */
export async function openApp(page: Page, options: OpenOptions = {}): Promise<void> {
  const { route = '/', demo = 'tenant', lang = 'ar', theme = 'light', speed = 20 } = options;
  const query = `?reset=1&demo=${demo}&lang=${lang}&theme=${theme}&speed=${speed}`;
  await page.goto(`file://${APP_FILE}${query}#${route}`);
  await page.evaluate(() => document.fonts.ready);
}

/** Collects page errors and console errors so a test can assert there were none. */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  return errors;
}
