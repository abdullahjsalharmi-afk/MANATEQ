import { useMemo, useState } from 'react';
import { SearchX } from 'lucide-react';
import { Button, Chip, ChipRow, Container, List, Row, Screen, Section, Tile } from '@/design/core';
import { EmptyState, SearchField } from '@/design/forms';
import { useLang, useT } from '@/app/i18n';
import { useQuery } from '@/app/routes';
import { getService, getZone, zones } from '@/data/catalog';
import type { ServiceSummary, Zone } from '@/data/types';
import type { AppState, Doc, Invoice, Pass, Plot } from '@/domain/types';
import { buildIndex } from '@/domain/search';
import { useNow } from '@/features/shared/useNow';
import { InvoiceRow } from '@/features/payments';
import { RequestRow } from '@/features/requests';
import { ServiceRow } from '@/features/services';
import { matchesReference, readRecent, serviceSearch, startTarget } from '@/features/services/catalogue';
import { DocRow, PassRow } from '@/features/wallet';
import { ZoneRow } from '@/features/zones';
import { selectDocs, selectInvoices, selectPasses, selectPersona, selectPlots, useApp } from '@/state';
import { keywords, resultsCount, strings } from './strings';
import styles from './SearchScreen.module.css';

/** The six things investors most often come to do. */
const INTENTS = ['intentPay', 'intentPass', 'intentMaintenance', 'intentCertificate', 'intentRenewal', 'intentPermit'] as const;

const SERVICE_LIMIT = 8;

const zoneIndex = buildIndex<Zone>(zones.map((zone) => ({ item: zone, fields: [zone.name, zone.typeLabel, zone.operator], keys: [zone.code] })));

const selectRequests = (state: AppState) => state.world.requests;

const OWN_LIMIT = 4;

/** The investor's own records, searchable by their number, their title and the everyday word for them. */
function plotIndex(plots: Plot[]) {
  return buildIndex<Plot>(plots.map((plot) => ({ item: plot, fields: [plot.number, getZone(plot.zoneCode)?.name, keywords.plot], keys: [plot.number.toLowerCase(), plot.id.toLowerCase()] })));
}

function invoiceIndex(invoices: Invoice[]) {
  return buildIndex<Invoice>(
    invoices.map((invoice) => ({
      item: invoice,
      fields: [invoice.title, invoice.ref, keywords.invoice, invoice.status === 'paid' ? undefined : keywords.invoiceDue],
      keys: [invoice.ref.toLowerCase()],
    })),
  );
}

function docIndex(docs: Doc[]) {
  return buildIndex<Doc>(docs.map((doc) => ({ item: doc, fields: [doc.title, doc.ref, keywords.document], keys: [doc.ref.toLowerCase()] })));
}

function passIndex(passes: Pass[]) {
  return buildIndex<Pass>(passes.map((pass) => ({ item: pass, fields: [pass.holder, keywords[pass.kind], keywords.pass, pass.code], keys: [pass.code.toLowerCase()] })));
}

/** Keeps the order of `list` (the selectors put the due invoice and the active pass first). */
function inOrder<T>(list: T[], found: T[]): T[] {
  const hit = new Set(found);
  return list.filter((item) => hit.has(item)).slice(0, OWN_LIMIT);
}

/** Global search: services, zones and, for a signed-in investor, their own invoices, plots, requests, documents and passes. */
export function SearchScreen() {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const params = useQuery();
  const persona = useApp(selectPersona);
  const requests = useApp(selectRequests);
  const plots = useApp(selectPlots);
  const invoices = useApp(selectInvoices);
  const docs = useApp(selectDocs);
  const passes = useApp(selectPasses);
  const now = useNow();
  const [query, setQuery] = useState(params.q ?? '');
  const [recent] = useState(() => readRecent().map(getService).filter((s): s is ServiceSummary => s !== undefined));

  const trimmed = query.trim();
  const foundServices = useMemo(() => (trimmed ? serviceSearch().search(trimmed) : []), [trimmed]);
  const foundZones = useMemo(() => (trimmed ? zoneIndex.search(trimmed, 6) : []), [trimmed]);
  const foundRequests = useMemo(() => {
    if (!trimmed || persona === 'guest') return [];
    const ids = new Set(foundServices.slice(0, SERVICE_LIMIT).map((service) => service.id));
    return requests
      .filter((request) => matchesReference(request.ref, trimmed) || ids.has(request.serviceId))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6);
  }, [trimmed, persona, requests, foundServices]);

  const own = persona !== 'guest' && trimmed !== '';
  const plotsIdx = useMemo(() => plotIndex(plots), [plots]);
  const invoicesIdx = useMemo(() => invoiceIndex(invoices), [invoices]);
  const docsIdx = useMemo(() => docIndex(docs), [docs]);
  const passesIdx = useMemo(() => passIndex(passes), [passes]);
  const foundPlots = useMemo(() => (own ? inOrder(plots, plotsIdx.search(trimmed, plots.length)) : []), [own, plots, plotsIdx, trimmed]);
  const foundInvoices = useMemo(() => (own ? inOrder(invoices, invoicesIdx.search(trimmed, invoices.length)) : []), [own, invoices, invoicesIdx, trimmed]);
  const foundDocs = useMemo(() => (own ? inOrder(docs, docsIdx.search(trimmed, docs.length)) : []), [own, docs, docsIdx, trimmed]);
  const foundPasses = useMemo(() => (own ? inOrder(passes, passesIdx.search(trimmed, passes.length)) : []), [own, passes, passesIdx, trimmed]);

  const shownServices = foundServices.slice(0, SERVICE_LIMIT);
  const total = foundInvoices.length + foundPlots.length + foundRequests.length + foundDocs.length + foundPasses.length + shownServices.length + foundZones.length;

  return (
    <Screen title={t('title')} nav="back" backTo="/services" navLabel={t('back')} bleed>
      <Tile tone="light" className={styles.tile}>
        <div className={styles.field}>
          <SearchField value={query} onChange={setQuery} label={t('label')} autoFocus />
        </div>
        {trimmed ? null : (
          <div className={styles.try}>
            <p className={styles.tryLabel}>
              {t('tryLabel')}
            </p>
            <ChipRow label={t('tryLabel')} wrap className={styles.chips}>
              {INTENTS.map((key) => (
                <Chip key={key} onClick={() => setQuery(t(key))}>
                  {t(key)}
                </Chip>
              ))}
            </ChipRow>
          </div>
        )}
      </Tile>

      <div aria-live="polite" className="visually-hidden">
        {trimmed ? t('found', { q: trimmed, n: fmt.plural(total, resultsCount) }) : ''}
      </div>

      <Container width="content">
        {!trimmed ? (
          recent.length ? (
            <Section title={t('recent')}>
              <List aria-label={t('recent')}>
                {recent.map((service) => (
                  <ServiceRow key={service.id} service={service} />
                ))}
              </List>
            </Section>
          ) : null
        ) : total === 0 ? (
          <EmptyState icon={SearchX} title={t('noResults', { q: trimmed })} body={t('noResultsBody')} action={<Button to={startTarget('E1', persona)}>{t('getHelp')}</Button>} />
        ) : (
          <>
            {foundInvoices.length ? (
              <Section title={t('payments')}>
                <List aria-label={t('payments')}>
                  {foundInvoices.map((invoice) => (
                    <InvoiceRow key={invoice.id} invoice={invoice} now={now} />
                  ))}
                </List>
              </Section>
            ) : null}
            {foundPlots.length ? (
              <Section title={t('plots')}>
                <List aria-label={t('plots')}>
                  {foundPlots.map((plot) => {
                    const zone = getZone(plot.zoneCode);
                    return (
                      <Row
                        key={plot.id}
                        to={`/account/plots/${plot.id}`}
                        title={<span className="ltr">{fmt.ltr(plot.number)}</span>}
                        subtitle={zone ? t('plotLine', { zone: pick(zone.name), area: fmt.area(plot.areaSqm) }) : fmt.area(plot.areaSqm)}
                      />
                    );
                  })}
                </List>
              </Section>
            ) : null}
            {foundRequests.length ? (
              <Section title={t('requests')}>
                <List aria-label={t('requests')}>
                  {foundRequests.map((request) => (
                    <RequestRow key={request.id} request={request} now={now} />
                  ))}
                </List>
              </Section>
            ) : null}
            {foundDocs.length || foundPasses.length ? (
              <Section title={t('documents')}>
                <List aria-label={t('documents')}>
                  {foundDocs.map((doc) => (
                    <DocRow key={doc.id} doc={doc} />
                  ))}
                  {foundPasses.map((pass) => (
                    <PassRow key={pass.id} pass={pass} now={now} />
                  ))}
                </List>
              </Section>
            ) : null}
            {shownServices.length ? (
              <Section title={t('services')} action={foundServices.length > SERVICE_LIMIT ? { label: t('browse'), to: `/services?q=${encodeURIComponent(trimmed)}&view=all` } : undefined}>
                <List aria-label={t('services')}>
                  {shownServices.map((service) => (
                    <ServiceRow key={service.id} service={service} />
                  ))}
                </List>
              </Section>
            ) : null}
            {foundZones.length ? (
              <Section title={t('zones')}>
                <List aria-label={t('zones')}>
                  {foundZones.map((zone) => (
                    <ZoneRow key={zone.code} zone={zone} />
                  ))}
                </List>
              </Section>
            ) : null}
          </>
        )}
      </Container>
    </Screen>
  );
}
