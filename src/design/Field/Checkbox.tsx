import { Check, CircleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './Checkbox.module.css';

export interface CheckboxProps {
  /** The statement being agreed to. Pass translated text; it may wrap over several lines. */
  label: ReactNode;
  /** One quiet line under the statement. */
  hint?: string;
  /** What is missing. Its presence marks the checkbox invalid. */
  error?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

/** A statement to tick: a declaration, a consent. The whole line is the target. */
export function Checkbox({ label, hint, error, checked, onChange, required = false, disabled = false, id, name, className }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? `${autoId}-checkbox`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx(styles.checkbox, error && styles.invalid, disabled && styles.disabled, className)}>
      <label className={styles.row}>
        <input
          id={inputId}
          type="checkbox"
          className={styles.input}
          name={name}
          checked={checked}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className={styles.box} aria-hidden="true">
          <Icon icon={Check} size={16} strokeWidth={3} className={styles.tick} />
        </span>
        <span className={styles.label}>{label}</span>
      </label>
      {error || hint ? (
        <div className={styles.messages}>
          {error ? (
            <p id={errorId} className={styles.error}>
              <Icon icon={CircleAlert} size={16} strokeWidth={2} className={styles.errorIcon} />
              <span>{error}</span>
            </p>
          ) : null}
          {hint ? (
            <p id={hintId} className={styles.hint}>
              {hint}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
