import { useRef, type KeyboardEvent, type ReactNode } from 'react';
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
  className?: string;
}

/** A two-to-four way switch between views of the same content. Arrow keys move the selection. */
export function Segmented<V extends string>({ options, value, onChange, label, className }: SegmentedProps<V>) {
  const ref = useRef<HTMLDivElement>(null);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = options.findIndex((o) => o.value === value);
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
  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={cx(styles.segmented, className)} onKeyDown={onKeyDown}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-value={option.value}
            className={cx(styles.option, selected && styles.selected)}
            onClick={() => onChange(option.value)}
          >
            <span>{option.label}</span>
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
  className?: string;
}

/** A filter chip: on or off. */
export function Chip({ children, selected = false, onClick, className }: ChipProps) {
  return (
    <button type="button" aria-pressed={selected} className={cx(styles.chip, selected && styles.chipOn, className)} onClick={onClick}>
      {children}
    </button>
  );
}

/** A horizontally scrolling row of chips that bleeds to the screen edges. */
export function ChipRow({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cx(styles.chipRow, className)}>
      {children}
    </div>
  );
}
