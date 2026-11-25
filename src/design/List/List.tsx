import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from '@/app/router';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import { keepWhole } from './keepWhole';
import styles from './List.module.css';

export interface ListProps {
  children: ReactNode;
  /** `card` puts the rows on one surface with inset dividers; `plain` leaves them on the surface behind (a sheet, a card). */
  variant?: 'card' | 'plain';
  className?: string;
  'aria-label'?: string;
}

/** A vertical group of rows. The `card` variant is itself a card: do not wrap it in one. */
export function List({ children, variant = 'card', className, ...rest }: ListProps) {
  return (
    <ul className={cx(styles.list, styles[variant], className)} {...rest}>
      {children}
    </ul>
  );
}

export interface RowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** A plain glyph, an avatar, a ring… at the start of the row. */
  leading?: ReactNode;
  /** A value, pill or control at the end of the row. */
  trailing?: ReactNode;
  /** Small text above the title (a code, a category). */
  eyebrow?: ReactNode;
  /** Makes the row a link and shows a chevron. */
  to?: string;
  onClick?: () => void;
  /** Force or hide the chevron. Defaults to shown for links. */
  chevron?: boolean;
  /** Allow the subtitle to wrap to two lines instead of truncating. */
  wrap?: boolean;
  /**
   * A fact of a fact sheet («رقم العقد: LC-2021-0318»): the title is the label (14 px, --ink-3) and the trailing
   * value carries the information (17 px, --ink, tabular numbers, codes kept whole). Same design as the
   * document sheet and the invoice.
   */
  fact?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** One row of a list: leading · title and subtitle · trailing value · chevron. The divider starts where the text starts. */
export function Row({ title, subtitle, leading, trailing, eyebrow, to, onClick, chevron, wrap = false, fact = false, className, ...rest }: RowProps) {
  const showChevron = chevron ?? to !== undefined;
  const body = (
    <>
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <span className={styles.body}>
        <span className={styles.text}>
          {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
          <span className={styles.title}>{keepWhole(title)}</span>
          {subtitle ? <span className={cx(styles.subtitle, wrap && styles.wrap)}>{keepWhole(subtitle)}</span> : null}
        </span>
        {trailing ? <span className={styles.trailing}>{keepWhole(trailing)}</span> : null}
        {/* The chevron points forward: to the left in Arabic, to the right in English. */}
        {showChevron ? <Icon icon={ChevronRight} size={16} strokeWidth={2} flip className={styles.chevron} /> : null}
      </span>
    </>
  );
  return (
    <li className={cx(styles.item, fact && styles.fact, className)}>
      {to !== undefined ? (
        <Link to={to} className={cx(styles.row, styles.interactive)} {...rest}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" className={cx(styles.row, styles.interactive)} onClick={onClick} {...rest}>
          {body}
        </button>
      ) : (
        <div className={styles.row} {...rest}>
          {body}
        </div>
      )}
    </li>
  );
}
