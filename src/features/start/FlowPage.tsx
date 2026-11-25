import { useEffect, useRef, type ReactNode } from 'react';
import { useT } from '@/app/i18n';
import { Screen } from '@/design/core';
import { Stepper } from '@/design/forms';
import styles from './Start.module.css';
import { strings } from './strings';

export interface FlowPageProps {
  /** The service, in the bar ("اطلب شهادة أو كشف حساب"). */
  title: string;
  /** 1-based step and the number of steps, for the progress line. */
  step: number;
  total: number;
  /** The question or the name of the page, in 28 px / 600. */
  heading: string;
  /** One line under the heading. */
  lead?: ReactNode;
  /** Closes the flow (confirm first when something was entered). */
  onClose: () => void;
  /** The one pill of the page: a `<Button block>`. */
  footer: ReactNode;
  /** One line of running context beside the pill (the draft line, the amount). */
  footerContext?: ReactNode;
  /** Changes whenever the page changes: focus moves to the heading and the page scrolls to the top. */
  pageKey?: string | number;
  children: ReactNode;
}

/** One page of a flow: close, the 2 px progress line, the step, the heading, the content and the action bar. */
export function FlowPage({ title, step, total, heading, lead, onClose, footer, footerContext, pageKey, children }: FlowPageProps) {
  const t = useT(strings);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  useEffect(() => {
    // The screen focuses itself on arrival; later pages move focus to their own heading.
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [pageKey]);

  const stepText = t('stepOf', { n: step, m: total });
  return (
    <Screen
      title={title}
      nav="close"
      navLabel={t('closeFlow')}
      onNav={onClose}
      width="form"
      header={<Stepper current={step} total={total} label={stepText} />}
      footer={footer}
      footerContext={footerContext}
    >
      <div className={styles.head}>
        <p className={styles.step}>{stepText}</p>
        <h2 ref={headingRef} tabIndex={-1} className={styles.heading}>
          {heading}
        </h2>
        {lead ? <p className={styles.lead}>{lead}</p> : null}
      </div>
      {children}
    </Screen>
  );
}
