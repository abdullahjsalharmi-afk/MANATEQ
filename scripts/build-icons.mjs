// Renders the app icons (public/icons/*) from the Manateq One mark: a white mark on Manateq maroon,
// the colour of the brand tile (--brand in src/design/tokens.css).
// Usage: node scripts/build-icons.mjs            writes the icons
//        node scripts/build-icons.mjs --favicon  prints the inline favicon for index.html
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('public/icons');
const BRAND = '#862633';

// The same geometry as src/design/Mark/Mark.tsx: four plots of 18 units on a 64-unit grid, one of them filled.
// `stroke` thickens the lines for small sizes; `pad` shrinks the plots for maskable icons (safe zone).
const PLOTS = [
  [12, 12, false],
  [34, 12, true],
  [12, 34, false],
  [34, 34, false],
];
const svg = (size, { radius = 0.235, pad = 0, stroke = 3 } = {}) => {
  const s = 64;
  const k = 1 - pad * 2;
  const plots = PLOTS.map(
    ([x, y, taken]) =>
      `<rect x="${x + stroke / 2}" y="${y + stroke / 2}" width="${18 - stroke}" height="${18 - stroke}" rx="${5 - stroke / 2}"${taken ? ' fill="#fff"' : ''}/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}"><rect width="${s}" height="${s}" rx="${s * radius}" fill="${BRAND}"/><g transform="translate(${s * pad} ${s * pad}) scale(${k})" fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linejoin="round">${plots}</g></svg>`;
};

if (process.argv.includes('--favicon')) {
  // Browser tabs draw the icon at 16 to 32 px: use the heavier stroke.
  console.log(`data:image/svg+xml,${encodeURIComponent(svg(64, { stroke: 4.5 })).replace(/'/g, '%27')}`);
  process.exit(0);
}

const { chromium } = await import('playwright');
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'icon.svg'), svg(512) + '\n');

const browser = await chromium.launch();
const page = await browser.newPage();
const shots = [
  ['icon-192.png', 192, {}],
  ['icon-512.png', 512, {}],
  ['apple-touch-icon.png', 180, { radius: 0 }],
  ['maskable-512.png', 512, { radius: 0, pad: 0.12 }],
];
for (const [name, size, options] of shots) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:transparent">${svg(size, options)}</body>`);
  await page.screenshot({ path: path.join(OUT, name), omitBackground: true });
  console.log('icon', name);
}
await browser.close();
