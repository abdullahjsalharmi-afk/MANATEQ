import type { LucideIcon } from 'lucide-react';
import type { InputHTMLAttributes } from 'react';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import { controlProps, Field, type FieldBaseProps } from './Field';
import styles from './Field.module.css';

type NativeInput = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'id' | 'className' | 'required' | 'type' | 'children'>;

export interface TextFieldProps extends FieldBaseProps, NativeInput {
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'tel' | 'url';
  /**
   * For values that are always written left to right (codes, plate numbers, e-mail addresses): keeps
   * them in order in Arabic. On by default for `email`, `tel` and `url`.
   */
  ltr?: boolean;
  /** A quiet icon at the start of the field. */
  icon?: LucideIcon;
}

/** One line of text. */
export function TextField({ label, hint, error, required, labelHidden, id, className, value, onChange, type = 'text', ltr, icon, disabled, ...rest }: TextFieldProps) {
  const leftToRight = ltr ?? type !== 'text';
  return (
    <Field label={label} hint={hint} error={error} required={required} labelHidden={labelHidden} id={id} className={className}>
      {(control) => (
        <div className={cx(styles.control, control.invalid && styles.invalid, disabled && styles.disabled)}>
          {icon ? (
            <span className={styles.lead}>
              <Icon icon={icon} size={20} />
            </span>
          ) : null}
          <input
            {...rest}
            {...controlProps(control)}
            type={type}
            className={cx(styles.input, leftToRight && styles.ltr, icon && styles.withLead)}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )}
    </Field>
  );
}
