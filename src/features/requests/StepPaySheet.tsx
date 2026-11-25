import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '@/app/i18n';
import { Sheet } from '@/design/core';
import { ReturnFocus } from '@/design/Field/ReturnFocus';
import { type SheetLine } from '@/design/forms';
import { PAY_MS, PayContent, PayFooter, type PayMethod, type PayPhase } from '@/design/PaySheet/PaySheet';
import { strings as payStrings } from '@/design/PaySheet/strings';

export interface StepPaySheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  lines: SheetLine[];
  amount: number;
  /**
   * Completes the step once the simulated payment has gone through and returns the reference of the
   * receipt it filed, or null when the step could not be completed. The confirmation shows that
   * reference, so it is the number the investor finds in the wallet.
   */
  onPay: () => string | null;
  /** The step could not be completed: the sheet closes without a confirmation. */
  onFailed: () => void;
  /** Called once, when the person leaves the confirmation. */
  onDone: () => void;
  closeLabel: string;
}

/**
 * The demo payment of a request step. It looks and behaves like `PaySheet`, but the step is completed
 * when the payment goes through, before the confirmation, so the confirmation names the receipt that
 * was really filed instead of a number made up in advance.
 */
export function StepPaySheet({ open, onClose, title, lines, amount, onPay, onFailed, onDone, closeLabel }: StepPaySheetProps) {
  const t = useT(payStrings);
  const doneId = useId();
  const [phase, setPhase] = useState<PayPhase>('review');
  const [method, setMethod] = useState<PayMethod>('card');
  const [hold, setHold] = useState<number | undefined>(undefined);
  const [reference, setReference] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settled = useRef(false);
  // The latest callbacks, read when the timer fires.
  const latest = useRef({ onPay, onFailed });
  latest.current = { onPay, onFailed };

  // Every opening starts from the review.
  useEffect(() => {
    if (!open) return;
    settled.current = false;
    setPhase('review');
    setHold(undefined);
    setReference('');
    return () => clearTimeout(timer.current);
  }, [open]);

  // The pay button gives way to "Done": put the keyboard there.
  useEffect(() => {
    if (phase === 'success') document.getElementById(doneId)?.focus();
  }, [phase, doneId]);

  const pay = () => {
    clearTimeout(timer.current);
    setHold(contentRef.current?.offsetHeight);
    setPhase('processing');
    timer.current = setTimeout(() => {
      const receipt = latest.current.onPay();
      if (receipt === null) {
        latest.current.onFailed();
        return;
      }
      setReference(receipt);
      setPhase('success');
    }, PAY_MS);
  };

  // However the confirmation is left (the button, Escape, a swipe), the payment has happened.
  const finish = () => {
    if (!settled.current) {
      settled.current = true;
      onDone();
    }
  };

  return (
    <Sheet
      open={open}
      onClose={phase === 'success' ? finish : onClose}
      title={title}
      dismissible={phase !== 'processing'}
      closeLabel={closeLabel}
      footer={<PayFooter phase={phase} amount={amount} onPay={pay} onDone={finish} doneId={doneId} />}
    >
      <ReturnFocus />
      <div ref={contentRef}>
        <PayContent phase={phase} lines={lines} amount={amount} reference={reference} method={method} onMethod={setMethod} minHeight={hold} />
      </div>
      <span className="visually-hidden" role="status">
        {phase === 'processing' ? t('processing') : phase === 'success' ? t('paid') : ''}
      </span>
    </Sheet>
  );
}
