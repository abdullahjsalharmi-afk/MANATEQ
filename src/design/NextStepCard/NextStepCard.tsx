import { Clock } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { Button } from '../Button/Button';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './NextStepCard.module.css';

export interface NextStepCardProps {
  /** A few words above the title, e.g. "الخطوة التالية". */
  eyebrow?: string;
  /** Verb first: what to do — or, when nothing is needed, the good news. */
  title: string;
  /** One line of context. */
  context?: string;
  /** The deadline in a few words, e.g. "خلال 5 أيام". */
  due?: string;
  /** The one action. A link when `to` is given, otherwise a button. */
  cta?: { label: string; to?: string; onClick?: () => void };
  /** A quiet link under the action, e.g. "و3 إجراءات أخرى". */
  more?: { label: string; onClick: () => void };
  /** `action`: something is waiting for the investor. `clear`: nothing is needed right now. */
  tone?: 'action' | 'clear';
  /** A line sketch above the words. */
  illustration?: ReactNode;
  /** Heading level of the title. Default 2. */
  level?: 2 | 3;
  className?: string;
}

/**
 * The hero of Home: the investor's single next step — a verb-first title, one line of context with the
 * deadline, one button. When nothing is waiting it says so calmly.
 */
export function NextStepCard({ eyebrow, title, context, due, cta, more, tone = 'action', illustration, level = 2, className }: NextStepCardProps) {
  const titleId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <section className={cx(styles.card, styles[tone], className)} aria-labelledby={titleId}>
      {illustration ? (
        <div className={styles.illustration} aria-hidden="true">
          {illustration}
        </div>
      ) : null}
      {eyebrow || due ? (
        <div className={styles.top}>
          {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : <span />}
          {due ? (
            <p className={styles.due}>
              <Icon icon={Clock} size={13} strokeWidth={2} />
              <span>{due}</span>
            </p>
          ) : null}
        </div>
      ) : null}
      <Heading id={titleId} className={styles.title}>
        {title}
      </Heading>
      {context ? <p className={styles.context}>{context}</p> : null}
      {cta ? (
        <Button className={styles.cta} block variant={tone === 'action' ? 'primary' : 'secondary'} size={tone === 'action' ? 'lg' : 'md'} to={cta.to} onClick={cta.onClick}>
          {cta.label}
        </Button>
      ) : null}
      {more ? (
        <button type="button" className={styles.more} onClick={more.onClick}>
          {more.label}
        </button>
      ) : null}
    </section>
  );
}
