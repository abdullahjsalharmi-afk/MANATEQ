/**
 * First-run state and the demo worlds of each persona.
 * Everything here is illustrative: invented companies, plots, amounts and dates.
 */
import type { AppState, Persona, Settings, World } from '@/domain/types';

/** Bump when the saved shape changes; older saves are discarded on load. */
export const STATE_VERSION = 1;

export function initialSettings(): Settings {
  return { lang: 'ar', theme: 'auto', textSize: 1, onboarded: false, notifications: true };
}

export function emptyWorld(persona: Persona = 'guest'): World {
  return {
    persona,
    company: null,
    team: [],
    plots: [],
    leases: [],
    requests: [],
    invoices: [],
    docs: [],
    passes: [],
    notifications: [],
    appointments: [],
    drafts: {},
    eligibility: null,
    watchedZones: [],
    seq: 40,
  };
}

export function initialState(): AppState {
  return { version: STATE_VERSION, settings: initialSettings(), world: emptyWorld('guest'), demo: { speed: 1 } };
}
