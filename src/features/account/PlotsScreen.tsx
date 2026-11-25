import { useLang, useT } from '@/app/i18n';
import { Button, Card, Grid, Pill, Render, Screen } from '@/design/core';
import { EmptyState } from '@/design/forms';
import { getSolution, getZone } from '@/data/catalog';
import type { Plot } from '@/domain/types';
import { selectJourneyOfPlot, selectLeaseOfPlot, selectPlots, useApp } from '@/state';
import { plotRender, plotStatusMeta } from './account-model';
import styles from './PlotsScreen.module.css';
import { strings } from './strings';

/** Plots and leases: one card per plot, or a calm empty state for an investor without land. */
export function PlotsScreen() {
  const t = useT(strings);
  const plots = useApp(selectPlots);
  return (
    <Screen title={t('plotsTitle')} nav="back" backTo="/account">
      {plots.length === 0 ? (
        <EmptyState
          render="plot"
          title={t('noPlotsTitle')}
          body={t('noPlotsBody')}
          action={<Button to="/eligibility">{t('checkEligibility')}</Button>}
        />
      ) : (
        <Grid as="ul" columns={3} className={styles.grid}>
          {plots.map((plot) => (
            <PlotCard key={plot.id} plot={plot} />
          ))}
        </Grid>
      )}
    </Screen>
  );
}

function PlotCard({ plot }: { plot: Plot }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const lease = useApp(selectLeaseOfPlot(plot.id));
  const journey = useApp(selectJourneyOfPlot(plot.id));
  const station = journey.stations.find((candidate) => candidate.key === journey.station);
  const meta = plotStatusMeta(plot.status);
  const zone = getZone(plot.zoneCode);
  const solution = getSolution(plot.solution);
  return (
    <Card as="li" to={`/account/plots/${encodeURIComponent(plot.id)}`} media={<Render name={plotRender(plot)} decorative />}>
      <div className={styles.head}>
        <h2 className={`type-heading ${styles.number}`}>
          <span className="visually-hidden">{t('plotLabel', { number: plot.number })}</span>
          <span className="ltr" aria-hidden="true">
            {plot.number}
          </span>
        </h2>
        <Pill tone={meta.tone} icon={meta.icon}>
          {t(meta.key)}
        </Pill>
      </div>
      <p className="type-callout">{pick(zone?.name)}</p>
      <p className={`type-body ${styles.facts}`}>
        <span className="num">{fmt.area(plot.areaSqm)}</span> · {pick(solution?.name)}
      </p>
      <div className={styles.lease}>
        {lease ? (
          <>
            <p className="type-callout">{t('leaseLine', { ref: fmt.ltr(lease.ref), date: fmt.date(lease.endsAt) })}</p>
            <p className="type-callout num">{t('perYear', { amount: fmt.money(lease.annualRent) })}</p>
          </>
        ) : (
          <p className="type-callout">{t('noLease')}</p>
        )}
        {station ? <p className={`type-foot ${styles.station}`}>{t('stationNow', { station: pick(station.name) })}</p> : null}
      </div>
    </Card>
  );
}
