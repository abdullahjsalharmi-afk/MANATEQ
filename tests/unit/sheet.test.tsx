// The shared sheet (confirmation of the last fixes): the page behind scrolls again once the last sheet has
// closed, also when one sheet hands over to the next, and closing a sheet returns focus to what opened it.
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LangProvider } from '@/app/i18n';
import { Sheet } from '@/design/core';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
const overflow = () => document.documentElement.style.overflow;

beforeEach(() => {
  vi.useFakeTimers();
  document.documentElement.style.overflow = '';
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const render = (ui: ReactNode) => act(() => root.render(<LangProvider lang="en">{ui}</LangProvider>));
const settle = () => act(() => void vi.advanceTimersByTime(400));
const click = (id: string) => act(() => (document.getElementById(id) as HTMLElement).click());

/** A task in three steps, each its own sheet, as accepting, signing and paying an offer are. */
function Steps() {
  const [step, setStep] = useState<'none' | 'accept' | 'sign'>('none');
  return (
    <>
      <button id="opener" onClick={() => setStep('accept')}>
        Accept and renew
      </button>
      <button id="other">Elsewhere</button>
      <Sheet open={step === 'accept'} onClose={() => setStep('none')} title="Accept">
        <button id="agree" onClick={() => setStep('sign')}>
          I agree
        </button>
      </Sheet>
      <Sheet open={step === 'sign'} onClose={() => setStep('none')} title="Sign">
        <button id="close-sign" onClick={() => setStep('none')}>
          Not now
        </button>
      </Sheet>
    </>
  );
}

describe('the page behind a sheet', () => {
  it('is held still while a sheet is open and scrolls again when it closes', () => {
    render(<Steps />);
    expect(overflow()).toBe('');
    click('opener');
    expect(overflow()).toBe('hidden');
    act(() => (document.querySelector('dialog [aria-label="Close"]') as HTMLElement).click());
    settle();
    expect(document.querySelector('dialog')).toBeNull();
    expect(overflow()).toBe('');
  });

  it('scrolls again after one sheet handed over to the next and that one was closed', () => {
    render(<Steps />);
    click('opener');
    // The signing sheet opens while the accepting sheet is still closing.
    click('agree');
    expect(overflow()).toBe('hidden');
    settle();
    expect(document.querySelectorAll('dialog')).toHaveLength(1);
    expect(overflow()).toBe('hidden');
    click('close-sign');
    settle();
    expect(document.querySelector('dialog')).toBeNull();
    // The defect: the second sheet had saved "hidden" from the first and put it back for good.
    expect(overflow()).toBe('');
  });

  it('keeps a value the page had before any sheet opened', () => {
    document.documentElement.style.overflow = 'clip';
    render(<Steps />);
    click('opener');
    click('agree');
    settle();
    click('close-sign');
    settle();
    expect(overflow()).toBe('clip');
  });
});

describe('focus when a sheet closes', () => {
  it('returns to the control that opened it', () => {
    render(<Steps />);
    (document.getElementById('opener') as HTMLElement).focus();
    click('opener');
    act(() => (document.querySelector('dialog [aria-label="Close"]') as HTMLElement).focus());
    act(() => (document.querySelector('dialog [aria-label="Close"]') as HTMLElement).click());
    settle();
    expect(document.activeElement?.id).toBe('opener');
  });

  it('returns to the control on the page after a hand-over between sheets', () => {
    render(<Steps />);
    (document.getElementById('opener') as HTMLElement).focus();
    click('opener');
    act(() => (document.getElementById('agree') as HTMLElement).focus());
    click('agree');
    settle();
    act(() => (document.getElementById('close-sign') as HTMLElement).focus());
    click('close-sign');
    settle();
    expect(document.activeElement?.id).toBe('opener');
  });

  it('does not take focus from where the person has gone meanwhile', () => {
    render(<Steps />);
    (document.getElementById('opener') as HTMLElement).focus();
    click('opener');
    act(() => (document.querySelector('dialog [aria-label="Close"]') as HTMLElement).click());
    // Focus moved elsewhere on the page before the sheet finished closing.
    act(() => (document.getElementById('other') as HTMLElement).focus());
    settle();
    expect(document.activeElement?.id).toBe('other');
  });
});

/** What a browser does on a second Escape in a row: it closes the dialog itself, whatever the page answered. */
const closedByBrowser = () =>
  act(() => {
    const dialog = document.querySelector('dialog') as HTMLDialogElement;
    if (dialog.open) dialog.close();
    else dialog.removeAttribute('open');
    dialog.dispatchEvent(new Event('close'));
  });
const isShown = () => {
  const dialog = document.querySelector('dialog') as HTMLDialogElement | null;
  return dialog !== null && (dialog.open || dialog.hasAttribute('open'));
};

function Busy({ dismissible }: { dismissible: boolean }) {
  const [open, setOpen] = useState(false);
  const [paid, setPaid] = useState(false);
  return (
    <>
      <main tabIndex={-1} id="main">
        {paid ? <p>Paid</p> : <button id="pay" onClick={() => setOpen(true)}>Pay</button>}
      </main>
      <Sheet open={open} onClose={() => setOpen(false)} title="Pay" dismissible={dismissible}>
        <button
          id="done"
          onClick={() => {
            setPaid(true);
            setOpen(false);
          }}
        >
          Done
        </button>
      </Sheet>
    </>
  );
}

describe('a dialog the browser closed by itself', () => {
  it('comes straight back while the sheet cannot be dismissed (a payment is being processed)', () => {
    render(<Busy dismissible={false} />);
    click('pay');
    expect(isShown()).toBe(true);
    closedByBrowser();
    // Still there for the person to finish, and the page behind is still held.
    expect(isShown()).toBe(true);
    expect(overflow()).toBe('hidden');
    click('done');
    settle();
    expect(document.querySelector('dialog')).toBeNull();
    expect(overflow()).toBe('');
    expect(document.getElementById('main')?.textContent).toContain('Paid');
  });

  it('counts as closing a sheet that can be dismissed: nothing is left open in name only', () => {
    render(<Busy dismissible />);
    click('pay');
    closedByBrowser();
    settle();
    expect(document.querySelector('dialog')).toBeNull();
    expect(overflow()).toBe('');
    // The opener works again.
    click('pay');
    expect(isShown()).toBe(true);
  });

  it('is shown again when the sheet is reopened while it was still closing', () => {
    render(<Busy dismissible />);
    click('pay');
    closedByBrowser();
    // Reopened before the closing sheet has left the page.
    click('pay');
    expect(isShown()).toBe(true);
    settle();
    expect(isShown()).toBe(true);
    expect(overflow()).toBe('hidden');
  });
});

describe('focus when the task took its opener away', () => {
  it('goes to the main content of the screen, not to the top of the page', () => {
    render(<Busy dismissible />);
    (document.getElementById('pay') as HTMLElement).focus();
    click('pay');
    act(() => (document.getElementById('done') as HTMLElement).focus());
    click('done');
    settle();
    expect(document.getElementById('pay')).toBeNull();
    expect(document.activeElement?.id).toBe('main');
  });
});
