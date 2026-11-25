import { useLang, useT } from '@/app/i18n';
import { Button, Card, Section } from '@/design/core';
import { Money } from '@/design/forms';
import type { Dues } from '@/state';
import styles from './Home.module.css';
import { strings } from './strings';

export interface DuesCardProps {
  dues: Dues;
  now: number;
  /** Opens the payment sheet for the invoice due first. */
  onPay: () => void;
}

/** What is due next: the amount as the figure, the due date, and a small pill that pays it here. */
export function DuesCard({ dues, now, onPay }: DuesCardProps) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const invoice = dues.next;
  if (!invoice) return null;
  const overdue = invoice.status === 'overdue' || invoice.dueAt < now;
  const rest = dues.total - invoice.amount;

  return (
    <Section title={t('duesTitle')} action={{ label: t('invoicesLink'), to: '/account/payments' }}>
      <Card className={styles.dues}>
        <p className={styles.duesFor}>{pick(invoice.title)}</p>
        <Money amount={invoice.amount} size="display" className={styles.duesAmount} />
        <p className={overdue ? styles.duesLate : styles.duesDate}>
          {overdue ? t('duesOverdue', { date: fmt.date(invoice.dueAt) }) : t('duesFor', { date: fmt.date(invoice.dueAt) })}
          <span aria-hidden="true"> · </span>
          {fmt.relative(invoice.dueAt, now)}
        </p>
        {rest > 0 ? <p className={styles.duesRest}>{t('duesMore', { amount: fmt.money(rest) })}</p> : null}
        <div className={styles.duesAction}>
          <Button variant="secondary" size="sm" onClick={onPay}>
            {t('pay')}
          </Button>
        </div>
      </Card>
    </Section>
  );
}
