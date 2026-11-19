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

const LRI = '⁦';
const PDI = '⁩';

/** Wraps a left-to-right fragment (a reference number, a percentage, Latin text) so it keeps its order inside Arabic. */
export function ltr(text: string | number): string {
  return `${LRI}${text}${PDI}`;
}

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key]) : whole));
}

export interface Formatters {
  /** 18,750 */
  num(n: number, maxFractionDigits?: number): string;
  /** 18,750 ر.ق · QAR 18,750 */
  money(n: number): string;
  /** 5,000 م² · 5,000 m² */
  area(n: number): string;
  /** 48.6 مليون م² · 48.6M m² */
  areaShort(n: number): string;
  /** 94% (always left-to-right) */
  pct(n: number): string;
  /** 19 نوفمبر 2026 · 19 Nov 2026 */
  date(ms: number): string;
  /** 19 نوفمبر · 19 Nov */
  dayMonth(ms: number): string;
  /** 9:30 ص · 9:30 am */
  time(ms: number): string;
  /** خلال 5 أيام · in 5 days · أمس · yesterday */
  relative(ms: number, now: number): string;
  /** Chooses the plural form for `n` and fills `{n}`. */
  plural(n: number, forms: PluralForms): string;
  /** A left-to-right fragment, e.g. a reference number. */
  ltr(text: string | number): string;
}

export function makeFormatters(lang: Lang): Formatters {
  const locale = LOCALE[lang];
  const int = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const dateFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: lang === 'ar' ? 'long' : 'short', year: 'numeric' });
  const dayMonthFmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: lang === 'ar' ? 'long' : 'short' });
  const timeFmt = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', hour12: true });
  const rel = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const rules = new Intl.PluralRules(lang === 'ar' ? 'ar' : 'en');

  const num = (n: number, maxFractionDigits = 0): string =>
    maxFractionDigits === 0 ? int.format(n) : new Intl.NumberFormat(locale, { maximumFractionDigits: maxFractionDigits }).format(n);

  return {
    num,
    money: (n) => (lang === 'ar' ? `${num(n)} ر.ق` : `QAR ${num(n)}`),
    area: (n) => (lang === 'ar' ? `${num(n)} م²` : `${num(n)} m²`),
    areaShort: (n) => {
      if (n >= 1_000_000) {
        const m = num(n / 1_000_000, 1);
        return lang === 'ar' ? `${m} مليون م²` : `${m}M m²`;
      }
      return lang === 'ar' ? `${num(n)} م²` : `${num(n)} m²`;
    },
    pct: (n) => ltr(`${num(n)}%`),
    date: (ms) => dateFmt.format(ms),
    dayMonth: (ms) => dayMonthFmt.format(ms),
    time: (ms) => timeFmt.format(ms),
    relative: (ms, now) => {
      const diff = ms - now;
      const abs = Math.abs(diff);
      const MIN = 60_000;
      const HOUR = 3_600_000;
      const DAY = 86_400_000;
      if (abs < MIN) return rel.format(0, 'minute');
      if (abs < HOUR) return rel.format(Math.round(diff / MIN), 'minute');
      if (abs < DAY) return rel.format(Math.round(diff / HOUR), 'hour');
      if (abs < 30 * DAY) return rel.format(Math.round(diff / DAY), 'day');
      if (abs < 365 * DAY) return rel.format(Math.round(diff / (30 * DAY)), 'month');
      return rel.format(Math.round(diff / (365 * DAY)), 'year');
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
