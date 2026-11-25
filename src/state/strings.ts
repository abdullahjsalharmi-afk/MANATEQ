/**
 * Bilingual text the state layer writes into the demo world: notifications, invoice titles and the
 * few fixed words of the demo personas. Screens read it with `pick()` like any other data text.
 */
import { langTools, ltr } from '@/app/i18n';
import type { L10n } from '@/data/types';
import { DOT, keepWhole } from '@/domain/text';

const AR = langTools('ar').fmt;
const EN = langTools('en').fmt;

/**
 * "A · B · C" in both languages; empty parts are left out. A plain string is a code (a plot number, a
 * reference): it reads left to right inside Arabic and never breaks across lines. The dot stays with
 * the item that follows it.
 */
export function dots(...parts: (L10n | string | undefined)[]): L10n {
  const present = parts.filter((part): part is L10n | string => part !== undefined && part !== '');
  return {
    ar: present.map((part) => (typeof part === 'string' ? ltr(part) : part.ar)).join(DOT),
    en: present.map((part) => (typeof part === 'string' ? keepWhole(part) : part.en)).join(DOT),
  };
}

/** An amount and a date, each kept on one line. */
export const moneyText = (amount: number): L10n => ({ ar: keepWhole(AR.money(amount)), en: keepWhole(EN.money(amount)) });
export const dateText = (at: number): L10n => ({ ar: keepWhole(AR.date(at)), en: keepWhole(EN.date(at)) });
/** A date and a clock time, e.g. «29 نوفمبر 2026، 10:00 ص» / "29 Nov 2026, 10:00 am". */
export const dateTimeText = (at: number): L10n => ({ ar: `${keepWhole(AR.date(at))}، ${keepWhole(AR.time(at))}`, en: `${keepWhole(EN.date(at))}, ${keepWhole(EN.time(at))}` });

const QUARTER_AR = ['الأول', 'الثاني', 'الثالث', 'الرابع'] as const;

/** "إيجار الربع الرابع 2026 · BA-121" / "Rent, Q4 2026 · BA-121", or the annual rent of a one-year lease. */
export function rentTitle(period: 'quarter' | 'year', at: number, plotNumber: string): L10n {
  const date = new Date(at);
  const year = date.getFullYear();
  if (period === 'year') return dots({ ar: `الإيجار السنوي ${year}`, en: `Annual rent ${year}` }, plotNumber);
  const quarter = Math.floor(date.getMonth() / 3);
  return dots({ ar: `إيجار الربع ${QUARTER_AR[quarter] ?? ''} ${year}`, en: `Rent, Q${quarter + 1} ${year}` }, plotNumber);
}

export const text = {
  needsYou: { ar: 'طلبك بانتظار إجراء منك', en: 'Your request needs an action from you' },
  invoiceIssued: { ar: 'صدرت فاتورة جديدة', en: 'A new invoice was issued' },
  invoiceOverdue: { ar: 'فاتورة تجاوزت موعد استحقاقها', en: 'An invoice is past its due date' },
  invoiceDueSoon: { ar: 'فاتورة يقترب موعد استحقاقها', en: 'An invoice is due soon' },
  dueOn: { ar: 'تستحق في {date}', en: 'Due on {date}' },
  payment: { ar: 'سداد', en: 'Payment' },
  paymentReceived: { ar: 'استلمنا سدادك، والإيصال في «وثائقي وتصاريحي»', en: 'Payment received. The receipt is in Documents and passes' },
  reopened: { ar: 'أعدنا فتح البلاغ ليراجعه المشرف', en: 'We reopened the report for the supervisor' },
  reopenedBody: { ar: 'تقييمك {stars} من 5؛ سيعيد المشرف إرسال أمر العمل ثم نطلب تقييمك مرة أخرى', en: 'You rated it {stars} out of 5. The supervisor will send the work order again, then we will ask for your rating once more' },
  reopenedRequest: { ar: 'أعدنا فتح طلبك لدى مشرف مركز خدمات الأعمال', en: 'We reopened your request for the Business Services Center supervisor' },
  reopenedComplaint: { ar: 'أعدنا فتح شكواك لدى مشرف مركز خدمات الأعمال', en: 'We reopened your complaint for the Business Services Center supervisor' },
  reopenedHandlingBody: { ar: 'تقييمك {stars} من 5؛ ستُراجَع المعالجة ثم نطلب تقييمك مرة أخرى', en: 'You rated it {stars} out of 5. The handling will be reviewed, then we will ask for your rating once more' },
  appointmentBooked: { ar: 'حجزنا موعدك في مركز خدمات الأعمال', en: 'Your Business Services Center appointment is booked' },
  yes: { ar: 'نعم', en: 'Yes' },
  no: { ar: 'لا', en: 'No' },
  you: { ar: 'أنت', en: 'You' },
} as const;

/** Fills `{name}` placeholders in both languages. A plain string value is used as is in both. */
export function fill(template: L10n, vars: Record<string, L10n | string | number>): L10n {
  const side = (lang: 'ar' | 'en') =>
    template[lang].replace(/\{(\w+)\}/g, (whole, key: string) => {
      const value = vars[key];
      if (value === undefined) return whole;
      return typeof value === 'object' ? value[lang] : String(value);
    });
  return { ar: side('ar'), en: side('en') };
}
