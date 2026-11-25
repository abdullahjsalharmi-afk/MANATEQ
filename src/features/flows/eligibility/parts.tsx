/**
 * Small pieces the two journey-1 flows share: the head of a step (where you are, the one question,
 * one line of help), focus moving to it on every step, and the line that labels data as illustrative.
 */
import { forwardRef, useEffect, useRef, type ReactNode } from 'react';
import { DemoPill } from '@/design/forms';
import { cx } from '@/design/core';
import styles from './Flow.module.css';

export interface StepHeadProps {
  /** "الخطوة 2 من 3 · نوع الحل". */
  where: string;
  question: string;
  hint?: ReactNode;
}

/** The head of a flow step: a quiet "where you are", the question in the title size, one line of help. */
export const StepHead = forwardRef<HTMLHeadingElement, StepHeadProps>(function StepHead({ where, question, hint }, ref) {
  return (
    <header className={styles.head}>
      <p className={cx('type-callout', styles.where)}>{where}</p>
      <h2 ref={ref} tabIndex={-1} className={cx('type-title', styles.question)}>
        {question}
      </h2>
      {hint ? <p className={cx('type-body', styles.hint)}>{hint}</p> : null}
    </header>
  );
});

/**
 * Moves the page to the top and the keyboard to the step's question whenever `key` changes
 * (not on the first render: the screen already puts focus on its title).
 */
export function useStepFocus<T>(key: T) {
  const ref = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    ref.current?.focus({ preventScroll: true });
  }, [key]);
  return ref;
}

/** A quiet line of fine print with the "illustrative data" marker. */
export function FinePrint({ children, demo }: { children: ReactNode; demo?: 'illustrative' | 'indicative' | 'simulation' | 'example' }) {
  return (
    <p className={cx('type-foot', styles.fine)}>
      {demo ? <DemoPill kind={demo} /> : null}
      <span>{children}</span>
    </p>
  );
}

/** A message that appears when the investor tries to go on without answering. */
export function StepError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className={cx('type-callout', styles.error)}>
      {children}
    </p>
  );
}

/**
 * After a Continue that found something missing: brings the first marked field (or the first message)
 * into the middle of the view and moves the keyboard to it, so the investor sees why nothing happened.
 * Runs once React has drawn the messages.
 */
export function revealFirstError(): void {
  window.setTimeout(() => {
    const target = document.querySelector<HTMLElement>('main [aria-invalid="true"], main [role="alert"]');
    if (!target) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    target.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    if (!target.matches('input, select, textarea, button, [tabindex]')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }, 0);
}
