import { useId, type ReactNode } from 'react';
import { Link } from '@/app/router';
import { cx } from '../cx';
import styles from './Section.module.css';

export interface SectionProps {
  /** The section heading. */
  title?: string;
  /** A short line under the heading. */
  hint?: string;
  /** A quiet link beside the heading, e.g. "عرض الكل". */
  action?: { label: string; to?: string; onClick?: () => void };
  /** Heading level for the document outline. Default 2. */
  level?: 2 | 3;
  children: ReactNode;
  className?: string;
}

/** A titled block of a screen. Sections are separated by space, never by rules. */
export function Section({ title, hint, action, level = 2, children, className }: SectionProps) {
  const headingId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section className={cx(styles.section, className)} aria-labelledby={title ? headingId : undefined}>
      {title ? (
        <header className={styles.head}>
          <div className={styles.titles}>
            <Heading id={headingId} className={cx(styles.title, level === 3 && styles.small)}>
              {title}
            </Heading>
            {hint ? <p className={styles.hint}>{hint}</p> : null}
          </div>
          {action ? (
            action.to !== undefined ? (
              <Link to={action.to} className={styles.action}>
                {action.label}
              </Link>
            ) : (
              <button type="button" className={styles.action} onClick={action.onClick}>
                {action.label}
              </button>
            )
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
