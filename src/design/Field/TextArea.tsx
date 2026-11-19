import { useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';
import { useLang, useT } from '@/app/i18n';
import { cx } from '../cx';
import { controlProps, Field, type FieldBaseProps } from './Field';
import styles from './Field.module.css';
import { strings } from './strings';

type NativeTextArea = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'id' | 'className' | 'required' | 'children'>;

export interface TextAreaProps extends FieldBaseProps, NativeTextArea {
  value: string;
  onChange: (value: string) => void;
  /** With a limit, a quiet counter appears under the field. */
  maxLength?: number;
}

function fitHeight(area: HTMLTextAreaElement): void {
  area.style.height = 'auto';
  if (area.scrollHeight > 0) area.style.height = `${area.scrollHeight}px`;
}

/** Several lines of text. The box grows with what is written, up to a limit, then scrolls. */
export function TextArea({ label, hint, error, required, labelHidden, id, className, value, onChange, maxLength, disabled, ...rest }: TextAreaProps) {
  const t = useT(strings);
  const { fmt } = useLang();
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow to fit the text. The CSS min- and max-height keep the box within its limits.
  useLayoutEffect(() => {
    const area = ref.current;
    if (area) fitHeight(area);
  }, [value]);

  // The same text needs a different height when the field gets wider or narrower.
  useEffect(() => {
    const area = ref.current;
    if (!area || typeof ResizeObserver === 'undefined') return;
    let width = area.clientWidth;
    const observer = new ResizeObserver(() => {
      if (area.clientWidth === width) return;
      width = area.clientWidth;
      fitHeight(area);
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  const counter = maxLength !== undefined ? t('count', { n: fmt.num(value.length), max: fmt.num(maxLength) }) : null;

  return (
    <Field label={label} hint={hint} error={error} required={required} labelHidden={labelHidden} id={id} className={className} aside={counter}>
      {(control) => (
        <div className={cx(styles.control, styles.area, control.invalid && styles.invalid, disabled && styles.disabled)}>
          <textarea
            rows={3}
            {...rest}
            {...controlProps(control)}
            ref={ref}
            className={styles.textarea}
            value={value}
            maxLength={maxLength}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )}
    </Field>
  );
}
