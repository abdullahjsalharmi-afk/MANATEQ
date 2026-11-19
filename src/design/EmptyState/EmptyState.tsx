import type { ReactNode } from 'react';
import { cx } from '../cx';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** What is (not) here, in a few calm words. Pass translated text. */
  title: string;
  /** One or two sentences: why it is empty and what happens next. */
  body?: ReactNode;
  /** A sketch or an icon above the title. */
  illustration?: ReactNode;
  /** One action, usually a `Button`. */
  action?: ReactNode;
  /** Less space around it, for a section inside a screen rather than a whole screen. */
  compact?: boolean;
  /** Heading level for the document outline. Default 2. */
  level?: 2 | 3;
  className?: string;
}

/** What a screen or a section says when there is nothing to show. */
export function EmptyState({ title, body, illustration, action, compact = false, level = 2, className }: EmptyStateProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className={cx(styles.empty, compact && styles.compact, className)}>
      {illustration ? (
        <div className={styles.illustration} aria-hidden="true">
          {illustration}
        </div>
      ) : null}
      <Heading className={styles.title}>{title}</Heading>
      {body ? <p className={styles.body}>{body}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
