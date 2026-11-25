import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import { Render } from '../Render/Render';
import type { RenderName } from '../Render/renders';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  /** What is (not) here, in a few calm words. Pass translated text. */
  title: string;
  /** One line: why it is empty and what happens next. */
  body?: ReactNode;
  /** A small building render above the title, when one fits the subject (`plot` for "no plots yet"). Decorative. */
  render?: RenderName;
  /** Otherwise a single 28 px icon above the title. Used when there is no `render`. */
  icon?: LucideIcon;
  /** Custom content above the title, only when neither a render nor an icon fits. Decorative. */
  illustration?: ReactNode;
  /** At most one action, usually a `Button`. */
  action?: ReactNode;
  /** Less space around it, for a section inside a screen rather than a whole screen. */
  compact?: boolean;
  /** Heading level for the document outline. Default 2. */
  level?: 2 | 3;
  className?: string;
}

/**
 * What a screen or a section says when there is nothing to show: quiet, centred, a small render or an
 * icon, a 21 px headline, one line of body and at most one pill.
 */
export function EmptyState({ title, body, render, icon, illustration, action, compact = false, level = 2, className }: EmptyStateProps) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const media = render ? (
    <div className={styles.render}>
      <Render name={render} decorative />
    </div>
  ) : icon ? (
    <div className={styles.icon} aria-hidden="true">
      <Icon icon={icon} size={28} />
    </div>
  ) : illustration ? (
    <div className={styles.illustration} aria-hidden="true">
      {illustration}
    </div>
  ) : null;
  return (
    <div className={cx(styles.empty, compact && styles.compact, className)}>
      {media}
      <Heading className={styles.title}>{title}</Heading>
      {body ? <p className={styles.body}>{body}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
