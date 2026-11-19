import { CircleAlert } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './Field.module.css';

/** What a control needs so that its field's label, hint and error describe it. */
export interface FieldControl {
  /** The id the control takes; the label points at it. */
  id: string;
  /** The id of the label, for controls named with `aria-labelledby` (groups, buttons that show a value). */
  labelId: string;
  /** Ids of the hint and the error, when present. */
  describedBy: string | undefined;
  invalid: boolean;
  required: boolean;
}

/** The attributes a native input, textarea or button takes from its field. */
export function controlProps(control: FieldControl) {
  return {
    id: control.id,
    'aria-describedby': control.describedBy,
    'aria-invalid': control.invalid || undefined,
    'aria-required': control.required || undefined,
  } as const;
}

/** Props shared by every field component. Pass translated text. */
export interface FieldBaseProps {
  /** The question, above the control. */
  label: string;
  /** One quiet line under the control: the format, an example, why we ask. */
  hint?: string;
  /** What is wrong and how to fix it. Its presence marks the field invalid. */
  error?: string;
  /** Shows the required mark and tells assistive technology. */
  required?: boolean;
  /** Keep the label for screen readers only (when the screen's title already asks the question). */
  labelHidden?: boolean;
  id?: string;
  className?: string;
}

export interface FieldProps extends FieldBaseProps {
  /** `group` names a set of controls (radio tiles, a signature pad) instead of one input. */
  as?: 'field' | 'group';
  /** Ids of extra text that describes the control, such as a unit. */
  describedBy?: string;
  /** Small text at the end of the hint line (a character count). */
  aside?: ReactNode;
  children: (control: FieldControl) => ReactNode;
}

/**
 * The frame of a form field: label above, control, then error and hint below.
 * It creates the ids and hands them to the control so label, hint and error are always wired.
 */
export function Field({ label, hint, error, required = false, labelHidden = false, id, className, as = 'field', describedBy, aside, children }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? `${autoId}-control`;
  const labelId = `${controlId}-label`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const described = [describedBy, error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined;
  const control: FieldControl = { id: controlId, labelId, describedBy: described, invalid: Boolean(error), required };

  const labelClass = cx(styles.label, labelHidden && 'visually-hidden');
  const labelContent = (
    <>
      {label}
      {required ? (
        <span className={styles.required} aria-hidden="true">
          *
        </span>
      ) : null}
    </>
  );

  return (
    <div className={cx(styles.field, className)}>
      {as === 'group' ? (
        <span id={labelId} className={labelClass}>
          {labelContent}
        </span>
      ) : (
        <label id={labelId} htmlFor={controlId} className={labelClass}>
          {labelContent}
        </label>
      )}
      {children(control)}
      {error || hint || aside ? (
        <div className={styles.messages}>
          <div className={styles.texts}>
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
          {aside ? <span className={styles.aside}>{aside}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** A vertical stack of fields with the form's rhythm between them. */
export function FieldStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx(styles.stack, className)}>{children}</div>;
}
