/** Pieces shared by the two transaction sheets (payment and signature). */
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { keepWhole } from '../List/keepWhole';
import styles from './parts.module.css';

/** One fact about what is being paid or signed: "Due date · 5 December 2026". */
export interface SheetLine {
  label: string;
  value: ReactNode;
}

/** A short list of label and value pairs. */
export function Lines({ lines, bare = false, className }: { lines: SheetLine[]; /** Without the box, for use inside another surface. */ bare?: boolean; className?: string }) {
  if (!lines.length) return null;
  return (
    <dl className={cx(styles.lines, bare && styles.bare, className)}>
      {lines.map((line, index) => (
        <div key={index} className={styles.line}>
          <dt className={styles.lineLabel}>{line.label}</dt>
          <dd className={styles.lineValue} data-num="">
            <bdi>{keepWhole(line.value)}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The confirmation mark: an accent ring and a tick that draws itself once. */
export function SuccessMark() {
  return (
    <span className={styles.mark} aria-hidden="true">
      <svg viewBox="0 0 56 56" width="56" height="56" focusable="false">
        <circle className={styles.ring} cx="28" cy="28" r="26.5" pathLength={1} />
        <path className={styles.tick} d="M17.5 28.5l7 7 14-15" pathLength={1} />
      </svg>
    </span>
  );
}

/** The class for the single full-width button in a transaction sheet's footer. */
export const sheetActionClass = styles.sheetAction;

export interface SheetSuccessProps {
  title: string;
  children?: ReactNode;
  /** Keeps the sheet from shrinking when the review gives way to the confirmation. */
  minHeight?: number;
}

/** The confirmation that closes a transaction: the tick, a title and a few quiet lines. */
export function SheetSuccess({ title, children, minHeight }: SheetSuccessProps) {
  return (
    <div className={styles.success} style={minHeight ? { minHeight } : undefined}>
      <SuccessMark />
      <h3 className={styles.successTitle}>{title}</h3>
      {children}
    </div>
  );
}
