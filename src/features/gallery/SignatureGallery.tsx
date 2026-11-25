/**
 * Gallery section: the signature components in every state, with realistic content:
 * the next step as the dark hero tile and as quiet cards, a building-permit request at the Ministry of
 * Municipality on day 2 of 5, the four journey stations, a lease contract, a worker pass, the map and
 * a plot layout, and the same components placed on a dark tile.
 */
import { useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { getIntegration, getService, getZone } from '@/data/catalog';
import type { Lane } from '@/data/types';
import { Card, Chip, ChipRow, Grid, List, Row, Section, toast } from '@/design/core';
import { QR } from '@/design/QR/QR';
import { Render } from '@/design/Render/Render';
import {
  DocCard,
  FetchedList,
  HolderChip,
  JourneyRibbon,
  LevelMeter,
  NextStepCard,
  PassCard,
  PlotGrid,
  QatarMap,
  Ring,
  StandardBadge,
  Timeline,
  type FetchedItem,
  type JourneyStation,
  type TimelineItem,
} from '@/design/signature';
import { plotsFor } from '@/domain/plots';

/** The plot grid sample: plots smaller than this do not fit the sample request, so they show as not selectable. */
const UNFIT_BELOW_SQM = 2500;
import { dayOf, timeLeft } from '@/domain/standard';

/** Sample content of this gallery page. Everything here is illustrative. */
const demo = {
  // next step: the hero tile
  heroEyebrow: { ar: 'خطوتك التالية', en: 'Your next step' },
  heroTitle: { ar: 'قدّم طلب رخصة البناء', en: 'Apply for your building permit' },
  heroContext: { ar: 'شهادة عدم الممانعة على التصميم جاهزة.', en: 'Your design no-objection certificate is ready.' },
  heroCta: { ar: 'ابدأ الطلب', en: 'Start the application' },
  heroSecondary: { ar: 'ما المطلوب', en: 'What you need' },
  // next step: the quiet cards
  nextEyebrow: { ar: 'الخطوة التالية', en: 'Next step' },
  nextTitle: { ar: 'وقّع عقد الإيجار', en: 'Sign your lease contract' },
  nextContext: { ar: 'القطعة BA-117 محجوزة لك حتى 30 نوفمبر.', en: 'Plot BA-117 is reserved for you until 30 November.' },
  nextDue: { ar: 'خلال 5 أيام', en: 'In 5 days' },
  nextCta: { ar: 'راجِع ووقّع', en: 'Review and sign' },
  nextMore: { ar: 'و3 إجراءات أخرى', en: 'And 3 more actions' },
  clearEyebrow: { ar: 'اليوم', en: 'Today' },
  runningTitle: { ar: 'منشأتك تعمل', en: 'Your facility is operating' },
  runningContext: { ar: 'لا طلبات مفتوحة. التجديد القادم في مارس 2027.', en: 'No open requests. Your next renewal is in March 2027.' },
  runningCta: { ar: 'اعرض قطعتك', en: 'View your plot' },
  clearTitle: { ar: 'كل شيء على ما يرام', en: 'Everything is on track' },
  clearContext: { ar: 'لا شيء مطلوب منك الآن. سنخبرك حين يحين دورك.', en: 'Nothing is needed from you right now. We will tell you when it is your turn.' },
  clearCta: { ar: 'تابع طلباتك', en: 'Follow your requests' },
  opened: { ar: 'فُتحت القائمة', en: 'List opened' },

  // journey
  journey: { ar: 'رحلتك', en: 'Your journey' },
  join: { ar: 'الانضمام', en: 'Join' },
  contract: { ar: 'العقد', en: 'Contract' },
  build: { ar: 'البناء', en: 'Build' },
  operate: { ar: 'التشغيل', en: 'Operate' },
  journeyCaption: { ar: 'أنت في محطة البناء: رخصة البناء عند وزارة البلدية.', en: 'You are at Build: your building permit is with the Ministry of Municipality.' },
  station: { ar: 'المحطة: {name}', en: 'Station: {name}' },

  // ring
  of: { ar: 'من {total}', en: 'of {total}' },
  ringDone: { ar: 'اكتمل الطلب ضمن المعيار', en: 'Finished within the standard' },
  ringIdle: { ar: 'لا يوجد معيار زمني لهذه الخدمة', en: 'This service has no time standard' },

  // holders and rows
  ministry: { ar: 'وزارة البلدية', en: 'Ministry of Municipality' },
  permit: { ar: 'رخصة البناء', en: 'Building permit' },
  maintenance: { ar: 'صيانة إنارة الطريق', en: 'Street light repair' },
  lease: { ar: 'عقد الإيجار', en: 'Lease contract' },
  dueToday: { ar: 'يُعالج اليوم', en: 'Due today' },
  waitingYou: { ar: 'ينتظر توقيعك', en: 'Waiting for your signature' },

  // timeline: building permit
  s1: { ar: 'قدّم الاستشاري طلب الرخصة', en: 'Your consultant lodged the permit application' },
  s2: { ar: 'طلب نظام الوزارة موافقة مناطق إلكترونيًا', en: 'The Ministry’s system requested Manateq’s approval' },
  s3: { ar: 'سُجّل مرجع الرخصة على قطعتك', en: 'Permit reference recorded against your plot' },
  s4: { ar: 'هل شهادة عدم الممانعة سارية لهذا التصميم؟', en: 'Is the no-objection certificate valid for this design version?' },
  s4Outcome: { ar: 'نعم · الشهادة سارية', en: 'Yes · the certificate is valid' },
  s5: { ar: 'أُرسلت الشهادة وشروطها إلى الوزارة', en: 'Certificate and its conditions sent to the Ministry' },
  s6: { ar: 'الوزارة تراجع طلب الرخصة', en: 'The Ministry is reviewing the permit' },
  s6Text: {
    ar: 'تراجع وزارة البلدية المخططات المعتمدة. لا يلزمك شيء الآن، وسنبلغك فور صدور القرار.',
    en: 'The Ministry of Municipality is reviewing the approved drawings. Nothing is needed from you; we will tell you as soon as there is a decision.',
  },
  s6Time: { ar: 'متوقع خلال 3 أيام عمل', en: 'Expected within 3 working days' },
  s7: { ar: 'تحديثات الدفاع المدني وكهرماء', en: 'Civil Defence and Kahramaa updates' },
  s8: { ar: 'إصدار الرخصة يحدّث سجل قطعتك', en: 'Permit issue updates your plot record' },
  s9: { ar: 'اطلب تصريح تحضير الموقع', en: 'Request your mobilisation permit' },
  s10: { ar: 'تبدأ مدة الإنشاء', en: 'The construction period starts' },
  instant: { ar: 'فوري', en: 'Instant' },
  stamp: { ar: '{day}، {time}', en: '{day}, {time}' },

  // timeline: lease contract waiting for the investor
  c1: { ar: 'أعدّ فريق العقود عقد الإيجار', en: 'The contracts team prepared your lease' },
  c2: { ar: 'تحقّق آلي من بيانات السجل التجاري', en: 'Commercial registration checked automatically' },
  c3: { ar: 'تحديث بيانات المفوّض بالتوقيع', en: 'Update the authorised signatory' },
  c4: { ar: 'وقّع عقد الإيجار', en: 'Sign your lease contract' },
  c4Text: { ar: 'العقد جاهز للتوقيع الإلكتروني. القطعة محجوزة لك حتى 30 نوفمبر.', en: 'The contract is ready for e-signature. The plot is reserved for you until 30 November.' },
  c4Time: { ar: 'قبل 30 نوفمبر', en: 'Before 30 November' },
  c5: { ar: 'توقيع مناطق على العقد', en: 'Manateq countersigns the contract' },
  c6: { ar: 'تسليم القطعة في الموقع', en: 'Plot handover on site' },
  oneDay: { ar: 'يوم عمل واحد', en: '1 working day' },
  fiveDays: { ar: '5 أيام عمل', en: '5 working days' },
  contractsTeam: { ar: 'فريق العقود', en: 'Contracts team' },

  // fetched
  f1: { ar: 'اسم الشركة ورقم السجل التجاري', en: 'Company name and commercial registration number' },
  f2: { ar: 'المفوّض بالتوقيع وصفته', en: 'The authorised signatory and their role' },
  f3: { ar: 'القطعة ومساحتها وحدودها', en: 'The plot, its area and its boundaries' },
  f4: { ar: 'حالة رخصة البناء', en: 'Building permit status' },
  fetched: { ar: 'جلبناها عنك', en: 'Fetched for you' },

  // documents
  docLease: { ar: 'عقد إيجار أرض', en: 'Land lease contract' },
  docNoc: { ar: 'شهادة عدم ممانعة على التصميم', en: 'Design no-objection certificate' },
  docReceipt: { ar: 'إيصال سداد التأمين', en: 'Deposit payment receipt' },
  issuer: { ar: 'مناطق', en: 'Manateq' },
  tenant: { ar: 'المستأجر', en: 'Tenant' },
  company: { ar: 'شركة المثال للصناعات', en: 'Example Industries Co.' },
  plot: { ar: 'القطعة', en: 'Plot' },
  area: { ar: 'المساحة', en: 'Area' },
  term: { ar: 'مدة العقد', en: 'Lease term' },
  years: { ar: '25 سنة', en: '25 years' },
  rent: { ar: 'الإيجار السنوي', en: 'Annual rent' },
  qrDoc: { ar: 'رمز التحقق من عقد الإيجار', en: 'Verification code of the lease contract' },

  // pass
  holder: { ar: 'مهندس الموقع (تجريبي)', en: 'Site engineer (demo)' },
  contractor: { ar: 'شركة المثال للمقاولات', en: 'Example Contracting Co.' },
  visitor: { ar: 'زائر الشركة (تجريبي)', en: 'Company visitor (demo)' },
  qrPass: { ar: 'رمز تصريح الدخول', en: 'Gate pass code' },

  // map
  all: { ar: 'الكل', en: 'All' },
  logistics: { ar: 'لوجستي', en: 'Logistics' },
  industrial: { ar: 'صناعي', en: 'Industrial' },
  warehousing: { ar: 'تخزين', en: 'Warehousing' },
  solution: { ar: 'نوع الحل', en: 'Solution' },
} as const;

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 17, 6, 12);

type Filter = 'all' | 'logistics' | 'industrial' | 'warehousing';

const FILTER_ZONES: Record<Exclude<Filter, 'all'>, string[]> = {
  logistics: ['BA', 'AW', 'JS', 'AS'],
  industrial: ['MIZ', 'SMI', 'AK', 'KH'],
  warehousing: ['WK', 'BS', 'BF', 'US1', 'US2'],
};

export function SignatureGallery() {
  const t = useT(demo);
  const { lang, pick, fmt } = useLang();
  const [station, setStation] = useState('build');
  const [zone, setZone] = useState<string | undefined>('BA');
  const [filter, setFilter] = useState<Filter>('all');
  const [plot, setPlot] = useState<string | undefined>('BA-117');

  const stamp = (ms: number) => t('stamp', { day: fmt.dayMonth(ms), time: fmt.time(ms) });
  // The clock of the building-permit request: day 2 of a 5-day standard; and one that ran over.
  const onTime = { usedDays: 1.4, targetDays: 5, dayNumber: 2 };
  const lastDay = { usedDays: 4.5, targetDays: 5, dayNumber: 5 };
  const late = { usedDays: 5.6, targetDays: 5, dayNumber: 6 };
  const day2 = dayOf(onTime, lang) ?? '';
  const day5 = dayOf(lastDay, lang) ?? '';
  const over = timeLeft(late, lang) ?? '';
  const ministry = t('ministry');

  const stations: JourneyStation[] = [
    { key: 'join', label: t('join'), state: 'done' },
    { key: 'contract', label: t('contract'), state: 'done' },
    { key: 'build', label: t('build'), state: 'current' },
    { key: 'operate', label: t('operate'), state: 'upcoming' },
  ];

  const permitSteps: TimelineItem[] = [
    { id: 1, title: t('s1'), lane: 'inv', state: 'done', time: stamp(T0) },
    { id: 2, title: t('s2'), lane: 'nat', holderName: ministry, state: 'done', auto: true, time: stamp(T0 + 60_000) },
    { id: 3, title: t('s3'), lane: 'eng', state: 'done', auto: true, time: stamp(T0 + 120_000) },
    { id: 4, title: t('s4'), lane: 'eng', state: 'done', outcome: t('s4Outcome'), time: stamp(T0 + 120_000) },
    { id: 5, title: t('s5'), lane: 'nat', holderName: ministry, state: 'done', auto: true, time: stamp(T0 + 180_000) },
    { id: 6, title: t('s6'), text: t('s6Text'), lane: 'nat', holderName: ministry, state: 'current', time: t('s6Time') },
    { id: 7, title: t('s7'), lane: 'nat', state: 'upcoming', auto: true },
    { id: 8, title: t('s8'), lane: 'eng', state: 'upcoming', auto: true, standard: t('instant') },
    { id: 9, title: t('s9'), lane: 'inv', state: 'upcoming' },
    { id: 10, title: t('s10'), lane: 'one', state: 'upcoming', auto: true, standard: t('instant') },
  ];

  const leaseSteps: TimelineItem[] = [
    { id: 1, title: t('c1'), lane: 'staff', holderName: t('contractsTeam'), state: 'done', time: stamp(T0 - DAY) },
    { id: 2, title: t('c2'), lane: 'eng', state: 'done', auto: true, time: stamp(T0 - DAY + 60_000) },
    { id: 3, title: t('c3'), lane: 'inv', state: 'skipped' },
    { id: 4, title: t('c4'), text: t('c4Text'), lane: 'inv', state: 'current', time: t('c4Time') },
    { id: 5, title: t('c5'), lane: 'staff', state: 'upcoming', standard: t('oneDay') },
    { id: 6, title: t('c6'), lane: 'field', state: 'upcoming', standard: t('fiveDays') },
  ];

  const source = (id: string) => {
    const integration = getIntegration(id);
    return integration ? { name: pick(integration.short), live: integration.live } : undefined;
  };
  const fetched: FetchedItem[] = [
    { text: t('f1'), source: source('I2') },
    { text: t('f2'), source: source('I1') },
    { text: t('f3'), source: source('I21') },
    { text: t('f4'), source: source('I9') },
  ];

  const lanes: Lane[] = ['inv', 'one', 'eng', 'staff', 'nat', 'field'];
  const standards = ['A7', 'A1', 'A2', 'E4', 'G2', 'A4'].map((id) => getService(id)).filter((service) => service !== undefined);
  const leaseService = getService('A7');
  const zoneName = pick(getZone('BA')?.name);
  const issued = fmt.date(Date.UTC(2026, 10, 19, 7, 0));
  const from = stamp(Date.UTC(2026, 10, 19, 4, 0));
  const until = stamp(Date.UTC(2026, 10, 21, 15, 0));

  return (
    <>
      <Section title="Next step" hint="Hero tile · build step">
        <div style={{ marginInline: 'calc(var(--gutter) * -1)' }}>
          <NextStepCard
            tone="hero"
            eyebrow={t('heroEyebrow')}
            title={t('heroTitle')}
            context={t('heroContext')}
            due={t('nextDue')}
            cta={{ label: t('heroCta'), to: '/gallery' }}
            secondary={{ label: t('heroSecondary'), to: '/gallery' }}
            render="construction"
          />
        </div>
      </Section>
      <Section title="Next step" hint="Quiet cards · contract · operation · all clear">
        <NextStepCard eyebrow={t('nextEyebrow')} title={t('nextTitle')} context={t('nextContext')} due={t('nextDue')} cta={{ label: t('nextCta'), to: '/gallery' }} more={{ label: t('nextMore'), onClick: () => toast(t('opened')) }} render="plot" />
        <NextStepCard tone="clear" eyebrow={t('clearEyebrow')} title={t('runningTitle')} context={t('runningContext')} cta={{ label: t('runningCta'), to: '/gallery' }} render="warehouse" />
        <NextStepCard tone="clear" eyebrow={t('clearEyebrow')} title={t('clearTitle')} context={t('clearContext')} cta={{ label: t('clearCta'), to: '/gallery' }} />
      </Section>

      <Section title="Journey ribbon">
        <JourneyRibbon
          label={t('journey')}
          stations={stations}
          caption={station === 'build' ? t('journeyCaption') : t('station', { name: stations.find((s) => s.key === station)?.label ?? '' })}
          onSelect={setStation}
        />
        <Card>
          <JourneyRibbon label={t('journey')} size="expanded" stations={stations} caption={t('journeyCaption')} />
        </Card>
      </Section>

      <Section title="Ring">
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <Ring size="sm" value={0.4} label={day2}>
              2/5
            </Ring>
            <Ring size="md" value={0.4} label={day2}>
              2/5
            </Ring>
            <Ring size="md" value={0.9} label={day5}>
              5/5
            </Ring>
            <Ring size="md" value={1.2} label={over} />
            <Ring size="md" value={1} complete label={t('ringDone')} />
            <Ring size="md" value={null} label={t('ringIdle')} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBlockStart: 20 }}>
            <Ring size="lg" value={0.4} label={day2}>
              <span style={{ display: 'grid', gap: 2 }}>
                <span>2</span>
                <span style={{ fontSize: 'var(--t-cap)', fontWeight: 400, color: 'var(--ink-2)' }}>{t('of', { total: 5 })}</span>
              </span>
            </Ring>
            <Ring size="lg" value={1.2} label={over}>
              <span style={{ display: 'grid', gap: 2 }}>
                <span>6</span>
                <span style={{ fontSize: 'var(--t-cap)', fontWeight: 400 }}>{t('of', { total: 5 })}</span>
              </span>
            </Ring>
            <Ring size="lg" value={1} complete label={t('ringDone')} />
          </div>
        </Card>
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Ring size="lg" value={0.4} label={day2}>
              <span style={{ display: 'grid', gap: 2 }}>
                <span>2</span>
                <span style={{ fontSize: 'var(--t-cap)', fontWeight: 400, color: 'var(--ink-2)' }}>{t('of', { total: 5 })}</span>
              </span>
            </Ring>
            <div style={{ display: 'grid', gap: 6, justifyItems: 'start', minWidth: 0 }}>
              <h3 style={{ fontSize: 'var(--t-heading)' }}>{t('permit')}</h3>
              <HolderChip lane="nat" name={ministry} />
              <p style={{ fontSize: 'var(--t-foot)', color: 'var(--ink-2)' }}>
                {day2} · {timeLeft(onTime, lang)}
              </p>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Holder chips">
        <Card>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {lanes.map((lane) => (
              <HolderChip key={lane} lane={lane} />
            ))}
            <HolderChip lane="nat" name={ministry} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBlockStart: 12 }}>
            {lanes.map((lane) => (
              <HolderChip key={lane} lane={lane} size="sm" />
            ))}
            <HolderChip lane="nat" name={ministry} size="sm" />
          </div>
        </Card>
        <List>
          <Row
            to="/gallery"
            leading={
              <Ring size="sm" value={0.4} label={day2}>
                2/5
              </Ring>
            }
            title={t('permit')}
            subtitle={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBlockStart: 4 }}>
                <HolderChip lane="nat" name={ministry} size="sm" />
                {timeLeft(onTime, lang)}
              </span>
            }
          />
          <Row
            to="/gallery"
            leading={<Ring size="sm" value={0.9} label={t('dueToday')} />}
            title={t('maintenance')}
            subtitle={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBlockStart: 4 }}>
                <HolderChip lane="field" size="sm" />
                {t('dueToday')}
              </span>
            }
          />
          <Row
            to="/gallery"
            leading={<Ring size="sm" value={null} label={t('waitingYou')} />}
            title={t('lease')}
            subtitle={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBlockStart: 4 }}>
                <HolderChip lane="inv" size="sm" />
                {t('waitingYou')}
              </span>
            }
          />
        </List>
      </Section>

      <Section title="Timeline" hint="Building permit · collapsed">
        <Card>
          <Timeline items={permitSteps} collapsedCount={2} />
        </Card>
      </Section>
      <Section title="Timeline" hint="Lease contract · waiting for the investor · every step">
        <Card>
          <Timeline items={leaseSteps} />
        </Card>
      </Section>

      <Section title="Fetched for you">
        <FetchedList items={fetched} label={t('fetched')} />
        <Card tone="sunken">
          <FetchedList variant="plain" items={fetched.slice(0, 2)} label={t('fetched')} caption={false} />
        </Card>
      </Section>

      <Section title="Service standard">
        {standards.slice(0, 3).map((service) => (
          <Card key={service.id}>
            <StandardBadge standard={service.standard} />
          </Card>
        ))}
        {standards[5] ? (
          <Card>
            <StandardBadge standard={standards[5].standard} />
          </Card>
        ) : null}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {standards.map((service) => (
            <StandardBadge key={service.id} standard={service.standard} variant="compact" />
          ))}
        </div>
      </Section>

      <Section title="Level meter">
        <Card>
          {leaseService ? <LevelMeter now={leaseService.level.now} target={leaseService.level.target} /> : null}
          <div style={{ height: 20 }} />
          <LevelMeter now={0} target={5} />
          <div style={{ height: 20 }} />
          <LevelMeter now={3} target={3} />
        </Card>
      </Section>

      <Section title="Documents">
        <List>
          <DocCard kind="contract" title={t('docLease')} reference="MQ-LC-2611-0042" date={issued} signed to="/gallery" />
          <DocCard kind="noc" title={t('docNoc')} reference="MQ-NOC-2611-0057" date={issued} signed to="/gallery" />
          <DocCard kind="receipt" title={t('docReceipt')} reference="MQ-RC-2611-0031" date={issued} to="/gallery" />
        </List>
        <div style={{ height: 20 }} />
        <Grid as="ul">
          <DocCard variant="card" kind="contract" title={t('docLease')} reference="MQ-LC-2611-0042" date={issued} signed to="/gallery" />
          <DocCard variant="card" kind="noc" title={t('docNoc')} reference="MQ-NOC-2611-0057" date={issued} signed to="/gallery" />
          <DocCard variant="card" kind="receipt" title={t('docReceipt')} reference="MQ-RC-2611-0031" date={issued} to="/gallery" />
        </Grid>
        <DocCard
          variant="paper"
          kind="contract"
          issuer={t('issuer')}
          title={t('docLease')}
          reference="MQ-LC-2611-0042"
          date={issued}
          signed
          verifyCode="7KQ2-9XTM"
          qr={<QR value="https://verify.manateq.example/7KQ2-9XTM" size={92} label={t('qrDoc')} />}
          lines={[
            { label: t('tenant'), value: t('company') },
            { label: t('plot'), value: `BA-117 · ${zoneName}` },
            { label: t('area'), value: fmt.area(5000) },
            { label: t('term'), value: t('years') },
            { label: t('rent'), value: fmt.money(75000) },
          ]}
        />
      </Section>

      <Section title="Gate pass">
        <div style={{ width: 200, marginInline: 'auto', marginBlock: '8px 32px' }}>
          <Render name="gate" decorative />
        </div>
        <PassCard
          kind="worker"
          holder={t('holder')}
          company={t('contractor')}
          idOrPlate="28463401234"
          zone={zoneName}
          plot="BA-117"
          validFrom={from}
          validTo={until}
          status="active"
          code="MQP-4821-KD"
          qr={<QR value="MQP-4821-KD" size={132} label={t('qrPass')} />}
        />
        <PassCard kind="visitor" holder={t('visitor')} zone={zoneName} plot="BA-117" validFrom={from} validTo={until} status="expired" code="MQP-4790-VS" qr={<QR value="MQP-4790-VS" size={132} label={t('qrPass')} />} />
      </Section>

      <Section title="Map">
        <ChipRow label={t('solution')}>
          {(['all', 'logistics', 'industrial', 'warehousing'] as const).map((key) => (
            <Chip key={key} selected={filter === key} onClick={() => setFilter(key)}>
              {t(key)}
            </Chip>
          ))}
        </ChipRow>
        <QatarMap selected={zone} onSelect={setZone} highlight={filter === 'all' ? undefined : FILTER_ZONES[filter]} />
      </Section>

      <Section title="Plot grid">
        <Card>
          <PlotGrid plots={plotsFor('BA')} selected={plot} onSelect={(cell) => setPlot(cell.id)} own={['BA-124']} isSelectable={(cell) => cell.areaSqm >= UNFIT_BELOW_SQM} />
        </Card>
      </Section>

      <Section title="On a dark tile" hint="Ring · holder · journey · timeline · standard">
        <div data-tone="dark" style={{ marginInline: 'calc(var(--gutter) * -1)', padding: 'var(--tile-pad) var(--gutter)', background: 'var(--tile-1)', display: 'grid', gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Ring size="lg" value={0.4} label={day2}>
              2
            </Ring>
            <div style={{ display: 'grid', gap: 8, justifyItems: 'start', minWidth: 0 }}>
              <HolderChip lane="nat" name={ministry} />
              <HolderChip lane="inv" size="sm" />
            </div>
          </div>
          <JourneyRibbon label={t('journey')} stations={stations} caption={t('journeyCaption')} />
          <Timeline items={leaseSteps.slice(2)} />
          {leaseService ? <StandardBadge standard={leaseService.standard} /> : null}
        </div>
      </Section>
    </>
  );
}
