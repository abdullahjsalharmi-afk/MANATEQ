import { CircleAlert, CircleCheck, Clock, type LucideIcon } from 'lucide-react';
import { useLang, useT } from '@/app/i18n';
import { cx, Icon, Money, Row } from '@/design/core';
import type { Invoice } from '@/domain/types';
import { dueLine, type DueLine } from './logic';
import styles from './Payments.module.css';
import { plurals, strings } from './strings';

export interface InvoiceRowProps {
  invoice: Invoice;
  now: number;
}

const DUE_ICON: Record<DueLine['kind'], LucideIcon> = { paid: CircleCheck, overdue: CircleAlert, today: Clock, soon: Clock, later: Clock };

/** The due line as text: "تستحق خلال 5 أيام", "متأخرة منذ يومين", "دُفعت في 3 مارس 2026". */
export function useDueText(): (line: DueLine) => string {
  const t = useT(strings);
  const { fmt } = useLang();
  return (line) => {
    switch (line.kind) {
      case 'paid':
        return t('paidOn', { date: fmt.date(line.at) });
      case 'overdue':
        return fmt.plural(line.days, plurals.overdue);
      case 'today':
        return t('dueToday');
      case 'soon':
        return fmt.plural(line.days, plurals.dueIn);
      case 'later':
        return t('dueOn', { date: fmt.date(line.at) });
    }
  };
}

/** The due line with its glyph: the glyph carries the status colour, the words carry the meaning. */
export function DueText({ invoice, now, className }: { invoice: Invoice; now: number; className?: string }) {
  const text = useDueText();
  const line = dueLine(invoice, now);
  return (
    <span className={cx(styles.due, className)} data-tone={line.tone === 'neutral' ? undefined : line.tone}>
      <Icon icon={DUE_ICON[line.kind]} size={14} strokeWidth={2} className={styles.dueIcon} />
      <span className="num">{text(line)}</span>
    </span>
  );
}

/** One invoice in a list: title, amount, the due or paid line. Links to the invoice page. */
export function InvoiceRow({ invoice, now }: InvoiceRowProps) {
  const { pick } = useLang();
  return (
    <Row
      to={`/account/payments/${invoice.id}`}
      title={pick(invoice.title)}
      subtitle={<DueText invoice={invoice} now={now} />}
      trailing={<Money amount={invoice.amount} />}
      wrap
    />
  );
}
