import { forwardRef, type ReactNode } from 'react';
import { useLang, useT } from '@/app/i18n';
import { cx } from '../cx';
import styles from './StepHead.module.css';
import { strings } from './strings';

/** "الخطوة 2 من 4" or "الخطوة 2 من 4 · النشاط": the one caption every flow uses (for `Stepper`'s label too). */
export function useStepLabel() {
  const t = useT(strings);
  const { fmt } = useLang();
  return (current: number, total: number, name?: string) =>
    name ? t('stepOfNamed', { n: fmt.num(current), m: fmt.num(total), name }) : t('stepOf', { n: fmt.num(current), m: fmt.num(total) });
}

export interface StepHeadProps {
  /** The step the person is on, counting from 1. */
  current: number;
  /** How many steps there are. */
  total: number;
  /** The name of the step, appended after a middle dot. */
  name?: string;
  /** The question of the step, in the title size. */
  question: ReactNode;
  /** One line of help under the question. */
  hint?: ReactNode;
  className?: string;
}

/**
 * The head of a step of a flow, the same in every flow: the caption «الخطوة n من m» (optionally «· name») in
 * 14 px --ink-3, the question in --t-title 600, and an optional line of help. Pair it with `<Stepper>` (the
 * 2 px progress line) in the screen's `header`; keep the sticky action bar for running context only. The ref
 * goes to the question, so a flow can move focus to it when the step changes.
 */
export const StepHead = forwardRef<HTMLHeadingElement, StepHeadProps>(function StepHead({ current, total, name, question, hint, className }, ref) {
  const label = useStepLabel();
  return (
    <header className={cx(styles.head, className)}>
      <p className={styles.where}>{label(current, total, name)}</p>
      <h2 ref={ref} tabIndex={-1} className={styles.question}>
        {question}
      </h2>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </header>
  );
});
