import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../cx';
import styles from './Grid.module.css';

export interface GridProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** The most columns, reached on wide screens. Default 3: one column on phones, two from 735 px, three from 1069 px. */
  columns?: 2 | 3 | 4;
  /** Two columns already on phones: for small cards such as shortcuts. */
  compact?: boolean;
  /** `ul` for a list of like things; give it `<Card as="li">` children. */
  as?: 'div' | 'ul';
}

/** The responsive card grid: equal columns, cards of equal height in a row, 12 px apart on phones and 20 to 24 px on wide screens. */
export function Grid({ children, columns = 3, compact = false, as: Tag = 'div', className, ...rest }: GridProps) {
  return (
    <Tag className={cx(styles.grid, columns === 3 && styles.columns3, columns === 4 && styles.columns4, compact && styles.compact, className)} data-columns={columns} {...rest}>
      {children}
    </Tag>
  );
}
