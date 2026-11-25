import { Inbox } from 'lucide-react';
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LangProvider } from '@/app/i18n';
import type { Lang } from '@/data/types';
import { cleanNumberInput } from '@/design/Field/number';
import {
  Avatar,
  Banner,
  Checkbox,
  DemoPill,
  EmptyState,
  Field,
  FILE_CHECK_MS,
  FilePick,
  initials,
  isoDateToMs,
  Money,
  msToIsoDate,
  NumberField,
  parseNumber,
  PAY_MS,
  PaySheet,
  QR,
  SearchField,
  SelectField,
  SIGN_MS,
  SignSheet,
  Stepper,
  TextField,
  Toggle,
  controlProps,
  type PickedFile,
} from '@/design/forms';
import { qrMatrix, QUIET_ZONE } from '@/design/QR/matrix';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  vi.useRealTimers();
});

function render(ui: ReactNode, lang: Lang = 'en'): void {
  act(() => root.render(<LangProvider lang={lang}>{ui}</LangProvider>));
}

/** Holds the value of a controlled component, the way a screen would. */
function Controlled<T>({ initial, onValue, children }: { initial: T; onValue?: (value: T) => void; children: (value: T, set: (value: T) => void) => ReactNode }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      {children(value, (next) => {
        onValue?.(next);
        setValue(next);
      })}
    </>
  );
}

function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing: ${what}`);
  return value;
}

const query = <E extends Element = HTMLElement>(selector: string): E => must(document.body.querySelector<E>(selector), selector);
const queryAll = <E extends Element = HTMLElement>(selector: string): E[] => Array.from(document.body.querySelectorAll<E>(selector));
const byText = (selector: string, text: string): HTMLElement => must(queryAll(selector).find((el) => el.textContent?.trim() === text), `${selector} with text "${text}"`);
const textOf = (id: string): string => must(document.getElementById(id), `#${id}`).textContent ?? '';

function click(element: Element): void {
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

/** Types into a React-controlled input the way a browser does: set the native value, then fire `input`. */
function type(input: HTMLInputElement, text: string): void {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  act(() => {
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    if (setter) setter.call(input, text);
    else input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function blur(input: HTMLInputElement): void {
  act(() => {
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  });
}

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('Field', () => {
  it('wires the label, the hint and the error to the control', () => {
    render(<TextField label="Visitor name" hint="As written on the ID card." error="Enter the visitor’s name." value="" onChange={() => undefined} required />);
    const input = query<HTMLInputElement>('input');
    const label = query<HTMLLabelElement>('label');
    expect(label.htmlFor).toBe(input.id);
    expect(label.textContent).toContain('Visitor name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-required')).toBe('true');

    const described = must(input.getAttribute('aria-describedby'), 'aria-describedby').split(' ');
    expect(described).toHaveLength(2);
    // The error is read before the hint.
    expect(textOf(must(described[0], 'error id'))).toContain('Enter the visitor’s name.');
    expect(textOf(must(described[1], 'hint id'))).toContain('As written on the ID card.');
  });

  it('adds nothing when there is no hint, error or requirement', () => {
    render(<TextField label="Company" value="Horizon" onChange={() => undefined} />);
    const input = query<HTMLInputElement>('input');
    expect(input.value).toBe('Horizon');
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-required')).toBe(false);
  });

  it('hands the same wiring to any control through its render prop', () => {
    render(
      <Field label="Notes" hint="Optional." id="notes">
        {(control) => <textarea {...controlProps(control)} />}
      </Field>,
    );
    const area = query<HTMLTextAreaElement>('textarea');
    expect(area.id).toBe('notes');
    expect(query<HTMLLabelElement>('label').htmlFor).toBe('notes');
    expect(textOf(must(area.getAttribute('aria-describedby'), 'aria-describedby'))).toBe('Optional.');
  });

  it('reports what is typed', () => {
    const seen: string[] = [];
    render(
      <Controlled initial="" onValue={(value: string) => seen.push(value)}>
        {(value, set) => <TextField label="Plate" value={value} onChange={set} />}
      </Controlled>,
    );
    type(query<HTMLInputElement>('input'), '48213');
    expect(seen).toEqual(['48213']);
    expect(query<HTMLInputElement>('input').value).toBe('48213');
  });
});

describe('NumberField', () => {
  it('reads numbers the way people type them', () => {
    expect(parseNumber('18,750')).toBe(18750);
    expect(parseNumber('١٨٬٧٥٠')).toBe(18750);
    expect(parseNumber('۱۲۳')).toBe(123);
    expect(parseNumber(' 5 000 ')).toBe(5000);
    expect(parseNumber('12.5', 1)).toBe(12.5);
    expect(parseNumber('١٢٫٥', 1)).toBe(12.5);
    expect(parseNumber('12.7')).toBe(13);
    expect(parseNumber('0')).toBe(0);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('12abc')).toBeNull();
  });

  it('keeps letters and stray symbols out of the field', () => {
    expect(cleanNumberInput('ab12c3')).toBe('123');
    expect(cleanNumberInput('١٢٣')).toBe('123');
    expect(cleanNumberInput('12.7')).toBe('12');
    expect(cleanNumberInput('12.345', 2)).toBe('12.34');
    expect(cleanNumberInput('1.2.3', 2)).toBe('1.23');
    expect(cleanNumberInput('12345678901234567890')).toHaveLength(12);
  });

  it('parses while typing and groups the digits when focus leaves', () => {
    const seen: (number | null)[] = [];
    render(
      <Controlled initial={null as number | null} onValue={(value) => seen.push(value)}>
        {(value, set) => <NumberField label="Area needed" unit="m²" value={value} onChange={set} />}
      </Controlled>,
    );
    const input = query<HTMLInputElement>('input');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.value).toBe('');

    type(input, '١٢٣٤٥');
    expect(seen.at(-1)).toBe(12345);
    expect(input.value).toBe('12345');

    type(input, '12345x');
    expect(input.value).toBe('12345');

    blur(input);
    expect(input.value).toBe('12,345');

    type(input, '');
    expect(seen.at(-1)).toBeNull();
    blur(input);
    expect(input.value).toBe('');
  });

  it('shows a given value grouped and describes the field with its unit', () => {
    render(<NumberField label="Expected investment" unit="QAR" value={12_500_000} onChange={() => undefined} />, 'ar');
    const input = query<HTMLInputElement>('input');
    // Western digits in Arabic too.
    expect(input.value).toBe('12,500,000');
    expect(textOf(must(input.getAttribute('aria-describedby'), 'aria-describedby'))).toBe('QAR');
  });
});

describe('SelectField', () => {
  const passes = [
    { value: 'visitor', label: 'Visitor', hint: 'For one day' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'vehicle', label: 'Vehicle' },
  ];
  const zoneList = ['Mesaieed', 'Al Karaana', 'Al Khor', 'Birkat Al Awamer', 'Al Wakra', 'Jery Al Samur', 'Aba Saleel'].map((name, index) => ({ value: `z${index}`, label: name, keywords: index === 3 ? 'بركة العوامر BA' : undefined }));

  it('shows up to five options as radio tiles and selects one', () => {
    const seen: (string | null)[] = [];
    render(
      <Controlled initial={null as string | null} onValue={(value) => seen.push(value)}>
        {(value, set) => <SelectField label="Pass type" options={passes} value={value} onChange={set} required />}
      </Controlled>,
    );
    const group = query('[role="radiogroup"]');
    expect(textOf(must(group.getAttribute('aria-labelledby'), 'aria-labelledby'))).toContain('Pass type');
    expect(group.getAttribute('aria-required')).toBe('true');

    const radios = queryAll<HTMLInputElement>('input[type="radio"]');
    expect(radios).toHaveLength(3);
    expect(radios.every((radio) => !radio.checked)).toBe(true);
    // One group: the radios share a name, so the arrow keys move between them.
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);

    click(must(radios[1], 'second radio'));
    expect(seen).toEqual(['contractor']);
    const after = queryAll<HTMLInputElement>('input[type="radio"]');
    expect(after.map((radio) => radio.checked)).toEqual([false, true, false]);
  });

  it('opens a searchable sheet for a long list and selects from it', () => {
    vi.useFakeTimers();
    const seen: (string | null)[] = [];
    render(
      <Controlled initial={null as string | null} onValue={(value) => seen.push(value)}>
        {(value, set) => <SelectField label="Zone" options={zoneList} value={value} onChange={set} placeholder="Choose a zone" />}
      </Controlled>,
    );
    expect(queryAll('input[type="radio"]')).toHaveLength(0);
    const trigger = query<HTMLButtonElement>('button[aria-haspopup="dialog"]');
    expect(trigger.textContent).toContain('Choose a zone');
    expect(queryAll('[role="option"]')).toHaveLength(0);

    click(trigger);
    expect(queryAll('[role="option"]')).toHaveLength(zoneList.length);

    // The search understands the other language through the option's keywords.
    type(query<HTMLInputElement>('[role="searchbox"]'), 'بركه');
    const filtered = queryAll('[role="option"]');
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.textContent).toContain('Birkat Al Awamer');

    type(query<HTMLInputElement>('[role="searchbox"]'), 'zzz');
    expect(queryAll('[role="option"]')).toHaveLength(0);
    expect(query('[role="status"]').textContent).toBe('No matching results');

    type(query<HTMLInputElement>('[role="searchbox"]'), 'al w');
    click(byText('[role="option"]', 'Al Wakra'));
    expect(seen).toEqual(['z4']);

    // The sheet closes (after its closing animation) and the field shows the choice.
    advance(400);
    expect(queryAll('[role="option"]')).toHaveLength(0);
    expect(query<HTMLButtonElement>('button[aria-haspopup="dialog"]').textContent).toContain('Al Wakra');
  });
});

describe('Toggle and Checkbox', () => {
  it('is a switch that says whether it is on', () => {
    render(
      <Controlled initial={false}>{(value, set) => <Toggle label="Request notifications" hint="Whenever a request changes." checked={value} onChange={set} />}</Controlled>,
    );
    const control = query<HTMLButtonElement>('[role="switch"]');
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(query<HTMLLabelElement>('label').htmlFor).toBe(control.id);
    expect(textOf(must(control.getAttribute('aria-describedby'), 'aria-describedby'))).toBe('Whenever a request changes.');

    click(control);
    expect(query('[role="switch"]').getAttribute('aria-checked')).toBe('true');
    click(query('[role="switch"]'));
    expect(query('[role="switch"]').getAttribute('aria-checked')).toBe('false');
  });

  it('ticks a declaration and explains when it is missing', () => {
    render(<Controlled initial={false}>{(value, set) => <Checkbox label="I declare that the information is correct." checked={value} onChange={set} error={value ? undefined : 'We need your declaration.'} required />}</Controlled>);
    const box = query<HTMLInputElement>('input[type="checkbox"]');
    expect(box.checked).toBe(false);
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(textOf(must(box.getAttribute('aria-describedby'), 'aria-describedby'))).toContain('We need your declaration.');

    click(box);
    const ticked = query<HTMLInputElement>('input[type="checkbox"]');
    expect(ticked.checked).toBe(true);
    expect(ticked.hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('FilePick', () => {
  it('checks a chosen document and then shows it as verified', () => {
    vi.useFakeTimers();
    const seen: (PickedFile | null)[] = [];
    render(
      <Controlled initial={null as PickedFile | null} onValue={(value) => seen.push(value)}>
        {(value, set) => <FilePick label="Business plan" hint="PDF or image" value={value} onChange={set} required />}
      </Controlled>,
    );
    const state = () => query('[role="group"]').getAttribute('data-state');
    const status = () => query('[role="status"]').textContent;
    expect(state()).toBe('empty');
    expect(status()).toBe('');

    click(byText('button', 'Use a sample file'));
    expect(state()).toBe('checking');
    expect(status()).toBe('Checking the document…');
    expect(seen).toEqual([]);

    advance(FILE_CHECK_MS - 100);
    expect(state()).toBe('checking');

    advance(200);
    expect(state()).toBe('verified');
    expect(status()).toBe('Checked: the document is readable');
    expect(seen).toHaveLength(1);
    // Only the name and the size are kept.
    expect(Object.keys(must(seen[0], 'file')).sort()).toEqual(['name', 'size']);
    expect(seen[0]?.name).toBe('Business plan (sample).pdf');
    expect(document.body.textContent).toContain('Business plan (sample).pdf');
    expect(document.body.textContent).toContain('KB');

    click(byText('button', 'Remove'));
    expect(seen.at(-1)).toBeNull();
    expect(state()).toBe('empty');
  });

  it('does not report a document when it goes away mid-check', () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<FilePick label="Trade licence" value={null} onChange={onChange} />);
    click(byText('button', 'Use a sample file'));
    act(() => root.render(null));
    advance(FILE_CHECK_MS * 2);
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('QR', () => {
  it('renders a real code as an svg with modules', () => {
    render(<QR value="MANATEQ-ONE-DEMO/VERIFY/MQ-2611-0042" label="Verification code of the lease contract" size={160} />);
    const svg = query<SVGSVGElement>('svg[role="img"]');
    expect(svg.getAttribute('aria-label')).toBe('Verification code of the lease contract');
    const modules = Number(svg.getAttribute('data-modules'));
    expect(modules).toBeGreaterThanOrEqual(21);
    // QR sizes go 21, 25, 29…
    expect((modules - 17) % 4).toBe(0);
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${modules + QUIET_ZONE * 2} ${modules + QUIET_ZONE * 2}`);
    const path = must(svg.querySelector('path'), 'path').getAttribute('d') ?? '';
    expect((path.match(/M/g) ?? []).length).toBeGreaterThan(50);
  });

  it('draws the finder pattern, is stable, and carries Arabic text', () => {
    const first = must(qrMatrix('MQ-2611-0042'), 'matrix');
    // Every QR code starts with seven dark modules: the top edge of the first finder pattern.
    expect(first.path.startsWith(`M${QUIET_ZONE} ${QUIET_ZONE}h7v1h-7z`)).toBe(true);
    expect(first.box).toBe(first.modules + QUIET_ZONE * 2);
    expect(qrMatrix('MQ-2611-0042')?.path).toBe(first.path);
    expect(qrMatrix('MQ-2611-0043')?.path).not.toBe(first.path);
    const arabic = must(qrMatrix('عقد إيجار القطعة'), 'arabic matrix');
    expect(arabic.modules).toBeGreaterThanOrEqual(21);
    // Far more than a QR code can hold.
    expect(qrMatrix('x'.repeat(5000))).toBeNull();
  });
});

describe('Stepper', () => {
  it('is a progress bar with the step as its value', () => {
    render(<Stepper current={2} total={4} label="Step 2 of 4" />);
    const bar = query('[role="progressbar"]');
    expect(bar.getAttribute('aria-valuenow')).toBe('2');
    expect(bar.getAttribute('aria-valuemax')).toBe('4');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-label')).toBe('Step 2 of 4');
    expect(bar.children).toHaveLength(4);
  });

  it('keeps the value inside the range', () => {
    render(<Stepper current={9} total={3} label="Step 3 of 3" />);
    expect(query('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('3');
    render(<Stepper current={0} total={3} label="Step 1 of 3" />);
    expect(query('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('1');
  });
});

describe('SearchField', () => {
  it('is a search box that submits on Enter and can be cleared', () => {
    const submitted: string[] = [];
    render(<Controlled initial="">{(value, set) => <SearchField label="What do you want to get done?" value={value} onChange={set} onSubmit={(text) => submitted.push(text)} />}</Controlled>);
    const box = query<HTMLInputElement>('[role="searchbox"]');
    expect(box.getAttribute('aria-label')).toBe('What do you want to get done?');
    expect(queryAll('button')).toHaveLength(0);

    type(box, ' gate pass ');
    act(() => {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    });
    expect(submitted).toEqual(['gate pass']);

    click(query('button'));
    expect(query<HTMLInputElement>('[role="searchbox"]').value).toBe('');
  });
});

describe('transaction sheets', () => {
  it('pays in three steps and reports the payment once', () => {
    vi.useFakeTimers();
    const onPaid = vi.fn();
    const onClose = vi.fn();
    render(<PaySheet open onClose={onClose} title="Pay the rent invoice" lines={[{ label: 'Invoice', value: 'INV-2611-018' }]} amount={18750} reference="RCT-2611-0046" onPaid={onPaid} />);
    expect(document.body.textContent).toContain('Simulation: nothing is charged.');
    expect(document.body.textContent).toContain('INV-2611-018');
    // No card number, no credentials: the only inputs are the two stand-in methods.
    expect(queryAll('input').every((input) => input.getAttribute('type') === 'radio')).toBe(true);
    expect(queryAll('input')).toHaveLength(2);

    click(byText('button', 'Pay QAR 18,750'));
    expect(query('[role="status"]').textContent).toBe('Processing the payment…');
    expect(onPaid).not.toHaveBeenCalled();

    advance(PAY_MS + 50);
    expect(document.body.textContent).toContain('Payment complete');
    expect(document.body.textContent).toContain('RCT-2611-0046');
    expect(onPaid).not.toHaveBeenCalled();

    click(byText('button', 'Done'));
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks for a signature and consent before it signs', () => {
    vi.useFakeTimers();
    const onSigned = vi.fn();
    const onClose = vi.fn();
    render(<SignSheet open onClose={onClose} title="Sign the lease contract" documentName="Lease contract for plot BA-2-117" lines={[{ label: 'Term', value: '25 years' }]} signerName="Khalid Al-Marri" onSigned={onSigned} />);
    expect(document.body.textContent).toContain('E-signature simulation');

    click(byText('button', 'Sign'));
    expect(document.body.textContent).toContain('Add your signature first');
    expect(document.body.textContent).toContain('Confirm that you agree before you sign.');

    // The keyboard-accessible way to sign.
    click(byText('button', 'Adopt my signature'));
    click(query<HTMLInputElement>('input[type="checkbox"]'));
    expect(document.body.textContent).not.toContain('Add your signature first');

    click(byText('button', 'Sign'));
    expect(queryAll('[role="status"]').map((status) => status.textContent)).toContain('Signing…');
    expect(onSigned).not.toHaveBeenCalled();
    advance(SIGN_MS + 50);
    expect(document.body.textContent).toContain('Signed');
    expect(document.body.textContent).toContain('saved in your wallet');

    click(byText('button', 'Done'));
    expect(onSigned).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('small pieces', () => {
  it('makes initials for Latin and Arabic names', () => {
    expect(initials('Khalid Al-Marri')).toBe('KA');
    expect(initials('mariam')).toBe('M');
    expect(initials('خالد المري')).toBe('خ‌م');
    expect(initials('شركة الأفق للخدمات اللوجستية')).toBe('أ‌ل');
    expect(initials('شركة المثال للصناعات')).toBe('م‌ص');
    expect(initials('Example Industries Co.')).toBe('EI');
    expect(initials('   ')).toBe('');
    render(<Avatar name="Khalid Al-Marri" label="Khalid Al-Marri" />);
    expect(query('[role="img"]').textContent).toBe('KA');
  });

  it('writes money in the order of each language', () => {
    render(<Money amount={18750} />, 'en');
    expect(query('span').textContent?.replace(/\s+/g, ' ')).toBe('QARQatari riyals 18,750');
    render(<Money amount={18750} />, 'ar');
    expect(query('span').textContent?.replace(/\s+/g, ' ')).toBe('18,750 ر.قريال قطري');
  });

  it('moves between ISO dates and milliseconds without shifting the day', () => {
    const ms = must(isoDateToMs('2026-11-24'), 'ms');
    expect(new Date(ms).getDate()).toBe(24);
    expect(msToIsoDate(ms)).toBe('2026-11-24');
    expect(isoDateToMs('2026-02-30')).toBeNull();
    expect(isoDateToMs('24/11/2026')).toBeNull();
    expect(isoDateToMs(null)).toBeNull();
  });

  it('announces errors and labels the prototype', () => {
    render(
      <>
        <Banner tone="bad">The request could not be sent.</Banner>
        <Banner tone="demo">Simulation</Banner>
        <DemoPill />
        <DemoPill kind="indicative" />
      </>,
      'ar',
    );
    expect(query('[role="alert"]').textContent).toContain('The request could not be sent.');
    expect(queryAll('[role="note"]')).toHaveLength(1);
    expect(document.body.textContent).toContain('نسخة تجريبية');
    expect(document.body.textContent).toContain('استرشادي');
  });

  it('heads an empty state with a decorative render, or an icon when no render fits', () => {
    render(<EmptyState render="plot" title="No plots yet" body="The plots you lease appear here." />, 'en');
    const img = query<HTMLImageElement>('img');
    expect(img.getAttribute('alt')).toBe('');
    expect(query('h2').textContent).toBe('No plots yet');
    render(<EmptyState icon={Inbox} title="No requests in progress" level={3} />, 'en');
    expect(document.body.querySelector('img')).toBeNull();
    expect(query('[aria-hidden="true"] svg')).toBeTruthy();
    expect(query('h3').textContent).toBe('No requests in progress');
  });
});
