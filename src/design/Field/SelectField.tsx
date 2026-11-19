import { Check, ChevronDown, type LucideIcon } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useT } from '@/app/i18n';
import { normalise } from '@/domain/search';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import { SearchField } from '../SearchField/SearchField';
import { Sheet } from '../Sheet/Sheet';
import { Field, type FieldBaseProps, type FieldControl } from './Field';
import fieldStyles from './Field.module.css';
import { ReturnFocus } from './ReturnFocus';
import styles from './SelectField.module.css';
import { strings } from './strings';

/** Up to this many options are shown in place as radio tiles; more open in a searchable sheet. */
export const INLINE_OPTIONS_MAX = 5;

export interface SelectOption<V extends string = string> {
  value: V;
  /** Translated text. */
  label: string;
  /** One quiet line under the label. */
  hint?: string;
  icon?: LucideIcon;
  /** Extra words the option can be found by in the search: its name in the other language, a code. */
  keywords?: string;
}

export interface SelectFieldProps<V extends string = string> extends FieldBaseProps {
  options: SelectOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  /** Shown on the button while nothing is chosen (sheet presentation). */
  placeholder?: string;
  /** `auto`: radio tiles for up to five options, a searchable sheet for more. */
  presentation?: 'auto' | 'tiles' | 'sheet';
  disabled?: boolean;
}

/**
 * Choose one of several options. A handful are laid out in place as radio tiles, so every choice is
 * visible; a long list opens in a sheet with a search field.
 */
export function SelectField<V extends string = string>({ label, hint, error, required, labelHidden, id, className, options, value, onChange, placeholder, presentation = 'auto', disabled = false }: SelectFieldProps<V>) {
  const tiles = presentation === 'tiles' || (presentation === 'auto' && options.length <= INLINE_OPTIONS_MAX);
  return (
    <Field label={label} hint={hint} error={error} required={required} labelHidden={labelHidden} id={id} className={className} as={tiles ? 'group' : 'field'}>
      {(control) =>
        tiles ? (
          <Tiles control={control} options={options} value={value} onChange={onChange} disabled={disabled} />
        ) : (
          <Picker control={control} label={label} options={options} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} />
        )
      }
    </Field>
  );
}

interface ChoiceProps<V extends string> {
  control: FieldControl;
  options: SelectOption<V>[];
  value: V | null;
  onChange: (value: V) => void;
  disabled: boolean;
}

/**
 * Radio tiles: native radios, so arrow keys, forms and screen readers behave as expected.
 * When the choice is missing the tiles stay calm: one message under the group is clearer than five red boxes.
 */
function Tiles<V extends string>({ control, options, value, onChange, disabled }: ChoiceProps<V>) {
  const name = useId();
  return (
    <div
      id={control.id}
      role="radiogroup"
      aria-labelledby={control.labelId}
      aria-describedby={control.describedBy}
      aria-invalid={control.invalid || undefined}
      aria-required={control.required || undefined}
      className={styles.tiles}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label key={option.value} className={cx(styles.tile, selected && styles.tileOn, disabled && styles.tileDisabled)}>
            <input type="radio" className={styles.radio} name={name} value={option.value} checked={selected} disabled={disabled} onChange={() => onChange(option.value)} />
            <span className={styles.mark} aria-hidden="true" />
            <span className={styles.tileText}>
              <span className={styles.tileLabel}>{option.label}</span>
              {option.hint ? <span className={styles.tileHint}>{option.hint}</span> : null}
            </span>
            {option.icon ? <Icon icon={option.icon} size={22} className={styles.tileIcon} /> : null}
          </label>
        );
      })}
    </div>
  );
}

interface PickerProps<V extends string> extends ChoiceProps<V> {
  label: string;
  placeholder?: string;
}

/** A field-shaped button that shows the chosen option and opens the list in a sheet. */
function Picker<V extends string>({ control, label, options, value, onChange, placeholder, disabled }: PickerProps<V>) {
  const t = useT(strings);
  const [open, setOpen] = useState(false);
  const valueId = `${control.id}-value`;
  const requiredId = `${control.id}-required`;
  const current = options.find((option) => option.value === value);

  // A button cannot carry aria-required, so its name says it: "Zone, Birkat Al Awamer, required".
  const labelledBy = [control.labelId, valueId, control.required ? requiredId : null].filter(Boolean).join(' ');

  return (
    <>
      <button
        type="button"
        id={control.id}
        aria-labelledby={labelledBy}
        aria-describedby={control.describedBy}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        className={cx(fieldStyles.control, styles.trigger, control.invalid && fieldStyles.invalid, disabled && fieldStyles.disabled)}
        onClick={() => setOpen(true)}
      >
        <span id={valueId} className={cx(styles.triggerValue, !current && fieldStyles.placeholder)}>
          {current ? current.label : (placeholder ?? t('choose'))}
        </span>
        <Icon icon={ChevronDown} size={20} className={styles.chevron} />
        {control.required ? (
          <span id={requiredId} className="visually-hidden">
            {t('required')}
          </span>
        ) : null}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={label} closeLabel={t('close')} className={styles.sheet}>
        <ReturnFocus />
        <OptionList
          label={label}
          options={options}
          value={value}
          onPick={(next) => {
            onChange(next);
            setOpen(false);
          }}
        />
      </Sheet>
    </>
  );
}

interface OptionListProps<V extends string> {
  label: string;
  options: SelectOption<V>[];
  value: V | null;
  onPick: (value: V) => void;
}

/**
 * The searchable list inside the sheet. It is a listbox: Tab reaches the list once, the arrow keys
 * move through it, Enter or Space chooses. It mounts each time the sheet opens, so the search starts empty.
 */
function OptionList<V extends string>({ label, options, value, onPick }: OptionListProps<V>) {
  const t = useT(strings);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLUListElement>(null);

  const visible = useMemo(() => {
    const wanted = normalise(query).split(' ').filter(Boolean);
    if (!wanted.length) return options;
    return options.filter((option) => {
      const haystack = normalise(`${option.label} ${option.hint ?? ''} ${option.keywords ?? ''}`);
      return wanted.every((word) => haystack.includes(word));
    });
  }, [options, query]);

  // One tab stop: the chosen option when it is listed, otherwise the first.
  const tabStop = visible.some((option) => option.value === value) ? value : visible[0]?.value;

  // Open with the chosen option in view.
  useEffect(() => {
    const chosen = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (chosen && typeof chosen.scrollIntoView === 'function') chosen.scrollIntoView({ block: 'center' });
  }, []);

  const optionButtons = () => Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = optionButtons();
    const index = buttons.findIndex((button) => button === document.activeElement);
    let next: number;
    if (event.key === 'ArrowDown') next = Math.min(buttons.length - 1, index + 1);
    else if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    else return;
    event.preventDefault();
    buttons[next]?.focus();
  };

  return (
    <>
      <div className={styles.search}>
        <SearchField
          label={t('searchOptions')}
          value={query}
          onChange={setQuery}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowDown') return;
            event.preventDefault();
            optionButtons()[0]?.focus();
          }}
        />
      </div>
      <p className="visually-hidden" role="status">
        {visible.length ? '' : t('noResults')}
      </p>
      {visible.length ? (
        <ul ref={listRef} role="listbox" aria-label={label} className={styles.options} onKeyDown={onListKeyDown}>
          {visible.map((option) => {
            const selected = option.value === value;
            return (
              <li key={option.value} role="presentation">
                <button type="button" role="option" aria-selected={selected} tabIndex={option.value === tabStop ? 0 : -1} className={cx(styles.option, selected && styles.optionOn)} onClick={() => onPick(option.value)}>
                  {option.icon ? <Icon icon={option.icon} size={22} className={styles.optionIcon} /> : null}
                  <span className={styles.optionText}>
                    <span className={styles.optionLabel}>{option.label}</span>
                    {option.hint ? <span className={styles.optionHint}>{option.hint}</span> : null}
                  </span>
                  {selected ? <Icon icon={Check} size={20} strokeWidth={2.25} className={styles.optionCheck} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.empty} aria-hidden="true">
          {t('noResults')}
        </p>
      )}
    </>
  );
}
