import { CreditCard, Landmark } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Banner } from '../Banner/Banner';
import { Button } from '../Button/Button';
import { cx } from '../cx';
import { SelectField } from '../Field/SelectField';
import { Money } from '../Money/Money';
import { Sheet } from '../Sheet/Sheet';
import { Lines, SheetSuccess, type SheetLine } from './parts';
import styles from './PaySheet.module.css';
import { strings } from './strings';

export type PayPhase = 'review' | 'processing' | 'success';
export type PayMethod = 'card' | 'debit';

/** How long the simulated payment takes. */
export const PAY_MS = 1200;

export interface PaySheetProps {
  open: boolean;
  onClose: () => void;
  /** What is being paid, e.g. "ادفع فاتورة الإيجار". Pass translated text. */
  title: string;
  /** A few facts about the payment: invoice, plot, due date. */
  lines: SheetLine[];
  /** The amount in Qatari riyals. */
  amount: number;
  /** The receipt reference shown once the payment is done. */
  reference: string;
  /** Called once, when the person leaves the confirmation. */
  onPaid: () => void;
}

/**
 * The demo payment: review the amount, choose one of two stand-in methods, pay, see the receipt.
 * It is a simulation and says so: there are no card or account fields and nothing is charged.
 * While the payment is "processing" the sheet cannot be dismissed.
 */
export function PaySheet({ open, onClose, title, lines, amount, reference, onPaid }: PaySheetProps) {
  const t = useT(strings);
  const doneId = useId();
  const [phase, setPhase] = useState<PayPhase>('review');
  const [method, setMethod] = useState<PayMethod>('card');
  const [hold, setHold] = useState<number | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const settled = useRef(false);

  // Every opening starts from the review.
  useEffect(() => {
    if (!open) return;
    settled.current = false;
    setPhase('review');
    setHold(undefined);
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
    timer.current = setTimeout(() => setPhase('success'), PAY_MS);
  };

  // However the confirmation is left (the button, Escape, a swipe), the payment has happened.
  const finish = () => {
    if (!settled.current) {
      settled.current = true;
      onPaid();
    }
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={phase === 'success' ? finish : onClose}
      title={title}
      dismissible={phase !== 'processing'}
      closeLabel={t('close')}
      footer={<PayFooter phase={phase} amount={amount} onPay={pay} onDone={finish} doneId={doneId} />}
    >
      <div ref={contentRef}>
        <PayContent phase={phase} lines={lines} amount={amount} reference={reference} method={method} onMethod={setMethod} minHeight={hold} />
      </div>
      <span className="visually-hidden" role="status">
        {phase === 'processing' ? t('processing') : phase === 'success' ? t('paid') : ''}
      </span>
    </Sheet>
  );
}

export interface PayContentProps {
  phase: PayPhase;
  lines: SheetLine[];
  amount: number;
  reference: string;
  method: PayMethod;
  onMethod: (method: PayMethod) => void;
  minHeight?: number;
}

/** The inside of the payment sheet in each phase. `PaySheet` adds the sheet and the timing. */
export function PayContent({ phase, lines, amount, reference, method, onMethod, minHeight }: PayContentProps) {
  const t = useT(strings);

  if (phase === 'success') {
    return (
      <SheetSuccess title={t('paid')} minHeight={minHeight}>
        <p className={styles.paidAmount}>
          <Money amount={amount} size="heading" />
        </p>
        <Lines className={styles.receipt} lines={[{ label: t('receipt'), value: reference }]} />
        <p className={styles.paidNote}>{t('paidNote')}</p>
      </SheetSuccess>
    );
  }

  const busy = phase === 'processing';
  return (
    <div className={cx(styles.review, busy && styles.busy)} inert={busy} aria-busy={busy || undefined}>
      <div className={styles.amount}>
        <p className={styles.amountLabel}>{t('amountDue')}</p>
        <p className={styles.amountValue}>
          <Money amount={amount} size="display" />
        </p>
      </div>
      <Lines lines={lines} />
      <SelectField<PayMethod>
        label={t('method')}
        value={method}
        onChange={onMethod}
        options={[
          { value: 'card', label: t('card'), hint: t('cardHint'), icon: CreditCard },
          { value: 'debit', label: t('debit'), hint: t('debitHint'), icon: Landmark },
        ]}
      />
      <Banner tone="demo" compact>
        {t('notice')}
      </Banner>
    </div>
  );
}

export interface PayFooterProps {
  phase: PayPhase;
  amount: number;
  onPay?: () => void;
  onDone?: () => void;
  /** The id of the "Done" button, so the sheet can move focus to it. */
  doneId?: string;
}

/** The one button of the payment sheet: pay, then done. */
export function PayFooter({ phase, amount, onPay, onDone, doneId }: PayFooterProps) {
  const t = useT(strings);
  const { fmt } = useLang();
  if (phase === 'success') {
    return (
      <Button block id={doneId} onClick={onDone}>
        {t('done')}
      </Button>
    );
  }
  return (
    <Button block loading={phase === 'processing'} onClick={onPay}>
      {phase === 'processing' ? t('processing') : t('pay', { amount: fmt.money(amount) })}
    </Button>
  );
}
