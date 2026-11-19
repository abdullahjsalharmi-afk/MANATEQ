/**
 * Services whose "start" experience is purpose-built instead of the generic form.
 * `#/start/:id` looks the service up here first.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { ServiceId } from '@/data/types';

export const bespokeFlows: Record<ServiceId, LazyExoticComponent<ComponentType>> = {
  A4: lazy(() => import('./land/LandFlow').then((m) => ({ default: m.LandFlow }))),
  D1: lazy(() => import('./maintenance/MaintenanceFlow').then((m) => ({ default: m.MaintenanceFlow }))),
  D2: lazy(() => import('./pass/PassFlow').then((m) => ({ default: m.PassFlow }))),
  D3: lazy(() => import('./incident/IncidentFlow').then((m) => ({ default: m.IncidentFlow }))),
};

/** Services that open a dedicated screen instead of `#/start/:id`. */
export const startRedirects: Record<ServiceId, string> = {
  A2: '/eligibility',
};
