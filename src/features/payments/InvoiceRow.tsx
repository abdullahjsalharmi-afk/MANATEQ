// CONTRACT STUB — the payments feature replaces the body, not the props.
import { Row } from '@/design/core';
import type { Invoice } from '@/domain/types';

export interface InvoiceRowProps {
  invoice: Invoice;
  now: number;
}

/** One invoice in a list: title, amount, due date or paid date, status. Links to the invoice page. */
export function InvoiceRow({ invoice }: InvoiceRowProps) {
  return <Row to={`/account/payments/${invoice.id}`} title={invoice.title.ar} subtitle={invoice.ref} />;
}
