import { useId } from 'react';
import { cx } from '../cx';
import styles from './Toggle.module.css';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Names the switch for screen readers when no visible label is wired with `aria-labelledby`. */
  label?: string;
  id?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  disabled?: boolean;
  className?: string;
}

/** The bare switch, for the end of a list row. Give it a `label` (or `aria-labelledby`). */
export function Switch({ checked, onChange, label, disabled = false, className, ...rest }: SwitchProps) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} className={cx(styles.switch, className)} onClick={() => onChange(!checked)} {...rest}>
      <span className={styles.thumb} aria-hidden="true" />
    </button>
  );
}

export interface ToggleProps {
  /** What the switch turns on. Pass translated text. */
  label: string;
  /** One quiet line under the label. */
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** A setting that is on or off and takes effect at once: the label at the start, the switch at the end. */
export function Toggle({ label, hint, checked, onChange, disabled = false, id, className }: ToggleProps) {
  const autoId = useId();
  const switchId = id ?? `${autoId}-switch`;
  const labelId = `${switchId}-label`;
  const hintId = `${switchId}-hint`;
  return (
    <div className={cx(styles.toggle, disabled && styles.disabled, className)}>
      <div className={styles.text}>
        <label id={labelId} htmlFor={switchId} className={styles.label}>
          {label}
        </label>
        {hint ? (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        ) : null}
      </div>
      <Switch id={switchId} checked={checked} onChange={onChange} disabled={disabled} aria-labelledby={labelId} aria-describedby={hint ? hintId : undefined} />
    </div>
  );
}
