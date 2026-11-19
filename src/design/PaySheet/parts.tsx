/** Pieces shared by the two transaction sheets (payment and signature). */
import type { ReactNode } from 'react';
import { cx } from '../cx';
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
            <bdi>{line.value}</bdi>
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A tick that draws itself once inside a soft green disc. */
export function SuccessMark() {
  return (
    <span className={styles.mark} aria-hidden="true">
      <svg viewBox="0 0 32 32" width="32" height="32" focusable="false">
        <path className={styles.tick} d="M7.5 16.5l5.5 5.5L24.5 10" pathLength={1} />
      </svg>
    </span>
  );
}

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
