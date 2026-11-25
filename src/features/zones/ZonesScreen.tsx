import { useEffect, useRef, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useQuery } from '@/app/routes';
import { Button, Card, Chip, ChipRow, Container, EmptyState, Grid, QatarMap, Screen, Section, Segmented, Stat, Tile, cx } from '@/design/core';
import { getZone, zonesData } from '@/data/catalog';
import type { Zone } from '@/data/types';
import { FILTERS, isZoneFilter, takenPct, zonesFor, type ZoneFilter } from './model';
import { FinePrint, ShareBar, usePrices, useZoneFacts } from './parts';
import { strings } from './strings';
import { ZoneTile } from './ZoneTile';
import styles from './Zones.module.css';

type View = 'map' | 'list';

const FILTER_LABEL = {
  all: 'filterAll',
  logistics: 'filter_logistics',
  industrial: 'filter_industrial',
  commercial: 'filter_commercial',
  openYard: 'filter_openYard',
  warehousing: 'filter_warehousing',
} as const satisfies Record<ZoneFilter, keyof typeof strings>;

/** The zones explorer: the headline facts, a map or a list of the 13 zones, filtered by solution. */
export function ZonesScreen() {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const query = useQuery();
  const [view, setView] = useState<View>(query.view === 'list' ? 'list' : 'map');
  const [filter, setFilter] = useState<ZoneFilter>(isZoneFilter(query.solution) ? query.solution : 'all');
  const [selected, setSelected] = useState<string | undefined>(query.zone && getZone(query.zone) ? query.zone : undefined);
  const { totals } = zonesData;
  const sideRef = useRef<HTMLDivElement>(null);
  // Set when the investor taps a marker, so the card it opens is brought into view (it sits under the map on phones).
  const revealRef = useRef(false);

  const shown = zonesFor(filter);
  const chosen = selected ? shown.find((zone) => zone.code === selected) : undefined;

  const chooseFilter = (next: ZoneFilter) => {
    setFilter(next);
    // A selection the new filter hides is dropped, so the card never describes a faded marker.
    if (selected && !zonesFor(next).some((zone) => zone.code === selected)) setSelected(undefined);
  };

  const choose = (code: string) => {
    revealRef.current = true;
    setSelected(code);
  };

  useEffect(() => {
    if (!revealRef.current || !chosen) return;
    revealRef.current = false;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    sideRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }, [chosen]);

  const land = shown.filter((zone) => zone.kind === 'land');
  const parks = shown.filter((zone) => zone.kind === 'warehousing');

  return (
    <Screen title={t('zones')} large subtitle={t('zonesSubtitle')} bleed width="grid">
      <Container width="grid" pad="none" className={styles.top}>
        <Card className={styles.facts}>
          <div className={styles.stats}>
            <Stat value={fmt.num(totals.zones)} label={t('statZones')} />
            <Stat value={fmt.num(totals.totalSqm / 1_000_000, 1)} label={t('statArea')} />
            <Stat value={fmt.pct(totals.operationalRatePct)} label={t('statRate')} />
          </div>
        </Card>

        <div className={styles.controls}>
          <Segmented
            label={t('view')}
            value={view}
            onChange={setView}
            options={[
              { value: 'map', label: t('viewMap') },
              { value: 'list', label: t('viewList') },
            ]}
          />
        </div>

        <ChipRow label={t('filter')} className={styles.chips}>
          {FILTERS.map((key) => (
            <Chip key={key} selected={filter === key} onClick={() => chooseFilter(key)}>
              {t(FILTER_LABEL[key])}
            </Chip>
          ))}
        </ChipRow>

        <Button variant="quiet" to="/solutions" className={styles.pricesLink}>
          {t('pricesLink')}
        </Button>
      </Container>

      {view === 'map' ? (
        <Tile tone="light" className={styles.mapTile}>
          <div className={styles.mapLayout}>
            <QatarMap label={t('mapLabel')} selected={chosen?.code} onSelect={choose} highlight={filter === 'all' ? undefined : shown.map((zone) => zone.code)} height={480} className={styles.map} />
            <div ref={sideRef} className={styles.side} aria-live="polite">
              {chosen ? (
                <ZoneCard zone={chosen} />
              ) : (
                <Card tone="parchment" className={styles.hint}>
                  <p className="type-body">{t('mapHint')}</p>
                  {filter !== 'all' ? <p className={cx('type-callout', styles.muted)}>{t('mapMatching', { n: fmt.num(shown.length) })}</p> : null}
                </Card>
              )}
            </div>
          </div>
        </Tile>
      ) : null}

      <Container width="grid">
        {shown.length === 0 ? (
          <EmptyState
            title={t('noneTitle')}
            body={t('noneBody')}
            render="zone"
            action={
              <Button variant="secondary" onClick={() => chooseFilter('all')}>
                {t('showAll')}
              </Button>
            }
          />
        ) : null}
        {land.length > 0 ? (
          <Section title={t('sectionCount', { title: t('landZones'), n: fmt.num(land.length) })}>
            <Grid as="ul">
              {land.map((zone) => (
                <ZoneTile key={zone.code} zone={zone} />
              ))}
            </Grid>
          </Section>
        ) : null}
        {parks.length > 0 ? (
          <Section title={t('sectionCount', { title: t('parks'), n: fmt.num(parks.length) })}>
            <Grid as="ul">
              {parks.map((zone) => (
                <ZoneTile key={zone.code} zone={zone} />
              ))}
            </Grid>
          </Section>
        ) : null}
      </Container>

      <Container width="grid" className={styles.notes}>
        <FinePrint>
          {t('schematic')} {t('source', { source: pick(zonesData.sources) })}
        </FinePrint>
      </Container>
    </Screen>
  );
}

/** The card the map opens for the chosen zone: name, its facts (type, area, share taken), the published price and the way in. Compact, so it fits under the map on a phone. */
function ZoneCard({ zone }: { zone: Zone }) {
  const t = useT(strings);
  const { pick } = useLang();
  const prices = usePrices();
  const facts = useZoneFacts();
  const pct = takenPct(zone);

  return (
    <Card className={styles.zoneCard}>
      <h2 className={cx('type-heading', styles.zoneName)}>{pick(zone.name)}</h2>
      <p className={cx('type-callout num', styles.muted)}>{facts(zone)}</p>
      {pct !== null ? <ShareBar pct={pct} /> : null}
      <div className={styles.priceLine}>
        <span className={cx('type-callout', styles.muted)}>{t('price')}</span>
        <strong className="type-body num">{prices.zone(zone)}</strong>
      </div>
      <Button to={`/zones/${zone.code}`} size="sm" className={styles.open}>
        {t('openZone')}
      </Button>
    </Card>
  );
}
