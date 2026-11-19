/**
 * Gallery section for forms, feedback and the two transaction sheets: every component in each of its
 * states, with the kind of content the app really shows. Open a sheet on load with
 * `#/gallery?sheet=pay` or `#/gallery?sheet=sign`.
 */
import { Car, HardHat, IdCard, Inbox, Mail } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useQuery } from '@/app/routes';
import { solutions, zones, zonesData } from '@/data/catalog';
import type { SolutionKey } from '@/data/types';
import { Button, Card, Icon, List, Row, Section, toast } from '@/design/core';
import { FilePickView } from '@/design/FilePick/FilePick';
import {
  Avatar,
  Banner,
  Checkbox,
  DateField,
  DemoPill,
  EmptyState,
  FieldStack,
  FilePick,
  Money,
  NumberField,
  PaySheet,
  PhotoPick,
  QR,
  SAMPLE_PHOTO_ID,
  SearchField,
  SelectField,
  SignaturePad,
  SignSheet,
  Skeleton,
  Stat,
  Stepper,
  Switch,
  TextArea,
  TextField,
  Toggle,
  type PickedFile,
  type PickedPhoto,
  type SheetLine,
} from '@/design/forms';
import { PayContent, PayFooter, type PayMethod, type PayPhase } from '@/design/PaySheet/PaySheet';
import { SignContent, SignFooter, type SignPhase } from '@/design/SignSheet/SignSheet';

const strings = {
  visitor: { ar: 'اسم الزائر', en: 'Visitor name' },
  visitorHint: { ar: 'كما هو مكتوب في البطاقة الشخصية.', en: 'As written on the ID card.' },
  visitorValue: { ar: 'ناصر الكواري', en: 'Nasser Al-Kuwari' },
  idNumber: { ar: 'رقم البطاقة الشخصية', en: 'ID number' },
  idError: { ar: 'الرقم يتكوّن من 11 خانة. تحقّق منه وأعد كتابته.', en: 'The number has 11 digits. Check it and type it again.' },
  email: { ar: 'البريد الإلكتروني للمسؤول المالي', en: 'Finance contact’s e-mail' },
  emailPlaceholder: { ar: 'مثال: finance@company.qa', en: 'e.g. finance@company.qa' },
  crNumber: { ar: 'رقم السجل التجاري', en: 'Commercial registration number' },
  crHint: { ar: 'جلبناه من وزارة التجارة والصناعة؛ لا يمكن تعديله هنا.', en: 'Fetched from the Ministry of Commerce and Industry; it cannot be changed here.' },
  area: { ar: 'المساحة المطلوبة', en: 'Area needed' },
  areaHint: { ar: 'تقريبية؛ تُحدَّد بدقة عند اختيار القطعة.', en: 'Approximate; it is fixed when you choose a plot.' },
  sqm: { ar: 'م²', en: 'm²' },
  investment: { ar: 'قيمة الاستثمار المتوقعة', en: 'Expected investment' },
  qar: { ar: 'ر.ق', en: 'QAR' },
  fault: { ar: 'وصف العطل', en: 'Describe the fault' },
  faultHint: { ar: 'أين هو، ومنذ متى؟', en: 'Where is it, and since when?' },
  faultValue: { ar: 'إنارة الطريق أمام البوابة الثانية لا تعمل منذ مساء أمس.', en: 'The street light in front of gate 2 has been out since yesterday evening.' },
  passType: { ar: 'نوع التصريح', en: 'Pass type' },
  passVisitor: { ar: 'زائر', en: 'Visitor' },
  passVisitorHint: { ar: 'ليوم واحد', en: 'For one day' },
  passContractor: { ar: 'مقاول', en: 'Contractor' },
  passContractorHint: { ar: 'طوال مدة المشروع', en: 'For the length of the project' },
  passVehicle: { ar: 'مركبة', en: 'Vehicle' },
  passVehicleHint: { ar: 'شاحنة أو معدّة', en: 'A truck or equipment' },
  solution: { ar: 'نوع الحل', en: 'Solution' },
  solutionError: { ar: 'اختر نوع الحل لنعرض لك المناطق المناسبة.', en: 'Choose a solution so we can show you the zones that fit.' },
  zone: { ar: 'المنطقة', en: 'Zone' },
  zoneHint: { ar: 'يمكنك تغييرها قبل إرسال الطلب.', en: 'You can change it before you send the request.' },
  zonePlaceholder: { ar: 'اختر منطقة', en: 'Choose a zone' },
  visitDate: { ar: 'تاريخ الزيارة', en: 'Visit date' },
  handover: { ar: 'موعد التسليم المفضّل', en: 'Preferred handover date' },
  notify: { ar: 'إشعارات الطلبات', en: 'Request notifications' },
  notifyHint: { ar: 'عند كل تغيّر في حالة طلباتك.', en: 'Whenever one of your requests changes.' },
  remind: { ar: 'تذكير قبل موعد الاستحقاق', en: 'Reminder before a due date' },
  whatsapp: { ar: 'التحديثات عبر واتساب', en: 'Updates on WhatsApp' },
  declare: { ar: 'أقرّ بأن البيانات والوثائق المقدَّمة صحيحة.', en: 'I declare that the information and documents provided are correct.' },
  terms: { ar: 'أوافق على شروط حجز القطعة لمدة 30 يومًا.', en: 'I agree to the terms of the 30-day plot reservation.' },
  termsError: { ar: 'نحتاج موافقتك لإرسال الطلب.', en: 'We need your agreement to send the request.' },
  plan: { ar: 'خطة العمل', en: 'Business plan' },
  planHint: { ar: 'PDF أو صورة · حتى 10 ميغابايت', en: 'PDF or image · up to 10 MB' },
  drawings: { ar: 'مخططات التصميم المعتمدة من الاستشاري', en: 'Design drawings approved by the consultant' },
  drawingsFile: { ar: 'مخططات-المستودع-المرحلة-الأولى.pdf', en: 'warehouse-drawings-phase-1.pdf' },
  licence: { ar: 'الرخصة التجارية', en: 'Trade licence' },
  licenceFile: { ar: 'الرخصة-التجارية-2026.pdf', en: 'trade-licence-2026.pdf' },
  authority: { ar: 'تفويض المخوَّل بالتوقيع', en: 'Signatory’s authorisation' },
  authorityError: { ar: 'أرفق التفويض لنتمكّن من إصدار العقد.', en: 'Attach the authorisation so we can issue the contract.' },
  photo: { ar: 'صورة العطل', en: 'Photo of the fault' },
  photoHint: { ar: 'صورة واضحة تساعد الفريق الميداني على الوصول أسرع.', en: 'A clear photo helps the field team get there faster.' },
  samplePhoto: { ar: 'صورة تجريبية', en: 'Sample photo' },
  searchServices: { ar: 'ماذا تريد أن تنجز؟', en: 'What do you want to get done?' },
  searchValue: { ar: 'تصريح دخول', en: 'gate pass' },
  step: { ar: 'الخطوة {n} من {m}', en: 'Step {n} of {m}' },
  yourSignature: { ar: 'توقيعك', en: 'Your signature' },
  signer: { ar: 'خالد المري', en: 'Khalid Al-Marri' },
  company: { ar: 'شركة الأفق للخدمات اللوجستية', en: 'Horizon Logistics Services' },
  engineer: { ar: 'مريم السليطي', en: 'Mariam Al-Sulaiti' },
  qrLabel: { ar: 'رمز التحقق من عقد الإيجار', en: 'Verification code of the lease contract' },
  qrCaption: { ar: 'امسح الرمز للتحقق من الوثيقة', en: 'Scan to verify the document' },
  payTitle: { ar: 'ادفع فاتورة الإيجار', en: 'Pay the rent invoice' },
  invoice: { ar: 'الفاتورة', en: 'Invoice' },
  period: { ar: 'الفترة', en: 'Period' },
  periodValue: { ar: 'الربع الرابع 2026', en: 'Q4 2026' },
  plot: { ar: 'القطعة', en: 'Plot' },
  dueDate: { ar: 'تاريخ الاستحقاق', en: 'Due date' },
  signTitle: { ar: 'وقّع عقد الإيجار', en: 'Sign the lease contract' },
  leaseName: { ar: 'عقد إيجار القطعة {plot}', en: 'Lease contract for plot {plot}' },
  lessor: { ar: 'المؤجّر', en: 'Lessor' },
  lessorValue: { ar: 'مناطق', en: 'Manateq' },
  term: { ar: 'المدة', en: 'Term' },
  termValue: { ar: '25 سنة', en: '25 years' },
  annualRent: { ar: 'الإيجار السنوي', en: 'Annual rent' },
  openPay: { ar: 'افتح ورقة الدفع', en: 'Open the payment sheet' },
  openSign: { ar: 'افتح ورقة التوقيع', en: 'Open the signature sheet' },
  paidToast: { ar: 'سُجّل الدفع', en: 'Payment recorded' },
  signedToast: { ar: 'وُقّع العقد', en: 'Contract signed' },
  loadingRequests: { ar: 'جارٍ تحميل الطلبات…', en: 'Loading requests…' },
  emptyTitle: { ar: 'لا طلبات جارية', en: 'No requests in progress' },
  emptyBody: { ar: 'عندما تبدأ خدمة ستظهر هنا، ومعها مَن يتولّاها الآن.', en: 'When you start a service it appears here, with who has it now.' },
  emptyAction: { ar: 'استعرض الخدمات', en: 'Browse services' },
  bannerInfo: { ar: 'وزارة البلدية تراجع مخططاتك الآن. المعتاد خمسة أيام عمل.', en: 'The Ministry of Municipality is reviewing your drawings. It usually takes five working days.' },
  bannerOk: { ar: 'اكتمل ملف شركتك وجرى توثيقه.', en: 'Your company profile is complete and verified.' },
  bannerWarnTitle: { ar: 'عقد الإيجار ينتهي خلال 60 يومًا', en: 'Your lease ends in 60 days' },
  bannerWarn: { ar: 'جدّده الآن لتحتفظ بالقطعة دون انقطاع.', en: 'Renew it now to keep the plot without a gap.' },
  bannerWarnAction: { ar: 'جدّد العقد', en: 'Renew the lease' },
  bannerBad: { ar: 'تعذّر إرسال الطلب. تحقّق من الاتصال ثم حاول مرة أخرى.', en: 'The request could not be sent. Check your connection and try again.' },
  bannerDemo: { ar: 'محاكاة — لن يُخصم أي مبلغ', en: 'Simulation — nothing is charged' },
  statZones: { ar: 'منطقة ومجمّعًا', en: 'Zones and parks' },
  statArea: { ar: 'المساحة الإجمالية', en: 'Total area' },
  statRate: { ar: 'نسبة التشغيل', en: 'Operational rate' },
  statSource: { ar: 'دليل الخدمات 4.1', en: 'Service Guide 4.1' },
  rentDue: { ar: 'إيجار الربع الرابع', en: 'Q4 rent' },
  roleSignatory: { ar: 'المخوَّل بالتوقيع', en: 'Authorised signatory' },
  roleEngineer: { ar: 'مهندسة المشروع', en: 'Project engineer' },
} as const;

const PLOT = 'BA-2-117';
const DUE = new Date(2026, 11, 5, 12).getTime();
const QUARTER_RENT = 18_750;
const ANNUAL_RENT = 75_000;

const stack: CSSProperties = { display: 'grid', gap: 12, minWidth: 0 };
const cluster: CSSProperties = { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 };

function Caption({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 'var(--t-cap)', fontWeight: 500, color: 'var(--ink-3)', paddingInline: 2, marginBlockEnd: -4 }}>{children}</p>;
}

/** A still picture of a sheet, so every phase can be seen side by side without opening one. */
function SheetFrame({ title, footer, children }: { title: string; footer: ReactNode; children: ReactNode }) {
  return (
    <div style={{ borderRadius: 26, background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--line)', overflow: 'hidden' }}>
      <h3 style={{ padding: '22px var(--gutter) 12px', fontSize: 'var(--t-heading)', fontWeight: 600 }}>{title}</h3>
      <div style={{ padding: '8px var(--gutter) 20px' }}>{children}</div>
      <div style={{ padding: '12px var(--gutter) 16px', boxShadow: '0 -1px 0 var(--line)' }}>{footer}</div>
    </div>
  );
}

export function FormsGallery() {
  const t = useT(strings);
  const { fmt, pick } = useLang();
  const query = useQuery();

  const [visitor, setVisitor] = useState(t('visitorValue'));
  const [idNumber, setIdNumber] = useState('2847001');
  const [email, setEmail] = useState('');
  const [area, setArea] = useState<number | null>(5000);
  const [investment, setInvestment] = useState<number | null>(12_500_000);
  const [fault, setFault] = useState(t('faultValue'));
  const [passType, setPassType] = useState<'visitor' | 'contractor' | 'vehicle' | null>('contractor');
  const [solution, setSolution] = useState<SolutionKey | null>(null);
  const [zone, setZone] = useState<string | null>('BA');
  const [emptyZone, setEmptyZone] = useState<string | null>(null);
  const [visit, setVisit] = useState<string | null>('2026-11-24');
  const [handover, setHandover] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [remind, setRemind] = useState(false);
  const [whatsapp, setWhatsapp] = useState(true);
  const [declared, setDeclared] = useState(true);
  const [terms, setTerms] = useState(false);
  const [plan, setPlan] = useState<PickedFile | null>(null);
  const [licence, setLicence] = useState<PickedFile | null>({ name: t('licenceFile'), size: 2_516_582 });
  const [authority, setAuthority] = useState<PickedFile | null>(null);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [samplePhoto, setSamplePhoto] = useState<PickedPhoto | null>({ name: t('samplePhoto'), id: SAMPLE_PHOTO_ID });
  const [search, setSearch] = useState('');
  const [filledSearch, setFilledSearch] = useState(t('searchValue'));
  const [method, setMethod] = useState<PayMethod>('card');
  const [consent, setConsent] = useState(true);
  const [payOpen, setPayOpen] = useState(query.sheet === 'pay');
  const [signOpen, setSignOpen] = useState(query.sheet === 'sign');

  const zoneOptions = zones.map((z) => ({ value: z.code, label: pick(z.name), hint: pick(z.typeLabel), keywords: `${z.name.ar} ${z.name.en} ${z.code}` }));
  const solutionOptions = solutions.map((s) => ({ value: s.key, label: pick(s.name), hint: pick(s.price.text) }));

  const payLines: SheetLine[] = [
    { label: t('invoice'), value: 'INV-2611-018' },
    { label: t('period'), value: t('periodValue') },
    { label: t('plot'), value: PLOT },
    { label: t('dueDate'), value: fmt.date(DUE) },
  ];
  const signLines: SheetLine[] = [
    { label: t('lessor'), value: t('lessorValue') },
    { label: t('term'), value: t('termValue') },
    { label: t('annualRent'), value: fmt.money(ANNUAL_RENT) },
  ];
  const leaseName = t('leaseName', { plot: fmt.ltr(PLOT) });
  const payPhases: PayPhase[] = ['review', 'processing', 'success'];
  const signPhases: SignPhase[] = ['review', 'success'];
  const totals = zonesData.totals;

  return (
    <>
      <Section title="Text and number fields">
        <FieldStack>
          <TextField label={t('visitor')} hint={t('visitorHint')} value={visitor} onChange={setVisitor} required autoComplete="off" />
          <TextField label={t('idNumber')} value={idNumber} onChange={setIdNumber} error={t('idError')} ltr inputMode="numeric" required icon={IdCard} />
          <TextField label={t('email')} type="email" value={email} onChange={setEmail} placeholder={t('emailPlaceholder')} icon={Mail} />
          <TextField label={t('crNumber')} hint={t('crHint')} value="148825" onChange={() => undefined} ltr disabled />
          <NumberField label={t('area')} hint={t('areaHint')} unit={t('sqm')} value={area} onChange={setArea} required />
          <NumberField label={t('investment')} unit={t('qar')} value={investment} onChange={setInvestment} />
          <TextArea label={t('fault')} hint={t('faultHint')} value={fault} onChange={setFault} maxLength={300} />
        </FieldStack>
      </Section>

      <Section title="Choices">
        <FieldStack>
          <SelectField
            label={t('passType')}
            value={passType}
            onChange={setPassType}
            options={[
              { value: 'visitor', label: t('passVisitor'), hint: t('passVisitorHint'), icon: IdCard },
              { value: 'contractor', label: t('passContractor'), hint: t('passContractorHint'), icon: HardHat },
              { value: 'vehicle', label: t('passVehicle'), hint: t('passVehicleHint'), icon: Car },
            ]}
          />
          <SelectField label={t('solution')} value={solution} onChange={setSolution} options={solutionOptions} error={solution ? undefined : t('solutionError')} required />
          <SelectField label={t('zone')} hint={t('zoneHint')} value={zone} onChange={setZone} options={zoneOptions} />
          <SelectField label={t('zone')} value={emptyZone} onChange={setEmptyZone} options={zoneOptions} placeholder={t('zonePlaceholder')} required />
          <DateField label={t('visitDate')} value={visit} onChange={setVisit} min="2026-11-19" required />
          <DateField label={t('handover')} value={handover} onChange={setHandover} />
        </FieldStack>
      </Section>

      <Section title="Switches and checkboxes">
        <Card pad="sm">
          <Toggle label={t('notify')} hint={t('notifyHint')} checked={notify} onChange={setNotify} />
          <Toggle label={t('remind')} checked={remind} onChange={setRemind} />
        </Card>
        <List>
          <Row title={t('whatsapp')} trailing={<Switch label={t('whatsapp')} checked={whatsapp} onChange={setWhatsapp} />} />
        </List>
        <div>
          <Checkbox label={t('declare')} checked={declared} onChange={setDeclared} required />
          <Checkbox label={t('terms')} checked={terms} onChange={setTerms} error={terms ? undefined : t('termsError')} required />
        </div>
      </Section>

      <Section title="Documents and photos">
        <Caption>FilePick · empty</Caption>
        <FilePick label={t('plan')} hint={t('planHint')} value={plan} onChange={setPlan} required />
        <Caption>checking</Caption>
        <FilePickView id="gallery-file-checking" label={t('drawings')} state="checking" file={{ name: t('drawingsFile'), size: 6_920_601 }} />
        <Caption>verified</Caption>
        <FilePick label={t('licence')} hint={t('planHint')} value={licence} onChange={setLicence} />
        <Caption>missing</Caption>
        <FilePick label={t('authority')} hint={t('planHint')} value={authority} onChange={setAuthority} error={t('authorityError')} required />
        <Caption>PhotoPick · empty, with a photo</Caption>
        <PhotoPick label={t('photo')} hint={t('photoHint')} value={photo} onChange={setPhoto} />
        <PhotoPick label={t('photo')} value={samplePhoto} onChange={setSamplePhoto} />
      </Section>

      <Section title="Search and progress">
        <SearchField label={t('searchServices')} value={search} onChange={setSearch} onSubmit={(text) => toast(text || t('searchServices'), { tone: 'info' })} />
        <SearchField label={t('searchServices')} value={filledSearch} onChange={setFilledSearch} />
        <div style={{ ...stack, gap: 20, paddingBlock: 8 }}>
          <Stepper current={1} total={4} label={t('step', { n: 1, m: 4 })} />
          <Stepper current={3} total={4} label={t('step', { n: 3, m: 4 })} showLabel />
          <Stepper current={9} total={14} label={t('step', { n: 9, m: 14 })} />
        </div>
      </Section>

      <Section title="Signature pad and QR">
        <SignaturePad label={t('yourSignature')} signerName={t('signer')} onChange={() => undefined} />
        <SignaturePad label={t('yourSignature')} signerName={t('signer')} onChange={() => undefined} defaultAdopted />
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <QR value="MANATEQ-ONE-DEMO/VERIFY/MQ-2611-0042-7F3K9" size={132} label={t('qrLabel')} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontWeight: 600 }}>{leaseName}</p>
              <p style={{ fontSize: 'var(--t-foot)', color: 'var(--ink-2)', marginBlock: '2px 8px' }}>{t('qrCaption')}</p>
              <DemoPill kind="simulation" />
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Payment sheet">
        <Button variant="secondary" size="md" onClick={() => setPayOpen(true)}>
          {t('openPay')}
        </Button>
        {payPhases.map((phase) => (
          <div key={phase} style={stack}>
            <Caption>{phase}</Caption>
            <SheetFrame title={t('payTitle')} footer={<PayFooter phase={phase} amount={QUARTER_RENT} />}>
              <PayContent phase={phase} lines={payLines} amount={QUARTER_RENT} reference="RCT-2611-0046" method={method} onMethod={setMethod} />
            </SheetFrame>
          </div>
        ))}
        <PaySheet open={payOpen} onClose={() => setPayOpen(false)} title={t('payTitle')} lines={payLines} amount={QUARTER_RENT} reference="RCT-2611-0046" onPaid={() => toast(t('paidToast'))} />
      </Section>

      <Section title="Signature sheet">
        <Button variant="secondary" size="md" onClick={() => setSignOpen(true)}>
          {t('openSign')}
        </Button>
        {signPhases.map((phase) => (
          <div key={phase} style={stack}>
            <Caption>{phase}</Caption>
            <SheetFrame title={t('signTitle')} footer={<SignFooter phase={phase} />}>
              <SignContent phase={phase} documentName={leaseName} lines={signLines} signerName={t('signer')} consent={consent} onConsent={setConsent} onSignature={() => undefined} defaultAdopted />
            </SheetFrame>
          </div>
        ))}
        <SignSheet open={signOpen} onClose={() => setSignOpen(false)} title={t('signTitle')} documentName={leaseName} lines={signLines} signerName={t('signer')} onSigned={() => toast(t('signedToast'))} />
      </Section>

      <Section title="Banners">
        <Banner tone="info">{t('bannerInfo')}</Banner>
        <Banner tone="ok">{t('bannerOk')}</Banner>
        <Banner tone="warn" title={t('bannerWarnTitle')} action={{ label: t('bannerWarnAction'), onClick: () => toast(t('bannerWarnAction'), { tone: 'info' }) }}>
          {t('bannerWarn')}
        </Banner>
        <Banner tone="bad">{t('bannerBad')}</Banner>
        <Banner tone="demo" compact>
          {t('bannerDemo')}
        </Banner>
      </Section>

      <Section title="Loading and empty">
        <Card>
          <Skeleton label={t('loadingRequests')} />
        </Card>
        <Card pad="none">
          <div style={{ paddingInline: 'var(--s-5)' }}>
            <Skeleton variant="row" count={3} />
          </div>
        </Card>
        <Skeleton variant="block" height={96} />
        <Card>
          <EmptyState
            compact
            illustration={
              <span style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--sunken)', display: 'grid', placeItems: 'center' }}>
                <Icon icon={Inbox} size={32} strokeWidth={1.5} />
              </span>
            }
            title={t('emptyTitle')}
            body={t('emptyBody')}
            action={
              <Button size="md" to="/services">
                {t('emptyAction')}
              </Button>
            }
          />
        </Card>
      </Section>

      <Section title="Figures, people and honesty marks">
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <Stat value={fmt.num(totals.zones)} label={t('statZones')} />
            <Stat value={fmt.areaShort(totals.totalSqm)} label={t('statArea')} />
            <Stat value={fmt.pct(totals.operationalRatePct)} label={t('statRate')} hint={t('statSource')} />
          </div>
        </Card>
        <Card>
          <Stat size="lg" align="center" value={<Money amount={QUARTER_RENT} />} label={t('rentDue')} hint={fmt.date(DUE)} />
        </Card>
        <Card>
          <div style={{ ...stack, gap: 6 }}>
            <Money amount={ANNUAL_RENT} size="display" />
            <Money amount={QUARTER_RENT} size="title" />
            <Money amount={2_400} size="heading" />
            <p>
              {t('annualRent')}: <Money amount={ANNUAL_RENT} />
            </p>
          </div>
        </Card>
        <Card>
          <div style={cluster}>
            <Avatar name={t('signer')} size="sm" />
            <Avatar name={t('signer')} />
            <Avatar name={t('engineer')} size="lg" tone="accent" />
            <Avatar name={t('company')} size="xl" tone="gold" label={t('company')} />
          </div>
        </Card>
        <List>
          <Row leading={<Avatar name={t('signer')} tone="accent" />} title={t('signer')} subtitle={t('roleSignatory')} />
          <Row leading={<Avatar name={t('engineer')} />} title={t('engineer')} subtitle={t('roleEngineer')} />
        </List>
        <Card>
          <div style={{ ...cluster, gap: 8 }}>
            <DemoPill />
            <DemoPill kind="simulation" />
            <DemoPill kind="illustrative" />
            <DemoPill kind="indicative" />
            <DemoPill kind="example" />
          </div>
        </Card>
      </Section>
    </>
  );
}
