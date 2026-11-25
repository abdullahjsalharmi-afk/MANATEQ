/**
 * Search over the service catalogue, zones and solutions — in Arabic and English at once.
 * Arabic is normalised so that spelling variants match (أ/إ/آ → ا, ة → ه, ى → ي, diacritics and tatweel removed).
 */
import type { L10n } from '@/data/types';

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Arabic words often carry the article "ال" or a leading و/ب/ل; matching ignores them. */
function stem(token: string): string {
  let t = token;
  if (t.length > 4 && /^(وال|بال|لل|كال|فال)/.test(t)) t = t.replace(/^(وال|بال|كال|فال)/, '').replace(/^لل/, '');
  else if (t.length > 3 && t.startsWith('ال')) t = t.slice(2);
  return t;
}

/**
 * The Arabic article as it is written in English place names: "Al Wakra", "El Khor", and its assimilated forms
 * before a sun letter ("Ad Dawhah", "Ar Rayyan", "As Salwa", "Ash Shamal", "At Taawun", "Az Zubarah"). Like «ال»
 * in Arabic, it is ignored, so "Wakra", "Al Wakra" and "Al-Wakra" are one name.
 */
const LATIN_ARTICLES = new Set(['al', 'el', 'ad', 'ar', 'as', 'ash', 'at', 'az', 'adh', 'ath', 'an']);

/**
 * One English transliteration of an Arabic word, whatever the spelling: a final «ة» or «ه» is written with or
 * without an "h" ("Wakrah" / "Wakra", "Dohah" / "Doha"), so a final h after a vowel is dropped.
 */
function latin(token: string): string {
  if (!/^[a-z]+$/.test(token)) return token;
  if (token.length >= 4 && /[aeiou]h$/.test(token)) return token.slice(0, -1);
  return token;
}

export function tokens(text: string): string[] {
  const all = normalise(text)
    .split(' ')
    .filter(Boolean)
    .map((token) => latin(stem(token)));
  // Articles count only when nothing else was written ("al" alone still searches).
  const words = all.filter((token) => !LATIN_ARTICLES.has(token));
  return words.length ? words : all;
}

export interface SearchDoc<T> {
  item: T;
  /** Text fields in order of importance: the first is the title. */
  fields: (L10n | string | undefined)[];
  /** Extra exact keys, e.g. a service code such as "A4". */
  keys?: string[];
}

export interface SearchIndex<T> {
  search(query: string, limit?: number): T[];
}

interface Prepared<T> {
  item: T;
  fields: string[][];
  keys: string[];
}

const FIELD_WEIGHT = [10, 5, 3, 2, 1];

/** A word written in Latin letters (a number or a reference keeps matching inside: "0051" in a longer code). */
const LATIN_WORD = /^[a-z]+$/;

export function buildIndex<T>(docs: SearchDoc<T>[]): SearchIndex<T> {
  const prepared: Prepared<T>[] = docs.map((doc) => ({
    item: doc.item,
    fields: doc.fields.map((field) => {
      if (!field) return [];
      return typeof field === 'string' ? tokens(field) : tokens(`${field.ar} ${field.en}`);
    }),
    keys: (doc.keys ?? []).map((key) => key.toLowerCase()),
  }));

  return {
    search(query, limit = 20) {
      const wanted = tokens(query);
      const raw = query.trim().toLowerCase();
      if (!wanted.length) return [];
      const scored: { item: T; score: number }[] = [];
      for (const doc of prepared) {
        let score = doc.keys.includes(raw) ? 100 : 0;
        let matchedAll = true;
        for (const want of wanted) {
          let best = 0;
          doc.fields.forEach((fieldTokens, fieldIndex) => {
            const weight = FIELD_WEIGHT[fieldIndex] ?? 1;
            for (const have of fieldTokens) {
              if (have === want) best = Math.max(best, weight * 3);
              else if (have.startsWith(want) && want.length >= 2) best = Math.max(best, weight * 2);
              // Inside a word: for Arabic, whose words carry attached letters. In Latin script it is noise
              // ("rent" inside "current" and "transparent"), so a Latin word matches from its start only.
              else if (want.length >= 3 && !LATIN_WORD.test(want) && have.includes(want)) best = Math.max(best, weight);
            }
          });
          if (best === 0) matchedAll = false;
          score += best;
        }
        if (score > 0 && (matchedAll || score >= 100)) scored.push({ item: doc.item, score });
      }
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, limit).map((entry) => entry.item);
    },
  };
}
