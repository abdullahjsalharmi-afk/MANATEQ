// Takes phone-size screenshots of app routes from the single-file build (preview/index.html).
// Usage: node scripts/screenshots.mjs <outDir> [--routes=/,/services] [--lang=ar,en] [--theme=light,dark] [--demo=tenant] [--full] [--scale=2] [--wait=600]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--'));
if (!outDir) {
  console.error('usage: node scripts/screenshots.mjs <outDir> [--routes=…] [--lang=ar,en] [--theme=light,dark] [--demo=tenant] [--full] [--scale=2]');
  process.exit(1);
}
const opt = (name, fallback) => (args.find((a) => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback);
const routes = opt('routes', '/').split(',');
const langs = opt('lang', 'ar').split(',');
const themes = opt('theme', 'light').split(',');
const demo = opt('demo', 'tenant');
const full = args.includes('--full');
const scale = Number(opt('scale', '2'));
const wait = Number(opt('wait', '600'));
const text = opt('text', '');
const file = path.resolve(opt('file', 'preview/index.html'));
if (!fs.existsSync(file)) {
  console.error(`missing ${file} — run "npm run build:single" first`);
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const problems = [];
for (const lang of langs) {
  for (const theme of themes) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: scale, isMobile: true, hasTouch: true, colorScheme: theme === 'dark' ? 'dark' : 'light', reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`[${lang}/${theme}] page error: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`[${lang}/${theme}] console error: ${message.text()}`);
    });
    for (const route of routes) {
      const query = `?demo=${demo}&lang=${lang}&theme=${theme}${text ? `&text=${text}` : ''}`;
      await page.goto(`file://${file}${query}#${route}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(wait);
      const name = `${route === '/' ? 'home' : route.replace(/^\//, '').replace(/[/?=&]/g, '-')}.${lang}.${theme}${text ? `.t${text}` : ''}.png`;
      await page.screenshot({ path: path.join(outDir, name), fullPage: full });
      console.log('shot', name);
    }
    await context.close();
  }
}
await browser.close();
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n` + [...new Set(problems)].join('\n'));
  process.exitCode = 2;
}
