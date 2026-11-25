import { useMemo, useState } from 'react';
import { ChevronDown, SearchX } from 'lucide-react';
import { Button, Card, Chip, ChipRow, Container, Grid, Icon, List, Render, Screen, Section, Segmented, Tile } from '@/design/core';
import { EmptyState, SearchField } from '@/design/forms';
import { useLang, useT } from '@/app/i18n';
import { buildTarget, navigate } from '@/app/router';
import { useQuery } from '@/app/routes';
import { services } from '@/data/catalog';
import { selectPersona, selectStation, useApp } from '@/state';
import { filterServices, groupServices, serviceSearch, startTarget, type ServiceFilter, type ServiceGroup } from './catalogue';
import { ServiceCard } from './ServiceCard';
import { ServiceRow } from './ServiceRow';
import { servicesCount, strings } from './strings';
import styles from './ServicesScreen.module.css';

type View = 'journey' | 'all';

const FILTERS: readonly ServiceFilter[] = ['all', 'startable', 'automatic'];

/** The groups the investor opened under «رحلتي», kept while the app is open so «رجوع» finds them as they were. */
let openedGroups: readonly string[] = [];

/** The catalogue's address: the view, the filter and the search live in the link, so going back restores them. */
function catalogueTarget(view: View, filter: ServiceFilter, query: string): string {
  return buildTarget('/services', { view: view === 'all' ? 'all' : undefined, filter: filter === 'all' ? undefined : filter, q: query.trim() || undefined });
}

/** The catalogue: the fifty services by journey station (the investor's own first), or as one filtered list. */
export function ServicesScreen() {
  const t = useT(strings);
  const { fmt } = useLang();
  const station = useApp(selectStation);
  const persona = useApp(selectPersona);
  const params = useQuery();
  const [query, setQueryState] = useState(params.q ?? '');
  const [view, setViewState] = useState<View>(params.view === 'all' ? 'all' : 'journey');
  const [filter, setFilterState] = useState<ServiceFilter>(() => FILTERS.find((key) => key === params.filter) ?? 'all');

  // Each change replaces the address in place (no new history entry), so the screen comes back as it was left.
  const setQuery = (next: string) => {
    setQueryState(next);
    navigate(catalogueTarget(view, filter, next), { replace: true });
  };
  const setView = (next: View) => {
    setViewState(next);
    navigate(catalogueTarget(next, filter, query), { replace: true });
  };
  const setFilter = (next: ServiceFilter) => {
    setFilterState(next);
    navigate(catalogueTarget(view, next, query), { replace: true });
  };

  const trimmed = query.trim();
  const matched = useMemo(() => (trimmed ? serviceSearch().search(trimmed) : services), [trimmed]);
  const groups = useMemo(() => groupServices(station, matched), [station, matched]);
  const listed = useMemo(() => filterServices(matched, filter), [matched, filter]);
  const counts = useMemo(
    () => ({ all: matched.length, startable: filterServices(matched, 'startable').length, automatic: filterServices(matched, 'automatic').length }),
    [matched],
  );

  const count = (n: number) => fmt.plural(n, servicesCount);
  const hint = (group: ServiceGroup) => count(group.services.length);

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
        <JourneyView groups={groups} station={station} showRender={!trimmed} searching={trimmed !== ''} hint={hint} />
      ) : (
        <Container pad="none" className={styles.all}>
          <ChipRow label={t('filterLabel')} className={styles.filters}>
            {FILTERS.map((key) => (
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
  /** A search is on: every group that has a match is open. */
  searching: boolean;
  hint: (group: ServiceGroup) => string;
}

/**
 * «رحلتي»: the current station on a white tile with its render and its cards; every other station and domain
 * is one quiet row in a card that opens in place to its services.
 */
function JourneyView({ groups, station, showRender, searching, hint }: JourneyViewProps) {
  const t = useT(strings);
  const { pick } = useLang();
  const [opened, setOpened] = useState<readonly string[]>(openedGroups);
  const [first, ...rest] = groups;
  const current = first && first.station === station ? first : undefined;
  const others = current ? rest : groups;

  const toggle = (code: string, open: boolean) => {
    setOpened((list) => {
      const next = open ? (list.includes(code) ? list : [...list, code]) : list.filter((other) => other !== code);
      openedGroups = next;
      return next;
    });
  };

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
      {others.length ? (
        <Container>
          <Section title={current ? t('otherGroups') : t('allGroups')}>
            <Card pad="none" className={styles.groups}>
              {others.map((group) => {
                const name = group.stationNumber ? `${group.stationNumber} · ${pick(group.name)}` : pick(group.name);
                return (
                  <details
                    key={group.domain.code}
                    className={styles.group}
                    open={searching || opened.includes(group.domain.code)}
                    onToggle={(event) => {
                      if (!searching) toggle(group.domain.code, event.currentTarget.open);
                    }}
                  >
                    <summary className={styles.groupHead}>
                      <span className={styles.groupText}>
                        <span className={styles.groupName}>{name}</span>
                        <span className={styles.groupHint}>{hint(group)}</span>
                      </span>
                      <Icon icon={ChevronDown} size={16} strokeWidth={2} className={styles.groupChevron} />
                    </summary>
                    <List variant="plain" aria-label={pick(group.name)} className={styles.groupList}>
                      {group.services.map((service) => (
                        <ServiceRow key={service.id} service={service} />
                      ))}
                    </List>
                  </details>
                );
              })}
            </Card>
          </Section>
        </Container>
      ) : null}
    </>
  );
}
