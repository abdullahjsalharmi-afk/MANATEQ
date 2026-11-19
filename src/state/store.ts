/**
 * The app's single store. Components read with `useApp(selector)`; state changes only through
 * `src/state/actions.ts`.
 */
import { createStore, localPersistence, persistStore, useStoreOf } from '@/app/store';
import type { AppState, World } from '@/domain/types';
import { initialState, STATE_VERSION } from './seed';

export const STORAGE_KEY = 'manateq-one:v1';

/** The lists every saved world must hold; a save that lacks one is from another shape and is discarded. */
const WORLD_LISTS: (keyof World)[] = ['team', 'plots', 'leases', 'requests', 'invoices', 'docs', 'passes', 'notifications', 'appointments', 'watchedZones'];

function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AppState>;
  if (candidate.version !== STATE_VERSION) return false;
  if (typeof candidate.settings !== 'object' || candidate.settings === null) return false;
  if (typeof candidate.demo !== 'object' || candidate.demo === null || typeof candidate.demo.speed !== 'number') return false;
  const world = candidate.world as Partial<World> | null | undefined;
  if (typeof world !== 'object' || world === null) return false;
  return WORLD_LISTS.every((key) => Array.isArray(world[key])) && typeof world.drafts === 'object' && world.drafts !== null && typeof world.seq === 'number';
}

const persistence = localPersistence<AppState>(STORAGE_KEY, isAppState);

export const appStore = createStore<AppState>(typeof window === 'undefined' ? initialState() : (persistence.load() ?? initialState()));

if (typeof window !== 'undefined') persistStore(appStore, persistence);

/** Subscribes a component to a slice of the app state. */
export function useApp<S>(selector: (state: AppState) => S): S {
  return useStoreOf(appStore, selector);
}

export const getState = (): AppState => appStore.getState();

export function setState(update: (prev: AppState) => AppState): void {
  appStore.setState(update);
}

/** Forgets everything saved on this device and returns to the first-run state. */
export function resetEverything(): void {
  persistence.clear();
  appStore.replaceState(initialState());
}
