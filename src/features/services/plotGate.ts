/**
 * Whether a service can be started from the catalogue by this investor, or waits for a plot first (gate n=21).
 * A service for a leased plot (`needsTenancy`) is not offered to a signed-in company that holds no plot it could be
 * for: the page explains that it opens once a plot is leased and offers the one way there, the same way the start
 * screen does (`needsPlotAction`). A guest still sees «ابدأ», which first asks them to sign in.
 */
import { useMemo } from 'react';
import { peekServiceDetail } from '@/data/catalog';
import type { ServiceDetail, ServiceSummary } from '@/data/types';
import type { Persona, RequestState } from '@/domain/types';
import { needsPlotAction, type NeedsPlotAction } from '@/features/start/NeedsPlot';
import { needsTenancy, selectActiveRequests, selectHasPlots, selectPersona, selectPlotsFor, useApp } from '@/state';

export type { NeedsPlotAction };

export interface PlotGateInput {
  persona: Persona;
  /** How many of the investor's plots a request of this service can be started for (`selectPlotsFor(id)`). */
  candidates: number;
  hasPlots: boolean;
  active: readonly Pick<RequestState, 'id' | 'serviceId'>[];
  hasCheck: boolean;
}

/** The way forward instead of «ابدأ», or null when the service can be started (or is never started by the investor). */
export function plotGate(service: Pick<ServiceSummary, 'startable' | 'audiences'> & Partial<Pick<ServiceDetail, 'fields'>>, input: PlotGateInput): NeedsPlotAction | null {
  if (!service.startable || input.persona === 'guest') return null;
  if (!needsTenancy(service) || input.candidates > 0) return null;
  return needsPlotAction(input.hasPlots, input.active, input.hasCheck);
}

/** Where each way forward leads and what it is called (keys of the services strings table). */
export const PLOT_GATE_ACTION: Record<NeedsPlotAction['kind'], { label: 'gateTrackLand' | 'gateApplyLand' | 'gateCheckFirst' | 'gateViewPlots'; to: (action: NeedsPlotAction) => string }> = {
  track: { label: 'gateTrackLand', to: (action) => (action.kind === 'track' ? `/requests/${action.requestId}` : '/requests') },
  apply: { label: 'gateApplyLand', to: () => '/start/A4' },
  check: { label: 'gateCheckFirst', to: () => '/eligibility' },
  plots: { label: 'gateViewPlots', to: () => '/account/plots' },
};

/** `plotGate` for a screen. The detail, once loaded, also makes a plot service of one with a required plot field (B6). */
export function usePlotGate(summary: ServiceSummary, detail?: ServiceDetail): NeedsPlotAction | null {
  const persona = useApp(selectPersona);
  const candidates = useApp(useMemo(() => selectPlotsFor(summary.id), [summary.id]));
  const hasPlots = useApp(selectHasPlots);
  const active = useApp(selectActiveRequests);
  const hasCheck = useApp(selectHasCheck);
  const service = detail ?? peekServiceDetail(summary.id) ?? summary;
  return plotGate(service, { persona, candidates: candidates.length, hasPlots, active, hasCheck });
}

const selectHasCheck = (state: { world: { eligibility: unknown } }) => state.world.eligibility !== null;
