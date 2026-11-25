/** Small pieces shared by the zones screens. */
import { useLang, useT } from '@/app/i18n';
import { cx, type RenderName } from '@/design/core';
import type { ReactNode } from 'react';
import type { Solution, SolutionKey, Zone } from '@/data/types';
import { zonePrice } from './model';
import styles from './parts.module.css';
import { strings } from './strings';

/** The render of each solution (SPEC 3.5). */
export const SOLUTION_RENDER: Record<SolutionKey, RenderName> = {
  industrial: 'factory',
  logistics: 'warehouse',
  commercial: 'showroom',
  openYard: 'yard',
  warehousing: 'units',
};

/** The render of a zone: the master plan for land zones, the park for warehousing. */
export const zoneRender = (zone: Zone): RenderName => (zone.kind === 'land' ? 'zone' : 'park');

/** Price strings, formatted for the current language. */
export function usePrices() {
  const t = useT(strings);
  const { fmt } = useLang();
  const perSqm = (amount: number) => t('perSqmYear', { money: fmt.money(amount) });
  return {
    perSqm,
    /** "15 ر.ق / م² / سنة", "من 5 ر.ق / م² / سنة" or "حسب المشغّل". */
    zone(zone: Zone): string {
      const { amount, from } = zonePrice(zone);
      if (amount === null) return t('byOperator');
      return from ? t('fromPrice', { price: perSqm(amount) }) : perSqm(amount);
    },
    solution(solution: Solution): string {
      const amount = solution.price.qarPerSqmYear;
      return amount === null ? t('byOperator') : perSqm(amount);
    },
  };
}

/** Area as a figure and a unit, so a Stat can set the unit smaller. */
export function useAreaParts() {
  const t = useT(strings);
  const { fmt } = useLang();
  return (sqm: number): { value: string; unit: string } =>
    sqm >= 1_000_000 ? { value: fmt.num(sqm / 1_000_000, 1), unit: t('millionSqm') } : { value: fmt.num(sqm), unit: t('sqm') };
}

/** A slim bar under a percentage. The figure beside it carries the meaning; the bar only shows it. */
export function ShareBar({ pct }: { pct: number }) {
  const width = Math.max(0, Math.min(100, pct));
  return (
    <span className={styles.bar} aria-hidden="true">
      <span className={styles.fill} style={{ inlineSize: `${width}%` }} />
    </span>
  );
}

/** One quiet line of provenance under a section. */
export function FinePrint({ children }: { children: ReactNode }) {
  return <p className={cx('type-foot', styles.fine)}>{children}</p>;
}
