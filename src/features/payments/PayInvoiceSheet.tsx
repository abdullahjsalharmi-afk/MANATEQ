import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { toast } from '@/design/core';
import { PaySheet } from '@/design/forms';
import type { Invoice } from '@/domain/types';
import { unbroken } from '@/features/wallet/logic';
import { Atom, CodedText } from '@/features/wallet/Unbroken';
import { payInvoice, receiptRefFor } from '@/state';
import { useDueText } from './InvoiceRow';
import { dueLine } from './logic';
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
      reference={invoice ? receiptRefFor(invoice.ref) : ''}
      lines={
        invoice
          ? [
              { label: t('invoice'), value: <CodedText text={pick(invoice.title)} /> },
              { label: t('reference'), value: <Atom code>{invoice.ref}</Atom> },
              { label: t('dueDate'), value: `${unbroken(fmt.date(invoice.dueAt))} ·\u00A0${dueText(dueLine(invoice, now))}` },
            ]
          : []
      }
      onPaid={() => {
        if (!invoice) return;
        const receipt = payInvoice(invoice.id);
        // The receipt is one tap away from where the person paid.
        toast(t('paidToast'), {
          tone: 'ok',
          duration: 6000,
          action: receipt === null ? undefined : { label: t('viewReceipt'), onClick: () => navigate(`/account/wallet/${receipt}`) },
        });
        onPaid?.(receipt);
      }}
    />
  );
}
