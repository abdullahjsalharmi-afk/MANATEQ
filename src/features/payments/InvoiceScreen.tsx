import { CircleAlert, CircleCheck, Clock, FileQuestion, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useParams } from '@/app/routes';
import { Button, Card, EmptyState, keepWhole, List, Money, Pill, Row, Screen, Section, type Tone } from '@/design/core';
import { Skeleton } from '@/design/forms';
import { getZone } from '@/data/catalog';
import type { InvoiceStatus } from '@/domain/types';
import { useNow } from '@/features/shared/useNow';
import { DocRow } from '@/features/wallet/DocRow';
import { selectDoc, selectInvoice, selectLeases, selectPlots, selectRequest, useApp, useCatalogueReady } from '@/state';
import { DueText } from './InvoiceRow';
import { dueLine } from './logic';
import { PayInvoiceSheet } from './PayInvoiceSheet';
import styles from './Payments.module.css';
import { strings } from './strings';

const STATUS: Record<InvoiceStatus, { tone: Tone; icon: LucideIcon; key: 'stDue' | 'stOverdue' | 'stPaid' }> = {
  due: { tone: 'warn', icon: Clock, key: 'stDue' },
  overdue: { tone: 'bad', icon: CircleAlert, key: 'stOverdue' },
  paid: { tone: 'ok', icon: CircleCheck, key: 'stPaid' },
};

/** One invoice as a clean statement. Due: the pay pill in the action bar. Paid: its receipt. */
export function InvoiceScreen() {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const { id } = useParams<{ id: string }>();
  const ready = useCatalogueReady();
  const invoice = useApp(selectInvoice(id));
  const receipt = useApp(selectDoc(invoice?.receiptDocId));
  const leases = useApp(selectLeases);
  const plots = useApp(selectPlots);
  const request = useApp(selectRequest(invoice?.requestId));
  const now = useNow(60_000);
  const [paying, setPaying] = useState(false);

  if (!invoice) {
    return (
      <Screen title={t('invoice')} nav="back" backTo="/account/payments">
        {!ready ? (
          <Skeleton variant="block" height={420} label={t('loading')} />
        ) : (
          <EmptyState icon={FileQuestion} title={t('notFound')} body={t('notFoundBody')} action={<Button to="/account/payments">{t('toPayments')}</Button>} />
        )}
      </Screen>
    );
  }

  const lease = invoice.leaseId === undefined ? undefined : leases.find((candidate) => candidate.id === invoice.leaseId);
  const plot = lease === undefined ? undefined : plots.find((candidate) => candidate.id === lease.plotId);
  const zone = plot === undefined ? undefined : getZone(plot.zoneCode);
  // The calendar may not have marked a late invoice yet: the page reads the date itself.
  const status: InvoiceStatus = invoice.status === 'paid' ? 'paid' : dueLine(invoice, now).kind === 'overdue' ? 'overdue' : 'due';
  const state = STATUS[status];
  const unpaid = status !== 'paid';

  return (
    <Screen
      title={t('invoice')}
      nav="back"
      backTo="/account/payments"
      width="form"
      footerContext={unpaid ? <DueText invoice={invoice} now={now} /> : undefined}
      footer={
        unpaid ? (
          <Button block onClick={() => setPaying(true)}>
            {t('payAmount', { amount: fmt.money(invoice.amount) })}
          </Button>
        ) : undefined
      }
    >
      <Card as="article" className={styles.statement} aria-labelledby="invoice-title">
        <header className={styles.statementHead}>
          <p className={styles.eyebrow}>{t('issuer')}</p>
          <Pill tone={state.tone} icon={state.icon}>
            {t(state.key)}
          </Pill>
        </header>
        <h2 id="invoice-title" className={styles.statementTitle}>
          {keepWhole(pick(invoice.title))}
        </h2>
        <p className={styles.statementAmount}>
          <Money amount={invoice.amount} size="display" />
        </p>
        <DueText invoice={invoice} now={now} />

        <List variant="plain" className={styles.facts}>
          <Row fact title={t('reference')} trailing={<span className="ltr">{invoice.ref}</span>} />
          {lease ? <Row fact title={t('lease')} trailing={<span className="ltr">{lease.ref}</span>} /> : null}
          {plot ? (
            <Row
              fact
              title={t('plot')}
              trailing={
                <span>
                  <span className="ltr">{plot.number}</span>
                  {zone ? <> ·{'\u00A0'}{pick(zone.name)}</> : null}
                </span>
              }
            />
          ) : null}
          {request ? <Row fact title={t('request')} trailing={<span className="ltr">{request.ref}</span>} /> : null}
          <Row fact title={t('issued')} trailing={fmt.date(invoice.issuedAt)} />
          <Row fact title={t('dueDate')} trailing={fmt.date(invoice.dueAt)} />
          {invoice.paidAt !== undefined ? <Row fact title={t('paidDate')} trailing={fmt.date(invoice.paidAt)} /> : null}
        </List>
      </Card>

      {receipt ? (
        <Section title={t('receipt')}>
          <List>
            <DocRow doc={receipt} />
          </List>
          <p className={styles.center}>
            <Button to={`/account/wallet/${receipt.id}`}>{t('viewReceipt')}</Button>
          </p>
        </Section>
      ) : null}

      {unpaid ? <p className={styles.note}>{t('simNote')}</p> : null}

      <PayInvoiceSheet
        invoice={paying ? invoice : null}
        now={now}
        onClose={() => setPaying(false)}
      />
    </Screen>
  );
}
