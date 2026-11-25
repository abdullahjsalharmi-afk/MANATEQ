import { useMemo, useState } from 'react';
import { SearchX } from 'lucide-react';
import { Button, Chip, ChipRow, Container, List, Screen, Section, Tile } from '@/design/core';
import { EmptyState, SearchField } from '@/design/forms';
import { useLang, useT } from '@/app/i18n';
import { useQuery } from '@/app/routes';
import { getService, zones } from '@/data/catalog';
import type { ServiceSummary, Zone } from '@/data/types';
import type { AppState } from '@/domain/types';
import { buildIndex } from '@/domain/search';
import { useNow } from '@/features/shared/useNow';
import { RequestRow } from '@/features/requests';
import { ServiceRow } from '@/features/services';
import { matchesReference, readRecent, serviceSearch, startTarget } from '@/features/services/catalogue';
import { ZoneRow } from '@/features/zones';
import { selectPersona, useApp } from '@/state';
import { resultsCount, strings } from './strings';
import styles from './SearchScreen.module.css';

/** The six things investors most often come to do. */
const INTENTS = ['intentPay', 'intentPass', 'intentMaintenance', 'intentCertificate', 'intentRenewal', 'intentPermit'] as const;

const SERVICE_LIMIT = 8;

const zoneIndex = buildIndex<Zone>(zones.map((zone) => ({ item: zone, fields: [zone.name, zone.typeLabel, zone.operator], keys: [zone.code] })));

const selectRequests = (state: AppState) => state.world.requests;

/** Global search: services, zones and, for a signed-in investor, their own requests. */
export function SearchScreen() {
  const t = useT(strings);
  const { fmt } = useLang();
  const params = useQuery();
  const persona = useApp(selectPersona);
  const requests = useApp(selectRequests);
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

  const shownServices = foundServices.slice(0, SERVICE_LIMIT);
  const total = foundRequests.length + shownServices.length + foundZones.length;

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
            {foundRequests.length ? (
              <Section title={t('requests')}>
                <List aria-label={t('requests')}>
                  {foundRequests.map((request) => (
                    <RequestRow key={request.id} request={request} now={now} />
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
