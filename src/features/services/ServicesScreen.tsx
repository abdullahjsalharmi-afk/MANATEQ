import { useMemo, useState } from 'react';
import { SearchX } from 'lucide-react';
import { Button, Chip, ChipRow, Container, Grid, List, Render, Screen, Section, Segmented, Tile } from '@/design/core';
import { EmptyState, SearchField } from '@/design/forms';
import { useLang, useT } from '@/app/i18n';
import { useQuery } from '@/app/routes';
import { services } from '@/data/catalog';
import { selectPersona, selectStation, useApp } from '@/state';
import { filterServices, groupServices, serviceSearch, startTarget, type ServiceFilter, type ServiceGroup } from './catalogue';
import { ServiceCard } from './ServiceCard';
import { ServiceRow } from './ServiceRow';
import { servicesCount, strings } from './strings';
import styles from './ServicesScreen.module.css';

type View = 'journey' | 'all';

/** The catalogue: the fifty services by journey station (the investor's own first), or as one filtered list. */
export function ServicesScreen() {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const station = useApp(selectStation);
  const persona = useApp(selectPersona);
  const params = useQuery();
  const [query, setQuery] = useState(params.q ?? '');
  const [view, setView] = useState<View>(params.view === 'all' ? 'all' : 'journey');
  const [filter, setFilter] = useState<ServiceFilter>('all');

  const trimmed = query.trim();
  const matched = useMemo(() => (trimmed ? serviceSearch().search(trimmed) : services), [trimmed]);
  const groups = useMemo(() => groupServices(station, matched), [station, matched]);
  const listed = useMemo(() => filterServices(matched, filter), [matched, filter]);
  const counts = useMemo(
    () => ({ all: matched.length, startable: filterServices(matched, 'startable').length, automatic: filterServices(matched, 'automatic').length }),
    [matched],
  );

  const count = (n: number) => fmt.plural(n, servicesCount);
  const hint = (group: ServiceGroup) => t('groupHint', { tagline: pick(group.domain.tagline), count: count(group.services.length) });

  const nothing = trimmed !== '' && matched.length === 0;

  return (
    <Screen title={t('title')} subtitle={t('subtitle')} large bleed>
      <Container pad="none" className={styles.controls}>
        <SearchField value={query} onChange={setQuery} label={t('searchLabel')} />
        <Segmented
          label={t('viewLabel')}
          value={view}
          onChange={setView}
          options={[
            { value: 'journey', label: t('viewJourney') },
            { value: 'all', label: t('viewAll') },
          ]}
        />
      </Container>

      <div aria-live="polite" className="visually-hidden">
        {trimmed ? `${t('results')}: ${count(matched.length)}` : ''}
      </div>

      {nothing ? (
        <Container>
          <EmptyState
            icon={SearchX}
            title={t('noResults', { q: trimmed })}
            body={t('noResultsBody')}
            action={<Button to={startTarget('E1', persona)}>{t('getHelp')}</Button>}
          />
        </Container>
      ) : view === 'journey' ? (
        <JourneyView groups={groups} station={station} showRender={!trimmed} hint={hint} />
      ) : (
        <Container>
          <ChipRow label={t('filterLabel')} className={styles.filters}>
            {(['all', 'startable', 'automatic'] as const).map((key) => (
              <Chip key={key} selected={filter === key} onClick={() => setFilter(key)}>
                {t(key === 'all' ? 'filterAll' : key === 'startable' ? 'filterStartable' : 'filterAutomatic')}
                <span className={styles.chipCount}> {fmt.num(counts[key])}</span>
              </Chip>
            ))}
          </ChipRow>
          <p className={styles.count} aria-live="polite">
            {count(listed.length)}
          </p>
          {listed.length ? (
            <List aria-label={t('title')}>
              {listed.map((service) => (
                <ServiceRow key={service.id} service={service} />
              ))}
            </List>
          ) : (
            <EmptyState compact icon={SearchX} title={t('noneInFilter')} body={t('noneInFilterBody')} action={<Button variant="secondary" onClick={() => setFilter('all')}>{t('showAll')}</Button>} />
          )}
        </Container>
      )}
    </Screen>
  );
}

interface JourneyViewProps {
  groups: ServiceGroup[];
  station: string;
  showRender: boolean;
  hint: (group: ServiceGroup) => string;
}

/** «رحلتي»: the current station on a white tile with its render, then every other group on the page. */
function JourneyView({ groups, station, showRender, hint }: JourneyViewProps) {
  const t = useT(strings);
  const { pick } = useLang();
  const [first, ...rest] = groups;
  const current = first && first.station === station ? first : undefined;
  const others = current ? rest : groups;

  return (
    <>
      {current ? (
        <Tile
          tone="light"
          eyebrow={t('stationEyebrow', { n: current.stationNumber ?? 1 })}
          headline={pick(current.name)}
          tagline={pick(current.domain.tagline)}
          media={showRender ? <Render name={current.render} eager decorative /> : undefined}
          mediaWidth="small"
        >
          <Grid as="ul" columns={3} className={styles.tileGrid} aria-label={pick(current.name)}>
            {current.services.map((service) => (
              <ServiceCard key={service.id} service={service} tone="parchment" />
            ))}
          </Grid>
        </Tile>
      ) : null}
      <Container>
        {others.map((group) => (
          <Section key={group.domain.code} title={group.stationNumber ? `${group.stationNumber} · ${pick(group.name)}` : pick(group.name)} hint={hint(group)}>
            <Grid as="ul" columns={3} aria-label={pick(group.name)}>
              {group.services.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </Grid>
          </Section>
        ))}
      </Container>
    </>
  );
}
