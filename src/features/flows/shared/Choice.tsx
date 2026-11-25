/**
 * One choice out of several, drawn as large option cards: a radio group (`role="radiogroup"` with
 * `role="radio"` cards and a roving tab stop), so assistive technology hears "one of five" and the arrow
 * keys move between the cards. The look is the option card of the design system: a white card with a
 * hairline and 18 px corners, and the 2 px focus-colour border when chosen. Never a shadow.
 */
import type { KeyboardEvent, ReactNode } from 'react';
import { cx } from '@/design/core';
import styles from './Choice.module.css';

export interface ChoiceGroupOptions<K extends string> {
  /** The keys of the cards, in reading order. */
  keys: readonly K[];
  value: K | null;
  /** A click or Enter/Space on a card. */
  onPick: (key: K) => void;
  /** An arrow key landing on a card (default: the same as `onPick`). */
  onMove?: (key: K) => void;
  label: string;
}

/**
 * The keyboard and the roles of a radio group of cards. Spread `group` on the container and
 * `item(key)` on each card. Arrow keys follow the reading direction (mirrored in Arabic); Home and End
 * jump to the first and last card.
 */
export function useChoiceGroup<K extends string>({ keys, value, onPick, onMove = onPick, label }: ChoiceGroupOptions<K>) {
  const index = value === null ? -1 : keys.indexOf(value);
  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const group = event.currentTarget;
    const rtl = getComputedStyle(group).direction === 'rtl';
    const at = Math.max(index, 0);
    let next: number;
    if (event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) next = index < 0 ? 0 : at + 1;
    else if (event.key === 'ArrowUp' || event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) next = index < 0 ? keys.length - 1 : at - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = keys.length - 1;
    else return;
    event.preventDefault();
    const key = keys[(next + keys.length) % keys.length];
    if (key === undefined) return;
    onMove(key);
    group.querySelector<HTMLElement>(`[data-choice="${CSS.escape(key)}"]`)?.focus();
  };
  return {
    group: { role: 'radiogroup', 'aria-label': label, onKeyDown },
    item: (key: K) => ({
      role: 'radio' as const,
      'aria-checked': key === value,
      tabIndex: key === value || (index < 0 && key === keys[0]) ? 0 : -1,
      'data-choice': key,
      onClick: () => onPick(key),
    }),
  };
}

export interface ChoiceCardProps {
  /** From `useChoiceGroup().item(key)`. */
  item: ReturnType<ReturnType<typeof useChoiceGroup>['item']>;
  children: ReactNode;
  /** `row`: the picture at the inline start and the words beside it (one column on phones). */
  layout?: 'stack' | 'row';
  pad?: 'sm' | 'md';
  className?: string;
}

/** A large option card that is one radio of a `useChoiceGroup` group. Holds phrasing content only (spans). */
export function ChoiceCard({ item, children, layout = 'stack', pad = 'md', className }: ChoiceCardProps) {
  return (
    <button type="button" {...item} className={cx(styles.card, pad === 'sm' ? styles.padSm : styles.padMd, layout === 'row' && styles.row, item['aria-checked'] && styles.selected, className)}>
      {children}
    </button>
  );
}
