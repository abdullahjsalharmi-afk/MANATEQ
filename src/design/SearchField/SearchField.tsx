import { Search, X } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';
import { useT } from '@/app/i18n';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './SearchField.module.css';
import { strings } from './strings';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Called with the trimmed text when Enter (or the keyboard's search key) is pressed. */
  onSubmit?: (value: string) => void;
  /** Names the field for screen readers and is the placeholder unless `placeholder` is given. Pass translated text. */
  label: string;
  placeholder?: string;
  /** Other keys, e.g. the down arrow to move into a list of results. */
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  id?: string;
  className?: string;
}

/** A search box: an icon at the start, the text, and a button that clears it. */
export function SearchField({ value, onChange, onSubmit, label, placeholder, onKeyDown, autoFocus, id, className }: SearchFieldProps) {
  const t = useT(strings);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    // Enter while an input method is composing text confirms the composition, not the search.
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit?.(value.trim());
    }
  };

  return (
    <div className={cx(styles.search, className)}>
      <Icon icon={Search} size={16} strokeWidth={2} className={styles.glass} />
      <input
        ref={inputRef}
        id={id}
        type="search"
        role="searchbox"
        aria-label={label}
        className={styles.input}
        value={value}
        placeholder={placeholder ?? label}
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      {value ? (
        <button
          type="button"
          className={styles.clear}
          aria-label={t('clear')}
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
        >
          <span className={styles.clearDisc} aria-hidden="true">
            <Icon icon={X} size={12} strokeWidth={3} />
          </span>
        </button>
      ) : null}
    </div>
  );
}
