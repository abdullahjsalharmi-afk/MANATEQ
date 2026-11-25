/**
 * Gallery section for the core: the type scale and colours, every core component in its states, the
 * shell (global bar, frosted bar, tab bar, action bar, footer) and the layout primitives.
 * Open the sheet on load with `#/gallery?sheet=core`.
 */
import { BadgeCheck, Bell, Building2, CircleCheck, Clock, CreditCard, Download, FileText, House, LayoutGrid, ListChecks, MapPinned, CircleUserRound, Search, Share, TriangleAlert, Wrench } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useQuery } from '@/app/routes';
import { getSolution, getZone } from '@/data/catalog';
import {
  Button,
  Card,
  Chip,
  ChipRow,
  Container,
  Footer,
  GlobalNav,
  Grid,
  Icon,
  IconButton,
  List,
  Mark,
  Pill,
  Render,
  Row,
  Section,
  Segmented,
  Sheet,
  TabBar,
  Tile,
  toast,
  type TabItem,
} from '@/design/core';
import { ActionBar, ScreenBar } from '@/design/Screen/Screen';

const strings = {
  // foundations
  typeHead: { ar: 'سلّم الخطوط', en: 'Type scale' },
  typeHint: { ar: 'الأوزان 300 و400 و600 و700 فقط. العناوين 600 والنص 17 بكسل بوزن 400.', en: 'Weights 300, 400, 600 and 700 only. Headlines are 600; body is 17 px at 400.' },
  sampleHero: { ar: 'خمسون خدمة. رحلة واحدة.', en: 'Fifty services. One journey.' },
  sampleDisplay: { ar: 'رخصة البناء. في خط واحد.', en: 'The building permit. In one line.' },
  sampleTitle: { ar: 'نعرف خطوتك التالية دائمًا.', en: 'We always know your next step.' },
  sampleHeading: { ar: 'طلبات جارية', en: 'Requests in progress' },
  sampleBody: {
    ar: 'تطبيق واحد يرافق المستثمر من الانضمام إلى التشغيل، ويعرض في كل لحظة مَن يحمل الطلب الآن.',
    en: 'One app goes with the investor from joining to operating, and shows at every moment who holds the request now.',
  },
  sampleCallout: { ar: 'عند وزارة البلدية · اليوم 2 من 5', en: 'With the Ministry of Municipality · day 2 of 5' },
  sampleFoot: { ar: 'معيار الخدمة استرشادي. البيانات توضيحية.', en: 'The service standard is indicative. The data is illustrative.' },
  colourHead: { ar: 'الألوان', en: 'Colour' },
  colourHint: { ar: 'لون مميّز واحد لكل سطح: العنّابي على الفاتح والذهبي على الداكن. ألوان الحالة ترافقها دائمًا كلمة أو أيقونة.', en: 'One accent per surface: maroon on light, gold on dark. Status colours always come with a word or an icon.' },

  // buttons
  buttonsHead: { ar: 'الأزرار', en: 'Buttons' },
  buttonsHint: { ar: 'كبسولات للإجراءات ومستطيلات صغيرة للأدوات. الضغط تصغير طفيف بلا تغيّر في اللون.', en: 'Pills for actions, compact rectangles for utility. Pressed is a slight scale-down with no colour jump.' },
  reviewSign: { ar: 'راجِع ووقّع', en: 'Review and sign' },
  payAmount: { ar: 'ادفع 30,000 ر.ق', en: 'Pay QAR 30,000' },
  learnMore: { ar: 'اعرف المزيد', en: 'Learn more' },
  cancelRequest: { ar: 'ألغِ الطلب', en: 'Cancel request' },
  track: { ar: 'تتبّع', en: 'Track' },
  details: { ar: 'التفاصيل', en: 'Details' },
  seeAll: { ar: 'عرض الكل', en: 'See all' },
  signInTawtheeq: { ar: 'الدخول عبر توثيق', en: 'Sign in with Tawtheeq' },
  utility: { ar: 'English', en: 'العربية' },
  reference: { ar: 'انسخ المرجع', en: 'Copy reference' },
  sending: { ar: 'جارٍ الإرسال', en: 'Sending' },
  unavailable: { ar: 'غير متاح', en: 'Unavailable' },
  download: { ar: 'نزّل الوثيقة', en: 'Download document' },
  startService: { ar: 'ابدأ الخدمة', en: 'Start the service' },
  notifications: { ar: 'الإشعارات', en: 'Notifications' },
  search: { ar: 'بحث', en: 'Search' },
  share: { ar: 'مشاركة', en: 'Share' },
  close: { ar: 'إغلاق', en: 'Close' },
  rowPills: { ar: 'الكبسولات', en: 'Pills' },
  rowSmall: { ar: 'الحجم الصغير', en: 'Small' },
  rowHero: { ar: 'زر الواجهة', en: 'Hero pill' },
  rowUtility: { ar: 'الأدوات', en: 'Utility' },
  rowStates: { ar: 'الحالات', en: 'States' },
  rowBlock: { ar: 'بعرض الحاوية', en: 'Block width' },
  rowIcons: { ar: 'أزرار الأيقونات', en: 'Icon buttons' },

  // the maroon tile and the dark tile
  brandEyebrow: { ar: 'خطوتك التالية', en: 'Your next step' },
  brandHeadline: { ar: 'وقّع عقد الإيجار', en: 'Sign the lease' },
  brandTagline: { ar: 'القطعة محجوزة لك حتى 30 نوفمبر.', en: 'The plot is held for you until 30 November.' },
  brandMore: { ar: 'و3 إجراءات أخرى', en: 'And 3 more actions' },
  checkActivity: { ar: 'افحص أهلية نشاطك', en: 'Check your activity' },
  seePlots: { ar: 'اعرض القطع', en: 'See the plots' },
  darkNote: { ar: 'كل مكوّن يُقرأ على الداكن: الرموز تتبدّل داخل البلاطة، واللون المميّز ذهبي.', en: 'Every component reads on dark: the tokens switch inside the tile, and the accent is gold.' },

  // cards
  cardsHead: { ar: 'البطاقات', en: 'Cards' },
  cardsHint: { ar: 'سطح أبيض بخط رفيع وزوايا 18 بكسل. بلا ظل، ولا بطاقة داخل بطاقة.', en: 'A white surface with a hairline and 18 px corners. No shadow, and never a card inside a card.' },
  selectedNote: { ar: 'مختارة: حدّ بسماكة 2 بكسل بلون التركيز', en: 'Selected: a 2 px border in the focus colour' },
  plainCard: { ar: 'بطاقة عادية', en: 'Plain card' },
  plainBody: { ar: 'الحشوة 20 بكسل على الهاتف و24 على الشاشات العريضة.', en: 'Padding is 20 px on phones and 24 px on wide screens.' },
  linkCard: { ar: 'بطاقة رابط', en: 'Link card' },
  linkBody: { ar: 'تنضغط كلها بتصغير 0.985.', en: 'The whole card presses with a 0.985 scale.' },
  outlineCard: { ar: 'بطاقة بخط فقط', en: 'Outline card' },
  outlineBody: { ar: 'شفافة، لمحتوى ثانوي.', en: 'Transparent, for secondary content.' },
  sunkenCard: { ar: 'بطاقة غائرة', en: 'Sunken card' },
  sunkenBody: { ar: 'للملاحظات الهادئة.', en: 'For quiet notes.' },
  onWhiteEyebrow: { ar: 'بطاقات على بلاطة بيضاء', en: 'Cards on a white tile' },
  onWhiteHeadline: { ar: 'ما تحصل عليه', en: 'What you receive' },
  onWhiteTagline: { ar: 'على الأبيض تأخذ البطاقة لون الصفحة بلا حدّ.', en: 'On white the card takes the page colour, with no border.' },
  receive1: { ar: 'رخصة بناء موقّعة إلكترونيًا', en: 'An e-signed building permit' },
  receive1Body: { ar: 'تُحفظ في محفظتك ويمكن التحقق منها برمز QR.', en: 'Kept in your wallet and verifiable by QR code.' },
  receive2: { ar: 'إشعار عند كل خطوة', en: 'A notice at every step' },
  receive2Body: { ar: 'تعرف دائمًا عند مَن طلبك الآن.', en: 'You always know who has your request now.' },
  receive3: { ar: 'سجل كامل للقرار', en: 'A full record of the decision' },
  receive3Body: { ar: 'بالتواريخ والجهات التي راجعت.', en: 'With the dates and the entities that reviewed it.' },

  // lists
  listsHead: { ar: 'القوائم', en: 'Lists' },
  listsHint: { ar: 'الفاصل يبدأ من حيث يبدأ النص ولا يمتد على العرض كله.', en: 'The divider starts where the text starts and never spans the full width.' },
  buildPermit: { ar: 'رخصة البناء', en: 'Building permit' },
  buildPermitSub: { ar: 'عند وزارة البلدية · اليوم 2 من 5', en: 'With the Ministry of Municipality · day 2 of 5' },
  inProgress: { ar: 'جارٍ', en: 'In progress' },
  maintenance: { ar: 'صيانة إنارة الطريق', en: 'Street lighting repair' },
  maintenanceSub: { ar: 'الفريق الميداني في الطريق إليك', en: 'The field team is on its way' },
  leaseCertificate: { ar: 'شهادة إيجار', en: 'Lease certificate' },
  issuedToday: { ar: 'صدرت اليوم', en: 'Issued today' },
  company: { ar: 'الشركة', en: 'Company' },
  companyValue: { ar: 'الريان للصناعات', en: 'Al Rayyan Industries' },
  plot: { ar: 'القطعة', en: 'Plot' },
  dueDate: { ar: 'تاريخ الاستحقاق', en: 'Due date' },
  dueDateValue: { ar: '5 ديسمبر 2026', en: '5 Dec 2026' },
  amount: { ar: 'المبلغ', en: 'Amount' },
  amountValue: { ar: '30,000 ر.ق', en: 'QAR 30,000' },

  // pills
  pillsHead: { ar: 'كبسولات الحالة', en: 'Status pills' },
  pillsHint: { ar: 'نص 12 بكسل مع نقطة أو أيقونة على لون خفيف.', en: '12 px text with a dot or an icon on a tint.' },
  neutral: { ar: 'يوم عمل واحد', en: 'One working day' },
  withYou: { ar: 'عندك', en: 'With you' },
  completed: { ar: 'مكتمل', en: 'Completed' },
  dueSoon: { ar: 'يستحق خلال 5 أيام', en: 'Due in 5 days' },
  overdue: { ar: 'متأخر', en: 'Overdue' },
  verified: { ar: 'موثّق', en: 'Verified' },
  withMinistry: { ar: 'عند وزارة البلدية', en: 'With the Ministry of Municipality' },
  automatic: { ar: 'تلقائية', en: 'Automatic' },
  fresh: { ar: 'جديد', en: 'New' },
  demo: { ar: 'دخول تجريبي', en: 'Demo sign-in' },

  // segmented and chips
  choiceHead: { ar: 'التبديل والاختيار', en: 'Switching and choosing' },
  choiceHint: { ar: 'المسار كبسولة غائرة بإبهام أبيض. الاختيار حدّ بسماكة 2 بكسل دون تغيير التعبئة.', en: 'The track is a sunken pill with a white thumb. Selection is a 2 px border; the fill does not change.' },
  status: { ar: 'الحالة', en: 'Status' },
  active: { ar: 'جارية', en: 'Active' },
  done: { ar: 'مكتملة', en: 'Completed' },
  view: { ar: 'العرض', en: 'View' },
  myJourney: { ar: 'رحلتي', en: 'My journey' },
  all: { ar: 'الكل', en: 'All' },
  map: { ar: 'خريطة', en: 'Map' },
  list: { ar: 'قائمة', en: 'List' },
  solutionType: { ar: 'نوع الحل', en: 'Solution type' },
  chipLogistics: { ar: 'لوجستي', en: 'Logistics' },
  chipIndustrial: { ar: 'صناعي', en: 'Industrial' },
  chipCommercial: { ar: 'تجاري', en: 'Commercial' },
  chipYard: { ar: 'ساحات مفتوحة', en: 'Open yards' },
  chipWarehousing: { ar: 'تخزين', en: 'Warehousing' },
  areaNeeded: { ar: 'المساحة المطلوبة', en: 'Area needed' },
  area1: { ar: '2,500 م²', en: '2,500 m²' },
  area2: { ar: '5,000 م²', en: '5,000 m²' },
  area3: { ar: '10,000 م²', en: '10,000 m²' },
  area1Price: { ar: '25,000 ر.ق سنويًا', en: 'QAR 25,000 a year' },
  area2Price: { ar: '50,000 ر.ق سنويًا', en: 'QAR 50,000 a year' },
  area3Price: { ar: 'غير متاحة في هذه المنطقة', en: 'Not available in this zone' },

  // sheet and toast
  overlayHead: { ar: 'الورقة والتنبيه', en: 'Sheet and toast' },
  overlayHint: { ar: 'الورقة تصعد من الأسفل على الهاتف وتتوسط الشاشة العريضة. التنبيه كبسولة بلون الحبر.', en: 'The sheet rises from the bottom on phones and is a centred dialog on wide screens. The toast is an ink pill.' },
  openSheet: { ar: 'افتح الورقة', en: 'Open the sheet' },
  showToast: { ar: 'أظهر تنبيهًا', en: 'Show a toast' },
  toastWithAction: { ar: 'تنبيه مع إجراء', en: 'Toast with an action' },
  toastSent: { ar: 'تم إرسال طلبك', en: 'Your request was sent' },
  toastSaved: { ar: 'حُفظت المسودة', en: 'Draft saved' },
  undo: { ar: 'تراجع', en: 'Undo' },
  sheetTitle: { ar: 'ادفع الفاتورة', en: 'Pay the invoice' },
  sheetDescription: { ar: 'إيجار الربع الرابع 2026', en: 'Rent for the fourth quarter of 2026' },

  // mark
  markHead: { ar: 'العلامة', en: 'The mark' },
  markHint: { ar: 'أربع قطع، إحداها لك. بلون واحد يأخذ لون النص حيثما وقف.', en: 'Four plots, one of them yours. One colour: it takes the text colour of wherever it stands.' },
  appName: { ar: 'مناطق ون', en: 'Manateq One' },

  // shell
  shellHead: { ar: 'هيكل التطبيق', en: 'The shell' },
  shellHint: { ar: 'على الهاتف: شريط زجاجي في الأعلى وشريط تبويب في الأسفل. من 834 بكسل: الشريط العام الأسود والتذييل.', en: 'Phones: a frosted bar at the top and the tab bar at the bottom. From 834 px: the black global bar and the footer.' },
  globalBar: { ar: 'الشريط العام (من 834 بكسل)', en: 'Global bar (from 834 px)' },
  frostedBar: { ar: 'الشريط الزجاجي', en: 'Frosted bar' },
  tabBar: { ar: 'شريط التبويب (الهاتف)', en: 'Tab bar (phones)' },
  actionBar: { ar: 'شريط الإجراء الثابت', en: 'Sticky action bar' },
  footer: { ar: 'التذييل (من 834 بكسل)', en: 'Footer (from 834 px)' },
  navLabel: { ar: 'نموذج التنقّل', en: 'Navigation specimen' },
  tabHome: { ar: 'الرئيسية', en: 'Home' },
  tabServices: { ar: 'الخدمات', en: 'Services' },
  tabRequests: { ar: 'طلباتي', en: 'Requests' },
  tabZones: { ar: 'المناطق', en: 'Zones' },
  tabAccount: { ar: 'حسابي', en: 'Account' },
  barRoot: { ar: 'الخدمات', en: 'Services' },
  barInner: { ar: 'رخصة البناء', en: 'Building permit' },
  barFlow: { ar: 'تصريح دخول', en: 'Gate pass' },
  saveExit: { ar: 'احفظ واخرج', en: 'Save and exit' },
  back: { ar: 'رجوع', en: 'Back' },
  contextEstimate: { ar: 'التقدير', en: 'Estimate' },
  contextEstimateValue: { ar: '50,000 ر.ق سنويًا', en: 'QAR 50,000 a year' },
  contextStep: { ar: 'الخطوة 2 من 4', en: 'Step 2 of 4' },
  continue: { ar: 'متابعة', en: 'Continue' },
  applyForLand: { ar: 'قدّم على أرض', en: 'Apply for land' },
  footerLabel: { ar: 'نموذج التذييل', en: 'Footer specimen' },
  footServices: { ar: 'الخدمات', en: 'Services' },
  footAllServices: { ar: 'كل الخدمات', en: 'All services' },
  footRequests: { ar: 'طلباتي', en: 'My requests' },
  footZones: { ar: 'المناطق', en: 'Zones' },
  footZonesMap: { ar: 'خريطة المناطق', en: 'Zones map' },
  footSolutions: { ar: 'الحلول والأسعار', en: 'Solutions and prices' },
  footAbout: { ar: 'عن النموذج', en: 'About the prototype' },
  footPrivacy: { ar: 'الخصوصية', en: 'Privacy' },
  footAccessibility: { ar: 'إمكانية الوصول', en: 'Accessibility' },
  footNote: { ar: 'مناطق ون نسخة تجريبية للعرض. جميع البيانات توضيحية.', en: 'Manateq One is a prototype for demonstration. All data is illustrative.' },
  footEdition: { ar: 'دليل الخدمات، الإصدار 4.1', en: 'Service Guide, version 4.1' },

  // layout
  layoutHead: { ar: 'عناصر التخطيط', en: 'Layout primitives' },
  layoutHint: { ar: 'البلاطة تمتد على العرض كله، والحاوية عمود في الوسط، والشبكة تزيد أعمدتها مع العرض.', en: 'A tile is full-bleed, a container is a centred column, and the grid gains columns with the width.' },
  gridFour: { ar: 'شبكة مضغوطة بأربعة أعمدة: للاختصارات', en: 'Compact grid of four: for shortcuts' },
  shortcut1: { ar: 'بلاغ صيانة', en: 'Report a fault' },
  shortcut2: { ar: 'تصريح دخول', en: 'Gate pass' },
  shortcut3: { ar: 'كشف حساب', en: 'Statement' },
  shortcut4: { ar: 'احجز موعدًا', en: 'Book a visit' },
  widths: { ar: 'عرض الحاوية', en: 'Container widths' },
  widthForm: { ar: 'النماذج والمسارات: 692 بكسل', en: 'Forms and flows: 692 px' },
  widthContent: { ar: 'القراءة والقوائم: 980 بكسل', en: 'Reading and lists: 980 px' },
  widthGrid: { ar: 'شبكات البطاقات: 1440 بكسل', en: 'Card grids: 1440 px' },
  tileEyebrow: { ar: 'بلاطة بلون الصفحة', en: 'A parchment tile' },
  tileHeadline: { ar: 'خمسة حلول. سعر منشور.', en: 'Five solutions. Published prices.' },
  tileTagline: { ar: 'اختر ما يناسب نشاطك ثم افحص أهليته.', en: 'Choose what suits your activity, then check its eligibility.' },
  checkEligibility: { ar: 'افحص الأهلية', en: 'Check eligibility' },
  seeSolutions: { ar: 'اعرض الحلول', en: 'See the solutions' },
} as const;

const TYPE: readonly { cls: string; token: string; spec: string; sample: keyof typeof strings }[] = [
  { cls: 'type-hero', token: '--t-hero', spec: '40 / 56 · 600', sample: 'sampleHero' },
  { cls: 'type-display', token: '--t-display', spec: '34 · 600', sample: 'sampleDisplay' },
  { cls: 'type-title', token: '--t-title', spec: '28 · 400', sample: 'sampleTitle' },
  { cls: 'type-heading', token: '--t-heading', spec: '21 · 600', sample: 'sampleHeading' },
  { cls: 'type-body', token: '--t-body', spec: '17 · 400', sample: 'sampleBody' },
  { cls: 'type-callout', token: '--t-callout', spec: '14 · 400', sample: 'sampleCallout' },
  { cls: 'type-foot', token: '--t-foot', spec: '12 · 400', sample: 'sampleFoot' },
];

const COLOURS: readonly string[] = ['--bg', '--surface', '--surface-2', '--sunken', '--tile-1', '--black', '--brand', '--accent', '--gold', '--gold-line', '--ink', '--ink-2', '--ink-3', '--line-strong', '--ok', '--warn', '--bad', '--info'];

const cluster: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--s-3)' };
const stack: CSSProperties = { display: 'grid', gap: 'var(--s-5)' };
const meta: CSSProperties = { color: 'var(--ink-3)' };
const frame: CSSProperties = { overflow: 'hidden', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', background: 'var(--bg)' };
/** Bars are shown at the true width of a phone: below 735 px the frame bleeds to the screen edges and loses its corners. */
const WIDE = 'calc((100vw - 735px) * 9999)';
const barFrame: CSSProperties = { ...frame, marginInline: `clamp(calc(var(--gutter) * -1), ${WIDE}, 0px)`, borderInlineWidth: `clamp(0px, ${WIDE}, 1px)`, borderRadius: `clamp(0px, ${WIDE}, var(--r-card))` };
const filler: CSSProperties = { padding: 'var(--s-6) var(--gutter)', color: 'var(--ink-3)' };
const cardTitle: CSSProperties = { fontSize: 'var(--t-body)', fontWeight: 600, letterSpacing: 'var(--ls-body)' };
const cardBody: CSSProperties = { marginBlockStart: 'var(--s-1)', color: 'var(--ink-3)' };
const swatch: CSSProperties = { height: 44, border: '1px solid var(--line)', borderRadius: 'var(--r-tile)' };
const darkStack: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--s-6)', justifyItems: 'center' };
const darkCard: CSSProperties = { width: 'min(100%, 420px)' };
const widthBar: CSSProperties = { height: 8, borderRadius: 'var(--r-pill)', background: 'var(--sunken)', marginInline: 'auto' };

/** A labelled row of specimens inside a card. */
function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="type-foot" style={{ ...meta, marginBlockEnd: 'var(--s-2)' }}>
        {label}
      </p>
      {children}
    </div>
  );
}

export function CoreGallery() {
  const t = useT(strings);
  const { fmt, pick } = useLang();
  const query = useQuery();
  const [view, setView] = useState<'active' | 'done'>('active');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [chip, setChip] = useState('logistics');
  const [area, setArea] = useState('a2');
  const [solution, setSolution] = useState<string>('logistics');
  const [sheet, setSheet] = useState(query.sheet === 'core');

  const tabs: TabItem[] = [
    { key: 'home', to: '/gallery', label: t('tabHome'), icon: House },
    { key: 'services', to: '/gallery', label: t('tabServices'), icon: LayoutGrid },
    { key: 'requests', to: '/gallery', label: t('tabRequests'), icon: ListChecks, badge: 2 },
    { key: 'zones', to: '/gallery', label: t('tabZones'), icon: MapPinned },
    { key: 'account', to: '/gallery', label: t('tabAccount'), icon: CircleUserRound },
  ];
  const chips: [string, string][] = [
    ['logistics', t('chipLogistics')],
    ['industrial', t('chipIndustrial')],
    ['commercial', t('chipCommercial')],
    ['yard', t('chipYard')],
    ['warehousing', t('chipWarehousing')],
  ];
  // Real names and published prices, from the catalogue.
  const zone = getZone('BA');
  const logistics = getSolution('logistics');
  const products = (
    [
      ['industrial', 'factory'],
      ['logistics', 'warehouse'],
      ['warehousing', 'units'],
    ] as const
  ).flatMap(([key, render]) => {
    const found = getSolution(key);
    return found ? [{ key, render, name: pick(found.name), price: pick(found.price.text) }] : [];
  });

  return (
    <>
      <Container>
        <Section title={t('typeHead')} hint={t('typeHint')}>
          <Card>
            <div style={stack}>
              {TYPE.map((row) => (
                <div key={row.token}>
                  <p className={row.cls}>{t(row.sample)}</p>
                  <p className="type-foot ltr" style={{ ...meta, marginBlockStart: 'var(--s-1)' }}>
                    {row.token} · {row.spec}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        <Section title={t('colourHead')} hint={t('colourHint')}>
          <Card>
            <Grid columns={4} compact>
              {COLOURS.map((token) => (
                <div key={token}>
                  <div style={{ ...swatch, background: `var(${token})` }} />
                  <p className="type-foot ltr" style={{ ...meta, marginBlockStart: 'var(--s-1)' }}>
                    {token}
                  </p>
                </div>
              ))}
            </Grid>
          </Card>
        </Section>

        <Section title={t('buttonsHead')} hint={t('buttonsHint')}>
          <Card>
            <div style={stack}>
              <Specimen label={t('rowPills')}>
                <div style={cluster}>
                  <Button>{t('reviewSign')}</Button>
                  <Button variant="secondary" icon={CreditCard}>
                    {t('payAmount')}
                  </Button>
                  <Button variant="quiet" to="/gallery">
                    {t('learnMore')}
                  </Button>
                  <Button variant="danger">{t('cancelRequest')}</Button>
                  <Button variant="secondary" tone="danger">
                    {t('cancelRequest')}
                  </Button>
                  <Button variant="quiet" tone="danger">
                    {t('cancelRequest')}
                  </Button>
                </div>
              </Specimen>
              <Specimen label={t('rowSmall')}>
                <div style={cluster}>
                  <Button size="sm">{t('track')}</Button>
                  <Button size="sm" variant="secondary">
                    {t('details')}
                  </Button>
                  <Button size="sm" variant="quiet" to="/gallery">
                    {t('seeAll')}
                  </Button>
                </div>
              </Specimen>
              <Specimen label={t('rowHero')}>
                <div style={cluster}>
                  <Button size="lg">{t('signInTawtheeq')}</Button>
                </div>
              </Specimen>
              <Specimen label={t('rowUtility')}>
                <div style={cluster}>
                  <Button variant="utility">{t('utility')}</Button>
                  <Button variant="utility" icon={Download}>
                    {t('download')}
                  </Button>
                  <Button variant="pearl">{t('reference')}</Button>
                  <Button variant="pearl" icon={Share}>
                    {t('share')}
                  </Button>
                </div>
              </Specimen>
              <Specimen label={t('rowStates')}>
                <div style={cluster}>
                  <Button loading>{t('sending')}</Button>
                  <Button variant="secondary" loading>
                    {t('sending')}
                  </Button>
                  <Button disabled>{t('unavailable')}</Button>
                  <Button variant="secondary" disabled>
                    {t('unavailable')}
                  </Button>
                  <Button variant="quiet" disabled>
                    {t('unavailable')}
                  </Button>
                </div>
              </Specimen>
              <Specimen label={t('rowBlock')}>
                <div style={{ display: 'grid', gap: 'var(--s-3)' }}>
                  <Button block>{t('startService')}</Button>
                  <Button block variant="secondary">
                    {t('details')}
                  </Button>
                </div>
              </Specimen>
              <Specimen label={t('rowIcons')}>
                <div style={cluster}>
                  <IconButton icon={Search} label={t('search')} />
                  <IconButton icon={Bell} label={t('notifications')} badge={3} />
                  <IconButton icon={Bell} label={t('notifications')} badge />
                  <IconButton icon={Share} label={t('share')} variant="soft" />
                  <IconButton icon={Search} label={t('close')} variant="soft" size="sm" />
                </div>
              </Specimen>
            </div>
          </Card>
        </Section>
      </Container>

      <Tile
        tone="brand"
        eyebrow={t('brandEyebrow')}
        headline={t('brandHeadline')}
        tagline={t('brandTagline')}
        actions={
          <>
            <Button>{t('reviewSign')}</Button>
            <Button variant="secondary">{t('details')}</Button>
          </>
        }
        media={<Render name="plot" decorative />}
      >
        <Button variant="quiet" to="/gallery">
          {t('brandMore')}
        </Button>
      </Tile>

      <Tile
        tone="dark"
        eyebrow={zone ? pick(zone.typeLabel) : undefined}
        headline={zone ? pick(zone.name) : undefined}
        tagline={logistics ? pick(logistics.price.text) : undefined}
        actions={
          <>
            <Button>{t('checkActivity')}</Button>
            <Button variant="secondary">{t('seePlots')}</Button>
          </>
        }
        media={<Render name="zone" decorative />}
      >
        <div style={darkStack}>
          <p className="type-callout" style={meta}>
            {t('darkNote')}
          </p>
          <div style={{ ...cluster, justifyContent: 'center' }}>
            <Button variant="quiet" to="/gallery">
              {t('learnMore')}
            </Button>
            <Button variant="danger">{t('cancelRequest')}</Button>
            <Button variant="utility">{t('utility')}</Button>
            <Button variant="pearl">{t('reference')}</Button>
            <Button disabled>{t('unavailable')}</Button>
            <IconButton icon={Bell} label={t('notifications')} badge={3} />
            <IconButton icon={Share} label={t('share')} variant="soft" />
          </div>
          <div style={{ ...cluster, justifyContent: 'center' }}>
            <Pill>{t('neutral')}</Pill>
            <Pill tone="accent">{t('withYou')}</Pill>
            <Pill tone="gold" icon={BadgeCheck}>
              {t('verified')}
            </Pill>
            <Pill tone="ok" icon={CircleCheck}>
              {t('completed')}
            </Pill>
            <Pill tone="warn" icon={Clock}>
              {t('dueSoon')}
            </Pill>
            <Pill tone="bad" icon={TriangleAlert}>
              {t('overdue')}
            </Pill>
          </div>
          <div style={darkCard}>
            <Segmented
              label={t('status')}
              value={view}
              onChange={setView}
              options={[
                { value: 'active', label: t('active'), count: 3 },
                { value: 'done', label: t('done'), count: 12 },
              ]}
            />
          </div>
          <ChipRow label={t('solutionType')} wrap>
            {chips.slice(0, 3).map(([value, label]) => (
              <Chip key={value} selected={chip === value} onClick={() => setChip(value)}>
                {label}
              </Chip>
            ))}
          </ChipRow>
          <div style={darkCard}>
            <List>
              <Row leading={<Icon icon={Building2} />} title={t('buildPermit')} subtitle={t('buildPermitSub')} to="/gallery" />
              <Row leading={<Icon icon={FileText} />} title={t('leaseCertificate')} subtitle={t('issuedToday')} trailing="PDF" />
            </List>
          </div>
        </div>
      </Tile>

      <Container width="grid">
        <Section title={t('cardsHead')} hint={t('cardsHint')}>
          <Grid>
            {products.map((product) => (
              <Card key={product.key} media={<Render name={product.render} decorative />} onClick={() => setSolution(product.key)} selected={solution === product.key}>
                <h3 style={cardTitle}>{product.name}</h3>
                <p style={cardBody}>{product.price}</p>
                {solution === product.key ? (
                  <p className="type-foot" style={{ ...meta, marginBlockStart: 'var(--s-3)' }}>
                    {t('selectedNote')}
                  </p>
                ) : null}
              </Card>
            ))}
          </Grid>
          <Grid columns={4}>
            <Card>
              <h3 style={cardTitle}>{t('plainCard')}</h3>
              <p style={cardBody}>{t('plainBody')}</p>
            </Card>
            <Card to="/gallery">
              <h3 style={cardTitle}>{t('linkCard')}</h3>
              <p style={cardBody}>{t('linkBody')}</p>
            </Card>
            <Card tone="outline">
              <h3 style={cardTitle}>{t('outlineCard')}</h3>
              <p style={cardBody}>{t('outlineBody')}</p>
            </Card>
            <Card tone="sunken">
              <h3 style={cardTitle}>{t('sunkenCard')}</h3>
              <p style={cardBody}>{t('sunkenBody')}</p>
            </Card>
          </Grid>
        </Section>
      </Container>

      <Tile tone="light" eyebrow={t('onWhiteEyebrow')} headline={t('onWhiteHeadline')} tagline={t('onWhiteTagline')}>
        <Grid>
          {(
            [
              ['receive1', 'receive1Body'],
              ['receive2', 'receive2Body'],
              ['receive3', 'receive3Body'],
            ] as const
          ).map(([title, body]) => (
            <Card key={title} tone="parchment">
              <h3 style={cardTitle}>{t(title)}</h3>
              <p style={cardBody}>{t(body)}</p>
            </Card>
          ))}
        </Grid>
      </Tile>

      <Container>
        <Section title={t('listsHead')} hint={t('listsHint')} action={{ label: t('seeAll'), to: '/gallery' }}>
          <List>
            <Row to="/gallery" leading={<Icon icon={Building2} />} title={t('buildPermit')} subtitle={t('buildPermitSub')} trailing={<Pill tone="accent">{t('inProgress')}</Pill>} />
            <Row to="/gallery" leading={<Icon icon={Wrench} />} title={t('maintenance')} subtitle={t('maintenanceSub')} />
            <Row leading={<Icon icon={FileText} />} eyebrow={fmt.ltr('MQ-2611-0042')} title={t('leaseCertificate')} subtitle={t('issuedToday')} trailing="PDF" />
          </List>
          <List>
            <Row title={t('company')} trailing={t('companyValue')} />
            <Row title={t('plot')} trailing={fmt.ltr('BA-214')} />
            <Row title={t('dueDate')} trailing={t('dueDateValue')} to="/gallery" />
          </List>
        </Section>

        <Section title={t('pillsHead')} hint={t('pillsHint')}>
          <Card>
            <div style={cluster}>
              <Pill>{t('neutral')}</Pill>
              <Pill>{t('automatic')}</Pill>
              <Pill tone="accent">{t('withYou')}</Pill>
              <Pill tone="gold" icon={BadgeCheck}>
                {t('verified')}
              </Pill>
              <Pill tone="info">{t('withMinistry')}</Pill>
              <Pill tone="ok" icon={CircleCheck}>
                {t('completed')}
              </Pill>
              <Pill tone="ok">{t('completed')}</Pill>
              <Pill tone="warn" icon={Clock}>
                {t('dueSoon')}
              </Pill>
              <Pill tone="bad" icon={TriangleAlert}>
                {t('overdue')}
              </Pill>
              <Pill tone="accent" solid>
                {t('fresh')}
              </Pill>
              <Pill solid>{t('demo')}</Pill>
            </div>
          </Card>
        </Section>

        <Section title={t('choiceHead')} hint={t('choiceHint')}>
          <Segmented
            label={t('status')}
            value={view}
            onChange={setView}
            options={[
              { value: 'active', label: t('active'), count: 3 },
              { value: 'done', label: t('done'), count: 12 },
            ]}
          />
          <div style={cluster}>
            <Segmented
              inline
              label={t('view')}
              value={scope}
              onChange={setScope}
              options={[
                { value: 'mine', label: t('myJourney') },
                { value: 'all', label: t('all') },
              ]}
            />
            <Segmented
              inline
              size="sm"
              label={t('view')}
              value={mode}
              onChange={setMode}
              options={[
                { value: 'map', label: t('map') },
                { value: 'list', label: t('list') },
              ]}
            />
          </div>
          <ChipRow label={t('solutionType')}>
            {chips.map(([value, label]) => (
              <Chip key={value} selected={chip === value} onClick={() => setChip(value)}>
                {label}
              </Chip>
            ))}
          </ChipRow>
          <Grid aria-label={t('areaNeeded')} role="group">
            <Chip selected={area === 'a1'} onClick={() => setArea('a1')} detail={t('area1Price')}>
              {t('area1')}
            </Chip>
            <Chip selected={area === 'a2'} onClick={() => setArea('a2')} detail={t('area2Price')}>
              {t('area2')}
            </Chip>
            <Chip disabled detail={t('area3Price')}>
              {t('area3')}
            </Chip>
          </Grid>
        </Section>

        <Section title={t('overlayHead')} hint={t('overlayHint')}>
          <div style={cluster}>
            <Button variant="secondary" onClick={() => setSheet(true)}>
              {t('openSheet')}
            </Button>
            <Button variant="secondary" onClick={() => toast(t('toastSent'))}>
              {t('showToast')}
            </Button>
            <Button variant="secondary" onClick={() => toast(t('toastSaved'), { tone: 'info', action: { label: t('undo'), onClick: () => undefined } })}>
              {t('toastWithAction')}
            </Button>
          </div>
          <Sheet
            open={sheet}
            onClose={() => setSheet(false)}
            title={t('sheetTitle')}
            description={t('sheetDescription')}
            footer={
              <Button block onClick={() => setSheet(false)}>
                {t('payAmount')}
              </Button>
            }
          >
            <List variant="plain">
              <Row title={t('plot')} trailing={fmt.ltr('BA-214')} />
              <Row title={t('dueDate')} trailing={t('dueDateValue')} />
              <Row title={t('amount')} trailing={t('amountValue')} />
            </List>
          </Sheet>
        </Section>

        <Section title={t('markHead')} hint={t('markHint')}>
          <Card>
            <div style={{ ...cluster, gap: 'var(--s-6)' }}>
              <Mark size={16} />
              <Mark size={24} />
              <Mark size={40} label={t('appName')} />
              <Mark size={64} />
              <Mark size={64} variant="tile" />
              <Mark size={40} variant="tile" />
              <span style={{ ...cluster, gap: 'var(--s-2)', color: 'var(--accent-ink)' }}>
                <Mark size={24} />
                <span style={cardTitle}>{t('appName')}</span>
              </span>
              <span data-tone="dark" style={{ ...cluster, gap: 'var(--s-2)', padding: 'var(--s-3) var(--s-4)', borderRadius: 'var(--r-tile)', background: 'var(--black)' }}>
                <Mark size={16} />
                <span className="type-callout" style={{ fontWeight: 600 }}>
                  {t('appName')}
                </span>
              </span>
            </div>
          </Card>
        </Section>

        <Section title={t('shellHead')} hint={t('shellHint')}>
          <Specimen label={t('globalBar')}>
            <div style={frame}>
              <GlobalNav inline label={t('navLabel')} items={tabs} activeKey="services" brand={t('appName')} homeTo="/gallery" search={{ to: '/gallery', label: t('search') }} language={{ name: t('utility'), lang: 'en', onSwitch: () => undefined }} />
            </div>
          </Specimen>
          <Specimen label={t('frostedBar')}>
            <div style={stack}>
              <div style={barFrame}>
                <ScreenBar inline title={t('barRoot')} actions={<IconButton icon={Search} label={t('search')} />} />
              </div>
              <div style={barFrame}>
                <ScreenBar
                  inline
                  line
                  title={t('barInner')}
                  nav="back"
                  navLabel={t('back')}
                  actions={
                    <>
                      <IconButton icon={Share} label={t('share')} />
                      <IconButton icon={Bell} label={t('notifications')} badge={2} />
                    </>
                  }
                />
              </div>
              <div style={barFrame}>
                <ScreenBar
                  inline
                  line
                  title={t('barFlow')}
                  nav="close"
                  navLabel={t('close')}
                  actions={
                    <Button variant="quiet" size="sm">
                      {t('saveExit')}
                    </Button>
                  }
                />
              </div>
            </div>
          </Specimen>
          <Specimen label={t('tabBar')}>
            <div style={{ ...barFrame, maxWidth: 420 }}>
              <TabBar inline items={tabs} activeKey="services" label={t('navLabel')} />
            </div>
          </Specimen>
          <Specimen label={t('actionBar')}>
            <div style={stack}>
              <div style={barFrame}>
                <p className="type-callout" style={filler}>
                  {t('sampleCallout')}
                </p>
                <ActionBar
                  inline
                  context={
                    <>
                      {t('contextEstimate')} <strong>{t('contextEstimateValue')}</strong>
                    </>
                  }
                >
                  <Button block>{t('applyForLand')}</Button>
                </ActionBar>
              </div>
              <div style={barFrame}>
                <ActionBar inline context={t('contextStep')} width="form">
                  <Button block>{t('continue')}</Button>
                </ActionBar>
              </div>
            </div>
          </Specimen>
          <Specimen label={t('footer')}>
            <div style={frame}>
              <Footer
                inline
                label={t('footerLabel')}
                columns={[
                  {
                    title: t('footServices'),
                    links: [
                      { label: t('footAllServices'), to: '/gallery' },
                      { label: t('footRequests'), to: '/gallery' },
                    ],
                  },
                  {
                    title: t('footZones'),
                    links: [
                      { label: t('footZonesMap'), to: '/gallery' },
                      { label: t('footSolutions'), to: '/gallery' },
                    ],
                  },
                  {
                    title: t('footAbout'),
                    links: [
                      { label: t('footPrivacy'), to: '/gallery' },
                      { label: t('footAccessibility'), to: '/gallery' },
                    ],
                  },
                ]}
                note={t('footNote')}
                edition={t('footEdition')}
              />
            </div>
          </Specimen>
        </Section>

        <Section title={t('layoutHead')} hint={t('layoutHint')}>
          <Specimen label={t('gridFour')}>
            <Grid columns={4} compact>
              {[
                [Wrench, t('shortcut1')] as const,
                [MapPinned, t('shortcut2')] as const,
                [FileText, t('shortcut3')] as const,
                [Clock, t('shortcut4')] as const,
              ].map(([icon, label]) => (
                <Card key={label} to="/gallery">
                  <Icon icon={icon} />
                  <p style={{ ...cardTitle, marginBlockStart: 'var(--s-3)' }}>{label}</p>
                </Card>
              ))}
            </Grid>
          </Specimen>
          <Specimen label={t('widths')}>
            <Card>
              <div style={{ display: 'grid', gap: 'var(--s-4)' }}>
                {(
                  [
                    ['widthForm', '48%'],
                    ['widthContent', '68%'],
                    ['widthGrid', '100%'],
                  ] as const
                ).map(([label, width]) => (
                  <div key={label}>
                    <div style={{ ...widthBar, width }} />
                    <p className="type-foot" style={{ ...meta, marginBlockStart: 'var(--s-1)', textAlign: 'center' }}>
                      {t(label)}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </Specimen>
        </Section>
      </Container>

      <Tile
        tone="parchment"
        eyebrow={t('tileEyebrow')}
        headline={t('tileHeadline')}
        tagline={t('tileTagline')}
        actions={
          <>
            <Button>{t('checkEligibility')}</Button>
            <Button variant="secondary">{t('seeSolutions')}</Button>
          </>
        }
        media={<Render name="journey" mirrorInRtl decorative />}
        mediaWidth="wide"
      />
    </>
  );
}
