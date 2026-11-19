import { cx } from '../cx';
import styles from './Mark.module.css';

export interface MarkProps {
  /** Pixel size of the square mark. Default 40. */
  size?: number;
  /** `plain` draws on the page; `tile` puts the mark on an accent tile, like the app icon. */
  variant?: 'plain' | 'tile';
  /** Accessible name. Without it the mark is decorative. */
  label?: string;
  className?: string;
}

/**
 * The Manateq One mark: four plots, one of them taken — yours.
 * An original mark made for this prototype; it is not Manateq's logo.
 */
export function Mark({ size = 40, variant = 'plain', label, className }: MarkProps) {
  return (
    <svg
      className={cx(styles.mark, styles[variant], className)}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {variant === 'tile' ? <rect className={styles.tileBg} width="64" height="64" rx="15" /> : null}
      <g strokeWidth="3" strokeLinejoin="round">
        <rect className={styles.outline} x="13.5" y="13.5" width="15" height="15" rx="4" />
        <rect className={styles.taken} x="35.5" y="13.5" width="15" height="15" rx="4" />
        <rect className={styles.outline} x="13.5" y="35.5" width="15" height="15" rx="4" />
        <rect className={styles.outline} x="35.5" y="35.5" width="15" height="15" rx="4" />
      </g>
    </svg>
  );
}
