/**
 * Language, direction and formatting.
 *
 * - UI strings live next to the feature that uses them: `const strings = { hello: { ar: '…', en: '…' } } as const`
 *   and are read with `const t = useT(strings)` → `t('hello')`, with `{name}` placeholders.
 * - Data text is bilingual (`L10n`) and is read with `pick()`.
 * - Numbers use Western digits in both languages, as Qatar's government services do.
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { L10n, Lang } from '@/data/types';

export type Dir = 'rtl' | 'ltr';
export type Vars = Record<string, string | number>;

/** Plural forms. Arabic needs one / two / few (3–10) / many (11–99) / other; English one / other. */
export interface PluralForms {
  ar: { one: string; two: string; few: string; many: string; other?: string };
  en: { one: string; other: string };
}

const LOCALE: Record<Lang, string> = { ar: 'ar-QA-u-nu-latn-ca-gregory', en: 'en-GB' };

const LRI = '\u2066';
const PDI = '\u2069';
/** WORD JOINER: invisible, forbids a line break where it stands. */
const WJ = '\u2060';
/** NO-BREAK SPACE. */
const NBSP = '\u00A0';

/**
 * Keeps a code whole on one line: no break after the hyphens of «AW-116», «RCP-2026-0049», «TSD-58SD-7KX8».
 * The hyphen itself is unchanged (a word joiner follows it), so the code reads, copies and pastes as before
 * once the joiner is ignored. Use it for codes in text that is not passed through `ltr()`.
 */
export function keep(text: string | number): string {
  return String(text).replace(/(\S)-(?=\S)/g, `$1-${WJ}`);
}

/** Wraps a left-to-right fragment (a reference number, a percentage, Latin text) so it keeps its order inside Arabic, and keeps a code whole. */
export function ltr(text: string | number): string {
  return `${LRI}${keep(text)}${PDI}`;
}

/** Joins the words of a short value (a date, an amount) with no-break spaces, so it never splits across lines. */
function whole(text: string): string {
  return text.replace(/ /g, NBSP);
}

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
/** The mean Gregorian month and year. */
const MONTH = 30.436875 * DAY;
const YEAR = 365.2425 * DAY;
/** `relative()` counts in days up to this many days, then in months up to RELATIVE_MAX_MONTHS, then in years. */
export const RELATIVE_MAX_DAYS = 60;
export const RELATIVE_MAX_MONTHS = 24;

export interface Formatters {
  /** 18,750 */
  num(n: number, maxFractionDigits?: number): string;
  /** 18,750 ر.ق · QAR 18,750 (one unbreakable unit) */
  money(n: number): string;
  /** 5,000 م² · 5,000 m² */
  area(n: number): string;
  /** 48.6 مليون م² · 48.6M m² */
  areaShort(n: number): string;
  /** 94% (always left-to-right) */
  pct(n: number): string;
  /** 19 نوفمبر 2026 · 19 Nov 2026 (one unbreakable unit) */
  date(ms: number): string;
  /** 19 نوفمبر · 19 Nov */
  dayMonth(ms: number): string;
  /** 9:30 ص · 9:30 am */
  time(ms: number): string;
  /** خلال 5 أيام · in 5 days · أمس · yesterday · in 15 months · 3 years ago (days up to 60, months up to 24, then years). */
  relative(ms: number, now: number): string;
  /** Chooses the plural form for `n` and fills `{n}`. */
  plural(n: number, forms: PluralForms): string;
  /** A left-to-right fragment, e.g. a reference number, kept on one line. */
  ltr(text: string | number): string;
  /** A code kept on one line, without the direction isolates (English text). */
  keep(text: string | number): string;
}

export function makeFormatters(lang: Lang): Formatters {
  const locale = LOCALE[lang];
  const int = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: lang === 'ar' ? 'long' : 'short', year: 'numeric' });
  const dayMonthFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: lang === 'ar' ? 'long' : 'short' });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
  const rel = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const relNumeric = new Intl.RelativeTimeFormat(locale, { numeric: 'always' });
  const rules = new Intl.PluralRules(lang === 'ar' ? 'ar' : 'en');

  const num = (n: number, maxFractionDigits = 0): string =>
    maxFractionDigits === 0 ? int.format(n) : new Intl.NumberFormat(locale, { maximumFractionDigits: maxFractionDigits }).format(n);

  return {
    num,
    money: (n) => whole(lang === 'ar' ? `${num(n)} ر.ق` : `QAR ${num(n)}`),
    area: (n) => whole(lang === 'ar' ? `${num(n)} م²` : `${num(n)} m²`),
    areaShort: (n) => {
      if (n >= 1_000_000) {
        const m = num(n / 1_000_000, 1);
        return whole(lang === 'ar' ? `${m} مليون م²` : `${m}M m²`);
      }
      return whole(lang === 'ar' ? `${num(n)} م²` : `${num(n)} m²`);
    },
    pct: (n) => ltr(`${num(n)}%`),
    date: (ms) => whole(dateFmt.format(ms)),
    dayMonth: (ms) => whole(dayMonthFmt.format(ms)),
    time: (ms) => timeFmt.format(ms),
    relative: (ms, now) => {
      const diff = ms - now;
      const abs = Math.abs(diff);
      const sign = diff < 0 ? -1 : 1;
      if (abs < MINUTE) return rel.format(0, 'minute');
      if (abs < HOUR) return rel.format(Math.round(diff / MINUTE), 'minute');
      if (abs < DAY) return rel.format(Math.round(diff / HOUR), 'hour');
      // Words such as "tomorrow" and "yesterday" only for days; a longer span always carries its number, so a date
      // 15 months away never reads "next year" (numeric: 'auto' would round 466 days to one year and say so).
      const days = Math.round(abs / DAY);
      if (days <= RELATIVE_MAX_DAYS) return rel.format(sign * days, 'day');
      const months = Math.round(abs / MONTH);
      if (months <= RELATIVE_MAX_MONTHS) return relNumeric.format(sign * months, 'month');
      return relNumeric.format(sign * Math.round(abs / YEAR), 'year');
    },
    plural: (n, forms) => {
      const rule = rules.select(n);
      let template: string;
      if (lang === 'ar') {
        const f = forms.ar;
        template = rule === 'one' ? f.one : rule === 'two' ? f.two : rule === 'few' ? f.few : rule === 'many' ? f.many : (f.other ?? f.many);
        if (rule === 'zero') template = f.other ?? f.many;
      } else {
        template = rule === 'one' ? forms.en.one : forms.en.other;
      }
      return interpolate(template, { n: num(n) });
    },
    ltr,
    keep,
  };
}

export interface LangValue {
  lang: Lang;
  dir: Dir;
  /** Reads a bilingual value in the current language (falls back to the other language when one is empty). */
  pick(text: L10n | null | undefined): string;
  fmt: Formatters;
}

function makeValue(lang: Lang): LangValue {
  return {
    lang,
    dir: lang === 'ar' ? 'rtl' : 'ltr',
    pick: (text) => (text ? text[lang] || text[lang === 'ar' ? 'en' : 'ar'] || '' : ''),
    fmt: makeFormatters(lang),
  };
}

const LangContext = createContext<LangValue>(makeValue('ar'));

export function LangProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => makeValue(lang), [lang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangValue {
  return useContext(LangContext);
}

/** Returns `t(key, vars?)` for a feature's strings table. */
export function useT<S extends Record<string, L10n>>(strings: S): (key: keyof S, vars?: Vars) => string {
  const { lang } = useLang();
  return useMemo(() => (key: keyof S, vars?: Vars) => interpolate((strings[key] as L10n)[lang], vars), [strings, lang]);
}

/** For code outside React (tests, actions): the same helpers for an explicit language. */
export function langTools(lang: Lang): LangValue {
  return makeValue(lang);
}
