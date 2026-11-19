import { CalendarDays } from 'lucide-react';
import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useLang, useT } from '@/app/i18n';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import { isoDateToMs } from './date';
import { controlProps, Field, type FieldBaseProps } from './Field';
import styles from './Field.module.css';
import { strings } from './strings';

export interface DateFieldProps extends FieldBaseProps {
  /** A calendar date as `YYYY-MM-DD`, or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Earliest and latest dates that can be chosen, as `YYYY-MM-DD`. */
  min?: string;
  max?: string;
  /** Shown while no date is chosen. */
  placeholder?: string;
  disabled?: boolean;
  name?: string;
}

type PickerInput = HTMLInputElement & { showPicker?: () => void };

function openPicker(input: PickerInput): void {
  try {
    input.showPicker?.();
  } catch {
    /* Not allowed here (an embedded preview, or already open): the native input still works by itself. */
  }
}

/**
 * A date. The field shows the date the way the app writes dates (19 نوفمبر 2026 · 19 Nov 2026); a native
 * date input lies invisibly on top, so a tap opens the system's own picker. When someone types the
 * date with a keyboard instead, the native segments they are editing become visible until focus leaves.
 */
export function DateField({ label, hint, error, required, labelHidden, id, className, value, onChange, min, max, placeholder, disabled, name }: DateFieldProps) {
  const t = useT(strings);
  const { fmt } = useLang();
  const [typing, setTyping] = useState(false);
  const ms = isoDateToMs(value);

  const onClick = (event: MouseEvent<HTMLInputElement>) => openPicker(event.currentTarget);
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openPicker(event.currentTarget);
    } else if (event.key.length === 1 || event.key.startsWith('Arrow') || event.key === 'Backspace' || event.key === 'Delete') {
      setTyping(true);
    }
  };

  return (
    <Field label={label} hint={hint} error={error} required={required} labelHidden={labelHidden} id={id} className={className}>
      {(control) => (
        <div className={cx(styles.control, styles.date, typing && styles.dateTyping, control.invalid && styles.invalid, disabled && styles.disabled)}>
          <span className={cx(styles.dateText, ms === null && styles.placeholder)} aria-hidden="true">
            {ms === null ? (placeholder ?? t('chooseDate')) : fmt.date(ms)}
          </span>
          <span className={styles.trail}>
            <Icon icon={CalendarDays} size={20} />
          </span>
          <input
            {...controlProps(control)}
            type="date"
            className={styles.dateNative}
            value={value ?? ''}
            min={min}
            max={max}
            name={name}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value || null)}
            onClick={onClick}
            onKeyDown={onKeyDown}
            onBlur={() => setTyping(false)}
          />
        </div>
      )}
    </Field>
  );
}
