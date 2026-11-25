import { useLang, useT } from '@/app/i18n';
import type { DomainCode, ServiceSummary } from '@/data/types';
import { Button, EmptyState, Screen, type RenderName } from '@/design/core';
import type { RequestState } from '@/domain/types';
import { selectActiveRequests, selectHasPlots, useApp } from '@/state';
import { strings } from './strings';

/** SPEC 3.5: the render of each service domain. */
export const DOMAIN_RENDER: Record<DomainCode, RenderName> = { A: 'zone', B: 'plot', C: 'construction', D: 'utilities', E: 'services', F: 'units', G: 'gate' };

/** The land journey a company without a plot is on: application, evaluation, offer, contract. */
const LAND_STEPS = ['A4', 'A5', 'A6', 'A7'];

export type NeedsPlotAction = { kind: 'track'; requestId: string } | { kind: 'apply' } | { kind: 'check' } | { kind: 'plots' };

/**
 * The one way forward when a service needs a plot the company does not hold: follow the land application
 * already running, apply for land once an eligibility check is saved, else check eligibility first. A company
 * that holds plots, none of which this service is for (A8 once every plot is handed over), sees its plots.
 */
export function needsPlotAction(hasPlots: boolean, active: readonly Pick<RequestState, 'id' | 'serviceId'>[], hasCheck: boolean): NeedsPlotAction {
  if (hasPlots) return { kind: 'plots' };
  const running = active.find((request) => LAND_STEPS.includes(request.serviceId));
  if (running) return { kind: 'track', requestId: running.id };
  return hasCheck ? { kind: 'apply' } : { kind: 'check' };
}

const ACTION: Record<NeedsPlotAction['kind'], { label: 'trackLand' | 'applyLand' | 'checkFirst' | 'viewPlots'; to: (action: NeedsPlotAction) => string }> = {
  track: { label: 'trackLand', to: (action) => (action.kind === 'track' ? `/requests/${action.requestId}` : '/requests') },
  apply: { label: 'applyLand', to: () => '/start/A4' },
  check: { label: 'checkFirst', to: () => '/eligibility' },
  plots: { label: 'viewPlots', to: () => '/account/plots' },
};

/**
 * `#/start/:id` for a service that needs a tenancy when the company holds no plot it could be for: what the
 * service is for, that it opens once a plot is leased, one way forward, and a link back to the service. The
 * flow itself never runs (the pattern of the gate pass flow, D2).
 */
export function NeedsPlot({ service }: { service: Pick<ServiceSummary, 'id' | 'label' | 'summary' | 'domain'> }) {
  const t = useT(strings);
  const { pick } = useLang();
  const hasPlots = useApp(selectHasPlots);
  const active = useApp(selectActiveRequests);
  const hasCheck = useApp((state) => state.world.eligibility !== null);
  const action = needsPlotAction(hasPlots, active, hasCheck);
  const { label, to } = ACTION[action.kind];
  const body = [pick(service.summary), t(hasPlots ? 'needsPlotNoneBody' : 'needsPlotBody')].filter(Boolean).join(' ');
  return (
    <Screen title={pick(service.label)} nav="close" navLabel={t('closeFlow')} backTo={`/services/${service.id}`} width="form">
      <EmptyState
        render={DOMAIN_RENDER[service.domain]}
        title={t(hasPlots ? 'needsPlotNoneTitle' : 'needsPlotTitle')}
        body={body}
        action={
          <>
            <Button to={to(action)}>{t(label)}</Button>
            <Button variant="quiet" to={`/services/${service.id}`}>
              {t('openService')}
            </Button>
          </>
        }
      />
    </Screen>
  );
}
