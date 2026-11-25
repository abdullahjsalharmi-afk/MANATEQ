/**
 * A small hash router.
 *
 * - Routes look like `#/services/A4?plot=p1`. Hash routing works from any static host, from a single
 *   HTML file and inside sandboxed previews.
 * - The router knows whether a navigation went forward, back or sideways (tab), so screens can animate
 *   in the right direction, and it restores the scroll position when the user goes back.
 * - Where the History API is unavailable it keeps working in memory.
 */
import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

export type NavKind = 'initial' | 'push' | 'pop' | 'replace' | 'tab';

export interface RouteLocation {
  /** Always starts with '/', never ends with one (except the root). */
  path: string;
  query: Record<string, string>;
  /** Position in this session's history stack. */
  idx: number;
  /** How the app arrived here. */
  nav: NavKind;
}

export interface NavigateOptions {
  replace?: boolean;
  /** Switching between tabs: no directional animation. */
  tab?: boolean;
}

type Listener = () => void;

function normalise(path: string): string {
  let p = path.trim();
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

export function parseTarget(target: string): { path: string; query: Record<string, string> } {
  const raw = target.replace(/^#/, '');
  const [pathPart = '/', queryPart = ''] = raw.split('?');
  const query: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(queryPart)) query[key] = value;
  return { path: normalise(pathPart || '/'), query };
}

export function buildTarget(path: string, query?: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return normalise(path) + (qs ? `?${qs}` : '');
}

/** A malformed escape (a link cut short in the middle of «%D8%A3») is kept as typed, so the screen shows its not-found state. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** Matches `/services/:id` against `/services/A4` → `{ id: 'A4' }`, or null. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const want = normalise(pattern).split('/');
  const have = normalise(path).split('/');
  if (want.length !== have.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < want.length; i++) {
    const w = want[i] as string;
    const h = have[i] as string;
    if (w.startsWith(':')) params[w.slice(1)] = decodeSegment(h);
    else if (w !== h) return null;
  }
  return params;
}

const hasWindow = typeof window !== 'undefined';
let historyWorks = hasWindow;

function readIdx(): number | null {
  if (!historyWorks) return null;
  try {
    const state: unknown = window.history.state;
    if (state && typeof state === 'object' && typeof (state as { idx?: unknown }).idx === 'number') return (state as { idx: number }).idx;
  } catch {
    historyWorks = false;
  }
  return null;
}

function initialLocation(): RouteLocation {
  const { path, query } = parseTarget(hasWindow ? window.location.hash : '');
  const idx = readIdx() ?? 0;
  if (historyWorks) {
    try {
      window.history.replaceState({ idx }, '');
    } catch {
      historyWorks = false;
    }
  }
  return { path, query, idx, nav: 'initial' };
}

let current: RouteLocation = initialLocation();
const listeners = new Set<Listener>();
const scrollByIdx = new Map<number, number>();

function prefersReducedMotion(): boolean {
  return hasWindow && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface ViewTransitionLike {
  ready?: Promise<unknown>;
  finished?: Promise<unknown>;
}
type TransitionDocument = Document & { startViewTransition?: (update: () => void) => ViewTransitionLike | undefined };

/**
 * The location a transition is on its way to. A view transition applies the change a moment after it starts,
 * so between the two the address bar is ahead of `current`. Going back fires both `popstate` and `hashchange`;
 * without this the second event would start the same change again and cut the first transition short.
 */
let pending: RouteLocation | null = null;

function latest(): RouteLocation {
  return pending ?? current;
}

function commit(next: RouteLocation): void {
  if (hasWindow) scrollByIdx.set(current.idx, window.scrollY);
  pending = next;
  const apply = () => {
    const from = current;
    current = next;
    if (pending === next) pending = null;
    // A new screen starts at the top. Reset before the screen renders, so its own effects may scroll
    // afterwards (About scrolls to ?section=). Replacing only the query of the same screen (a filter
    // written to the address) keeps the reader where they are.
    const keepPlace = next.nav === 'replace' && next.path === from.path;
    if (hasWindow && next.nav !== 'pop' && !keepPlace) window.scrollTo(0, 0);
    flushSync(() => {
      for (const listener of [...listeners]) listener();
    });
    // Going back restores where the reader was, once the screen is there to scroll.
    if (hasWindow && next.nav === 'pop') window.scrollTo(0, scrollByIdx.get(next.idx) ?? 0);
  };
  if (!hasWindow) {
    current = next;
    pending = null;
    for (const listener of [...listeners]) listener();
    return;
  }
  document.documentElement.dataset.nav = next.nav;
  const doc = document as TransitionDocument;
  if (typeof doc.startViewTransition === 'function' && !prefersReducedMotion() && next.nav !== 'replace') {
    try {
      const transition = doc.startViewTransition(apply);
      // A newer navigation may cut this transition short; that is expected and not an error.
      transition?.ready?.catch(() => undefined);
      transition?.finished?.catch(() => undefined);
      return;
    } catch {
      /* fall through to an instant change */
    }
  }
  apply();
}

export function navigate(to: string, options: NavigateOptions = {}): void {
  const { path, query } = parseTarget(to);
  const target = buildTarget(path, query);
  const from = latest();
  if (target === buildTarget(from.path, from.query)) return;
  const idx = options.replace ? from.idx : from.idx + 1;
  if (historyWorks) {
    try {
      if (options.replace) window.history.replaceState({ idx }, '', '#' + target);
      else window.history.pushState({ idx }, '', '#' + target);
    } catch {
      historyWorks = false;
    }
  }
  commit({ path, query, idx, nav: options.tab ? 'tab' : options.replace ? 'replace' : 'push' });
}

/** Goes back one screen; when there is nowhere to go back to, opens `fallback` instead. */
export function back(fallback = '/'): void {
  if (latest().idx > 0 && historyWorks) {
    window.history.back();
    return;
  }
  const { path, query } = parseTarget(fallback);
  if (historyWorks) {
    try {
      window.history.replaceState({ idx: 0 }, '', '#' + buildTarget(path, query));
    } catch {
      historyWorks = false;
    }
  }
  commit({ path, query, idx: 0, nav: 'pop' });
}

function onExternalChange(): void {
  const { path, query } = parseTarget(window.location.hash);
  const known = readIdx();
  const from = latest();
  let idx: number;
  let nav: NavKind;
  if (known === null) {
    // The address was changed by hand or by a plain link: treat it as a forward step.
    idx = from.idx + 1;
    nav = 'push';
    try {
      window.history.replaceState({ idx }, '');
    } catch {
      historyWorks = false;
    }
  } else {
    idx = known;
    nav = known < from.idx ? 'pop' : 'push';
  }
  if (buildTarget(path, query) === buildTarget(from.path, from.query) && idx === from.idx) return;
  commit({ path, query, idx, nav });
}

if (hasWindow) {
  window.addEventListener('popstate', onExternalChange);
  window.addEventListener('hashchange', onExternalChange);
  if ('scrollRestoration' in window.history) {
    try {
      window.history.scrollRestoration = 'manual';
    } catch {
      /* ignore */
    }
  }
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = (): RouteLocation => current;

export function useLocation(): RouteLocation {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getLocation(): RouteLocation {
  return current;
}

/** True when there is a previous screen in this session to go back to. */
export function canGoBack(): boolean {
  return current.idx > 0;
}

export function href(to: string): string {
  const { path, query } = parseTarget(to);
  return '#' + buildTarget(path, query);
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  to: string;
  replace?: boolean;
  tab?: boolean;
  children?: ReactNode;
}

/** An in-app link: a real anchor (so it can be opened in a new tab) that navigates without a reload. */
export function Link({ to, replace, tab, onClick, children, ...rest }: LinkProps) {
  const handle = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to, { replace, tab });
  };
  return (
    <a href={href(to)} onClick={handle} {...rest}>
      {children}
    </a>
  );
}

/** Test helper: puts the router at a location without touching browser history. */
export function __setLocationForTests(to: string): void {
  const { path, query } = parseTarget(to);
  current = { path, query, idx: 0, nav: 'initial' };
  for (const listener of [...listeners]) listener();
}
