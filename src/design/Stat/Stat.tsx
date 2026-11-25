import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Stat.module.css';

export interface StatProps {
  /** The figure, already formatted (use `fmt.*`, `Money`). */
  value: ReactNode;
  /** A unit after the figure, set smaller so the number leads: "م²", "مليون م²", "يوم عمل". */
  unit?: string;
  /** What the figure measures. Pass translated text. */
  label: string;
  /** A quiet qualifier under the label: a source, a date, "illustrative". */
  hint?: ReactNode;
  /** `lg` for the one headline figure of a screen. */
  size?: 'md' | 'lg';
  align?: 'start' | 'center';
  className?: string;
}

/**
 * One figure with its label. The label comes first for screen readers and second for the eye,
 * where the number leads.
 */
export function Stat({ value, unit, label, hint, size = 'md', align = 'start', className }: StatProps) {
  return (
    <div className={cx(styles.stat, styles[size], align === 'center' && styles.center, className)}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value} data-num="">
        <span className={styles.figure}>{value}</span>
        {unit ? (
          <>
            {' '}
            <span className={styles.unit}>{unit}</span>
          </>
        ) : null}
      </span>
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </div>
  );
}
