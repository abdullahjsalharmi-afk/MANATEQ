/**
 * Which zones a query names (gate n=20). A query that is the name of a zone («أبا صليل», "Al Wakrah", "AW") puts
 * that zone first, above services whose text merely mentions it. A query names a zone when every word of it is a
 * word of the zone's name (Arabic or English, whole or the start of one) and at least one of them sets this zone
 * apart: the words many zone names share («مجمّع», "Logistics", "Park") are a kind of zone, not a name.
 */
import type { Zone } from '@/data/types';
import { tokens } from '@/domain/search';

/** A name word used by this many zones or more is a kind of zone, not a name. */
const COMMON = 3;

export interface ZoneNamer<T> {
  named(query: string): T[];
}

export function makeZoneNamer<T extends Pick<Zone, 'code' | 'name'>>(list: readonly T[]): ZoneNamer<T> {
  const names = list.map((zone) => ({ zone, words: [...new Set(tokens(`${zone.name.ar} ${zone.name.en}`))] }));
  const uses = new Map<string, number>();
  for (const { words } of names) for (const word of words) uses.set(word, (uses.get(word) ?? 0) + 1);
  const distinct = (word: string) => (uses.get(word) ?? 0) < COMMON;
  return {
    named(query) {
      const code = query.trim().toLowerCase();
      const wanted = tokens(query);
      if (!wanted.length) return [];
      return names
        .filter(({ zone, words }) => {
          if (zone.code.toLowerCase() === code) return true;
          const hits = wanted.map((want) => words.filter((word) => word === want || (want.length >= 3 && word.startsWith(want))));
          return hits.every((found) => found.length > 0) && hits.some((found) => found.some(distinct));
        })
        .map(({ zone }) => zone);
    },
  };
}

/**
 * The investor's plot that a query names: its number in any letter case, with or without its hyphen or a space
 * ("BA-121", "ba 121", "BA121"). Such a query is about that plot: the plot comes first, with the requests about it.
 */
export function namedPlot<T extends { id: string; number: string }>(plots: readonly T[], query: string): T | undefined {
  const plain = (value: string) => value.toLowerCase().replace(/[\s\u00a0\-\u2010\u2011\u2013]/g, '');
  const wanted = plain(query);
  if (wanted.length < 3) return undefined;
  return plots.find((plot) => plain(plot.number) === wanted || plain(plot.id) === wanted);
}
