import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStore, deepEqual, useStoreOf } from '@/app/store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface State {
  docs: Record<string, { title: string }>;
  count: number;
}

let host: HTMLElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('useStoreOf', () => {
  it('answers with the new selector when only the selector changes', () => {
    const store = createStore<State>({ docs: { a: { title: 'A' }, b: { title: 'B' } }, count: 0 });
    let choose: (id: string | undefined) => void = () => undefined;
    function Probe() {
      const [id, setId] = useState<string | undefined>(undefined);
      choose = setId;
      // A selector built on every render, as `selectDoc(id)` is.
      const doc = useStoreOf(store, (state) => (id === undefined ? undefined : state.docs[id]));
      return <p>{doc?.title ?? 'none'}</p>;
    }
    act(() => root.render(<Probe />));
    expect(host.textContent).toBe('none');
    // The store does not change; only the id the component asks about does.
    act(() => choose('b'));
    expect(host.textContent).toBe('B');
    act(() => choose('a'));
    expect(host.textContent).toBe('A');
  });

  it('does not loop when a selector builds a fresh, equal structure on every call', () => {
    const store = createStore<State>({ docs: { a: { title: 'A' } }, count: 0 });
    let renders = 0;
    function Probe() {
      renders += 1;
      // New arrays and new objects each time, the same data: the reference must stay put.
      const rows = useStoreOf(store, (state) => Object.keys(state.docs).map((id) => ({ id, parts: [state.docs[id]?.title] })));
      return <p>{rows.map((row) => row.id).join(',')}</p>;
    }
    act(() => root.render(<Probe />));
    expect(host.textContent).toBe('a');
    const settled = renders;
    // A change the selection does not depend on re-renders nothing.
    act(() => store.setState((prev) => ({ ...prev, count: prev.count + 1 })));
    expect(renders).toBeLessThanOrEqual(settled + 1);
    // A change it does depend on shows up.
    act(() => store.setState((prev) => ({ ...prev, docs: { ...prev.docs, b: { title: 'B' } } })));
    expect(host.textContent).toBe('a,b');
  });

  it('compares plain data structurally', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual(null, {})).toBe(false);
  });
});
