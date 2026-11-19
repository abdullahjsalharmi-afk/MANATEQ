/** Zero-width non-joiner: keeps two Arabic initials from joining into one word. */
const ZWNJ = '‌';

/** The first letter of a word, without the Arabic article: "الخليج" gives "خ". */
function lead(word: string): string {
  const bare = word.length > 3 && word.startsWith('ال') ? word.slice(2) : word;
  return Array.from(bare.replace(/^[^\p{L}\p{N}]+/u, ''))[0] ?? '';
}

/**
 * Up to two initials for a person or a company: the first letters of the first and the last word.
 * "Khalid Al-Marri" gives "KA"; "خالد المري" gives "خ م" as two separate letters.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = lead(words[0] ?? '');
  const last = words.length > 1 ? lead(words[words.length - 1] ?? '') : '';
  if (!first) return '';
  if (/\p{Script=Arabic}/u.test(first)) return last ? `${first}${ZWNJ}${last}` : first;
  return (first + last).toLocaleUpperCase('en');
}
