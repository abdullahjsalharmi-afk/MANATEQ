/**
 * Documents — what lands in the investor's wallet when a request finishes, an invoice is paid or a
 * lease is signed. Every document is generated from data the app already holds, carries a reference
 * and a verification code, and says who it was issued to. Pure functions: ids and references are
 * allocated by the caller.
 *
 * Which documents a service issues comes from its published `receives` (kind `document`); the short
 * wallet title and the document kind of each are curated below, in the same order.
 */
import { langTools, ltr } from '@/app/i18n';
import type { L10n, Receives, ServiceDetail, ServiceId } from '@/data/types';
import type { Company, Doc, DocKind, DocLine, Invoice, Lease, Plot, RequestState } from './types';

const AR = langTools('ar').fmt;
const EN = langTools('en').fmt;

export const MANATEQ: L10n = { ar: 'مناطق', en: 'Manateq' };
const CIVIL_DEFENCE: L10n = { ar: 'الدفاع المدني', en: 'Civil Defence' };

/** One document a service issues. */
export interface DocSpec {
  kind: DocKind;
  title: L10n;
  /** Signed electronically (by both parties for contracts, by the issuer otherwise). */
  signed: boolean;
  /** The issuing entity when it is not Manateq. */
  issuer?: L10n;
  /** The document is the lease itself, so it carries the lease reference. */
  isLease?: boolean;
}

/** Everything a document may quote. */
export interface DocFacts {
  company: Company | null;
  plot?: Plot;
  zoneName?: L10n;
  lease?: Lease;
}

/** The identity of a new document, allocated by the state layer. */
export interface DocSeed {
  id: string;
  ref: string;
}

/** The first letters of a document reference, by kind ("NOC-2611-0042"). Leases use their own reference. */
export const DOC_REF_PREFIX: Record<DocKind, string> = {
  contract: 'ADD',
  offer: 'OFR',
  noc: 'NOC',
  permit: 'PRM',
  certificate: 'CRT',
  receipt: 'RCP',
  statement: 'STM',
  letter: 'LTR',
  report: 'RPT',
};

const spec = (kind: DocKind, ar: string, en: string, signed = false, extra: Partial<DocSpec> = {}): DocSpec => ({ kind, title: { ar, en }, signed, ...extra });

/**
 * The wallet documents of each service, aligned with its `receives` of kind `document`.
 * `null` marks a published item that is not a wallet document (an invoice, a copy, a web page).
 */
const CURATED: Record<ServiceId, (DocSpec | null)[]> = {
  A1: [spec('report', 'ورقة الحل المناسب', 'Solution sheet')],
  A6: [spec('offer', 'عرض تخصيص القطعة', 'Plot offer')],
  A7: [spec('contract', 'عقد الإيجار', 'Lease contract', true, { isLease: true })],
  A8: [spec('certificate', 'شهادة تسليم القطعة', 'Plot handover certificate', true), spec('report', 'حزمة الترحيب', 'Welcome kit')],
  B1: [null, null],
  B3: [null, spec('contract', 'ملحق تجديد عقد الإيجار', 'Lease renewal addendum', true)],
  B4: [spec('contract', 'ملحق تعديل عقد الإيجار', 'Lease amendment addendum', true)],
  B5: [spec('contract', 'ملحق النشاط المعتمد', 'Approved activity annex', true)],
  B6: [spec('contract', 'الاتفاقية الثلاثية', 'Tripartite agreement', true)],
  B7: [spec('report', 'سجل معاينة الخروج', 'Exit inspection record'), spec('statement', 'كشف التسوية', 'Settlement statement'), spec('certificate', 'شهادة مخالصة', 'Clearance certificate', true)],
  B8: [spec('statement', 'كشف حساب', 'Statement of account')],
  B9: [null, null],
  C1: [spec('report', 'تقرير الفحص المسبق', 'Pre-check report'), spec('noc', 'شهادة عدم ممانعة', 'No-objection certificate', true)],
  C3: [spec('certificate', 'شهادة السلامة من الحريق', 'Fire-safety certificate', true, { issuer: CIVIL_DEFENCE })],
  C6: [spec('permit', 'تصريح تحضير الموقع', 'Mobilisation permit', true)],
  C7: [spec('report', 'سجل تفتيش الموقع', 'Site inspection record'), spec('letter', 'إشعار ملاحظة تفتيش', 'Inspection finding notice')],
  C8: [spec('letter', 'خطاب الجاهزية التشغيلية', 'Operational readiness letter', true)],
  C9: [spec('permit', 'موافقة أعمال التجهيز', 'Works approval', true)],
  D3: [spec('report', 'سجل الحادث', 'Incident record'), spec('report', 'تقرير التحقيق', 'Investigation report')],
  D4: [spec('report', 'سجل التفتيش', 'Inspection record')],
  D5: [spec('report', 'سجل الامتثال البيئي', 'Environmental compliance record')],
  D6: [spec('letter', 'إشعار مخالفة', 'Violation notice')],
  D7: [spec('report', 'سجل تفتيش السكن', 'Accommodation inspection record'), spec('certificate', 'شهادة امتثال سكن العمال', 'Worker accommodation compliance certificate', true)],
  E2: [spec('letter', 'خطاب رسمي', 'Official letter', true), null],
  E3: [spec('report', 'ملف الإحالة', 'Referral dossier')],
  E4: [null],
  E5: [null],
  G5: [null],
};

/** B8 and E2 issue the document the investor picked; the kind follows the pick, the title is the option's own label. */
const PICKED: Record<ServiceId, { field: string; kinds: Record<string, DocKind>; signed: boolean }> = {
  B8: {
    field: 'docType',
    kinds: { statement: 'statement', receipt: 'receipt', leaseConfirmation: 'letter', toWhomItMayConcern: 'certificate', noObjection: 'letter', noDues: 'letter' },
    signed: true,
  },
  E2: { field: 'letterType', kinds: { leaseConfirmation: 'letter', nocCrLicence: 'noc', addressConfirmation: 'letter', other: 'letter' }, signed: true },
};

const KEYWORDS: [RegExp, DocKind][] = [
  [/\bnoc\b|no-objection/i, 'noc'],
  [/contract|addendum|annex|agreement/i, 'contract'],
  [/\boffer\b/i, 'offer'],
  [/permit/i, 'permit'],
  [/certificate/i, 'certificate'],
  [/receipt/i, 'receipt'],
  [/statement/i, 'statement'],
  [/letter|notice/i, 'letter'],
];

const cutAt = (text: string, marks: RegExp): string => (text.split(marks)[0] ?? text).trim();

/** A document the curated list does not know yet: the kind is read from the wording, the title is its first clause. */
function fallbackSpec(receive: Receives): DocSpec {
  const kind = KEYWORDS.find(([pattern]) => pattern.test(receive.en))?.[1] ?? 'report';
  const en = cutAt(receive.en.replace(/^(an?|the|your)\s+/i, ''), /[,:;]| with | showing | you can | that can /);
  const ar = cutAt(receive.ar, /[،:؛]/);
  return { kind, title: { ar, en: en.charAt(0).toUpperCase() + en.slice(1) }, signed: kind !== 'report' && kind !== 'statement' && kind !== 'receipt' };
}

type DocSource = Pick<ServiceDetail, 'id' | 'receives' | 'fields'>;

/**
 * The documents a service issues when a request finishes, in published order. Pass the request's form
 * when the investor picks the document (statements, certificates and letters).
 */
export function docSpecs(service: DocSource, form?: RequestState['form']): DocSpec[] {
  const published = service.receives.filter((item) => item.kind === 'document');
  const curated = CURATED[service.id];
  const specs: DocSpec[] = [];
  published.forEach((receive, index) => {
    const known = curated && index < curated.length ? curated[index] : undefined;
    if (known === null) return;
    specs.push(known ?? fallbackSpec(receive));
  });

  const picked = PICKED[service.id];
  const first = specs[0];
  if (picked && first) {
    const value = form?.[picked.field];
    const option = service.fields.find((field) => field.key === picked.field)?.options?.find((candidate) => candidate.value === value);
    if (option && typeof value === 'string') {
      specs[0] = { ...first, kind: picked.kinds[value] ?? first.kind, title: { ar: option.ar, en: option.en }, signed: picked.signed };
    }
  }
  return specs;
}

/* ───────────────────────────── verification ───────────────────────────── */

/** No 0/O, 1/I/L: the code is read aloud and typed by third parties. */
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

function fnv1a(text: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** The code a third party types or scans to verify a document: "TSD-XXXX-XXXX". Stable for a given seed text. */
export function verifyCode(seed: string): string {
  let a = fnv1a(seed, 0x811c9dc5);
  let b = fnv1a(seed, 0x01234567);
  let left = '';
  let right = '';
  for (let i = 0; i < 4; i++) {
    left += CODE_ALPHABET[a % CODE_ALPHABET.length];
    right += CODE_ALPHABET[b % CODE_ALPHABET.length];
    a = Math.floor(a / CODE_ALPHABET.length);
    b = Math.floor(b / CODE_ALPHABET.length);
  }
  return `TSD-${left}-${right}`;
}

export const VERIFY_CODE_PATTERN = /^TSD-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/;

/* ───────────────────────────── lines ───────────────────────────── */

const LABEL = {
  issuedTo: { ar: 'صادرة إلى', en: 'Issued to' },
  cr: { ar: 'السجل التجاري', en: 'Commercial registration' },
  plot: { ar: 'القطعة', en: 'Plot' },
  area: { ar: 'المساحة', en: 'Area' },
  lease: { ar: 'عقد الإيجار', en: 'Lease contract' },
  term: { ar: 'مدة العقد', en: 'Lease term' },
  rate: { ar: 'سعر الإيجار', en: 'Rent rate' },
  annualRent: { ar: 'الإيجار السنوي', en: 'Annual rent' },
  validUntil: { ar: 'سارٍ حتى', en: 'Valid until' },
  service: { ar: 'الخدمة', en: 'Service' },
  request: { ar: 'رقم الطلب', en: 'Request number' },
  issuedOn: { ar: 'تاريخ الإصدار', en: 'Issued on' },
  amount: { ar: 'المبلغ', en: 'Amount' },
  invoice: { ar: 'الفاتورة', en: 'Invoice' },
  paidOn: { ar: 'تاريخ السداد', en: 'Paid on' },
  method: { ar: 'طريقة السداد', en: 'Payment method' },
  signature: { ar: 'التوقيع', en: 'Signature' },
} as const;

const VALUE = {
  demoPayment: { ar: 'سداد تجريبي، لم يُحصَّل أي مبلغ', en: 'Demo payment, no money was collected' },
  demoSignature: { ar: 'توقيع إلكتروني تجريبي', en: 'Demo electronic signature' },
} as const;

const same = (text: string): L10n => ({ ar: text, en: text });
const code = (text: string): L10n => ({ ar: ltr(text), en: text });
const money = (amount: number): L10n => ({ ar: AR.money(amount), en: EN.money(amount) });
const area = (sqm: number): L10n => ({ ar: AR.area(sqm), en: EN.area(sqm) });
const date = (ms: number): L10n => ({ ar: AR.date(ms), en: EN.date(ms) });
const line = (label: L10n, value: L10n): DocLine => ({ label, value });

function partyLines(facts: DocFacts): DocLine[] {
  if (!facts.company) return [];
  return [line(LABEL.issuedTo, facts.company.name), line(LABEL.cr, code(facts.company.cr))];
}

/** "AW-116 · مجمّع الوكرة اللوجستي" */
export function plotLabel(plot: Plot, zoneName?: L10n): L10n {
  if (!zoneName) return code(plot.number);
  return { ar: `${ltr(plot.number)} · ${zoneName.ar}`, en: `${plot.number} · ${zoneName.en}` };
}

function plotLines(facts: DocFacts): DocLine[] {
  if (!facts.plot) return [];
  return [line(LABEL.plot, plotLabel(facts.plot, facts.zoneName)), line(LABEL.area, area(facts.plot.areaSqm))];
}

function leaseLines(lease: Lease): DocLine[] {
  return [
    line(LABEL.term, { ar: `${AR.date(lease.startsAt)} – ${AR.date(lease.endsAt)}`, en: `${EN.date(lease.startsAt)} – ${EN.date(lease.endsAt)}` }),
    line(LABEL.rate, { ar: `${AR.num(lease.ratePerSqmYear)} ر.ق / م² / سنة`, en: `QAR ${EN.num(lease.ratePerSqmYear)} / m² / year` }),
    line(LABEL.annualRent, money(lease.annualRent)),
  ];
}

const signatureLine = (): DocLine => line(LABEL.signature, VALUE.demoSignature);

/** "عقد الإيجار · AW-116" */
function titled(title: L10n, plot?: Plot): L10n {
  if (!plot) return title;
  return { ar: `${title.ar} · ${ltr(plot.number)}`, en: `${title.en} · ${plot.number}` };
}

/* ───────────────────────────── builders ───────────────────────────── */

/** The lease contract itself: a signed document that carries the lease reference. */
export function leaseContractDoc(seed: DocSeed, lease: Lease, facts: DocFacts, at: number, source?: { serviceId: ServiceId; requestId: string }): Doc {
  return {
    id: seed.id,
    ref: lease.ref,
    kind: 'contract',
    title: titled({ ar: 'عقد الإيجار', en: 'Lease contract' }, facts.plot),
    issuedAt: at,
    issuer: MANATEQ,
    ...(source ?? {}),
    verifyCode: verifyCode(`${lease.ref}:${seed.id}`),
    signed: true,
    lines: [...partyLines(facts), ...plotLines(facts), ...leaseLines(lease), signatureLine()],
  };
}

/** The receipt of a paid invoice. */
export function receiptDoc(seed: DocSeed, invoice: Invoice, facts: DocFacts, at: number, source?: { serviceId: ServiceId; requestId: string }): Doc {
  return {
    id: seed.id,
    ref: seed.ref,
    kind: 'receipt',
    title: { ar: `إيصال سداد · ${invoice.title.ar}`, en: `Payment receipt · ${invoice.title.en}` },
    issuedAt: at,
    issuer: MANATEQ,
    ...(source ?? {}),
    verifyCode: verifyCode(`${seed.ref}:${seed.id}`),
    signed: false,
    lines: [
      ...partyLines(facts),
      line(LABEL.invoice, code(invoice.ref)),
      line(LABEL.amount, money(invoice.amount)),
      line(LABEL.paidOn, date(at)),
      line(LABEL.method, VALUE.demoPayment),
    ],
  };
}

/**
 * The documents a finished request issues. `allocate` gives each one its id and reference; a spec
 * marked `isLease` uses the lease's own reference.
 */
export function requestDocs(
  request: Pick<RequestState, 'id' | 'ref' | 'serviceId' | 'form'>,
  service: DocSource & Pick<ServiceDetail, 'label'>,
  facts: DocFacts,
  at: number,
  allocate: (spec: DocSpec) => DocSeed,
): Doc[] {
  return docSpecs(service, request.form).map((item) => {
    const seed = allocate(item);
    const source = { serviceId: service.id, requestId: request.id };
    if (item.isLease && facts.lease) return leaseContractDoc(seed, facts.lease, facts, at, source);

    const lines: DocLine[] = [...partyLines(facts), ...plotLines(facts)];
    if (item.kind === 'contract' || item.kind === 'offer') {
      if (facts.lease) {
        if (!item.isLease) lines.push(line(LABEL.lease, code(facts.lease.ref)));
        lines.push(...leaseLines(facts.lease));
      }
    } else if (item.kind === 'certificate' && facts.lease) {
      lines.push(line(LABEL.lease, code(facts.lease.ref)), line(LABEL.validUntil, date(facts.lease.endsAt)));
    }
    lines.push(line(LABEL.service, service.label), line(LABEL.request, code(request.ref)), line(LABEL.issuedOn, date(at)));
    if (item.signed) lines.push(signatureLine());

    return {
      id: seed.id,
      ref: seed.ref,
      kind: item.kind,
      title: titled(item.title, facts.plot),
      issuedAt: at,
      issuer: item.issuer ?? MANATEQ,
      ...source,
      verifyCode: verifyCode(`${seed.ref}:${seed.id}`),
      signed: item.signed,
      lines,
    };
  });
}

/** Every `same`-language value helper is exported for the state layer's own documents. */
export const docText = { same, code, money, area, date, line };
