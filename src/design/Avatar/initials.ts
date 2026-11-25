/** Zero-width non-joiner: keeps two Arabic initials from joining into one word. */
const ZWNJ = '‌';

/** Words that say what kind of body it is, not what it is called: they give no initial. */
const GENERIC = new Set(['شركة', 'مؤسسة', 'مجموعة', 'مصنع', 'مصانع', 'co', 'co.', 'company', 'ltd', 'ltd.', 'llc', 'w.l.l', 'w.l.l.']);

/** The first letter of a word, without the Arabic article (alone or after "لـ"): "الخليج" and "للخليج" give "خ". */
function lead(word: string): string {
  let bare = word;
  if (bare.length > 3 && bare.startsWith('ال')) bare = bare.slice(2);
  else if (bare.length > 3 && bare.startsWith('لل')) bare = bare.slice(2);
  return Array.from(bare.replace(/^[^\p{L}\p{N}]+/u, ''))[0] ?? '';
}

/**
 * Up to two initials for a person or a company: the first letters of the first and the last word that name it.
 * "Khalid Al-Marri" gives "KA"; "خالد المري" gives "خ م" as two separate letters; in "شركة المثال للصناعات"
 * the word "شركة" is skipped, giving "م ص".
 */
export function initials(name: string): string {
  const all = name.trim().split(/\s+/).filter(Boolean);
  const named = all.filter((word) => !GENERIC.has(word.toLocaleLowerCase('en')));
  const words = named.length ? named : all;
  const first = lead(words[0] ?? '');
  const last = words.length > 1 ? lead(words[words.length - 1] ?? '') : '';
  if (!first) return '';
  if (/\p{Script=Arabic}/u.test(first)) return last ? `${first}${ZWNJ}${last}` : first;
  return (first + last).toLocaleUpperCase('en');
}
