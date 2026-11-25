import { cx } from '../cx';
import styles from './Mark.module.css';

export interface MarkProps {
  /** Pixel size of the square mark. Default 40. */
  size?: number;
  /** `plain` draws in the current text colour, on any surface; `tile` sets it in white on the maroon tile, like the app icon. */
  variant?: 'plain' | 'tile';
  /** Accessible name. Without it the mark is decorative. */
  label?: string;
  className?: string;
}

/** The four plots sit on a 64-unit grid: two rows of two, 18 units each, 4 apart. */
const PLOTS: readonly { x: number; y: number; taken: boolean }[] = [
  { x: 12, y: 12, taken: false },
  { x: 34, y: 12, taken: true },
  { x: 12, y: 34, taken: false },
  { x: 34, y: 34, taken: false },
];

/** The stroke of the mark for a given drawn size: the lines thicken as the mark gets small. */
export function markStroke(glyphPixels: number): number {
  if (glyphPixels < 20) return 4.5;
  if (glyphPixels < 32) return 3.75;
  return 3;
}

/**
 * The Manateq One mark: four plots, one of them taken (yours). One colour, so it sits on the near-black
 * global bar, on the maroon tile and on a white tile alike. An original mark made for this prototype; it is not Manateq's logo.
 */
export function Mark({ size = 40, variant = 'plain', label, className }: MarkProps) {
  const tile = variant === 'tile';
  const stroke = markStroke(tile ? (size * 40) / 64 : (size * 40) / 44);
  return (
    <svg
      className={cx(styles.mark, tile && styles.tile, className)}
      width={size}
      height={size}
      viewBox={tile ? '0 0 64 64' : '10 10 44 44'}
      fill="none"
      data-tone={tile ? 'brand' : undefined}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {tile ? <rect className={styles.tileBg} width="64" height="64" rx="15" /> : null}
      <g stroke="currentColor" strokeWidth={stroke} strokeLinejoin="round">
        {PLOTS.map((plot) => (
          <rect
            key={`${plot.x}-${plot.y}`}
            x={plot.x + stroke / 2}
            y={plot.y + stroke / 2}
            width={18 - stroke}
            height={18 - stroke}
            rx={5 - stroke / 2}
            fill={plot.taken ? 'currentColor' : undefined}
          />
        ))}
      </g>
    </svg>
  );
}
