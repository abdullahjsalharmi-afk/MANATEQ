/** Splits notifications (already latest first) into today and earlier, by the local calendar day. */
export interface Grouped<T> {
  today: T[];
  earlier: T[];
}

export function startOfDay(ms: number): number {
  const day = new Date(ms);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

export function groupByDay<T extends { at: number }>(items: readonly T[], now: number): Grouped<T> {
  const cut = startOfDay(now);
  const today: T[] = [];
  const earlier: T[] = [];
  for (const item of items) (item.at >= cut ? today : earlier).push(item);
  return { today, earlier };
}
