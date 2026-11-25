import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LangProvider } from '@/app/i18n';
import type { FieldDef, FieldType } from '@/data/types';
import type { FormValue, Plot } from '@/domain/types';
import { FormFields, describeValue, hasValue, isFieldShown, prefillValues, shownFields, validateFields, type FormValues } from '@/features/shared/FormFields';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const L = (en: string, ar = en) => ({ en, ar });
const field = (type: FieldType, key: string, label: string, ar: string, extra: Partial<FieldDef> = {}): FieldDef => ({ key, type, label: L(label, ar), required: true, ...extra });

const plots: Plot[] = [
  { id: 'BA-121', number: 'BA-121', zoneCode: 'BA', areaSqm: 10000, solution: 'logistics', status: 'operating' },
  { id: 'AW-116', number: 'AW-116', zoneCode: 'AW', areaSqm: 5000, solution: 'logistics', status: 'building' },
];
const NOW = Date.UTC(2026, 10, 25);

const FIELDS: Record<FieldType, FieldDef> = {
  text: field('text', 'purpose', 'Purpose', 'الغرض'),
  textarea: field('textarea', 'reason', 'Reason for the change', 'سبب التغيير'),
  number: field('number', 'capacity', 'Capacity (workers)', 'السعة (عدد العمال)'),
  area: field('area', 'area', 'Area needed', 'المساحة المطلوبة'),
  amount: field('amount', 'budget', 'Budget', 'الميزانية'),
  select: field('select', 'docType', 'Document type', 'نوع الوثيقة', { options: [{ value: 'statement', en: 'Statement of account', ar: 'كشف حساب' }] }),
  date: field('date', 'vacateDate', 'Vacate date', 'موعد الإخلاء'),
  file: field('file', 'insurance', 'Insurance certificate', 'شهادة التأمين'),
  photo: field('photo', 'photo', 'Photo of the issue', 'صورة المشكلة'),
  plot: field('plot', 'plot', 'Plot', 'القطعة'),
  zone: field('zone', 'zone', 'Zone', 'المنطقة'),
  activity: field('activity', 'activity', 'Activity', 'النشاط'),
  toggle: field('toggle', 'consent', 'I consent', 'أوافق'),
  person: field('person', 'contact', 'Contact person', 'جهة التواصل'),
};

describe('validateFields: required', () => {
  const all = Object.values(FIELDS);
  it('asks for every missing answer with a friendly verb', () => {
    const en = validateFields(all, {}, 'en', { plots, now: NOW });
    expect(en).toEqual({
      purpose: 'Enter the purpose',
      reason: 'Enter the reason for the change',
      capacity: 'Enter the capacity (workers)',
      area: 'Enter the area needed',
      budget: 'Enter the budget',
      docType: 'Choose the document type',
      vacateDate: 'Choose the vacate date',
      insurance: 'Attach the insurance certificate',
      photo: 'Add the photo of the issue',
      plot: 'Choose the plot',
      zone: 'Choose the zone',
      activity: 'Choose the activity',
      consent: 'Confirm this to continue',
      contact: 'Enter a name',
    });
    const ar = validateFields(all, {}, 'ar', { plots, now: NOW });
    expect(ar.docType).toBe('اختر نوع الوثيقة');
    expect(ar.purpose).toBe('أدخل الغرض');
    expect(ar.insurance).toBe('أرفق شهادة التأمين');
  });

  it('keeps capitals of acronyms and answers questions plainly', () => {
    const qid = field('text', 'qid', 'QID number', 'الرقم الشخصي');
    const question = field('textarea', 'what', 'What happened?', 'ما الذي حدث؟');
    const choice = field('select', 'when', 'When do you want to start?', 'متى تريد أن تبدأ؟');
    expect(validateFields([qid, question, choice], {}, 'en', { plots })).toEqual({ qid: 'Enter the QID number', what: 'Write your answer', when: 'Choose an answer' });
    expect(validateFields([question], {}, 'ar', { plots }).what).toBe('اكتب إجابتك');
  });

  it('lets optional fields be empty and waives a plot when the investor has none', () => {
    const optional = { ...FIELDS.text, required: false };
    expect(validateFields([optional, FIELDS.plot], {}, 'en', { plots: [] })).toEqual({});
  });

  it('accepts complete answers of every type', () => {
    const values: FormValues = {
      purpose: 'Bank', reason: 'More space for storage', capacity: 40, area: 5000, budget: 18750, docType: 'statement',
      vacateDate: '2027-01-15', insurance: { name: 'insurance.pdf', size: 1000 }, photo: { name: 'p.jpg', id: 'sample' },
      plot: 'BA-121', zone: 'BA', activity: 'ACT-101', consent: true, contact: { name: 'Sara Ali', phone: '55123456' },
    };
    expect(validateFields(Object.values(FIELDS), values, 'en', { plots, now: NOW })).toEqual({});
  });
});

describe('validateFields: sanity', () => {
  const check = (f: FieldDef, value: FormValue) => validateFields([f], { [f.key]: value }, 'en', { plots, now: NOW })[f.key];
  it('wants positive, whole and plausible numbers', () => {
    expect(check(FIELDS.area, 0)).toBe('Enter a number above zero');
    expect(check(FIELDS.amount, -5)).toBe('Enter a number above zero');
    expect(check(FIELDS.number, 2.5)).toBe('Enter a whole number');
    expect(check(FIELDS.area, 50_000_000)).toMatch(/larger than expected/);
    expect(check(FIELDS.area, 1200)).toBeUndefined();
  });
  it('wants real dates that are not decades away', () => {
    expect(check(FIELDS.date, '2026-13-40')).toBe('Choose a valid date');
    expect(check(FIELDS.date, '1900-01-01')).toBe('Choose a valid date');
    expect(check(FIELDS.date, '2040-01-01')).toBe('Choose a date within the next five years');
    expect(check(FIELDS.date, '2026-12-01')).toBeUndefined();
  });
  it('checks a person’s phone and a required text that says nothing', () => {
    expect(check(FIELDS.person, { name: 'Sara', phone: '123' })).toMatch(/8 digits/);
    expect(check(FIELDS.person, { name: '', phone: '55123456' })).toBe('Enter a name');
    expect(check(FIELDS.textarea, 'ok')).toBe('Add a little more detail');
    expect(check(FIELDS.text, '   ')).toBe('Enter the purpose');
  });
});

/** Units, dates and codes may be held together with no-break spaces, word joiners and direction marks; compare the words. */
const plain = (text: string) => text.replace(/[\u00a0\u202f]/g, ' ').replace(/[\u2060\u2066-\u2069\u200e\u200f]/g, '');

describe('fields that wait for another answer (showIf)', () => {
  const book = field('toggle', 'bookAppointment', 'I want to book an appointment', 'أريد حجز موعد', { required: false });
  const day = field('date', 'preferredDate', 'Preferred appointment day', 'اليوم المفضل للموعد', { required: true, showIf: { key: 'bookAppointment', equals: true } });
  it('hides the field until the answer it waits for is given', () => {
    expect(isFieldShown(day, {})).toBe(false);
    expect(isFieldShown(day, { bookAppointment: false })).toBe(false);
    expect(isFieldShown(day, { bookAppointment: true })).toBe(true);
    expect(shownFields([book, day], {}).map((f) => f.key)).toEqual(['bookAppointment']);
  });
  it('does not check a hidden field', () => {
    expect(validateFields([book, day], {}, 'en', { plots, now: NOW })).toEqual({});
    expect(Object.keys(validateFields([book, day], { bookAppointment: true }, 'en', { plots, now: NOW }))).toEqual(['preferredDate']);
  });
});

describe('describeValue', () => {
  it('reads every type as the investor would say it', () => {
    expect(describeValue(FIELDS.text, 'Bank', 'en')).toBe('Bank');
    expect(describeValue(FIELDS.number, 1200, 'en')).toBe('1,200');
    expect(plain(describeValue(FIELDS.area, 5000, 'en'))).toBe('5,000 m²');
    expect(plain(describeValue(FIELDS.area, 5000, 'ar'))).toBe('5,000 م²');
    expect(plain(describeValue(FIELDS.amount, 18750, 'en'))).toBe('QAR 18,750');
    expect(plain(describeValue(FIELDS.amount, 18750, 'ar'))).toBe('18,750 ر.ق');
    expect(describeValue(FIELDS.select, 'statement', 'ar')).toBe('كشف حساب');
    expect(describeValue(FIELDS.select, 'unknown', 'en')).toBe('unknown');
    expect(plain(describeValue(FIELDS.date, '2026-11-19', 'en'))).toBe('19 Nov 2026');
    expect(describeValue(FIELDS.file, { name: 'drawings.pdf' }, 'en')).toBe('drawings.pdf');
    expect(describeValue(FIELDS.photo, { name: '', id: 'sample' }, 'en')).toBe('');
    expect(describeValue(FIELDS.photo, { name: 'site.jpg' }, 'en')).toBe('site.jpg');
    expect(describeValue(FIELDS.toggle, true, 'ar')).toBe('نعم');
    expect(describeValue(FIELDS.toggle, false, 'en')).toBe('No');
    // A switch left untouched is off.
    expect(describeValue(FIELDS.toggle, undefined, 'en')).toBe('No');
    expect(describeValue(FIELDS.toggle, undefined, 'ar')).toBe('لا');
    expect(describeValue(FIELDS.zone, 'BA', 'en')).toBe('Birkat Al Awamer Logistics Park');
    expect(describeValue(FIELDS.activity, 'ACT-101', 'en')).toBe('Food products manufacturing');
    expect(describeValue(FIELDS.activity, 'Metal works', 'en')).toBe('Metal works');
    expect(plain(describeValue(FIELDS.plot, 'XX-1', 'en'))).toContain('XX-1');
    expect(plain(describeValue(FIELDS.person, { name: 'Sara Ali', id: '28763400123', phone: '55123456' }, 'en'))).toMatch(/^Sara Ali · .*28763400123.* · .*55123456/);
  });
  it('gives an empty string when nothing was answered', () => {
    for (const f of Object.values(FIELDS)) if (f.type !== 'toggle') expect(describeValue(f, undefined, 'en')).toBe('');
    expect(describeValue(FIELDS.text, null, 'en')).toBe('');
  });
});

describe('prefillValues and hasValue', () => {
  const fields = [FIELDS.plot, FIELDS.zone, FIELDS.activity, FIELDS.text];
  it('takes the plot, zone and activity from the link', () => {
    expect(prefillValues(fields, { plots, plotId: 'AW-116', zoneCode: 'AW', activity: 'ACT-101' })).toEqual({ plot: 'AW-116', zone: 'AW', activity: 'ACT-101' });
  });
  it('picks the only plot, ignores unknown ones and never overwrites an answer', () => {
    expect(prefillValues(fields, { plots: [plots[0] as Plot] }).plot).toBe('BA-121');
    expect(prefillValues(fields, { plots, plotId: 'ZZ-9' }).plot).toBeUndefined();
    expect(prefillValues(fields, { plots, plotId: 'AW-116', zoneCode: 'NOPE' }, { plot: 'BA-121' })).toEqual({ plot: 'BA-121' });
  });
  it('knows an empty answer of each kind', () => {
    expect(hasValue(FIELDS.toggle, false)).toBe(false);
    expect(hasValue(FIELDS.area, null)).toBe(false);
    expect(hasValue(FIELDS.person, { name: ' ' })).toBe(false);
    expect(hasValue(FIELDS.file, { name: 'a.pdf' })).toBe(true);
  });
});

describe('<FormFields>', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function Harness({ fields }: { fields: FieldDef[] }) {
    const [values, setValues] = useState<FormValues>({});
    return (
      <LangProvider lang="en">
        <FormFields fields={fields} values={values} onChange={(k, v) => setValues((s) => ({ ...s, [k]: v }))} errors={{ purpose: 'Enter the purpose' }} />
        <output data-testid="values">{JSON.stringify(values)}</output>
      </LangProvider>
    );
  }

  it('renders a labelled control for each field and wires errors', () => {
    const fields = [FIELDS.text, FIELDS.area, FIELDS.select, FIELDS.toggle, FIELDS.person, { ...FIELDS.zone, required: false }];
    act(() => root.render(<Harness fields={fields} />));
    const input = container.querySelector<HTMLInputElement>('#f-purpose');
    expect(input).not.toBeNull();
    expect(input?.getAttribute('aria-invalid')).toBe('true');
    expect(container.textContent).toContain('Enter the purpose');
    expect(container.textContent).toContain('m²');
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(container.querySelector('#f-contact-name')).not.toBeNull();
    expect(container.querySelector('#f-contact-qid')).not.toBeNull();
    expect(container.querySelector('#f-consent')).not.toBeNull();
    expect(container.querySelector('#f-zone')?.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('reports typed values through onChange', () => {
    act(() => root.render(<Harness fields={[FIELDS.text]} />));
    const input = container.querySelector<HTMLInputElement>('#f-purpose');
    expect(input).not.toBeNull();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'Bank');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('[data-testid="values"]')?.textContent).toBe('{"purpose":"Bank"}');
  });
});
