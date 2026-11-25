import { useMemo, useState } from 'react';
import { Bell, BellRing, Check } from 'lucide-react';
import { useLang, useT } from '@/app/i18n';
import { useParams } from '@/app/routes';
import { Button, Card, Container, EmptyState, Grid, Icon, PlotGrid, Render, Screen, Section, Stat, Tile, cx, toast } from '@/design/core';
import { getSolution, getZone, zonesData } from '@/data/catalog';
import type { Zone } from '@/data/types';
import { plotsFor, type PlotCell } from '@/domain/plots';
import type { AppState } from '@/domain/types';
import { selectPersona, selectPlots, toggleWatchZone, useApp } from '@/state';
import { allocatedPct, applyTarget, solutionsOf } from './model';
import { FinePrint, SOLUTION_RENDER, ShareBar, useAreaParts, usePrices, zoneRender } from './parts';
import { strings } from './strings';
import styles from './Zone.module.css';

const FACILITY_LABEL = {
  road: 'fac_road',
  handover: 'fac_handover',
  bsc: 'fac_bsc',
  portal: 'fac_portal',
  utilities: 'fac_utilities',
  telecom: 'fac_telecom',
  security: 'fac_security',
  accommodation: 'fac_accommodation',
  showroom: 'fac_showroom',
  offices: 'fac_offices',
  lease25: 'fac_lease25',
} as const satisfies Record<string, keyof typeof strings>;

const isFacility = (key: string): key is keyof typeof FACILITY_LABEL => key in FACILITY_LABEL;

const selectWatched = (state: AppState) => state.world.watchedZones;

/** The zone page: a product page for one zone or warehousing park. */
export function ZoneScreen() {
  const { code = '' } = useParams<{ code: string }>();
  const zone = getZone(code.toUpperCase());
  return zone ? <ZonePage zone={zone} /> : <ZoneNotFound />;
}

function ZoneNotFound() {
  const t = useT(strings);
  return (
    <Screen title={t('zone')} nav="back" backTo="/zones">
      <EmptyState
        level={2}
        title={t('notFoundTitle')}
        body={t('notFoundBody')}
        render="zone"
        action={<Button to="/zones">{t('backToZones')}</Button>}
      />
    </Screen>
  );
}

function ZonePage({ zone }: { zone: Zone }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const prices = usePrices();
  const areaParts = useAreaParts();
  const persona = useApp(selectPersona);
  const watched = useApp(selectWatched).includes(zone.code);
  const land = zone.kind === 'land';
  const name = pick(zone.name);

  const toggleWatch = () => {
    if (persona === 'guest') {
      toast(t('applyGuest'), { tone: 'info' });
      return;
    }
    toggleWatchZone(zone.code);
    toast(watched ? t('watchOff', { zone: name }) : t('watchOn', { zone: name }));
  };

  const scrollToPlots = () => document.getElementById('plots')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

  const area = areaParts(zone.totalSqm);
  const pct = land ? allocatedPct(zone) : (zone.occupancyPct ?? null);
  const priceText = prices.zone(zone);
  const extra = zone.extra;
  const distances = extra?.distancesKm;
  const facilities = (extra?.utilities ?? []).filter(isFacility);
  const sectors = extra?.sectors ?? [];
  const hasDistances = distances !== undefined && Object.keys(distances).length > 0;
  const extraCards = [facilities.length > 0, sectors.length > 0, hasDistances].filter(Boolean).length;
  const hasExtra = extraCards > 0;

  return (
    <Screen
      title={name}
      nav="back"
      backTo="/zones"
      bleed
      width="grid"
      footerContext={
        <>
          {t('price')} <strong className="num">{priceText}</strong>
        </>
      }
      footer={
        land ? (
          <Button block to={`/eligibility?zone=${zone.code}`}>
            {t('checkEligibility')}
          </Button>
        ) : (
          <Button block to={`/start/F1?zone=${zone.code}`}>
            {t('referral')}
          </Button>
        )
      }
    >
      <Tile
        tone="dark"
        size="hero"
        eyebrow={pick(zone.typeLabel)}
        headline={name}
        tagline={<span className="num">{land ? priceText : t('pricesByOperator')}</span>}
        actions={
          <>
            {land ? (
              <Button variant="secondary" onClick={scrollToPlots}>
                {t('seePlots')}
              </Button>
            ) : null}
            <Button variant="secondary" icon={watched ? BellRing : Bell} aria-pressed={watched} onClick={toggleWatch}>
              {watched ? t('watching') : t('watch')}
            </Button>
          </>
        }
        media={<Render name={zoneRender(zone)} eager decorative />}
      />

      <Container width="grid">
        <Grid columns={3} className={styles.facts}>
          <Card>
            <Stat size="lg" value={area.value} unit={area.unit} label={t('totalArea')} />
          </Card>
          {pct !== null ? (
            <Card>
              <Stat
                size="lg"
                value={fmt.pct(pct)}
                label={land ? t('allocated') : t('occupancy')}
                hint={land && zone.allocatedSqm !== undefined ? t('allocatedOf', { part: fmt.areaShort(zone.allocatedSqm), whole: fmt.areaShort(zone.totalSqm) }) : undefined}
              />
              <ShareBar pct={pct} />
            </Card>
          ) : null}
          {land && zone.units !== undefined ? (
            <Card>
              <Stat size="lg" value={fmt.num(zone.units)} label={t('units')} />
            </Card>
          ) : null}
          {!land && zone.operator ? (
            <Card>
              <Stat value={pick(zone.operator)} label={t('operator')} hint={t('operatorHint')} />
            </Card>
          ) : null}
        </Grid>

        <Section title={t('solutionsHere')} action={{ label: t('allSolutions'), to: '/solutions' }}>
          <Grid columns={solutionsOf(zone).length > 1 ? 2 : 3} as="ul">
            {solutionsOf(zone).map((solution) => (
              <Card as="li" key={solution.key} media={<Render name={SOLUTION_RENDER[solution.key]} decorative />} className={styles.solution}>
                <h3 className="type-body">
                  <strong>{pick(solution.name)}</strong>
                </h3>
                <p className={cx('type-title num', styles.price)}>
                  <strong>{prices.solution(solution)}</strong>
                </p>
                <p className={cx('type-callout', styles.muted)}>{pick(solution.term)}</p>
                {!land && zone.operator ? <p className="type-callout">{t('operatorNote', { operator: pick(zone.operator) })}</p> : null}
              </Card>
            ))}
          </Grid>
        </Section>

        {hasExtra ? (
          <Section title={t('available')} hint={t('illustrative')}>
            <Grid columns={3} className={cx(extraCards === 1 && styles.single)}>
              {facilities.length > 0 ? (
                <Card>
                  <h3 className={cx('type-body', styles.cardHead)}>
                    <strong>{t('facilities')}</strong>
                  </h3>
                  <ul className={styles.checks}>
                    {facilities.map((key) => (
                      <li key={key} className={cx('type-callout', styles.check)}>
                        <Icon icon={Check} size={16} />
                        {t(FACILITY_LABEL[key])}
                      </li>
                    ))}
                  </ul>
                </Card>
              ) : null}
              {sectors.length > 0 ? (
                <Card>
                  <h3 className={cx('type-body', styles.cardHead)}>
                    <strong>{t('sectors')}</strong>
                  </h3>
                  <p className="type-body">{sectors.map((sector) => pick(sector)).join(' · ')}</p>
                </Card>
              ) : null}
              {distances && hasDistances ? (
                <Card>
                  <h3 className={cx('type-body', styles.cardHead)}>
                    <strong>{t('distances')}</strong>
                  </h3>
                  <div className={styles.distances}>
                    {distances.airport !== undefined ? <Stat value={fmt.num(distances.airport)} unit={t('km')} label={t('toAirport')} /> : null}
                    {distances.port !== undefined ? <Stat value={fmt.num(distances.port)} unit={t('km')} label={t('toPort')} /> : null}
                    {distances.doha !== undefined ? <Stat value={fmt.num(distances.doha)} unit={t('km')} label={t('toDoha')} /> : null}
                    {distances.landBorder !== undefined ? <Stat value={fmt.num(distances.landBorder)} unit={t('km')} label={t('toBorder')} /> : null}
                  </div>
                </Card>
              ) : null}
            </Grid>
          </Section>
        ) : null}

        {land ? <PlotsSection zone={zone} guest={persona === 'guest'} /> : null}

        <div className={styles.notes}>
          <FinePrint>{t('source', { source: pick(zonesData.sources) })}</FinePrint>
        </div>
      </Container>
    </Screen>
  );
}

/** The illustrative plot layout of a land zone, with the investor's own plots marked. */
function PlotsSection({ zone, guest }: { zone: Zone; guest: boolean }) {
  const t = useT(strings);
  const { lang, pick, fmt } = useLang();
  const plots = useApp(selectPlots);
  const cells = useMemo(() => plotsFor(zone.code), [zone.code]);
  const own = useMemo(() => plots.filter((plot) => plot.zoneCode === zone.code).map((plot) => plot.id), [plots, zone.code]);
  const [chosen, setChosen] = useState<PlotCell | undefined>(undefined);
  const solution = zone.solutions[0] ? getSolution(zone.solutions[0]) : undefined;

  return (
    <div id="plots" className={styles.plotsSection}>
      <Section title={t('plots')} hint={t('illustrative')}>
        <div className={styles.plots}>
          <Card>
            <PlotGrid plots={cells} selected={chosen?.id} onSelect={setChosen} own={own} label={t('plotsLabel', { zone: pick(zone.name) })} />
          </Card>
          <Card tone={chosen ? 'plain' : 'parchment'} className={cx(styles.plotCard, !chosen && own.length === 0 && styles.wideOnly)}>
            {chosen ? (
              <>
                <p className={cx('type-callout', styles.muted)}>{t('plotChosen')}</p>
                <p className="type-title">
                  <strong className="ltr num">{chosen.id}</strong>
                </p>
                <p className={cx('type-callout', styles.muted)}>
                  {t('plotFacts', { area: fmt.area(chosen.areaSqm), solution: solution ? pick(solution.name) : pick(zone.typeLabel) })}
                </p>
                <Button variant="secondary" to={applyTarget(zone.code, chosen.id, guest)} className={styles.apply}>
                  {t('apply')}
                </Button>
                {guest ? <p className={cx('type-foot', styles.muted)}>{t('applyGuest')}</p> : null}
              </>
            ) : (
              <p className={cx('type-body', styles.wideOnly)}>{t('plotPick')}</p>
            )}
            {own.length > 0 ? <p className={cx('type-callout', styles.muted)}>{t('ownPlots', { plots: own.map((id) => fmt.ltr(id)).join(lang === 'ar' ? '، ' : ', ') })}</p> : null}
          </Card>
        </div>
      </Section>
    </div>
  );
}
