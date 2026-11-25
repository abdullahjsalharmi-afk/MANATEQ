// The plot gate of a start flow is judged when the flow opens; a flow that was let in stays (second review:
// the handover's confirmation was replaced by "None of your plots needs this service now" once its own request
// had made the plot handed over).
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAdmitted } from '@/features/start/StartScreen';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function Probe({ id, open }: { id: string; open: boolean | undefined }) {
  return <p>{useAdmitted(id, open) ? 'flow' : 'gate'}</p>;
}

const show = (id: string, open: boolean | undefined) => {
  act(() => root.render(<Probe id={id} open={open} />));
  return host.textContent;
};

describe('the plot gate of a start flow', () => {
  it('keeps a flow that was let in, when its own request leaves no plot that needs the service', () => {
    expect(show('A8', true)).toBe('flow');
    // The handover completes: no plot qualifies any more. The confirmation stays on screen.
    expect(show('A8', false)).toBe('flow');
    expect(show('A8', false)).toBe('flow');
  });

  it('shows the gate to a company with no plot the service could be for, from the start', () => {
    expect(show('B8', false)).toBe('gate');
    // A plot appears (the lease was signed elsewhere): the flow opens.
    expect(show('B8', true)).toBe('flow');
  });

  it('does not carry an admission over to another service', () => {
    expect(show('A8', true)).toBe('flow');
    expect(show('B7', false)).toBe('gate');
  });

  it('waits while the service is still loading', () => {
    expect(show('A8', undefined)).toBe('gate');
    expect(show('A8', true)).toBe('flow');
  });

  it('is what both gates of the start screen use', () => {
    const screen = readFileSync(resolve(__dirname, '../../src/features/start/StartScreen.tsx'), 'utf8');
    expect(screen.match(/useAdmitted\(id, /g)).toHaveLength(2);
    expect(screen).not.toMatch(/candidates\.length === 0\) return <NeedsPlot/);
  });
});
