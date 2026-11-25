import { ChevronDown, ChevronUp, Clock, CornerDownRight, EllipsisVertical, Zap } from 'lucide-react';
import { useId, useState } from 'react';
import { useT } from '@/app/i18n';
import type { Lane } from '@/data/types';
import { cx } from '../cx';
import { HolderChip, useHolderLabel } from '../HolderChip/HolderChip';
import { Icon } from '../Icon/Icon';
import { strings } from './strings';
import styles from './Timeline.module.css';

/**
 * `stopped`: the step that was open when the investor withdrew the request. It never finished: a neutral hollow
 * marker, muted words, and no time shown as a completion.
 */
export type TimelineState = 'done' | 'current' | 'upcoming' | 'skipped' | 'stopped';

export interface TimelineItem {
  id: string | number;
  /** The step in a few words. */
  title: string;
  /** One or two sentences about the step. Shown for the current step only. */
  text?: string;
  /** Who holds the step. */
  lane: Lane;
  /** The entity's own name when the step names one, e.g. "وزارة البلدية". */
  holderName?: string;
  state: TimelineState;
  /** Done steps: when the step finished. Current and upcoming steps: when it is expected. Already formatted. Never shown for a stopped step. */
  time?: string;
  /** The step runs without a person. */
  auto?: boolean;
  /** For decisions: what was decided, e.g. "نعم · الشهادة سارية". */
  outcome?: string;
  /** The step's own published standard, e.g. "فوري" or "يوما عمل". Shown until the step is done. */
  standard?: string;
}

export interface TimelineProps {
  items: TimelineItem[];
  /**
   * Shorten a long timeline: earlier steps fold behind "عرض الخطوات السابقة (n)" and only this many
   * upcoming steps show before "عرض كل الخطوات". Leave undefined to show every step.
   */
  collapsedCount?: number;
  /** Names the list for screen readers. Default "خطوات الطلب". */
  label?: string;
  className?: string;
}

/** Folding a single step behind a button saves nothing. */
const MIN_HIDDEN = 2;

/**
 * The request timeline: "who has it now?" across Manateq and national entities.
 * A thin vertical rail: finished steps are solid ink dots, the current step has the accent dot with its
 * holder and expected time, upcoming steps are hollow and muted. An ordered list; the current step is
 * `aria-current`.
 */
export function Timeline({ items, collapsedCount, label, className }: TimelineProps) {
  const t = useT(strings);
  const holder = useHolderLabel();
  const listId = useId();
  const [pastOpen, setPastOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);

  const currentIndex = items.findIndex((item) => item.state === 'current');
  // "Past" is everything before the current step; without a current step, the finished steps at the start.
  let pastEnd = currentIndex;
  if (pastEnd < 0) {
    pastEnd = 0;
    while (pastEnd < items.length && isPast(items[pastEnd]?.state)) pastEnd++;
  }
  const afterStart = currentIndex >= 0 ? currentIndex + 1 : pastEnd;
  const pastCount = pastEnd;
  const afterCount = items.length - afterStart;

  let hiddenPast = 0;
  let hiddenAfter = 0;
  if (collapsedCount !== undefined) {
    const keep = Math.max(0, Math.floor(collapsedCount));
    // While the request is moving, the past folds away completely; once it is finished, the last steps stay.
    hiddenPast = pastEnd < items.length ? pastCount : Math.max(0, pastCount - keep);
    hiddenAfter = Math.max(0, afterCount - keep);
    if (hiddenPast < MIN_HIDDEN) hiddenPast = 0;
    if (hiddenAfter < MIN_HIDDEN) hiddenAfter = 0;
  }

  const from = pastOpen ? 0 : hiddenPast;
  const to = restOpen ? items.length : items.length - hiddenAfter;
  const visible = items.slice(from, to);
  // While steps are folded away, the rail runs on into the button that brings them back.
  const pastFolded = hiddenPast > 0 && !pastOpen;
  const restFolded = hiddenAfter > 0 && !restOpen;

  const toggleAll = () => {
    const open = !restOpen;
    setRestOpen(open);
    setPastOpen(open && hiddenPast > 0);
  };

  return (
    <div className={cx(styles.timeline, className)}>
      {hiddenPast > 0 ? (
        <button type="button" className={cx(styles.toggle, pastFolded ? styles.past : styles.hide)} aria-expanded={pastOpen} aria-controls={listId} onClick={() => setPastOpen((open) => !open)}>
          <span className={styles.lead} aria-hidden="true">
            {pastFolded ? <span className={cx(styles.dot, styles.stack)} /> : null}
          </span>
          <span className={styles.toggleLabel}>
            {pastOpen ? t('hidePast') : t('showPast', { n: hiddenPast })}
            <Icon icon={pastOpen ? ChevronUp : ChevronDown} size={16} strokeWidth={2} />
          </span>
        </button>
      ) : null}

      <ol id={listId} className={styles.list} start={from + 1} aria-label={label ?? t('list')} data-lead={pastFolded || undefined} data-tail={restFolded || undefined}>
        {visible.map((item, offset) => {
          const index = from + offset;
          const isCurrent = item.state === 'current';
          const automatic = Boolean(item.auto) || item.lane === 'eng';
          const who = item.lane === 'eng' ? null : holder(item.lane, item.holderName, 'by');
          const when = item.state === 'stopped' ? undefined : item.state === 'done' || item.state === 'skipped' ? item.time : (item.time ?? item.standard);
          return (
            <li key={item.id} className={cx(styles.item, styles[item.state])} aria-current={isCurrent ? 'step' : undefined} data-state={item.state} data-past={index < pastEnd || undefined}>
              <span className={styles.dot} aria-hidden="true" />
              {isCurrent ? (
                <div className={styles.card}>
                  <p className={styles.title}>
                    <span className="visually-hidden">{t('current')}: </span>
                    {item.title}
                  </p>
                  {item.text ? <p className={styles.text}>{item.text}</p> : null}
                  <div className={styles.now}>
                    <HolderChip lane={item.lane} name={item.holderName} size="sm" />{' '}
                    {item.auto && item.lane !== 'eng' ? (
                      <span className={styles.auto}>
                        <Icon icon={Zap} size={12} strokeWidth={2.25} />
                        {t('auto')}{' '}
                      </span>
                    ) : null}
                    {when ? (
                      <span className={styles.eta}>
                        <Icon icon={Clock} size={13} strokeWidth={2} />
                        {when}
                      </span>
                    ) : null}
                  </div>
                  {item.outcome ? <Outcome text={item.outcome} /> : null}
                </div>
              ) : (
                <div className={styles.body}>
                  <p className={styles.title}>
                    <span className="visually-hidden">{t(item.state)}: </span>
                    {item.title}
                  </p>
                  {automatic || who || when || item.state === 'skipped' || item.state === 'stopped' ? (
                    <p className={styles.meta}>
                      <span className={styles.parts}>
                        {item.state === 'skipped' ? <span className={styles.part}>{t('skipped')} </span> : null}
                        {item.state === 'stopped' ? (
                          <span className={styles.part} aria-hidden="true">
                            {t('stoppedHere')}{' '}
                          </span>
                        ) : null}
                        {automatic ? (
                          <span className={cx(styles.part, styles.auto)}>
                            <Icon icon={Zap} size={12} strokeWidth={2.25} />
                            {t('auto')}{' '}
                          </span>
                        ) : null}
                        {who ? <span className={styles.part}>{who} </span> : null}
                        {when ? <span className={cx(styles.part, 'num')}>{when}</span> : null}
                      </span>
                    </p>
                  ) : null}
                  {item.outcome ? <Outcome text={item.outcome} /> : null}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {hiddenAfter > 0 ? (
        <button type="button" className={cx(styles.toggle, restFolded ? styles.more : styles.less)} aria-expanded={restOpen} aria-controls={listId} onClick={toggleAll}>
          <span className={styles.lead} aria-hidden="true">
            {restFolded ? <Icon icon={EllipsisVertical} size={16} strokeWidth={2} /> : null}
          </span>
          <span className={styles.toggleLabel}>
            {restOpen ? t('showLess') : t('showAll')}
            <Icon icon={restOpen ? ChevronUp : ChevronDown} size={16} strokeWidth={2} />
          </span>
        </button>
      ) : null}
    </div>
  );
}

/** Finished, not needed or stopped: a step behind the request. */
function isPast(state: TimelineState | undefined): boolean {
  return state === 'done' || state === 'skipped' || state === 'stopped';
}

function Outcome({ text }: { text: string }) {
  return (
    <p className={styles.outcome}>
      <Icon icon={CornerDownRight} size={14} strokeWidth={2} flip />
      <span>{text}</span>
    </p>
  );
}
