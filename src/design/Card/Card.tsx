import type { HTMLAttributes, KeyboardEvent, MouseEventHandler, ReactNode } from 'react';
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
  /** A small building render (or other picture) that heads the card, centred, the same width in every card. */
  media?: ReactNode;
  as?: 'div' | 'section' | 'article' | 'li';
}

/** A surface that groups related content: hairline, 18 px corners, no shadow. Never put a card inside a card. */
export function Card({ children, tone = 'plain', pad = 'md', to, onClick, selected, media, as: Tag = 'div', className, ...rest }: CardProps) {
  const interactive = to !== undefined || onClick !== undefined;
  const look = tone === 'accent' ? 'plain' : tone;
  const classes = cx(styles.card, styles[look], styles[`pad-${pad}`], interactive && styles.interactive, selected && styles.selected, className);
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
  if (to !== undefined) {
    return (
      <Link to={to} className={classes} aria-label={rest['aria-label']} aria-current={selected ? 'true' : undefined} onClick={onClick}>
        {body}
      </Link>
    );
  }
  if (onClick !== undefined) {
    // A div with the button role, so the card may hold headings and paragraphs and still be pressed from the keyboard.
    const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      event.currentTarget.click();
    };
    return (
      <div {...rest} role="button" tabIndex={0} className={classes} onClick={onClick} onKeyDown={onKeyDown} aria-pressed={selected ?? undefined}>
        {body}
      </div>
    );
  }
  return (
    <Tag className={classes} {...rest}>
      {body}
    </Tag>
  );
}
