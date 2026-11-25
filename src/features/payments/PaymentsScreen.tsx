import { CircleCheck, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Link } from '@/app/router';
import { Button, Card, EmptyState, Grid, Icon, List, Money, Row, Screen, Section } from '@/design/core';
import { Skeleton } from '@/design/forms';
import type { Invoice } from '@/domain/types';
import { useNow } from '@/features/shared/useNow';
import { selectDues, selectInvoices, useApp, useCatalogueReady } from '@/state';
import { DueText } from './InvoiceRow';
import { groupByMonth, outstanding, receiptRef } from './logic';
import { PayInvoiceSheet } from './PayInvoiceSheet';
import styles from './Payments.module.css';
import { plurals, strings } from './strings';

/** Invoices and the statement: what is due first, with a pay pill each, then what was paid, by month. */
export function PaymentsScreen() {
  const t = useT(strings);
  const { lang, pick, fmt } = useLang();
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
      <Screen title={t('title')} large subtitle={t('subtitle')} nav="back" backTo="/account">
        <Skeleton variant="block" height={160} label={t('loading')} />
        <Section>
          <Skeleton variant="row" count={3} />
        </Section>
      </Screen>
    );
  }

  if (invoices.length === 0) {
    return (
      <Screen title={t('title')} large subtitle={t('subtitle')} nav="back" backTo="/account">
        <EmptyState icon={Receipt} title={t('nothing')} body={t('nothingBody')} action={<Button to="/solutions">{t('explore')}</Button>} />
      </Screen>
    );
  }

  return (
    <Screen title={t('title')} large subtitle={t('subtitle')} nav="back" backTo="/account" width="content">
      <Card className={styles.summary} aria-live="polite">
        {dues.count > 0 && dues.next ? (
          <div className={styles.summaryGrid}>
            <div>
              <p className={styles.eyebrow}>{t('totalDue')}</p>
              <p className={styles.figure}>
                <Money amount={dues.total} size="display" />
              </p>
              <p className={styles.summaryLine}>
                {fmt.plural(dues.count, plurals.invoices)}
                <span aria-hidden="true"> · </span>
                <span className="num">{t('nextDue', { date: fmt.date(dues.next.dueAt) })}</span>
              </p>
            </div>
            <DueText invoice={dues.next} now={now} className={styles.summaryDue} />
          </div>
        ) : (
          <div className={styles.clear}>
            <Icon icon={CircleCheck} size={28} className={styles.clearIcon} />
            <div>
              <p className={styles.clearTitle}>{t('allClear')}</p>
              <p className={styles.summaryLine}>{t('allClearBody')}</p>
            </div>
          </div>
        )}
      </Card>

      {open.length > 0 ? (
        <Section title={t('due')}>
          <Grid as="ul" columns={2}>
            {open.map((invoice) => (
              <Card as="li" key={invoice.id} className={styles.invoiceCard}>
                <Link to={`/account/payments/${invoice.id}`} className={styles.invoiceLink}>
                  <span className={styles.invoiceTitle}>{pick(invoice.title)}</span>
                  <span className={`${styles.invoiceRef} ltr num`}>{invoice.ref}</span>
                </Link>
                <div className={styles.invoiceFoot}>
                  <div>
                    <p className={styles.invoiceAmount}>
                      <Money amount={invoice.amount} size="title" />
                    </p>
                    <DueText invoice={invoice} now={now} />
                  </div>
                  <Button size="sm" onClick={() => setPaying(invoice)} aria-label={t('payLabel', { title: pick(invoice.title) })}>
                    {t('pay')}
                  </Button>
                </div>
              </Card>
            ))}
          </Grid>
        </Section>
      ) : null}

      <Section title={t('statement')} hint={t('statementHint')} action={{ label: t('issue'), to: '/start/B8' }}>
        {months.length === 0 ? (
          <EmptyState compact icon={Receipt} title={t('noHistory')} body={t('noHistoryBody')} level={3} />
        ) : (
          months.map((month) => (
            <section key={month.key} className={styles.month} aria-label={monthName.format(month.at)}>
              <header className={styles.monthHead}>
                <h3 className={styles.monthTitle}>{monthName.format(month.at)}</h3>
                {month.invoices.length > 1 ? <p className={styles.monthTotal}>{t('monthTotal', { amount: fmt.money(month.total) })}</p> : null}
              </header>
              <List>
                {month.invoices.map((invoice) => (
                  <Row
                    key={invoice.id}
                    title={pick(invoice.title)}
                    subtitle={
                      <>
                        <span className="ltr num">{receiptRef(invoice)}</span>
                        <span aria-hidden="true"> · </span>
                        <span className="num">{fmt.date(invoice.paidAt ?? invoice.issuedAt)}</span>
                      </>
                    }
                    trailing={<Money amount={invoice.amount} />}
                    to={invoice.receiptDocId ? `/account/wallet/${invoice.receiptDocId}` : `/account/payments/${invoice.id}`}
                    wrap
                  />
                ))}
              </List>
            </section>
          ))
        )}
      </Section>

      <PayInvoiceSheet invoice={paying} now={now} onClose={() => setPaying(null)} />
    </Screen>
  );
}
