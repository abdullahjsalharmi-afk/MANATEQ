import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from '@/app/router';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './List.module.css';

export interface ListProps {
  children: ReactNode;
  /** `card` puts the rows on one surface with inset dividers; `plain` leaves them on the page. */
  variant?: 'card' | 'plain';
  className?: string;
  'aria-label'?: string;
}

/** A vertical group of rows. */
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
  /** An icon tile, avatar, ring… at the start of the row. */
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
  className?: string;
  'aria-label'?: string;
}

/** One row of a list: leading · title/subtitle · trailing · chevron. */
export function Row({ title, subtitle, leading, trailing, eyebrow, to, onClick, chevron, wrap = false, className, ...rest }: RowProps) {
  const interactive = to !== undefined || onClick !== undefined;
  const showChevron = chevron ?? to !== undefined;
  const body = (
    <>
      {leading ? <span className={styles.leading}>{leading}</span> : null}
      <span className={styles.text}>
        {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
        <span className={styles.title}>{title}</span>
        {subtitle ? <span className={cx(styles.subtitle, wrap && styles.wrap)}>{subtitle}</span> : null}
      </span>
      {trailing ? <span className={styles.trailing}>{trailing}</span> : null}
      {/* The chevron points "forward": left in Arabic, mirrored to the right in English. */}
      {showChevron ? <Icon icon={ChevronLeft} size={18} className={styles.chevron} /> : null}
    </>
  );
  return (
    <li className={cx(styles.item, className)}>
      {to !== undefined ? (
        <Link to={to} className={cx(styles.row, styles.interactive)} {...rest}>
          {body}
        </Link>
      ) : onClick ? (
        <button type="button" className={cx(styles.row, styles.interactive)} onClick={onClick} {...rest}>
          {body}
        </button>
      ) : (
        <div className={cx(styles.row, interactive && styles.interactive)} {...rest}>
          {body}
        </div>
      )}
    </li>
  );
}
