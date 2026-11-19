import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from '@/app/router';
import { cx } from '../cx';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  /** `plain` white surface · `accent` tinted (the one emphasised card on a screen) · `sunken` recessed · `outline` transparent with a hairline. */
  tone?: 'plain' | 'accent' | 'sunken' | 'outline';
  pad?: 'none' | 'sm' | 'md' | 'lg';
  /** Make the whole card a link to this route. */
  to?: string;
  as?: 'div' | 'section' | 'article' | 'li';
}

/** A surface that groups related content. Hairline border, no shadow. */
export function Card({ children, tone = 'plain', pad = 'md', to, as: Tag = 'div', className, ...rest }: CardProps) {
  const classes = cx(styles.card, styles[tone], styles[`pad-${pad}`], to !== undefined && styles.link, className);
  if (to !== undefined) {
    return (
      <Link to={to} className={classes} aria-label={rest['aria-label']}>
        {children}
      </Link>
    );
  }
  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  );
}
