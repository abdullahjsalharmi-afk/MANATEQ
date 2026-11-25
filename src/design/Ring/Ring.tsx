import { Check, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { clockTone } from '@/domain/standard';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './Ring.module.css';

export type RingSize = 'sm' | 'md' | 'lg';

/** `accent` on track · `warn` close to the standard · `bad` past it · `ok` finished · `idle` no clock. */
export type RingTone = 'accent' | 'warn' | 'bad' | 'ok' | 'idle';

export interface RingProps {
  /** Share of the service standard used so far: 0–1, above 1 when the standard is exceeded. Null when the service has no clock. */
  value: number | null;
  /** Required: what the ring says, for screen readers — e.g. "اليوم 2 من 5". */
  label: string;
  /** 36, 52 or 84 px. Default `md`. */
  size?: RingSize;
  /** The request is finished: a full ring with a tick. */
  complete?: boolean;
  /** Short content for the centre (a day number, a fraction). Hidden from screen readers — say it in `label`. */
  children?: ReactNode;
  className?: string;
}

/** `dots`: how many dots the track has when there is no clock. */
const GEOMETRY: Record<RingSize, { box: number; stroke: number; glyph: number; dots: number }> = {
  sm: { box: 36, stroke: 3, glyph: 16, dots: 14 },
  md: { box: 52, stroke: 3, glyph: 22, dots: 18 },
  lg: { box: 84, stroke: 4, glyph: 32, dots: 28 },
};

/** The tone a ring takes for a value: calm up to 0.8, a warning above it, past the standard above 1. */
export function ringTone(value: number | null, complete = false): RingTone {
  if (complete) return 'ok';
  if (value === null) return 'idle';
  return clockTone(value);
}

/**
 * The service-standard ring: how much of the published standard a request has used.
 * The arc draws itself once, then follows the value. Colour is never the only signal: the arc length,
 * the centre content and the label say the same thing.
 */
export function Ring({ value, label, size = 'md', complete = false, children, className }: RingProps) {
  const { box, stroke, glyph, dots } = GEOMETRY[size];
  const tone = ringTone(value, complete);
  const share = complete ? 1 : value === null || Number.isNaN(value) ? 0 : Math.max(0, Math.min(1, value));
  const centre = box / 2;
  const radius = (box - stroke) / 2;

  let inside: ReactNode = children;
  if (complete) inside = <Icon icon={Check} size={glyph} strokeWidth={2} />;
  else if (inside === undefined && tone === 'bad') inside = <Icon icon={TriangleAlert} size={glyph - 4} strokeWidth={1.75} />;

  return (
    <span role="img" aria-label={label} data-tone={tone} className={cx(styles.ring, styles[size], styles[tone], className)}>
      <svg className={styles.svg} width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true" focusable="false">
        <circle className={styles.track} cx={centre} cy={centre} r={radius} strokeWidth={stroke} pathLength={tone === 'idle' ? dots : undefined} />
        {share > 0 ? (
          <circle className={styles.arc} cx={centre} cy={centre} r={radius} strokeWidth={stroke} pathLength={100} strokeDasharray="100 100" strokeDashoffset={100 - share * 100} />
        ) : null}
      </svg>
      {inside !== undefined && inside !== null ? (
        <span className={styles.centre} aria-hidden="true">
          {inside}
        </span>
      ) : null}
    </span>
  );
}
