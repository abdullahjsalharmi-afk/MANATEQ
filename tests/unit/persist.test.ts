// Saving the store: shortly after each change, and at once when the page is going away, including a change
// made while it goes (a payment the person had just confirmed is completed by another listener of the same event).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore, persistStore, type Persistence } from '@/app/store';

let saves: number[];
let stop: () => void;
const store = createStore(0);
const persistence: Persistence<number> = {
  load: () => null,
  save: (state) => void saves.push(state),
  clear: () => undefined,
};
const bump = () => store.setState((n) => n + 1);
const fire = (type: string, target: EventTarget = window) => target.dispatchEvent(new Event(type));
const visibility = (state: 'hidden' | 'visible') => Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });

beforeEach(() => {
  vi.useFakeTimers();
  saves = [];
  store.replaceState(0);
  stop = persistStore(store, persistence, 200);
});

afterEach(() => {
  stop();
  visibility('visible');
  vi.useRealTimers();
});

describe('saving the store', () => {
  it('saves once, shortly after a run of changes', () => {
    bump();
    bump();
    bump();
    expect(saves).toEqual([]);
    vi.advanceTimersByTime(250);
    expect(saves).toEqual([3]);
  });

  it('saves what is waiting at once when the page goes', () => {
    bump();
    fire('pagehide');
    expect(saves).toEqual([1]);
    vi.advanceTimersByTime(1000);
    expect(saves).toEqual([1]);
  });

  it('saves at once a change made while the page goes, whichever listener ran first', () => {
    // A listener registered after the store's own: it completes something as the page goes.
    const complete = () => bump();
    window.addEventListener('pagehide', complete);
    fire('pagehide');
    window.removeEventListener('pagehide', complete);
    expect(saves).toEqual([1]);
  });

  it('goes back to saving shortly after, when the browser brings the page back', () => {
    fire('pagehide');
    fire('pageshow');
    bump();
    expect(saves).toEqual([]);
    vi.advanceTimersByTime(250);
    expect(saves).toEqual([1]);
  });

  it('saves what is waiting when the page goes to the background', () => {
    bump();
    visibility('hidden');
    fire('visibilitychange', document);
    expect(saves).toEqual([1]);
    // Still alive in the background: later changes are saved shortly after, as usual.
    bump();
    expect(saves).toEqual([1]);
    vi.advanceTimersByTime(250);
    expect(saves).toEqual([1, 2]);
  });

  it('saves nothing more once stopped', () => {
    bump();
    stop();
    fire('pagehide');
    vi.advanceTimersByTime(1000);
    bump();
    vi.advanceTimersByTime(1000);
    expect(saves).toEqual([]);
  });
});
