import { useId, useState } from 'react';
import { useLang } from '@/app/i18n';
import { cx } from '../cx';
import { controlProps, Field, type FieldBaseProps } from './Field';
import styles from './Field.module.css';
import { cleanNumberInput, parseNumber } from './number';

export interface NumberFieldProps extends FieldBaseProps {
  value: number | null;
  onChange: (value: number | null) => void;
  /** A unit shown after the value, e.g. "م²" or "ر.ق". Pass translated text. */
  unit?: string;
  /** Digits allowed after the decimal point. Default 0: whole numbers. */
  decimals?: number;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
  autoFocus?: boolean;
}

/**
 * A number: an area, an amount, a count. Phones show the numeric keypad; Arabic-Indic digits are
 * understood; letters never appear. While the field has focus it shows exactly what was typed, and
 * when focus leaves it shows the value with grouping (18,750).
 */
export function NumberField({ label, hint, error, required, labelHidden, id, className, value, onChange, unit, decimals = 0, placeholder, disabled, name, autoFocus }: NumberFieldProps) {
  const { fmt } = useLang();
  const unitId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? '' : fmt.num(value, decimals));

  return (
    <Field label={label} hint={hint} error={error} required={required} labelHidden={labelHidden} id={id} className={className} describedBy={unit ? unitId : undefined}>
      {(control) => (
        <div className={cx(styles.control, control.invalid && styles.invalid, disabled && styles.disabled)}>
          <input
            {...controlProps(control)}
            type="text"
            inputMode={decimals > 0 ? 'decimal' : 'numeric'}
            autoComplete="off"
            data-num=""
            className={cx(styles.input, styles.ltr, unit && styles.withTrail)}
            value={shown}
            placeholder={placeholder}
            disabled={disabled}
            name={name}
            autoFocus={autoFocus}
            onFocus={() => setDraft(shown)}
            onChange={(event) => {
              const text = cleanNumberInput(event.target.value, decimals);
              setDraft(text);
              const next = parseNumber(text, decimals);
              if (next !== value) onChange(next);
            }}
            onBlur={() => setDraft(null)}
          />
          {unit ? (
            <span id={unitId} className={styles.unit}>
              {unit}
            </span>
          ) : null}
        </div>
      )}
    </Field>
  );
}
