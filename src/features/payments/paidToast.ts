import type { Formatters } from '@/app/i18n';
import { strings } from './strings';

/**
 * The words of the toast after any payment, the same on Home, in payments and on a request page: the verb
 * «تم الدفع» / "Paid", the receipt by its reference when it is known, and the place by the title of its screen.
 */
export function paidToastText(t: (key: 'paidToast' | 'paidToastPlain', vars?: Record<string, string>) => string, fmt: Pick<Formatters, 'ltr'>, receiptRef: string | undefined): string {
  return receiptRef ? t('paidToast', { ref: fmt.ltr(receiptRef) }) : t('paidToastPlain');
}

export { strings as paidStrings };
