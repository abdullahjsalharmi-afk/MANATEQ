/**
 * A very small store: one immutable state object, subscribers, and persistence to localStorage.
 * Components read with `useStore(selector)`; state changes only through `src/state/actions.ts`.
 */
import { useRef, useSyncExternalStore } from 'react';

type Listener = () => void;

export interface Store<T> {
  getState(): T;
  setState(update: (prev: T) => T): void;
  replaceState(next: T): void;
  subscribe(listener: Listener): () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<Listener>();
  const emit = () => {
    for (const listener of [...listeners]) listener();
  };
  return {
    getState: () => state,
    setState(update) {
      const next = update(state);
      if (next === state) return;
      state = next;
      emit();
    },
    replaceState(next) {
      state = next;
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** Shallow equality for selector results (arrays and plain objects one level deep). */
export function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
  }
  return true;
}

/** Structural equality for plain data (arrays and plain objects), a few levels deep. */
export function deepEqual(a: unknown, b: unknown, depth = 6): boolean {
  if (Object.is(a, b)) return true;
  if (depth <= 0 || typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], depth - 1)) return false;
  }
  return true;
}

/**
 * Subscribes a component to a slice of a store. The selector may build a new array or object on
 * every call; the component re-renders only when the result differs.
 *
 * The cached selection belongs to one state AND one selector. A component that passes a different
 * selector for the same state (for example `selectDoc(id)` after the id arrived) gets that selector's
 * answer, not the previous one's. A selector that is merely a new function returning the same data
 * (an inline arrow, a factory called on every render) keeps the reference it had, so nothing loops.
 */
export function useStoreOf<T, S>(store: Store<T>, selector: (state: T) => S, isEqual: (a: S, b: S) => boolean = shallowEqual): S {
  const cache = useRef<{ state: T; selector: (state: T) => S; selection: S } | null>(null);
  const getSnapshot = (): S => {
    const state = store.getState();
    const cached = cache.current;
    if (cached && cached.state === state && cached.selector === selector) return cached.selection;
    const selection = selector(state);
    if (cached) {
      const same = cached.state === state ? deepEqual(cached.selection, selection) : isEqual(cached.selection, selection);
      if (same) {
        cache.current = { state, selector, selection: cached.selection };
        return cached.selection;
      }
    }
    cache.current = { state, selector, selection };
    return selection;
  };
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

export interface Persistence<T> {
  load(): T | null;
  save(state: T): void;
  clear(): void;
}

/** localStorage persistence that never throws (private windows, blocked storage, previews). */
export function localPersistence<T>(key: string, isValid: (value: unknown) => value is T): Persistence<T> {
  return {
    load() {
      try {
        const raw = window.localStorage.getItem(key);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        return isValid(parsed) ? parsed : null;
      } catch {
        return null;
      }
    },
    save(state) {
      try {
        window.localStorage.setItem(key, JSON.stringify(state));
      } catch {
        /* storage unavailable: the app keeps working in memory */
      }
    },
    clear() {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    },
  };
}

/** Saves the store shortly after each change. Returns a function that stops saving. */
export function persistStore<T>(store: Store<T>, persistence: Persistence<T>, delayMs = 200): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    timer = undefined;
    persistence.save(store.getState());
  };
  const unsubscribe = store.subscribe(() => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
  });
  const onHide = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      flush();
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('pagehide', onHide);
  return () => {
    unsubscribe();
    if (timer !== undefined) clearTimeout(timer);
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', onHide);
  };
}
