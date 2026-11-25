import { ChevronRight } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';
import { Link } from '@/app/router';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './Section.module.css';

export interface SectionProps {
  /** The section heading. */
  title?: string;
  /** A short line under the heading. */
  hint?: string;
  /** A quiet link beside the heading, e.g. "عرض الكل". */
  action?: { label: string; to?: string; onClick?: () => void };
  /** Heading level for the document outline. Default 2; level 3 is the smaller head of a sub-section. */
  level?: 2 | 3;
  children: ReactNode;
  className?: string;
}

/**
 * A titled block of a screen: a 21 px head with an optional quiet link at the inline end, then the content.
 * Sections space themselves (32 px above on phones, 48 px on wide screens) and are never separated by rules.
 */
export function Section({ title, hint, action, level = 2, children, className }: SectionProps) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const Heading = level === 2 ? 'h2' : 'h3';

  // An action that removes itself ("Mark all as read") would drop the keyboard focus to the top of the page.
  // Once it is gone, the focus moves to the heading of its section, where the reader already was.
  const runAction = () => {
    action?.onClick?.();
    requestAnimationFrame(() => {
      const lost = document.activeElement === null || document.activeElement === document.body;
      const heading = headingRef.current;
      if (buttonRef.current || !lost || !heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
  };
  return (
    <section className={cx(styles.section, level === 3 && styles.sub, className)} aria-labelledby={title ? headingId : undefined} data-section="">
      {title ? (
        <header className={styles.head}>
          <div className={styles.titles}>
            <Heading id={headingId} ref={headingRef} className={cx(styles.title, level === 3 && styles.small)}>
              {title}
            </Heading>
            {hint ? <p className={styles.hint}>{hint}</p> : null}
          </div>
          {action ? (
            action.to !== undefined ? (
              <Link to={action.to} className={styles.action}>
                <span>{action.label}</span>
                <Icon icon={ChevronRight} size={12} strokeWidth={2.25} flip />
              </Link>
            ) : (
              <button ref={buttonRef} type="button" className={styles.action} onClick={runAction}>
                <span>{action.label}</span>
              </button>
            )
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
