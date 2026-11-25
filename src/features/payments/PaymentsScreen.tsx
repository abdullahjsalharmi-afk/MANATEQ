import { CircleCheck, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Link } from '@/app/router';
import { Button, Card, EmptyState, Grid, Icon, keepWhole, List, Money, Row, Screen, Section } from '@/design/core';
import { Skeleton } from '@/design/forms';
import type { Invoice } from '@/domain/types';
import { useNow } from '@/features/shared/useNow';
import { receiptRefFor, selectDues, selectInvoices, useApp, useCatalogueReady } from '@/state';
import { DueText } from './InvoiceRow';
import { groupByMonth, outstanding } from './logic';
import { PayInvoiceSheet } from './PayInvoiceSheet';
import styles from './Payments.module.css';
import { plurals, strings } from './strings';

/**
 * Invoices and the statement: what is due first, with a pay pill each, then what was paid, by month, in
 * one grouped list. With a single due invoice its card is the summary, so the amount appears once.
 */
export function PaymentsScreen() {
  const t = useT(strings);
  const { lang, fmt } = useLang();
  const ready = useCatalogueReady();
  const invoices = useApp(selectInvoices);
  const dues = useApp(selectDues);
  const now = useNow(60_000);
  const [paying, setPaying] = useState<Invoice | null>(null);

  const open = useMemo(() => outstanding(invoices), [invoices]);
  const months = useMemo(() => groupByMonth(invoices), [invoices]);
  const monthName = useMemo(
    () => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-QA-u-nu-latn-ca-gregory' : 'en-GB', { month: 'long', year: 'numeric' }),
    [lang],
  );

  if (!ready) {
    return (
      <Screen title={t('title')} nav="back" backTo="/account">
        <Skeleton variant="block" height={160} label={t('loading')} />
        <Section>
          <Skeleton variant="row" count={3} />
        </Section>
      </Screen>
    );
  }

  if (invoices.length === 0) {
    return (
      <Screen title={t('title')} nav="back" backTo="/account">
        <EmptyState icon={Receipt} title={t('nothing')} body={t('nothingBody')} action={<Button to="/solutions">{t('explore')}</Button>} />
      </Screen>
    );
  }

  const single = open.length === 1 ? open[0] : undefined;

  return (
    <Screen title={t('title')} nav="back" backTo="/account" width="content">
      <div aria-live="polite">
        {single ? (
          <Section title={t('due')}>
            <DueCard invoice={single} now={now} onPay={setPaying} figure="display" />
          </Section>
        ) : open.length > 1 && dues.next ? (
          <>
            <Card className={styles.summary}>
              <div className={styles.summaryGrid}>
                <div>
                  <p className={styles.eyebrow}>{t('totalDue')}</p>
                  <p className={styles.figure}>
                    <Money amount={dues.total} size="display" />
                  </p>
                  <p className={styles.summaryLine}>
                    {fmt.plural(dues.count, plurals.invoices)}
                    <span aria-hidden="true"> ·{'\u00A0'}</span>
                    <span className="num">{t('nextDue', { date: fmt.date(dues.next.dueAt) })}</span>
                  </p>
                </div>
                <DueText invoice={dues.next} now={now} className={styles.summaryDue} />
              </div>
            </Card>
            <Section title={t('due')}>
              <Grid as="ul" columns={2}>
                {open.map((invoice) => (
                  <DueCard key={invoice.id} invoice={invoice} now={now} onPay={setPaying} figure="title" as="li" />
                ))}
              </Grid>
            </Section>
          </>
        ) : (
          <Card className={styles.summary}>
            <div className={styles.clear}>
              <Icon icon={CircleCheck} size={28} className={styles.clearIcon} />
              <div>
                <p className={styles.clearTitle}>{t('allClear')}</p>
                <p className={styles.summaryLine}>{t('allClearBody')}</p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <Section title={t('statement')} action={{ label: t('issue'), to: '/start/B8' }}>
        {months.length === 0 ? (
          <EmptyState compact icon={Receipt} title={t('noHistory')} body={t('noHistoryBody')} level={3} />
        ) : (
          <Card pad="none" className={styles.statementCard}>
            {months.map((month) => (
              <section key={month.key} className={styles.month} aria-labelledby={`month-${month.key}`}>
                <header className={styles.monthHead}>
                  <h3 id={`month-${month.key}`} className={styles.monthTitle}>
                    {monthName.format(month.at)}
                  </h3>
                  {month.invoices.length > 1 ? <p className={styles.monthTotal}>{t('monthTotal', { amount: fmt.money(month.total) })}</p> : null}
                </header>
                <List variant="plain">
                  {month.invoices.map((invoice) => (
                    <StatementRow key={invoice.id} invoice={invoice} />
                  ))}
                </List>
              </section>
            ))}
          </Card>
        )}
      </Section>

      <PayInvoiceSheet invoice={paying} now={now} onClose={() => setPaying(null)} />
    </Screen>
  );
}

/** A due invoice: title and number, the amount as the figure, the due line and the small pay pill. */
function DueCard({ invoice, now, onPay, figure, as }: { invoice: Invoice; now: number; onPay: (invoice: Invoice) => void; figure: 'display' | 'title'; as?: 'li' }) {
  const t = useT(strings);
  const { pick } = useLang();
  return (
    <Card as={as} className={styles.invoiceCard}>
      <Link to={`/account/payments/${invoice.id}`} className={styles.invoiceLink}>
        <span className={styles.invoiceTitle}>
          {keepWhole(pick(invoice.title))}
        </span>
        <span className={styles.invoiceRef}>
          <span className="ltr">{invoice.ref}</span>
        </span>
      </Link>
      <div className={styles.invoiceFoot}>
        <div>
          <p className={styles.invoiceAmount}>
            <Money amount={invoice.amount} size={figure} />
          </p>
          <DueText invoice={invoice} now={now} />
        </div>
        <Button size="sm" onClick={() => onPay(invoice)} aria-label={t('payLabel', { title: pick(invoice.title) })}>
          {t('pay')}
        </Button>
      </div>
    </Card>
  );
}

/** A paid invoice in the statement: title, then its date and receipt number on their own line. */
function StatementRow({ invoice }: { invoice: Invoice }) {
  const { pick, fmt } = useLang();
  return (
    <Row
      title={pick(invoice.title)}
      subtitle={
        <>
          <span className={styles.metaLine}>{fmt.date(invoice.paidAt ?? invoice.issuedAt)}</span>
          <span className={styles.metaLine}>
            <span className="ltr">{receiptRefFor(invoice.ref)}</span>
          </span>
        </>
      }
      trailing={<Money amount={invoice.amount} />}
      to={invoice.receiptDocId ? `/account/wallet/${invoice.receiptDocId}` : `/account/payments/${invoice.id}`}
      wrap
    />
  );
}
