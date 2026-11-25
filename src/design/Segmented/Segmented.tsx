import { useRef, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Segmented.module.css';

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  /** A small count shown after the label. */
  count?: number;
}

export interface SegmentedProps<V extends string> {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Names the group for screen readers. */
  label: string;
  /** `sm` is the small control for a bar or a corner (a language switch). Default `md`. */
  size?: 'md' | 'sm';
  /** Take the width of the labels instead of the full row. */
  inline?: boolean;
  className?: string;
}

/**
 * A two-to-four way switch between views of the same content: a sunken pill track with a pill thumb
 * that slides to the chosen option. Arrow keys move the selection.
 */
export function Segmented<V extends string>({ options, value, onChange, label, size = 'md', inline = false, className }: SegmentedProps<V>) {
  const ref = useRef<HTMLDivElement>(null);
  const index = options.findIndex((o) => o.value === value);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    let next = index;
    if (event.key === 'ArrowRight') next = index + (rtl ? -1 : 1);
    else if (event.key === 'ArrowLeft') next = index + (rtl ? 1 : -1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = options.length - 1;
    else return;
    event.preventDefault();
    const target = options[(next + options.length) % options.length];
    if (!target) return;
    onChange(target.value);
    ref.current?.querySelector<HTMLButtonElement>(`[data-value="${target.value}"]`)?.focus();
  };
  const position = { '--segments': options.length, '--at': Math.max(index, 0) } as CSSProperties;
  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={cx(styles.segmented, size === 'sm' && styles.sm, inline && styles.inline, className)} style={position} onKeyDown={onKeyDown}>
      {index >= 0 ? <span className={styles.thumb} aria-hidden="true" /> : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (index < 0 && option === options[0]) ? 0 : -1}
            data-value={option.value}
            className={cx(styles.option, selected && styles.selected)}
            onClick={() => onChange(option.value)}
          >
            <span className={styles.optionLabel}>{option.label}</span>
            {option.count !== undefined ? <span className={styles.count}>{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
  /** A second line under the label (a price, a note). Makes the chip a larger two-line option with 11 px corners. */
  detail?: ReactNode;
  /** A small picture or glyph before the label. */
  leading?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** A choice chip: on or off. Selected is a 2 px border in the focus blue; the fill does not change. */
export function Chip({ children, selected = false, onClick, detail, leading, disabled, className }: ChipProps) {
  return (
    <button type="button" aria-pressed={selected} disabled={disabled} className={cx(styles.chip, detail !== undefined && styles.twoLine, selected && styles.chipOn, className)} onClick={onClick}>
      {leading ? <span className={styles.chipLeading}>{leading}</span> : null}
      {detail !== undefined ? (
        <span className={styles.chipText}>
          <span className={styles.chipLabel}>{children}</span>
          <span className={styles.chipDetail}>{detail}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}

export interface ChipRowProps {
  children: ReactNode;
  /** Names the group for screen readers. */
  label: string;
  /** Wrap onto more lines instead of scrolling sideways (the options of a configurator step). */
  wrap?: boolean;
  className?: string;
}

/** A row of chips. By default it scrolls sideways and bleeds to the screen edges; with `wrap` it wraps. */
export function ChipRow({ children, label, wrap = false, className }: ChipRowProps) {
  return (
    <div role="group" aria-label={label} className={cx(wrap ? styles.chipWrap : styles.chipRow, className)}>
      {children}
    </div>
  );
}
