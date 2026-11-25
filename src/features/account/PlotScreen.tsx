import { CalendarClock, FileText, MapPin, Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useParams } from '@/app/routes';
import { Button, Card, Container, Icon, List, Pill, Render, Row, Screen, Section, Tile } from '@/design/core';
import { EmptyState } from '@/design/forms';
import { JourneyRibbon } from '@/design/signature';
import { getService, getSolution, getZone } from '@/data/catalog';
import type { Lease, Plot } from '@/domain/types';
import { StationSheet } from '@/features/home';
import { InvoiceRow } from '@/features/payments';
import { RequestRow } from '@/features/requests';
import { DocRow } from '@/features/wallet';
import { useNow } from '@/features/shared/useNow';
import {
  selectDocsOfPlot,
  selectInvoices,
  selectJourneyOfPlot,
  selectLeaseOfPlot,
  selectPlot,
  selectRequestsOfPlot,
  useApp,
  type StationKey,
} from '@/state';
import { invoicesOfLease, leaseEndingSoon, openRenewal, plotRender, plotServiceIds, plotStatusMeta, startRoute } from './account-model';
import styles from './PlotScreen.module.css';
import { strings } from './strings';

/** One plot: where it stands, its lease, its invoices, requests and documents, and what to do next for it. */
export function PlotScreen() {
  const t = useT(strings);
  const { id = '' } = useParams<{ id: string }>();
  const plot = useApp(selectPlot(id));

  if (!plot) {
    return (
      <Screen title={t('plotNotFoundName')} nav="back" backTo="/account/plots">
        <EmptyState
          icon={MapPin}
          title={t('plotNotFoundTitle')}
          body={t('plotNotFoundBody')}
          action={<Button to="/account/plots">{t('toPlots')}</Button>}
        />
      </Screen>
    );
  }
  return <PlotPage plot={plot} />;
}

function PlotPage({ plot }: { plot: Plot }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const now = useNow(30_000);
  const lease = useApp(selectLeaseOfPlot(plot.id));
  const journey = useApp(selectJourneyOfPlot(plot.id));
  const requests = useApp(selectRequestsOfPlot(plot.id));
  const docs = useApp(selectDocsOfPlot(plot.id));
  const allInvoices = useApp(selectInvoices);
  const invoices = useMemo(() => invoicesOfLease(allInvoices, lease?.id), [allInvoices, lease?.id]);
  const zone = getZone(plot.zoneCode);
  const meta = plotStatusMeta(plot.status);
  const station = journey.stations.find((candidate) => candidate.key === journey.station);
  // A station opens its checklist for this plot, as it does on Home for the plot furthest behind.
  const [stationOpen, setStationOpen] = useState<StationKey | null>(null);
  const title = t('plotLabel', { number: plot.number });

  return (
    <Screen title={title} nav="back" backTo="/account/plots" bleed>
      <Tile
        tone="light"
        headline={<span className="ltr">{plot.number}</span>}
        tagline={zone ? t('inZone', { zone: pick(zone.name) }) : undefined}
        actions={
          zone ? (
            <Button variant="quiet" to={`/zones/${zone.code}`}>
              {t('openZone')}
            </Button>
          ) : undefined
        }
        media={<Render name={plotRender(plot)} eager decorative />}
        mediaWidth="small"
      >
        <Pill tone={meta.tone} icon={meta.icon}>
          {t(meta.key)}
        </Pill>
      </Tile>

      <Container width="content">
        <Card className={styles.journey}>
          <JourneyRibbon
            label={t('journeyLabel')}
            stations={journey.stations.map((s) => ({ key: s.key, label: pick(s.name), state: s.state }))}
            caption={station ? t('journeyCaption', { station: pick(station.name) }) : undefined}
            onSelect={(key) => setStationOpen(key as StationKey)}
          />
        </Card>
        <StationSheet journey={journey} plotNumber={plot.number} open={stationOpen} onChange={setStationOpen} />

        <div className={styles.columns}>
          <div className={styles.column}>
            <Facts plot={plot} lease={lease} now={now} />
            <PlotServices plot={plot} lease={lease} now={now} />
          </div>
          <div className={styles.column}>
            <Section title={t('invoices')} action={{ label: t('allPayments'), to: '/account/payments' }}>
              {invoices.length > 0 ? (
                <List aria-label={t('invoices')}>
                  {invoices.map((invoice) => (
                    <InvoiceRow key={invoice.id} invoice={invoice} now={now} />
                  ))}
                </List>
              ) : (
                <Quiet icon={Receipt} text={t('noInvoices')} />
              )}
            </Section>
            <Section title={t('requests')}>
              {requests.length > 0 ? (
                <List aria-label={t('requests')}>
                  {requests.slice(0, 5).map((request) => (
                    <RequestRow key={request.id} request={request} now={now} />
                  ))}
                </List>
              ) : (
                <Quiet icon={CalendarClock} text={t('noRequests')} />
              )}
            </Section>
            <Section title={t('docs')} action={docs.length > 0 ? { label: t('allDocs'), to: '/account/wallet' } : undefined}>
              {docs.length > 0 ? (
                <List aria-label={t('docs')}>
                  {docs.slice(0, 4).map((doc) => (
                    <DocRow key={doc.id} doc={doc} />
                  ))}
                </List>
              ) : (
                <Quiet icon={FileText} text={t('noDocs')} />
              )}
            </Section>
          </div>
        </div>
      </Container>
    </Screen>
  );
}

function Facts({ plot: p, lease: l, now: n }: { plot: Plot; lease: Lease | undefined; now: number }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const solution = getSolution(p.solution);
  return (
    <Section title={t('facts')}>
      <List aria-label={t('facts')}>
        <Row fact title={t('area')} trailing={fmt.area(p.areaSqm)} />
        <Row fact title={t('solution')} trailing={pick(solution?.name)} />
        {l ? (
          <>
            <Row fact title={t('rate')} trailing={t('ratePerSqm', { amount: fmt.money(l.ratePerSqmYear) })} />
            <Row fact title={t('annualRent')} trailing={fmt.money(l.annualRent)} />
            <Row fact title={t('leaseRef')} trailing={<span className="ltr">{l.ref}</span>} />
            <Row fact title={t('leaseStart')} trailing={fmt.date(l.startsAt)} />
            <Row fact title={t('leaseEnd')} subtitle={l.endsAt > n ? t('endsIn', { when: fmt.relative(l.endsAt, n) }) : t('ended')} trailing={fmt.date(l.endsAt)} />
          </>
        ) : (
          <Row title={t('noLease')} />
        )}
      </List>
    </Section>
  );
}

function PlotServices({ plot, lease, now }: { plot: Plot; lease: Lease | undefined; now: number }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const requests = useApp(selectRequestsOfPlot(plot.id));
  const renewal = openRenewal(requests, plot.id);
  const ending = leaseEndingSoon(lease, now);
  const services = plotServiceIds(plot)
    .map((serviceId) => getService(serviceId))
    .filter((service) => service !== undefined);
  if (services.length === 0 && !ending) return null;
  return (
    <Section title={t('plotServices')}>
      <List aria-label={t('plotServices')}>
        {ending && lease ? (
          <Row
            title={renewal ? t('renewalOpen') : pick(getService('B3')?.label)}
            subtitle={t('renewalHint', { when: fmt.relative(lease.endsAt, now) })}
            to={renewal ? `/requests/${renewal.id}` : '/services/B3'}
          />
        ) : null}
        {services.map((service) => (
          <Row key={service.id} title={pick(service.label)} subtitle={pick(service.summary)} to={startRoute(service.id, plot.id)} wrap />
        ))}
      </List>
    </Section>
  );
}

function Quiet({ icon, text }: { icon: typeof Receipt; text: string }) {
  return (
    <Card tone="sunken" pad="sm" className={styles.quiet}>
      <Icon icon={icon} size={20} />
      <p className="type-callout">{text}</p>
    </Card>
  );
}
