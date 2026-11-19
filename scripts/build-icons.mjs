// Renders the app icons (public/icons/*) from the Manateq One mark. Usage: node scripts/build-icons.mjs
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const OUT = path.resolve('public/icons');
fs.mkdirSync(OUT, { recursive: true });

// The same geometry as src/design/Mark/Mark.tsx. `pad` shrinks the plots for maskable icons (safe zone).
const svg = (size, { radius = 0.235, pad = 0 } = {}) => {
  const s = 64;
  const k = 1 - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${s * radius}" fill="#862633"/>
  <g transform="translate(${s * pad} ${s * pad}) scale(${k})" fill="none" stroke-width="3" stroke-linejoin="round">
    <rect x="13.5" y="13.5" width="15" height="15" rx="4" stroke="rgba(255,255,255,.92)"/>
    <rect x="35.5" y="13.5" width="15" height="15" rx="4" stroke="#fff" fill="#fff"/>
    <rect x="13.5" y="35.5" width="15" height="15" rx="4" stroke="rgba(255,255,255,.92)"/>
    <rect x="35.5" y="35.5" width="15" height="15" rx="4" stroke="rgba(255,255,255,.92)"/>
  </g>
</svg>`;
};

fs.writeFileSync(path.join(OUT, 'icon.svg'), svg(512));

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
