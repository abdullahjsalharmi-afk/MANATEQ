import { useLayoutEffect, useRef, type HTMLAttributes, type KeyboardEvent, type MouseEventHandler, type ReactNode } from 'react';
import { Link } from '@/app/router';
import { cx } from '../cx';
import styles from './Card.module.css';

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, 'onClick'> {
  children: ReactNode;
  /**
   * `plain` white surface with a hairline (the default, on the parchment page and on dark tiles) ·
   * `parchment` borderless, for a card that sits on a white tile · `sunken` a recessed well for quiet notes ·
   * `outline` transparent with a hairline. `accent` is kept for older call sites and looks like `plain`.
   */
  tone?: 'plain' | 'parchment' | 'sunken' | 'outline' | 'accent';
  pad?: 'none' | 'sm' | 'md' | 'lg';
  /** Make the whole card a link to this route. */
  to?: string;
  /** Make the whole card a button (an option to choose). */
  onClick?: MouseEventHandler<HTMLElement>;
  /** For a card that is an option: draws the 2 px selection border and reports the state to assistive technology. */
  selected?: boolean;
  /**
   * The card is one of several mutually exclusive options (one solution, one persona): it is a radio
   * (`aria-checked`) instead of a toggle button (`aria-pressed`). Put the cards in a `<CardChoiceGroup>`, which
   * names the choice and moves between the options with the arrow keys.
   */
  choice?: boolean;
  /** A small building render (or other picture) that heads the card, centred, the same width in every card. */
  media?: ReactNode;
  as?: 'div' | 'section' | 'article' | 'li';
}

const PAD = { none: styles.padNone, sm: styles.padSm, md: styles.padMd, lg: styles.padLg } as const;

/** A surface that groups related content: hairline, 18 px corners, no shadow. Never put a card inside a card. */
export function Card({ children, tone = 'plain', pad = 'md', to, onClick, selected, choice = false, media, as: Tag = 'div', className, ...rest }: CardProps) {
  const interactive = to !== undefined || onClick !== undefined;
  const look = tone === 'accent' ? 'plain' : tone;
  const classes = cx(styles.card, styles[look], PAD[pad], interactive && styles.interactive, selected && styles.selected, className);
  const body = (
    <>
      {media ? (
        <span className={styles.media}>
          <span className={styles.mediaBox}>{media}</span>
        </span>
      ) : null}
      {children}
    </>
  );
  // In a list (`as="li"`) a link or an option keeps its list item around it.
  const inList = (node: ReactNode) => (Tag === 'li' ? <li className={styles.item}>{node}</li> : node);
  if (to !== undefined) {
    return inList(
      <Link to={to} className={classes} aria-label={rest['aria-label']} aria-current={selected ? 'true' : undefined} onClick={onClick}>
        {body}
      </Link>,
    );
  }
  if (onClick !== undefined) {
    // A div with the button role, so the card may hold headings and paragraphs and still be pressed from the keyboard.
    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      event.currentTarget.click();
    };
    return inList(
      <div
        {...rest}
        role={choice ? 'radio' : 'button'}
        tabIndex={0}
        className={classes}
        onClick={onClick}
        onKeyDown={onKeyDown}
        aria-pressed={choice ? undefined : (selected ?? undefined)}
        aria-checked={choice ? selected === true : undefined}
      >
        {body}
      </div>,
    );
  }
  return (
    <Tag className={classes} {...rest}>
      {body}
    </Tag>
  );
}

export interface CardChoiceGroupProps {
  /** The cards, each with `choice`, `onClick` and `selected`. */
  children: ReactNode;
  /** Names the choice for screen readers, e.g. «نوع الحل». Pass translated text. */
  label: string;
  className?: string;
}

/**
 * A group of option cards of which exactly one is chosen: a radiogroup with one tab stop (the chosen card, or
 * the first) and the arrow keys moving between the options and choosing them, as in `Segmented`.
 */
export function CardChoiceGroup({ children, label, className }: CardChoiceGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const radios = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []);

  // One tab stop: the chosen card, or the first when none is chosen yet.
  useLayoutEffect(() => {
    const all = radios();
    const chosen = all.find((radio) => radio.getAttribute('aria-checked') === 'true') ?? all[0];
    for (const radio of all) radio.tabIndex = radio === chosen ? 0 : -1;
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = radios();
    const at = all.indexOf(event.target as HTMLElement);
    if (at < 0) return;
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl';
    let next = at;
    if (event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) next = at + 1;
    else if (event.key === 'ArrowUp' || event.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) next = at - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = all.length - 1;
    else return;
    event.preventDefault();
    const target = all[(next + all.length) % all.length];
    if (!target) return;
    target.focus();
    target.click();
  };

  return (
    <div ref={ref} role="radiogroup" aria-label={label} className={className} onKeyDown={onKeyDown}>
      {children}
    </div>
  );
}
