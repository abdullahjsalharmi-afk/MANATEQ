import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '@/app/i18n';
import { Sheet } from '@/design/core';
import { ReturnFocus } from '@/design/Field/ReturnFocus';
import { useConfirmedTask } from '@/design/Sheet/useConfirmedTask';
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
  /** Called once, when the person leaves the confirmation, or when the sheet went away before they could. */
  onDone: () => void;
  closeLabel: string;
}

/**
 * The demo payment of a request step. It looks and behaves like `PaySheet`, but the step is completed
 * when the payment goes through, before the confirmation, so the confirmation names the receipt that
 * was really filed instead of a number made up in advance. A payment the person confirmed completes the
 * step exactly once, even if the sheet goes away while it is processing (see `useConfirmedTask`).
 */
export function StepPaySheet({ open, onClose, title, lines, amount, onPay, onFailed, onDone, closeLabel }: StepPaySheetProps) {
  const t = useT(payStrings);
  const doneId = useId();
  const [phase, setPhase] = useState<PayPhase>('review');
  const [method, setMethod] = useState<PayMethod>('card');
  const [hold, setHold] = useState<number | undefined>(undefined);
  const [reference, setReference] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const task = useConfirmedTask(
    open,
    PAY_MS,
    () => {
      const receipt = onPay();
      if (receipt === null) {
        onFailed();
        return false;
      }
      setReference(receipt);
      setPhase('success');
      return true;
    },
    onDone,
  );

  // Every opening starts from the review.
  useEffect(() => {
    if (!open) return;
    setPhase('review');
    setHold(undefined);
    setReference('');
  }, [open]);

  // The pay button gives way to "Done": put the keyboard there.
  useEffect(() => {
    if (phase === 'success') document.getElementById(doneId)?.focus();
  }, [phase, doneId]);

  const pay = () => {
    setHold(contentRef.current?.offsetHeight);
    setPhase('processing');
    task.start();
  };

  // However the confirmation is left (the button, Escape, a swipe), the payment has happened.
  const finish = task.settle;

  return (
    <Sheet
      open={open}
      onClose={phase === 'success' ? finish : onClose}
      title={phase === 'success' ? t('paidTitle') : title}
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
