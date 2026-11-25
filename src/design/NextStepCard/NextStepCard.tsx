import { ChevronRight, CircleCheck, Clock } from 'lucide-react';
import { useId } from 'react';
import { Button } from '../Button/Button';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import { keepWhole } from '../List/keepWhole';
import { Render } from '../Render/Render';
import type { RenderName } from '../Render/renders';
import styles from './NextStepCard.module.css';

interface NextStepAction {
  label: string;
  to?: string;
  onClick?: () => void;
}

export interface NextStepCardProps {
  /** A few words above the title, e.g. "خطوتك التالية". */
  eyebrow?: string;
  /** Verb first: what to do, or, when nothing is needed, the good news. */
  title: string;
  /** One line of context (two at the largest text size; longer copy is cut with an ellipsis). Codes and dates in it never break. */
  context?: string;
  /** The deadline in a few words, e.g. "خلال 5 أيام". */
  due?: string;
  /** The one action: the accent pill. A link when `to` is given, otherwise a button. */
  cta?: NextStepAction;
  /** `hero` only: a second, quieter action beside the first, shown as a ghost pill. */
  secondary?: NextStepAction;
  /** A quiet link after the action, e.g. "و3 إجراءات أخرى". */
  more?: { label: string; onClick: () => void };
  /**
   * `hero`: the maroon brand tile at the top of Home, with a large building render.
   * `action`: a quiet card, something is waiting for the investor.
   * `clear`: a calm card, nothing is needed right now.
   */
  tone?: 'hero' | 'action' | 'clear';
  /** The building render of the investor's current station. Large under the actions on `hero`; small at the head of a card otherwise. */
  render?: RenderName;
  /** Heading level of the title. Default 2. */
  level?: 2 | 3;
  className?: string;
}

/**
 * The investor's single next step: a verb-first title, one line of context with the deadline, one pill.
 * As the hero of Home it is the maroon brand tile with the render of the current station resting below the words,
 * or beside them from 834 px, where the tile is wide enough for both.
 * When nothing is waiting it says so calmly.
 */
export function NextStepCard({ eyebrow, title, context, due, cta, secondary, more, tone = 'action', render, level = 2, className }: NextStepCardProps) {
  const titleId = useId();
  const Heading = level === 2 ? 'h2' : 'h3';
  const hero = tone === 'hero';

  const dueLine = due ? (
    <span className={styles.due}>
      <Icon icon={Clock} size={14} strokeWidth={1.75} />
      <span>{due}</span>
    </span>
  ) : null;

  const moreLink = more ? (
    <button type="button" className={styles.more} onClick={more.onClick}>
      <span>{more.label}</span>
      <Icon icon={ChevronRight} size={16} strokeWidth={2} flip />
    </button>
  ) : null;

  if (hero) {
    return (
      <section className={cx(styles.hero, render && styles.withRender, className)} data-tone="brand" aria-labelledby={titleId}>
        <div className={styles.heroInner}>
          {eyebrow || due ? (
            <p className={styles.heroEyebrow}>
              {eyebrow ? <span>{eyebrow}</span> : null}
              {eyebrow && due ? <span aria-hidden="true">·</span> : null}
              {dueLine}
            </p>
          ) : null}
          <Heading id={titleId} className={styles.heroTitle}>
            {title}
          </Heading>
          {context ? (
            <p className={styles.heroContext}>
              {keepWhole(context)}
            </p>
          ) : null}
          {cta || secondary ? (
            <div className={styles.heroActions}>
              {cta ? (
                <Button size="md" to={cta.to} onClick={cta.onClick}>
                  {cta.label}
                </Button>
              ) : null}
              {secondary ? (
                <Button size="md" variant="secondary" to={secondary.to} onClick={secondary.onClick}>
                  {secondary.label}
                </Button>
              ) : null}
            </div>
          ) : null}
          {moreLink ? <div className={styles.heroMore}>{moreLink}</div> : null}
        </div>
        {render ? (
          <div className={styles.heroMedia}>
            <Render name={render} eager decorative />
          </div>
        ) : null}
      </section>
    );
  }

  const clear = tone === 'clear';
  return (
    <section className={cx(styles.card, styles[tone], render && styles.withMedia, className)} aria-labelledby={titleId}>
      {render ? (
        <div className={styles.media}>
          <Render name={render} decorative />
        </div>
      ) : null}
      <div className={styles.words}>
        {!render && clear ? (
          <span className={styles.check} aria-hidden="true">
            <Icon icon={CircleCheck} size={28} strokeWidth={1.5} />
          </span>
        ) : null}
        {eyebrow || due ? (
          <div className={styles.top}>
            {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : <span />}
            {dueLine}
          </div>
        ) : null}
        <Heading id={titleId} className={styles.title}>
          {title}
        </Heading>
        {context ? <p className={styles.context}>{keepWhole(context)}</p> : null}
        {cta || moreLink ? (
          <div className={styles.actions}>
            {cta ? (
              clear ? (
                <Button variant="quiet" size="md" trailingIcon={ChevronRight} flipIcons to={cta.to} onClick={cta.onClick}>
                  {cta.label}
                </Button>
              ) : (
                <Button size="md" to={cta.to} onClick={cta.onClick}>
                  {cta.label}
                </Button>
              )
            ) : null}
            {moreLink}
          </div>
        ) : null}
      </div>
    </section>
  );
}
