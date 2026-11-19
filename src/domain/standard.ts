/**
 * Service standards in words — the short figure of a published standard ("5 أيام عمل", "Instant") and
 * where a request stands against it ("اليوم 2 من 5"). Pure functions; every standard is indicative.
 */
import type { Lang, Standard, StandardUnit } from '@/data/types';
import type { StandardClock } from './simulation';

type TimedUnit = Exclude<StandardUnit, 'instant'>;

/** Arabic counts nouns in five ways; English in two. `{n}` is replaced by the number. */
interface CountForms {
  ar: { one: string; two: string; few: string; many: string; other: string };
  en: { one: string; other: string };
}

export type ArabicCount = 'one' | 'two' | 'few' | 'many' | 'other';

/**
 * The Arabic plural category of a whole number (CLDR): 1 · 2 · 3–10 · 11–99 · the rest (100, 101, 102 …).
 * The same pattern repeats every hundred: 103 counts like 3, 111 like 11.
 */
export function arabicCount(n: number): ArabicCount {
  if (!Number.isInteger(n) || n < 0) return 'other';
  if (n === 1) return 'one';
  if (n === 2) return 'two';
  const rest = n % 100;
  if (rest >= 3 && rest <= 10) return 'few';
  if (rest >= 11) return 'many';
  return 'other';
}

const digits = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** Chooses the form for `n` and fills in the number (Western digits in both languages). */
function count(n: number, forms: CountForms, lang: Lang): string {
  const template = lang === 'ar' ? forms.ar[arabicCount(n)] : n === 1 ? forms.en.one : forms.en.other;
  return template.replace('{n}', digits.format(n));
}

const INSTANT = { ar: 'فوري', en: 'Instant' } as const;

const UNITS: Record<TimedUnit, CountForms> = {
  minute: {
    ar: { one: 'دقيقة واحدة', two: 'دقيقتان', few: '{n} دقائق', many: '{n} دقيقة', other: '{n} دقيقة' },
    en: { one: '{n} minute', other: '{n} minutes' },
  },
  hour: {
    ar: { one: 'ساعة واحدة', two: 'ساعتان', few: '{n} ساعات', many: '{n} ساعة', other: '{n} ساعة' },
    en: { one: '{n} hour', other: '{n} hours' },
  },
  working_day: {
    ar: { one: 'يوم عمل واحد', two: 'يوما عمل', few: '{n} أيام عمل', many: '{n} يوم عمل', other: '{n} يوم عمل' },
    en: { one: '{n} working day', other: '{n} working days' },
  },
  day: {
    ar: { one: 'يوم واحد', two: 'يومان', few: '{n} أيام', many: '{n} يومًا', other: '{n} يوم' },
    en: { one: '{n} day', other: '{n} days' },
  },
  month: {
    ar: { one: 'شهر واحد', two: 'شهران', few: '{n} أشهر', many: '{n} شهرًا', other: '{n} شهر' },
    en: { one: '{n} month', other: '{n} months' },
  },
};

const DAYS_LEFT: CountForms = {
  ar: { one: 'بقي يوم واحد', two: 'بقي يومان', few: 'بقيت {n} أيام', many: 'بقي {n} يومًا', other: 'بقي {n} يوم' },
  en: { one: '{n} day left', other: '{n} days left' },
};

const DAYS_OVER: CountForms = {
  ar: {
    one: 'متأخر يومًا واحدًا عن المعيار',
    two: 'متأخر يومين عن المعيار',
    few: 'متأخر {n} أيام عن المعيار',
    many: 'متأخر {n} يومًا عن المعيار',
    other: 'متأخر {n} يوم عن المعيار',
  },
  en: { one: '{n} day over the standard', other: '{n} days over the standard' },
};

/** True when the standard promises an immediate result. */
export function isInstant(standard: Pick<Standard, 'value' | 'unit'>): boolean {
  return standard.unit === 'instant' || (standard.unit !== null && standard.value !== null && standard.value <= 0);
}

/** A duration in words: "5 أيام عمل" · "2 hours". */
export function durationText(value: number, unit: TimedUnit, lang: Lang): string {
  return count(value, UNITS[unit], lang);
}

/**
 * The short figure of a service standard: "فوري" · "يوم عمل واحد" · "5 أيام عمل" · "ساعتان" /
 * "Instant" · "1 working day" · "5 working days" · "2 hours". Null when the standard has no headline
 * duration (it is then described by its full text only).
 */
export function standardHeadline(standard: Pick<Standard, 'value' | 'unit'>, lang: Lang): string | null {
  if (isInstant(standard)) return INSTANT[lang];
  if (standard.value === null || standard.unit === null || standard.unit === 'instant') return null;
  return durationText(standard.value, standard.unit, lang);
}

export interface StandardFigure {
  /** The number, when the figure is written with digits ("5"); null when it is all words ("يوم عمل واحد", "فوري"). */
  value: string | null;
  /** The words after the number ("أيام عمل"), or the whole figure when there is no number. */
  words: string;
}

/** The headline split into its number and its words, for large displays. */
export function standardFigure(standard: Pick<Standard, 'value' | 'unit'>, lang: Lang): StandardFigure | null {
  const headline = standardHeadline(standard, lang);
  if (headline === null) return null;
  const match = /^([\d.,]+)\s+(.+)$/.exec(headline);
  return match ? { value: match[1] as string, words: match[2] as string } : { value: null, words: headline };
}

/**
 * Where a request stands against its standard: "اليوم 2 من 5" / "Day 2 of 5"; "اليوم 3" / "Day 3" when
 * the standard has no headline duration. Null for standards shorter than a day, which have no day count.
 */
export function dayOf(clock: Pick<StandardClock, 'dayNumber' | 'targetDays'>, lang: Lang): string | null {
  const target = clock.targetDays;
  if (target !== null && target < 1) return null;
  const day = digits.format(Math.max(1, Math.round(clock.dayNumber)));
  if (target === null) return lang === 'ar' ? `اليوم ${day}` : `Day ${day}`;
  const total = digits.format(Math.ceil(target));
  return lang === 'ar' ? `اليوم ${day} من ${total}` : `Day ${day} of ${total}`;
}

/**
 * The time left inside the standard, or how far past it the request is: "بقيت 3 أيام" / "3 days left",
 * "متأخر يومين عن المعيار" / "2 days over the standard". Null when there is no day count.
 */
export function timeLeft(clock: Pick<StandardClock, 'usedDays' | 'targetDays'>, lang: Lang): string | null {
  const target = clock.targetDays;
  if (target === null || target < 1) return null;
  const remaining = target - clock.usedDays;
  if (remaining >= 0) return count(Math.max(1, Math.ceil(remaining)), DAYS_LEFT, lang);
  return count(Math.max(1, Math.ceil(-remaining)), DAYS_OVER, lang);
}

export type ClockTone = 'accent' | 'warn' | 'bad';

/** Above this share of the standard a request is "close to the limit". */
export const CLOCK_WARN_RATIO = 0.8;

/** How a share of the standard is shown: calm, close to the limit (above 0.8) or past it (above 1). */
export function clockTone(ratio: number): ClockTone {
  if (ratio > 1) return 'bad';
  if (ratio > CLOCK_WARN_RATIO) return 'warn';
  return 'accent';
}
