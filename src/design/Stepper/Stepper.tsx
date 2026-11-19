import { cx } from '../cx';
import styles from './Stepper.module.css';

export interface StepperProps {
  /** The step the person is on, counting from 1. */
  current: number;
  /** How many steps there are. */
  total: number;
  /** Says where the person is, e.g. "الخطوة 2 من 4". Pass translated text. */
  label: string;
  /** Also show the label as a quiet line under the bar. */
  showLabel?: boolean;
  className?: string;
}

/** More steps than this are drawn as one continuous bar instead of segments. */
const MAX_SEGMENTS = 10;

/** A thin progress indicator for a flow: one segment per step, filled up to the current one. */
export function Stepper({ current, total, label, showLabel = false, className }: StepperProps) {
  const steps = Math.max(1, Math.floor(total));
  const now = Math.min(steps, Math.max(1, Math.floor(current)));
  const segmented = steps <= MAX_SEGMENTS;
  return (
    <div className={cx(styles.stepper, className)}>
      <div className={styles.track} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={steps} aria-valuenow={now}>
        {segmented ? (
          Array.from({ length: steps }, (_, index) => (
            <span key={index} className={cx(styles.segment, index < now && styles.done)}>
              <span className={styles.fill} />
            </span>
          ))
        ) : (
          <span className={styles.segment}>
            <span className={styles.fill} style={{ width: `${(now / steps) * 100}%` }} />
          </span>
        )}
      </div>
      {showLabel ? (
        <p className={styles.label} aria-hidden="true">
          {label}
        </p>
      ) : null}
    </div>
  );
}
