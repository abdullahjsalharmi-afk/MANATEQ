// Builds the design book from the running app: real screens, captured from the single-file build and laid out
// as pages in the app's own design language.
//
//   npm run build:single && node scripts/build-design-book.mjs
//
// Writes docs/design/shots/*, docs/design/index.html and docs/design/manateq-one-design.pdf.
// The book shows the app's content, so like the build itself it stays out of the repository (see .gitignore).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
// The build to capture: preview/index.html, or another single-file build named in MQ_APP_FILE (as the e2e tests do).
const APP = process.env.MQ_APP_FILE ? path.resolve(process.env.MQ_APP_FILE) : path.join(ROOT, 'preview', 'index.html');
const OUT = path.join(ROOT, 'docs', 'design');
const SHOTS = path.join(OUT, 'shots');
const DATA = path.join(ROOT, 'src', 'data', 'generated');
if (!fs.existsSync(APP)) {
  console.error('missing preview/index.html: run "npm run build:single" first');
  process.exit(1);
}
fs.mkdirSync(SHOTS, { recursive: true });

// The figures of the closing page are counted from the data the app is built from, never typed by hand.
const readData = (name) => JSON.parse(fs.readFileSync(path.join(DATA, name), 'utf8'));
const catalog = readData('catalog.json');
let workflowCount = 0;
let stepCount = 0;
for (const letter of new Set(catalog.services.map((service) => service.id[0]))) {
  const file = readData(`services-${letter}.json`);
  for (const service of Array.isArray(file) ? file : (file.services ?? Object.values(file))) {
    if (!service.workflow) continue;
    workflowCount += 1;
    stepCount += service.workflow.steps.length;
  }
}
const FACTS = { services: catalog.services.length, workflows: workflowCount, steps: stepCount, zones: readData('zones.json').zones.length, integrations: readData('reference.json').integrations.length };

const PHONE = { width: 390, height: 844 };
const DESK = { width: 1440, height: 1000 };
/** The eight renders of the design-language page. */
const SYSTEM_RENDERS = ['plot', 'construction', 'warehouse', 'factory', 'showroom', 'yard', 'units', 'gate'];

/**
 * The pages of the book. Each shot: id, route, and optionally demo (tenant by default), lang, theme, desk, tall
 * (a taller capture for long screens) and `after` (a small interaction before the capture: `signin` opens the
 * demo sign-in sheet, `pick` chooses the first option of the step).
 */
const PAGES = [
  {
    title: 'الترحيب والدخول',
    lead: 'لحظة واحدة بلون «مناطق»، ثم دخول مرة واحدة تصل معه بيانات الشركة تلقائيًا.',
    notes: ['بلاطة عنابية كاملة: العلامة، العنوان، زرّان، ومجسّم المنطقة.', 'الدخول في النموذج تجريبي: لا يُطلب اسم مستخدم ولا كلمة مرور.', 'ملفان للعرض: مستثمر جديد ومستثمر قائم.'],
    shots: [
      { id: 'welcome', route: '/welcome', demo: 'none' },
      { id: 'welcome-sheet', route: '/welcome', demo: 'none', after: 'signin' },
      { id: 'home-guest', route: '/', demo: 'guest' },
    ],
  },
  {
    title: 'الرئيسية: خطوتك التالية أولًا',
    lead: 'الشاشة تجيب عن سؤال واحد: ما المطلوب مني الآن؟',
    notes: ['بطاقة «خطوتك التالية» هي اللحظة العنابية الوحيدة في الشاشة.', 'تحتها الرحلة بمحطاتها الأربع، ثم الطلبات الجارية والمستحقات والاختصارات.', 'للمستثمر الجديد: الخطوة التالية هي طلب الأرض، ثم كيف تسير الرحلة والحلول وأسعارها.'],
    shots: [
      { id: 'home-tenant', route: '/', tall: 1500 },
      { id: 'home-prospect', route: '/', demo: 'prospect', tall: 1500 },
      { id: 'notifications', route: '/notifications' },
    ],
  },
  {
    title: 'الخدمات وصفحة الخدمة',
    lead: 'خمسون خدمة مرتّبة على محطات الرحلة، ولكل خدمة صفحة واحدة بالعناصر نفسها.',
    notes: ['محطتك الحالية أولًا، ثم باقي المحطات.', 'صفحة الخدمة: الوعد، معيار الخدمة (استرشادي)، ما نحتاجه منك، وما جلبناه عنك.', 'الخدمات التلقائية تشرح متى تبدأ ولا تُطلب.'],
    shots: [
      { id: 'services', route: '/services', tall: 1500 },
      { id: 'service-c1', route: '/services/C1', tall: 1500 },
      { id: 'search', route: '/search' },
    ],
  },
  {
    title: 'طلباتي: عند مَن الآن؟',
    lead: 'كل طلب يجيب عن ثلاثة أسئلة: عند مَن هو؟ كم بقي؟ وهل المطلوب مني شيء؟',
    notes: ['الخط الزمني هو مسار العمل نفسه كما ورد في كتاب «سير عمل الخدمات» (الإصدار 1.1).', 'حين يكون الدور على المستثمر تظهر بطاقة إجراء واحدة، وتتوقف ساعة المعيار.', 'القبول والتوقيع والدفع في ورقة واحدة متتابعة.'],
    shots: [
      { id: 'requests', route: '/requests' },
      { id: 'request-needs', route: '@needsYou', tall: 1500 },
      { id: 'request-active', route: '@active', tall: 1500 },
    ],
  },
  {
    title: 'المناطق والحلول',
    lead: 'خريطة، ثم سعر منشور، ثم خطوة.',
    notes: ['ثلاث عشرة منطقة ومجمّعًا على خريطة تخطيطية.', 'صفحة المنطقة صفحة منتج: المجسّم، السعر المنشور، المساحات، ومخطط القطع.', 'البيانات التوضيحية موسومة بذلك حيث وردت.'],
    shots: [
      { id: 'zones', route: '/zones', tall: 1300 },
      { id: 'zone-ba', route: '/zones/BA', tall: 1500 },
      { id: 'solutions', route: '/solutions', tall: 1500 },
    ],
  },
  {
    title: 'من الأهلية إلى الأرض',
    lead: 'يعرف المستثمر خلال دقائق هل نشاطه مستهدف، وأين، وبكم؛ ثم يقدّم على قطعته.',
    notes: ['ثلاثة أسئلة: النشاط، ثم الحل، ثم المساحة.', 'النتيجة تُحفظ في الملف وتملأ طلب الأرض.', 'اختيار القطعة من مخطط المنطقة مباشرة.'],
    shots: [
      { id: 'eligibility', route: '/eligibility', demo: 'prospect', tall: 1300 },
      { id: 'land', route: '/start/A4', demo: 'prospect', tall: 1300 },
      { id: 'start-generic', route: '/start/B8' },
    ],
  },
  {
    title: 'الحساب والمحفظة والمدفوعات',
    lead: 'كل ما يخص الشركة في مكان واحد، وكل وثيقة يمكن التحقق منها.',
    notes: ['القطع والعقود بمجسّم يدل على مرحلة كل قطعة.', 'الوثائق والتصاريح برمز QR ورمز تحقق.', 'الدفع والتوقيع في النموذج محاكاة، ومكتوب ذلك بوضوح.'],
    shots: [
      { id: 'plots', route: '/account/plots', tall: 1400 },
      { id: 'doc', route: '@doc', tall: 1400 },
      { id: 'payments', route: '/account/payments', tall: 1400 },
    ],
  },
  {
    title: 'داخل المنطقة: بلاغ وتصريح',
    lead: 'يبلّغ المستثمر عن عطل أو يصدر تصريح دخول في دقيقة.',
    notes: ['المستثمر يصف ما يراه فقط، والتصنيف والتوجيه على النظام.', 'أنواع التصريح: عامل، مركبة، زائر.', 'للطوارئ مدخل مستقل وهادئ.'],
    shots: [
      { id: 'd1', route: '/start/D1', after: 'pick' },
      { id: 'd2', route: '/start/D2', after: 'pick' },
      { id: 'pass', route: '@pass' },
    ],
  },
  {
    title: 'الوضع الداكن والإنجليزية',
    lead: 'على الخلفيات الداكنة يصير لون التمييز ذهب «مناطق»، والإنجليزية مكافئة تمامًا للعربية.',
    notes: ['كل الألوان رموز تصميم، فلا يحتاج الوضع الداكن إلى شاشات خاصة.', 'الاتجاهان من الشيفرة نفسها.'],
    shots: [
      { id: 'home-dark', route: '/', theme: 'dark', tall: 1500 },
      { id: 'request-dark', route: '@active', theme: 'dark', tall: 1500 },
      { id: 'home-en', route: '/', lang: 'en', tall: 1500 },
    ],
  },
  {
    title: 'على الشاشات العريضة',
    lead: 'التطبيق موقع كذلك: شريط علوي، شبكات بطاقات، وتذييل.',
    notes: ['من 834 بكسل يظهر الشريط العلوي والتذييل وتتعدد الأعمدة.', 'الجرس والبحث وتبديل اللغة في الشريط العلوي، في كل صفحة.', 'بطاقة «خطوتك التالية» تمتد على عرض الصفحة، والمجسّم بجانب الكلمات.'],
    desk: true,
    shots: [{ id: 'desk-home', route: '/', desk: true }],
  },
  {
    title: 'الطلب على الشاشة العريضة',
    lead: 'الجهة الحائزة في الصدارة، ثم مسار الطلب ومعيار الخدمة جنبًا إلى جنب.',
    notes: ['العمود الأعرض للخط الزمني، والأضيق لمعيار الخدمة والطلبات المرتبطة.', 'عمود القراءة لا يتجاوز 980 بكسل كي تبقى السطور مريحة.'],
    desk: true,
    shots: [{ id: 'desk-request', route: '@active', desk: true }],
  },
  {
    title: 'صفحة المنطقة',
    lead: 'صفحة منتج: بلاطة داكنة، ومجسّم المنطقة، ثم الأرقام والحلول ومخطط القطع.',
    notes: ['على البلاطات الداكنة يصير لون التمييز ذهبيًّا.', 'شريط الإجراء يبقى أسفل الشاشة بالسعر المنشور والخطوة التالية.'],
    desk: true,
    shots: [{ id: 'desk-zone', route: '/zones/BA', desk: true }],
  },
  {
    title: 'الخدمات بالإنجليزية',
    lead: 'الصفحة نفسها من اليسار إلى اليمين: الترتيب ينعكس، والأرقام والرموز تبقى كما هي.',
    notes: ['محطة المستثمر الحالية أولًا، في شبكة من ثلاثة أعمدة.', 'كل نص في التطبيق متاح باللغتين.'],
    desk: true,
    shots: [{ id: 'desk-services-en', route: '/services', desk: true, lang: 'en' }],
  },
];

const browser = await chromium.launch();

async function openContext({ demo = 'tenant', lang = 'ar', theme = 'light', desk = false }) {
  const size = desk ? DESK : PHONE;
  const context = await browser.newContext({
    viewport: size,
    deviceScaleFactor: 2,
    isMobile: !desk,
    hasTouch: !desk,
    colorScheme: theme === 'dark' ? 'dark' : 'light',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  const boot = demo === 'none' ? `?reset=1&lang=${lang}&theme=${theme}` : `?reset=1&demo=${demo}&lang=${lang}&theme=${theme}&speed=0`;
  await page.goto(`file://${APP}${boot}#/`);
  await page.waitForTimeout(1800);
  const world = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem('manateq-one:v1') ?? 'null')?.world ?? null;
    } catch {
      return null;
    }
  });
  return { context, page, world, lang, theme };
}

function resolve(route, world) {
  if (!route.startsWith('@')) return route;
  const requests = world?.requests ?? [];
  if (route === '@needsYou') return `/requests/${requests.find((r) => r.status === 'needs_you')?.id ?? ''}`;
  if (route === '@active') return `/requests/${requests.find((r) => r.status === 'active')?.id ?? ''}`;
  if (route === '@doc') return `/account/wallet/${(world?.docs ?? []).find((d) => d.kind === 'contract')?.id ?? world?.docs?.[0]?.id ?? ''}`;
  if (route === '@pass') return `/account/wallet/${world?.passes?.[0]?.id ?? ''}`;
  return '/';
}

const sessions = new Map();
for (const pageDef of PAGES) {
  for (const shot of pageDef.shots) {
    const key = JSON.stringify([shot.demo ?? 'tenant', shot.lang ?? 'ar', shot.theme ?? 'light', Boolean(shot.desk)]);
    if (!sessions.has(key)) sessions.set(key, await openContext(shot));
    const session = sessions.get(key);
    const { page, world, lang, theme } = session;
    const size = shot.desk ? DESK : PHONE;
    await page.setViewportSize({ width: size.width, height: shot.tall ?? size.height });
    await page.goto(`file://${APP}?lang=${lang}&theme=${theme}${(shot.demo ?? 'tenant') === 'none' ? '' : '&speed=0'}#${resolve(shot.route, world)}`);
    await page.waitForTimeout(900);
    if (shot.after === 'signin') {
      await page.getByRole('button', { name: /توثيق|Tawtheeq/ }).first().click();
      await page.waitForTimeout(700);
    }
    if (shot.after === 'pick') {
      await page.getByRole('main').getByRole('radio').first().click();
      await page.waitForTimeout(500);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, `${shot.id}.jpg`), type: 'jpeg', quality: 88 });
    console.log('shot', shot.id);
  }
}
for (const session of sessions.values()) await session.context.close();

// The renders carry a soft shadow. Drawn with a CSS filter inside the book, each one lands in the PDF as a large
// lossless image; captured once here on its flat background, the art is two small JPEGs. The cover art is the
// whole cover without its words, so there is no edge where an image meets the page colour.
const art = path.join(SHOTS, 'art.html');
const renderUrl = (name) => 'file://' + path.join(ROOT, 'src', 'assets', 'renders', `${name}.webp`);
fs.writeFileSync(
  art,
  `<!doctype html><meta charset="utf-8"><style>
  body { margin: 0; }
  * { box-sizing: border-box; }
  #cover { width: 1600px; height: 1000px; background: #862633; display: grid; grid-template-columns: 1fr 1fr; align-items: center; padding: 80px 96px; }
  #cover img { display: block; width: 100%; filter: drop-shadow(3px 5px 30px rgba(0,0,0,.36)); }
  #grid { width: 1084px; padding: 60px; background: #fff; display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 20px; align-items: center; }
  #grid img { display: block; width: 100%; filter: drop-shadow(3px 5px 24px rgba(35,31,32,.18)); }
  </style><div id="cover" dir="rtl"><div></div><div><img src="${renderUrl('zone')}"></div></div><div id="grid">${SYSTEM_RENDERS.map((name) => `<img src="${renderUrl(name)}">`).join('')}</div>`,
);
const artContext = await browser.newContext({ viewport: { width: 1700, height: 1100 }, deviceScaleFactor: 2 });
const artPage = await artContext.newPage();
await artPage.goto('file://' + art);
await artPage.waitForFunction(() => [...document.images].every((image) => image.complete && image.naturalWidth > 0));
await artPage.locator('#cover').screenshot({ path: path.join(SHOTS, 'art-cover.jpg'), type: 'jpeg', quality: 92 });
await artPage.locator('#grid').screenshot({ path: path.join(SHOTS, 'art-renders.jpg'), type: 'jpeg', quality: 94 });
await artContext.close();
fs.rmSync(art);
console.log('art cover, renders');

// ---------------------------------------------------------------------------------------------------------
// The book: one landscape page per chapter, in the app's own language (tokens copied from src/design/tokens.css).
const fontDir = path.relative(OUT, path.join(ROOT, 'src', 'assets', 'fonts')).split(path.sep).join('/');
const esc = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const chapter = (def, n) => `
<section class="page${def.desk ? ' desk' : ''}">
  <div class="words">
    <p class="eyebrow">${String(n).padStart(2, '0')}</p>
    <h2>${esc(def.title)}</h2>
    <p class="lead">${esc(def.lead)}</p>
    <ul>${def.notes.map((note) => `<li>${esc(note)}</li>`).join('')}</ul>
  </div>
  <div class="shots">${def.shots.map((shot) => `<figure class="${shot.desk ? 'wide' : 'phone'}"><img src="shots/${shot.id}.jpg" alt=""></figure>`).join('')}</div>
</section>`;

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>مناطق ون · كتاب التصميم</title>
<style>
@font-face { font-family: 'Manateq Arabic'; font-weight: 100 400; src: url('${fontDir}/Tajawal-400-arabic.woff2') format('woff2'); size-adjust: 108%; }
@font-face { font-family: 'Manateq Arabic'; font-weight: 500 900; src: url('${fontDir}/Tajawal-700-arabic.woff2') format('woff2'); size-adjust: 108%; }
@font-face { font-family: 'Manateq UI'; font-weight: 100 900; src: url('${fontDir}/Inter-variable-latin.woff2') format('woff2'); }
:root { --bg: #f4f2ef; --surface: #fff; --ink: #231f20; --ink-2: #4a4446; --ink-3: #6a6566; --line: rgba(35,31,32,.12); --brand: #862633; --gold: #7c6529; --gold-on-dark: #e2cda0; --tile: #231f20; }
* { box-sizing: border-box; }
html { background: var(--bg); }
body { margin: 0; color: var(--ink); font-family: 'Manateq Arabic', -apple-system, 'Manateq UI', system-ui, sans-serif; font-size: 17px; line-height: 1.65; }
h1, h2, p, ul, figure { margin: 0; padding: 0; }
.page { width: 1600px; height: 1000px; display: grid; grid-template-columns: 420px 1fr; gap: 56px; align-items: center; padding: 64px 80px; margin: 0 auto; background: var(--bg); break-after: page; overflow: hidden; }
.page.desk { grid-template-columns: 340px 1fr; }
.eyebrow { color: var(--gold); font-size: 14px; font-weight: 700; }
h2 { font-size: 44px; font-weight: 700; line-height: 1.3; margin-block: 8px 16px; text-wrap: balance; }
.lead { font-size: 21px; color: var(--ink-2); line-height: 1.6; text-wrap: pretty; }
ul { list-style: none; margin-block-start: 28px; display: grid; gap: 14px; border-block-start: 1px solid var(--line); padding-block-start: 24px; }
li { font-size: 16px; color: var(--ink-3); line-height: 1.7; }
.shots { display: flex; gap: 28px; justify-content: center; align-items: center; height: 100%; min-width: 0; }
/* A box shadow, not a filter: a filter would make the PDF embed every screen as a lossless image. */
figure { flex: 0 1 auto; min-width: 0; border-radius: 36px; overflow: hidden; background: var(--surface); border: 1px solid var(--line); box-shadow: 3px 5px 30px rgba(35,31,32,.16); }
figure.phone { max-height: 100%; }
figure.phone img { display: block; width: 300px; max-height: 872px; object-fit: cover; object-position: top; }
figure.wide { border-radius: 14px; }
figure.wide img { display: block; width: 1000px; max-height: 760px; object-fit: cover; object-position: top; }
.cover { width: 1600px; height: 1000px; margin: 0 auto; background: var(--brand) url('shots/art-cover.jpg') center / 100% 100% no-repeat; color: #fff; display: grid; grid-template-columns: 1fr 1fr; align-items: center; padding: 80px 96px; break-after: page; overflow: hidden; }
.cover .eyebrow { color: var(--gold-on-dark); font-size: 16px; }
.cover h1 { font-size: 84px; font-weight: 700; line-height: 1.2; margin-block: 12px 20px; }
.cover p.lead { color: rgba(255,255,255,.88); font-size: 26px; }
.cover .fine { margin-block-start: 48px; font-size: 14px; color: rgba(255,255,255,.76); max-width: 30em; }
.system { width: 1600px; height: 1000px; margin: 0 auto; background: var(--surface); padding: 64px 80px; display: grid; grid-template-columns: 420px 1fr; gap: 56px; align-items: center; break-after: page; overflow: hidden; }
/* Above the renders image, whose white margin (room for the shadows) reaches under the swatches. */
.swatches { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.swatch { border-radius: 18px; border: 1px solid var(--line); overflow: hidden; }
.swatch i { display: block; height: 120px; }
.swatch b { display: block; padding: 12px 16px 2px; font-size: 16px; }
.swatch span { display: block; padding: 0 16px 14px; font-size: 13px; color: var(--ink-3); direction: ltr; text-align: end; }
.renders { display: block; width: calc(100% + 120px); margin: -32px -60px -60px; }
.figures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.figures div { border-radius: 18px; border: 1px solid var(--line); padding: 22px 22px 20px; }
.figures b { display: block; font-size: 56px; font-weight: 700; line-height: 1.15; font-variant-numeric: tabular-nums; }
.figures span { display: block; margin-block-start: 6px; font-size: 15px; color: var(--ink-3); line-height: 1.6; }
.sim { margin-block-start: 28px; border-radius: 18px; border: 1px solid var(--line); padding: 8px 24px; }
.sim h3 { margin: 0; padding-block: 14px; font-size: 17px; font-weight: 700; border-block-end: 1px solid var(--line); }
.sim dl { margin: 0; }
.sim dl div { display: grid; grid-template-columns: 220px 1fr; gap: 24px; padding-block: 12px; border-block-end: 1px solid var(--line); font-size: 15px; line-height: 1.6; }
.sim dl div:last-child { border-block-end: 0; }
.sim dt { color: var(--ink-3); }
.sim dd { margin: 0; color: var(--ink); }
.fine { margin-block-start: 18px; font-size: 13px; color: var(--ink-3); line-height: 1.7; }
@page { size: 1600px 1000px; margin: 0; }
@media screen { body { padding-block: 24px; } .page, .cover, .system { margin-block-end: 24px; } }
</style>
</head>
<body>
<section class="cover">
  <div>
    <p class="eyebrow">كتاب التصميم</p>
    <h1>مناطق ون</h1>
    <p class="lead">خمسون خدمة. رحلة واحدة.</p>
    <p class="fine">لقطات حقيقية من النموذج التجريبي. لغة التصميم لغة Apple، والألوان ألوان «مناطق»، والصور مجسّمات مبانٍ. نسخة تجريبية للعرض والمراجعة، وليست خدمة رسمية.</p>
  </div>
  <div></div>
</section>
<section class="system">
  <div class="words">
    <p class="eyebrow">00</p>
    <h2>لغة واحدة</h2>
    <p class="lead">واجهة تكاد لا تُرى، كي يتقدّم المحتوى ومجسّم المبنى.</p>
    <ul>
      <li>لون تمييز واحد لكل سطح: العنابي على الفاتح، والذهبي على الداكن.</li>
      <li>الخط العربي «تجوّل»، خط مستندات «مناطق». النص الأساسي بمقاس 17.</li>
      <li>خطوط رفيعة بدل الظلال، وأزرار على هيئة كبسولة، وبطاقات بزوايا 18.</li>
      <li>المجسّمات هي الصور الوحيدة، وهي وحدها تحمل ظلًّا.</li>
    </ul>
  </div>
  <div>
    <div class="swatches">
      <div class="swatch"><i style="background:#862633"></i><b>عنابي</b><span>#862633</span></div>
      <div class="swatch"><i style="background:#84754e"></i><b>ذهبي</b><span>#84754E</span></div>
      <div class="swatch"><i style="background:#231f20"></i><b>أسود دافئ</b><span>#231F20</span></div>
      <div class="swatch"><i style="background:#f4f2ef"></i><b>ورقي</b><span>#F4F2EF</span></div>
    </div>
    <img class="renders" src="shots/art-renders.jpg" alt="">
  </div>
</section>
${PAGES.map((def, index) => chapter(def, index + 1)).join('\n')}
<section class="system">
  <div class="words">
    <p class="eyebrow">${String(PAGES.length + 1).padStart(2, '0')}</p>
    <h2>الأرقام والمصادر</h2>
    <p class="lead">كل ما في التطبيق مأخوذ من ثلاثة مستندات، وما سواه موسوم بأنه توضيحي.</p>
    <ul>
      <li>«دليل الخدمات»، الإصدار 4.1، أكتوبر 2026.</li>
      <li>«دليل أتمتة الخدمات والربط»، الإصدار 4.1، أكتوبر 2026.</li>
      <li>«سير عمل الخدمات»، الإصدار 1.1، أكتوبر 2026: مسارات العمل منقولة عنه خطوة بخطوة.</li>
    </ul>
  </div>
  <div>
    <div class="figures">
      <div><b>${FACTS.services}</b><span>خدمة للمستثمرين، في رحلة واحدة</span></div>
      <div><b>${FACTS.steps}</b><span>خطوة في ${FACTS.workflows} مسار عمل، كما وردت في الكتاب</span></div>
      <div><b>${FACTS.zones}</b><span>منطقة ومجمّعًا، بأسعارها المنشورة</span></div>
      <div><b>${FACTS.integrations}</b><span>ربطًا مع الأنظمة الوطنية وأنظمة «مناطق»</span></div>
    </div>
    <div class="sim">
      <h3>ما الذي يُحاكى في النموذج</h3>
      <dl>
        <div><dt>الدخول</dt><dd>اختيار ملف عرض؛ لا تُطلب أي بيانات دخول.</dd></div>
        <div><dt>بيانات الشركة والجهات</dt><dd>بيانات توضيحية؛ لا يتصل النموذج بأي نظام.</dd></div>
        <div><dt>الدفع</dt><dd>ورقة دفع تجريبية؛ لا تُطلب بيانات بطاقة ولا يُخصم شيء.</dd></div>
        <div><dt>التوقيع والتحقق</dt><dd>توقيع ورمز تحقق تجريبيان.</dd></div>
        <div><dt>مرور الأيام</dt><dd>ساعة محاكاة، مع زر لتقديم الزمن.</dd></div>
      </dl>
    </div>
    <p class="fine">المستندات الثلاثة مسودات عمل، ومعايير الخدمة فيها استرشادية. العلامة المستخدمة أصلية وليست شعار «مناطق». مجسّمات المباني مولَّدة لهذا النموذج ولا تمثّل مباني قائمة.</p>
  </div>
</section>
</body>
</html>
`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);

const pdfPage = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await pdfPage.goto('file://' + path.join(OUT, 'index.html'));
await pdfPage.evaluate(() => document.fonts.ready);
await pdfPage.waitForTimeout(800);
await pdfPage.emulateMedia({ media: 'print' });
await pdfPage.pdf({ path: path.join(OUT, 'manateq-one-design.pdf'), width: '1600px', height: '1000px', printBackground: true });
await browser.close();
console.log('book', path.join(OUT, 'manateq-one-design.pdf'), `${PAGES.length + 3} pages`);
