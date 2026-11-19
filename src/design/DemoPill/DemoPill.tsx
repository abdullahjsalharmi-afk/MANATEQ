import { useT } from '@/app/i18n';
import { cx } from '../cx';
import styles from './DemoPill.module.css';
import { strings } from './strings';

export type DemoKind = keyof typeof strings;

export interface DemoPillProps {
  /**
   * What is being labelled: the app itself (`prototype`), a simulated step (`simulation`), invented
   * data (`illustrative`), a service standard (`indicative`) or a worked example (`example`).
   */
  kind?: DemoKind;
  className?: string;
}

/**
 * The discreet marker that keeps the prototype honest. An outline rather than a filled pill, so it
 * reads as an annotation and is never mistaken for a status or for the gold "verified" mark.
 */
export function DemoPill({ kind = 'prototype', className }: DemoPillProps) {
  const t = useT(strings);
  return <span className={cx(styles.pill, className)}>{t(kind)}</span>;
}
