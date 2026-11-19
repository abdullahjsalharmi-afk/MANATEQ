import type { CSSProperties } from 'react';
import { cx } from '../cx';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  /** `text`: lines of a paragraph · `block`: one area (a card, a map, an image) · `row`: list rows with a leading tile. */
  variant?: 'text' | 'block' | 'row';
  /** How many lines (`text`, default 3) or rows (`row`, default 1). */
  count?: number;
  /** Height of a `block` in px. Default 120. */
  height?: number;
  /** Tells screen readers what is loading. Without it the skeleton is decorative; mark the region `aria-busy` instead. */
  label?: string;
  className?: string;
}

/** Widths of text lines, so a paragraph does not look like a barcode. The last line is always short. */
const LINE_WIDTHS = ['100%', '92%', '97%', '88%'] as const;

/**
 * The shape of content that is on its way. A slow glint crosses it in the reading direction and
 * stands still when the person prefers reduced motion.
 */
export function Skeleton({ variant = 'text', count, height = 120, label, className }: SkeletonProps) {
  let bones;
  if (variant === 'block') {
    bones = <span className={cx(styles.bone, styles.block)} style={{ height }} />;
  } else if (variant === 'row') {
    bones = Array.from({ length: count ?? 1 }, (_, index) => (
      <span key={index} className={styles.row}>
        <span className={cx(styles.bone, styles.tile)} />
        <span className={styles.rowText}>
          <span className={cx(styles.bone, styles.line)} style={{ width: index % 2 ? '46%' : '58%' }} />
          <span className={cx(styles.bone, styles.line, styles.thin)} style={{ width: index % 2 ? '72%' : '64%' }} />
        </span>
      </span>
    ));
  } else {
    const lines = count ?? 3;
    bones = Array.from({ length: lines }, (_, index) => {
      const width: CSSProperties['width'] = lines > 1 && index === lines - 1 ? '62%' : LINE_WIDTHS[index % LINE_WIDTHS.length];
      return <span key={index} className={cx(styles.bone, styles.line)} style={{ width }} />;
    });
  }
  return (
    <span className={cx(styles.skeleton, variant === 'text' && styles.text, className)} {...(label ? { role: 'status', 'aria-label': label } : { 'aria-hidden': true })}>
      {bones}
    </span>
  );
}
