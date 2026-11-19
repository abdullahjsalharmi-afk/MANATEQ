/**
 * Whether every service's full record (workflow, actions, fields) is in memory. The records load per
 * domain on demand; the simulation asks for all of them once at start-up (`boot.ts`). Until they
 * arrive, requests wait where they are and screens fall back to the light catalogue.
 */
import { useSyncExternalStore } from 'react';

let ready = false;
const listeners = new Set<() => void>();

export const isCatalogueReady = (): boolean => ready;

/** Called once, when `loadAllServiceDetails()` has resolved. */
export function markCatalogueReady(): void {
  if (ready) return;
  ready = true;
  for (const listener of [...listeners]) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Re-renders the component when the full catalogue arrives, so `peekServiceDetail()` can be read during render. */
export function useCatalogueReady(): boolean {
  return useSyncExternalStore(subscribe, isCatalogueReady, isCatalogueReady);
}
