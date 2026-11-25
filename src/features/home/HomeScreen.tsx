import { Bell, Search } from 'lucide-react';
import { useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { Container, IconButton, List, Screen, Section, Skeleton, toast } from '@/design/core';
import { PaySheet, type SheetLine } from '@/design/forms';
import type { Invoice } from '@/domain/types';
import { paidStrings, paidToastText } from '@/features/payments/paidToast';
import { RequestRow } from '@/features/requests';
import { useNow } from '@/features/shared/useNow';
import {
  payInvoice,
  receiptRefFor,
  selectActiveRequests,
  selectCompany,
  selectDues,
  selectInvoices,
  selectJourney,
  selectNextSteps,
  selectPersona,
  selectPlot,
  selectStation,
  selectUnreadCount,
  useApp,
} from '@/state';
import { useCatalogueReady } from '@/state/catalogue';
import { HowTile, SolutionsSection, ZonesTile } from './Discover';
import { DuesCard } from './DuesCard';
import { HomeHero } from './HomeHero';
import { JourneyCard } from './JourneyCard';
import { greetingOf } from './logic';
import { Shortcuts } from './Shortcuts';
import styles from './Home.module.css';
import { strings } from './strings';

const REQUESTS_ON_HOME = 3;

/** Home answers one question: what is my next step? Then the journey, open requests, dues and shortcuts. */
export function HomeScreen() {
  const t = useT(strings);
  const paidT = useT(paidStrings);
  const { pick, fmt } = useLang();
  const now = useNow();
  const ready = useCatalogueReady();

  const persona = useApp(selectPersona);
  const company = useApp(selectCompany);
  const steps = useApp(selectNextSteps);
  const station = useApp(selectStation);
  const journey = useApp(selectJourney);
  const plot = useApp(selectPlot(journey.plotId ?? undefined));
  const active = useApp(selectActiveRequests);
  const dues = useApp(selectDues);
  const unread = useApp(selectUnreadCount);
  const invoices = useApp(selectInvoices);

  // The invoice being paid stays on screen until the sheet closes, even once it is settled.
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const guest = persona === 'guest';
  const tenant = persona === 'tenant';
  const greeting = t(greetingOf(new Date(now).getHours()));

  const actions = (
    <>
      {/* From 834 px the global bar carries search and the bell; this bar stays bare, like every other tab root. */}
      <IconButton icon={Search} label={t('search')} to="/search" className={styles.phoneOnly} />
      {guest ? null : (
        <IconButton
          icon={Bell}
          label={unread > 0 ? t('notificationsUnread', { n: fmt.num(unread) }) : t('notifications')}
          badge={unread > 0 ? unread : undefined}
          to="/notifications"
          className={styles.phoneOnly}
        />
      )}
    </>
  );

  const payLines: SheetLine[] = paying
    ? [
        { label: t('lineInvoice'), value: <span className="ltr">{paying.ref}</span> },
        { label: t('lineFor'), value: pick(paying.title) },
        { label: t('lineDue'), value: fmt.date(paying.dueAt) },
      ]
    : [];

  const onPaid = () => {
    if (!paying) return;
    const receipt = payInvoice(paying.id);
    toast(paidToastText(paidT, fmt, receipt ? receiptRefFor(paying.ref) : undefined), { tone: 'ok', action: receipt ? { label: t('viewReceipt'), onClick: () => navigate(`/account/wallet/${receipt}`) } : undefined });
  };

  const pay = (invoice: Invoice | null | undefined) => {
    if (!invoice) return;
    setPaying(invoice);
    setPayOpen(true);
  };

  const requests = active.slice(0, REQUESTS_ON_HOME);
  // When the hero already pays the invoice due first, the dues card shows it without a second pill.
  const heroInvoice = guest ? undefined : steps[0]?.invoiceId;

  return (
    <Screen title={greeting} subtitle={company ? pick(company.name) : undefined} large bleed width="grid" actions={actions}>
      {!ready && tenant ? (
        <Container width="grid">
          <Skeleton variant="block" height={420} label={t('loading')} />
        </Container>
      ) : (
        <HomeHero persona={persona} steps={steps} station={station} now={now} onPay={(id) => pay(invoices.find((invoice) => invoice.id === id))} />
      )}

      {tenant || requests.length > 0 ? (
        <Container width="grid">
          {tenant && plot ? <JourneyCard journey={journey} plotNumber={plot.number} /> : null}
          {requests.length > 0 || dues.next ? (
            <div className={styles.pair}>
              {requests.length > 0 ? (
                <div>
                  <Section title={t('requestsTitle')} action={{ label: active.length > REQUESTS_ON_HOME ? t('seeAllCount', { n: fmt.num(active.length) }) : t('seeAll'), to: '/requests' }}>
                    <List>
                      {requests.map((request) => (
                        <RequestRow key={request.id} request={request} now={now} />
                      ))}
                    </List>
                  </Section>
                </div>
              ) : null}
              {dues.next ? (
                <div>
                  <DuesCard dues={dues} now={now} onPay={dues.next.id === heroInvoice ? undefined : () => pay(dues.next)} />
                </div>
              ) : null}
            </div>
          ) : null}
          {tenant ? <Shortcuts /> : null}
        </Container>
      ) : null}

      {tenant ? null : (
        <>
          <HowTile />
          <SolutionsSection />
          <ZonesTile />
        </>
      )}

      {paying ? (
        <PaySheet open={payOpen} onClose={() => setPayOpen(false)} title={t('payTitle')} lines={payLines} amount={paying.amount} reference={receiptRefFor(paying.ref)} onPaid={onPaid} />
      ) : null}
    </Screen>
  );
}
