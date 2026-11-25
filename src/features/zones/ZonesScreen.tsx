import { useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { useQuery } from '@/app/routes';
import { Button, Card, Chip, ChipRow, Container, EmptyState, List, QatarMap, Screen, Section, Segmented, Stat, Tile, cx } from '@/design/core';
import { getZone, zonesData } from '@/data/catalog';
import type { Zone } from '@/data/types';
import { FILTERS, isZoneFilter, takenPct, zonesFor, type ZoneFilter } from './model';
import { FinePrint, ShareBar, useAreaParts, usePrices } from './parts';
import { strings } from './strings';
import { ZoneRow } from './ZoneRow';
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

  const shown = zonesFor(filter);
  const chosen = selected ? shown.find((zone) => zone.code === selected) : undefined;

  const chooseFilter = (next: ZoneFilter) => {
    setFilter(next);
    // A selection the new filter hides is dropped, so the card never describes a faded marker.
    if (selected && !zonesFor(next).some((zone) => zone.code === selected)) setSelected(undefined);
  };

  const land = shown.filter((zone) => zone.kind === 'land');
  const parks = shown.filter((zone) => zone.kind === 'warehousing');

  return (
    <Screen title={t('zones')} large subtitle={t('zonesSubtitle')} bleed width="grid">
      <Container width="grid" pad="none" className={styles.top}>
        <Card className={styles.facts}>
          <div className={styles.stats}>
            <Stat value={fmt.num(totals.zones)} label={t('statZones')} />
            <Stat value={fmt.num(totals.totalSqm / 1_000_000, 1)} unit={t('millionSqm')} label={t('statArea')} />
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
            className={styles.segmented}
          />
          <Button variant="quiet" to="/solutions">
            {t('pricesLink')}
          </Button>
        </div>

        <ChipRow label={t('filter')} className={styles.chips}>
          {FILTERS.map((key) => (
            <Chip key={key} selected={filter === key} onClick={() => chooseFilter(key)}>
              {t(FILTER_LABEL[key])}
            </Chip>
          ))}
        </ChipRow>
      </Container>

      {view === 'map' ? (
        <Tile tone="light" className={styles.mapTile}>
          <div className={styles.mapLayout}>
            <QatarMap
              label={t('mapLabel')}
              selected={chosen?.code}
              onSelect={setSelected}
              highlight={filter === 'all' ? undefined : shown.map((zone) => zone.code)}
              height={480}
              className={styles.map}
            />
            <div className={styles.side} aria-live="polite">
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
      ) : (
        <Container width="content">
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
            <Section title={t('landZones')} hint={fmt.num(land.length)}>
              <List>
                {land.map((zone) => (
                  <ZoneRow key={zone.code} zone={zone} />
                ))}
              </List>
            </Section>
          ) : null}
          {parks.length > 0 ? (
            <Section title={t('parks')} hint={fmt.num(parks.length)}>
              <List>
                {parks.map((zone) => (
                  <ZoneRow key={zone.code} zone={zone} />
                ))}
              </List>
            </Section>
          ) : null}
        </Container>
      )}

      <Container width="grid" className={styles.notes}>
        <FinePrint>
          {t('schematic')} {t('source', { source: pick(zonesData.sources) })}
        </FinePrint>
      </Container>
    </Screen>
  );
}

/** The card under the map for the chosen zone: name, type, two facts, the published price and the way in. */
function ZoneCard({ zone }: { zone: Zone }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const prices = usePrices();
  const areaParts = useAreaParts();
  const area = areaParts(zone.totalSqm);
  const pct = takenPct(zone);

  return (
    <Card className={styles.zoneCard}>
      <p className={cx('type-callout', styles.muted)}>{pick(zone.typeLabel)}</p>
      <h2 className={cx('type-heading', styles.zoneName)}>{pick(zone.name)}</h2>
      <div className={styles.pair}>
        <Stat value={area.value} unit={area.unit} label={t('area')} />
        {pct !== null ? (
          <div>
            <Stat value={fmt.pct(pct)} label={zone.kind === 'land' ? t('allocated') : t('occupancy')} />
            <ShareBar pct={pct} />
          </div>
        ) : null}
      </div>
      <div className={styles.priceLine}>
        <span className={cx('type-callout', styles.muted)}>{t('price')}</span>
        <strong className="type-body num">{prices.zone(zone)}</strong>
      </div>
      <Button to={`/zones/${zone.code}`} className={styles.open}>
        {t('openZone')}
      </Button>
    </Card>
  );
}
