import { useLang, useT } from '@/app/i18n';
import { toast } from '@/design/core';
import { PaySheet } from '@/design/forms';
import type { Invoice } from '@/domain/types';
import { payInvoice } from '@/state';
import { useDueText } from './InvoiceRow';
import { dueLine, receiptRef } from './logic';
import { strings } from './strings';

export interface PayInvoiceSheetProps {
  /** The invoice to pay; null keeps the sheet closed. */
  invoice: Invoice | null;
  now: number;
  onClose: () => void;
  /** Called with the receipt's document id once the payment is filed. */
  onPaid?: (receiptDocId: string | null) => void;
}

/**
 * The demo payment of one invoice: two taps (open, confirm). When the person leaves the confirmation the
 * invoice is paid in the state, the receipt is filed in the wallet and a toast says so.
 */
export function PayInvoiceSheet({ invoice, now, onClose, onPaid }: PayInvoiceSheetProps) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const dueText = useDueText();
  return (
    <PaySheet
      open={invoice !== null}
      onClose={onClose}
      title={t('sheetTitle')}
      amount={invoice?.amount ?? 0}
      reference={invoice ? receiptRef(invoice) : ''}
      lines={
        invoice
          ? [
              { label: t('invoice'), value: pick(invoice.title) },
              { label: t('reference'), value: <span className="ltr num">{invoice.ref}</span> },
              { label: t('dueDate'), value: `${fmt.date(invoice.dueAt)} · ${dueText(dueLine(invoice, now))}` },
            ]
          : []
      }
      onPaid={() => {
        if (!invoice) return;
        const receipt = payInvoice(invoice.id);
        toast(t('paidToast'), { tone: 'ok' });
        onPaid?.(receipt);
      }}
    />
  );
}
