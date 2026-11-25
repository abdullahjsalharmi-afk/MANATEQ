/**
 * Pure helpers of the account area: how a plot's status reads, which services make sense for a plot now,
 * and when a lease counts as ending soon. No React here, so it is easy to test.
 */
import { Bookmark, Factory, FileSignature, HardHat, KeyRound, type LucideIcon } from 'lucide-react';
import type { RenderName, Tone } from '@/design/core';
import type { Invoice, Lease, Plot, PlotStatus, RequestState, TeamMember } from '@/domain/types';
import type { ServiceId, SolutionKey } from '@/data/types';

const DAY = 86_400_000;

/** A lease ends "soon" inside this window: the renewal (B3) opens 120 days before the end. */
export const ENDING_SOON_DAYS = 120;

export interface StatusMeta {
  key: `status.${PlotStatus}`;
  icon: LucideIcon;
  tone: Tone;
}

const STATUS_META: Record<PlotStatus, StatusMeta> = {
  reserved: { key: 'status.reserved', icon: Bookmark, tone: 'neutral' },
  leased: { key: 'status.leased', icon: FileSignature, tone: 'info' },
  handed_over: { key: 'status.handed_over', icon: KeyRound, tone: 'info' },
  building: { key: 'status.building', icon: HardHat, tone: 'warn' },
  operating: { key: 'status.operating', icon: Factory, tone: 'ok' },
};

export function plotStatusMeta(status: PlotStatus): StatusMeta {
  return STATUS_META[status];
}

/** True when the lease is still running and ends within `ENDING_SOON_DAYS`. */
export function leaseEndingSoon(lease: Lease | undefined, now: number): boolean {
  if (!lease) return false;
  const left = lease.endsAt - now;
  return left > 0 && left <= ENDING_SOON_DAYS * DAY;
}

/** The services that make sense for a plot in its current status, in the order to show them. */
export function plotServiceIds(plot: Plot): ServiceId[] {
  switch (plot.status) {
    case 'operating':
      return ['D1', 'D2', 'C9', 'B5'];
    case 'building':
      return ['C1', 'C6', 'C5'];
    case 'handed_over':
      return ['C1', 'C6'];
    case 'leased':
      return ['A8'];
    case 'reserved':
      return [];
  }
}

/** The open renewal request of a plot, if the calendar has opened one. */
export function openRenewal(requests: RequestState[], plotId: string): RequestState | undefined {
  return requests.find((request) => request.serviceId === 'B3' && request.plotId === plotId && (request.status === 'active' || request.status === 'needs_you'));
}

/** The invoices of a plot's lease, as the payments list orders them (outstanding first). */
export function invoicesOfLease(invoices: Invoice[], leaseId: string | undefined, limit = 3): Invoice[] {
  if (leaseId === undefined) return [];
  return invoices.filter((invoice) => invoice.leaseId === leaseId).slice(0, limit);
}

/** The owner (the authorised signatory) first, then the others as stored. */
export function orderTeam(team: TeamMember[]): TeamMember[] {
  return [...team].sort((a, b) => Number(b.scope === 'owner') - Number(a.scope === 'owner'));
}

/** Where a plot's service starts: the start flow with the plot already chosen. */
export function startRoute(serviceId: ServiceId, plotId: string): string {
  return `/start/${serviceId}?plot=${encodeURIComponent(plotId)}`;
}

const SOLUTION_RENDER: Record<SolutionKey, RenderName> = { industrial: 'factory', logistics: 'warehouse', commercial: 'showroom', openYard: 'yard', warehousing: 'units' };

/** The render that shows a plot as it stands: bare land until it is built on, the site while building, its solution once it runs. */
export function plotRender(plot: Plot): RenderName {
  if (plot.status === 'building') return 'construction';
  if (plot.status === 'operating') return SOLUTION_RENDER[plot.solution];
  return 'plot';
}
