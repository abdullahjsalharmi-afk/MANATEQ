// Builds the design book from the running app: real screens, captured from the single-file build and laid out
// as pages in the app's own design language.
//
//   npm run build:single && node scripts/build-design-book.mjs
//
// Writes docs/design/shots/*.jpg, docs/design/index.html and docs/design/manateq-one-design.pdf.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const APP = path.join(ROOT, 'preview', 'index.html');
const OUT = path.join(ROOT, 'docs', 'design');
const SHOTS = path.join(OUT, 'shots');
if (!fs.existsSync(APP)) {
  console.error('missing preview/index.html: run "npm run build:single" first');
  process.exit(1);
}
fs.mkdirSync(SHOTS, { recursive: true });

const PHONE = { width: 390, height: 844 };
const DESK = { width: 1280, height: 800 };

/**
 * The pages of the book. Each shot: id, route, and optionally demo (tenant by default), lang, theme, desk, tall
 * (a taller phone capture for long screens) and `after` (a small interaction before the capture).
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
      { id: 'd1', route: '/start/D1' },
      { id: 'd2', route: '/start/D2' },
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
    notes: ['من 834 بكسل يظهر الشريط العلوي والتذييل وتتعدد الأعمدة.'],
    desk: true,
    shots: [
      { id: 'desk-home', route: '/', desk: true, tall: 1500 },
      { id: 'desk-zone', route: '/zones/BA', desk: true, tall: 1500 },
    ],
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
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(SHOTS, `${shot.id}.jpg`), type: 'jpeg', quality: 90 });
    console.log('shot', shot.id);
  }
}
for (const session of sessions.values()) await session.context.close();

// ---------------------------------------------------------------------------------------------------------
// The book: one landscape page per chapter, in the app's own language (tokens copied from src/design/tokens.css).
const fontDir = path.relative(OUT, path.join(ROOT, 'src', 'assets', 'fonts')).split(path.sep).join('/');
const renderDir = path.relative(OUT, path.join(ROOT, 'src', 'assets', 'renders')).split(path.sep).join('/');
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
figure { flex: 0 1 auto; min-width: 0; border-radius: 36px; overflow: hidden; background: var(--surface); border: 1px solid var(--line); filter: drop-shadow(3px 5px 30px rgba(35,31,32,.16)); }
figure.phone { max-height: 100%; }
figure.phone img { display: block; width: 300px; max-height: 872px; object-fit: cover; object-position: top; }
figure.wide { border-radius: 14px; }
figure.wide img { display: block; width: 540px; max-height: 760px; object-fit: cover; object-position: top; }
.cover { width: 1600px; height: 1000px; margin: 0 auto; background: var(--brand); color: #fff; display: grid; grid-template-columns: 1fr 1fr; align-items: center; padding: 80px 96px; break-after: page; overflow: hidden; }
.cover .eyebrow { color: var(--gold-on-dark); font-size: 16px; }
.cover h1 { font-size: 84px; font-weight: 700; line-height: 1.2; margin-block: 12px 20px; }
.cover p.lead { color: rgba(255,255,255,.88); font-size: 26px; }
.cover .fine { margin-block-start: 48px; font-size: 14px; color: rgba(255,255,255,.76); max-width: 30em; }
.cover img { width: 100%; filter: drop-shadow(3px 5px 30px rgba(0,0,0,.36)); }
.system { width: 1600px; height: 1000px; margin: 0 auto; background: var(--surface); padding: 64px 80px; display: grid; grid-template-columns: 420px 1fr; gap: 56px; align-items: center; break-after: page; overflow: hidden; }
.swatches { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
.swatch { border-radius: 18px; border: 1px solid var(--line); overflow: hidden; }
.swatch i { display: block; height: 120px; }
.swatch b { display: block; padding: 12px 16px 2px; font-size: 16px; }
.swatch span { display: block; padding: 0 16px 14px; font-size: 13px; color: var(--ink-3); direction: ltr; text-align: end; }
.renders { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px 20px; margin-block-start: 28px; align-items: center; }
.renders img { width: 100%; filter: drop-shadow(3px 5px 24px rgba(35,31,32,.18)); }
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
  <div><img src="${renderDir}/zone.webp" alt=""></div>
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
    <div class="renders">
      ${['plot', 'construction', 'warehouse', 'factory', 'showroom', 'yard', 'units', 'gate'].map((name) => `<img src="${renderDir}/${name}.webp" alt="">`).join('')}
    </div>
  </div>
</section>
${PAGES.map((def, index) => chapter(def, index + 1)).join('\n')}
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
console.log('book', path.join(OUT, 'manateq-one-design.pdf'), `${PAGES.length + 2} pages`);
