/**
 * The two demo profiles a visitor can sign in as. Their company names come from the state layer's
 * seed, so the welcome sheet always says what the profile will actually hold.
 */
import type { L10n } from '@/data/types';
import { seedWorld } from '@/state';

export type DemoProfile = 'prospect' | 'tenant';

export const DEMO_PROFILES: readonly DemoProfile[] = ['prospect', 'tenant'];

const names = new Map<DemoProfile, L10n | null>();

/** The company the seed gives a profile (read once, then remembered). */
export function demoCompanyName(profile: DemoProfile): L10n | null {
  if (!names.has(profile)) names.set(profile, seedWorld(profile, Date.now()).company?.name ?? null);
  return names.get(profile) ?? null;
}

/** The profile to offer first: the one in use when the screen serves as a profile switcher, else the richer demo. */
export function initialProfile(persona: string, onboarded: boolean): DemoProfile {
  return onboarded && persona === 'prospect' ? 'prospect' : 'tenant';
}

/** The simulated hand-off: when each fetched line ticks and when the profile opens (ms after "Sign in"). */
export const HANDOFF = { identity: 350, registry: 700, done: 1050 } as const;

/** Where the hand-off stands `elapsed` ms after it started. */
export function handoffStage(elapsed: number): { identity: boolean; registry: boolean; done: boolean } {
  return { identity: elapsed >= HANDOFF.identity, registry: elapsed >= HANDOFF.registry, done: elapsed >= HANDOFF.done };
}
