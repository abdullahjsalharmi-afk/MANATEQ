// Renders every .board in a sketch HTML file to a PNG image.
// Usage: node scripts/render-sketches.mjs <file.html> <outDir> [scale]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const [file, outDir, scaleArg] = process.argv.slice(2);
if (!file || !outDir) {
  console.error('usage: node scripts/render-sketches.mjs <file.html> <outDir> [scale]');
  process.exit(1);
}
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: Number(scaleArg || 2) });
await page.goto('file://' + path.resolve(file));
await page.waitForSelector('html[data-sketch-ready="1"]');
await page.waitForTimeout(250);

const boards = await page.$$('.board');
for (const board of boards) {
  const id = await board.getAttribute('id');
  const out = path.join(outDir, `${id}.png`);
  await board.screenshot({ path: out });
  console.log('rendered', out);
}
await browser.close();
