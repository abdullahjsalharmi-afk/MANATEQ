// Builds the design sketchbook from the boards in docs/sketches/boards:
//   docs/sketches/png/bNN.png            one image per board (2×)
//   docs/sketches/index.html             a single page that shows them in order
//   docs/sketches/manateq-one-sketchbook.pdf   every board as a vector page (needs `pdfunite` from poppler-utils)
// Usage: node scripts/build-sketchbook.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve('docs/sketches');
const BOARDS = path.join(ROOT, 'boards');
const PNG = path.join(ROOT, 'png');
fs.mkdirSync(PNG, { recursive: true });

const files = fs
  .readdirSync(BOARDS)
  .filter((name) => /^\d\d-.*\.html$/.test(name))
  .sort();
if (!files.length) {
  console.error('no boards found in', BOARDS);
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sketchbook-'));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1400 }, deviceScaleFactor: 2 });
const boards = [];

for (const file of files) {
  await page.goto('file://' + path.join(BOARDS, file));
  await page.waitForSelector('html[data-sketch-ready="1"]');
  await page.waitForTimeout(200);
  const board = await page.$('.board');
  if (!board) continue;
  const id = (await board.getAttribute('id')) ?? file.slice(0, 2);
  const title = (await page.$eval('.board-head h2', (el) => el.textContent ?? '').catch(() => '')).replace(/\s+/g, ' ').trim();
  const premise = (await page.$eval('.board-head p', (el) => el.textContent ?? '').catch(() => '')).replace(/\s+/g, ' ').trim();
  const box = await board.boundingBox();
  await board.screenshot({ path: path.join(PNG, `${id}.png`) });

  // One PDF page exactly the size of the board.
  await page.addStyleTag({ content: `@page { margin: 0 } html, body { margin: 0 !important; background: #fbf8f1 } .board { margin: 0 !important }` });
  const height = Math.ceil(box?.height ?? 1400);
  const pdfPath = path.join(tmp, `${id}.pdf`);
  await page.pdf({ path: pdfPath, width: '1000px', height: `${height}px`, printBackground: true, pageRanges: '1' });
  boards.push({ id, file, title, premise, pdfPath, height: Math.round(box?.height ?? 0) });
  console.log('board', id, title);
}
await browser.close();

const pdfOut = path.join(ROOT, 'manateq-one-sketchbook.pdf');
try {
  execFileSync('pdfunite', [...boards.map((b) => b.pdfPath), pdfOut]);
  console.log('pdf', pdfOut);
} catch (error) {
  console.warn('pdf skipped (pdfunite not available):', error.message);
}

const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>مناطق ون — دفتر السكتشات</title>
<link rel="stylesheet" href="kit/sketch.css">
<style>
  .book figure { margin: 0 0 28px; }
  .book figure img { display: block; width: 100%; height: auto; }
  .book figcaption { padding: 10px 20px 0; font-size: 15px; color: var(--pencil); }
  .book figcaption a { color: var(--accent); }
  .cover { padding: 48px 24px 28px; }
  .cover h1 { font-size: clamp(34px, 9vw, 54px); }
  .toc { grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
</style>
</head>
<body>
<main class="book">
  <header class="cover">
    <h1>مناطق ون — دفتر السكتشات</h1>
    <p>رسومات أولية بالقلم لتصميم التطبيق: الفكرة، رحلة المستثمر، خريطة التطبيق، ثم الشاشات والرحلات الرئيسية مع ملاحظات تشرح قرارات التصميم. ليست تصميمًا نهائيًا؛ هذه مرحلة القلم الرصاص.</p>
    <p class="meta">${boards.length} لوحًا · <a href="manateq-one-sketchbook.pdf">نسخة PDF</a></p>
    <ol class="toc">
${boards.map((b) => `      <li><a href="#${b.id}"><b>${b.id.replace('b', '')}</b>${esc(b.title)}</a></li>`).join('\n')}
    </ol>
  </header>
${boards
  .map(
    (b) => `  <figure id="${b.id}">
    <img src="png/${b.id}.png" width="2000" height="${b.height * 2}" loading="lazy" alt="${esc(b.title)} — ${esc(b.premise)}">
    <figcaption>${esc(b.title)} · <a href="boards/${b.file}">اللوح الأصلي</a></figcaption>
  </figure>`,
  )
  .join('\n')}
</main>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'index.html'), html);
console.log('index', path.join(ROOT, 'index.html'), `(${boards.length} boards)`);
