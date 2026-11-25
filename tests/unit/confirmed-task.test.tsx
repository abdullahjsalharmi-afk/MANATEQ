// A payment or a signature the person confirmed happens exactly once, whatever becomes of the sheet: it is not
// dropped when the screen changes (Back, a link) or the page goes while the sheet says "processing".
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LangProvider } from '@/app/i18n';
import { PAY_MS, PaySheet, SIGN_MS, SignSheet } from '@/design/forms';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
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
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const button = (name: string | RegExp) => {
  const found = [...document.querySelectorAll('button')].find((el) => (typeof name === 'string' ? el.textContent?.trim() === name : name.test(el.textContent ?? '')));
  if (!found) throw new Error(`no button ${String(name)}`);
  return found;
};
const press = (name: string | RegExp) => act(() => button(name).click());
const text = () => document.body.textContent ?? '';
/** The screen changes: everything on it goes away. */
const leave = () => render(null);

function pay(props: Partial<Parameters<typeof PaySheet>[0]> = {}) {
  return <PaySheet open onClose={() => undefined} title="Pay the rent invoice" lines={[]} amount={37500} reference="RCP-2026-0051" onPaid={() => undefined} {...props} />;
}

function signAll() {
  // Adopt the typed signature, agree, sign.
  press(/Adopt/);
  act(() => (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
  press('Sign');
}

function sign(props: Partial<Parameters<typeof SignSheet>[0]> = {}) {
  return <SignSheet open onClose={() => undefined} title="Sign the addendum" documentName="Lease addendum" lines={[]} signerName="Example Signatory" onSigned={() => undefined} {...props} />;
}

describe('a confirmed payment', () => {
  it('is made once when the screen changes while it is processing', () => {
    const onPaid = vi.fn();
    render(pay({ onPaid }));
    press(/^Pay /);
    expect(text()).toContain('Processing the payment');
    wait(PAY_MS / 3);
    leave();
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledWith(true);
    // The wait that was left running does not make it a second time.
    wait(PAY_MS * 3);
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it('files the payment first, then reports it, when the receipt comes from the payment itself', () => {
    const order: string[] = [];
    const onPay = vi.fn(() => (order.push('filed'), 'RCP-2026-0101'));
    const onPaid = vi.fn(() => void order.push('reported'));
    render(pay({ onPay, onPaid, reference: undefined }));
    press(/^Pay /);
    leave();
    expect(order).toEqual(['filed', 'reported']);
    wait(PAY_MS * 3);
    expect(onPay).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it('is reported once when the screen changes on the confirmation', () => {
    const onPaid = vi.fn();
    render(pay({ onPaid }));
    press(/^Pay /);
    wait(PAY_MS + 50);
    expect(text()).toContain('Payment complete');
    expect(onPaid).not.toHaveBeenCalled();
    leave();
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledWith(true);
  });

  it('is reported once, not twice, when the person leaves the confirmation themselves', () => {
    const onPaid = vi.fn();
    const onClose = vi.fn();
    render(pay({ onPaid, onClose }));
    press(/^Pay /);
    wait(PAY_MS + 50);
    press('Done');
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledWith(false);
    expect(onClose).toHaveBeenCalledTimes(1);
    leave();
    wait(PAY_MS * 3);
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it('is not made when the person only looked and closed the sheet', () => {
    const onPaid = vi.fn();
    const onPay = vi.fn(() => 'RCP-1');
    render(pay({ onPaid, onPay }));
    leave();
    wait(PAY_MS * 3);
    expect(onPay).not.toHaveBeenCalled();
    expect(onPaid).not.toHaveBeenCalled();
  });

  it('uses what the sheet was given while it was open, when its owner closes it by taking that away', () => {
    const paid: string[] = [];
    const owner = (invoice: string | null) => pay({ open: invoice !== null, onPaid: () => void (invoice ? paid.push(invoice) : paid.push('nothing')) });
    render(owner('inv51'));
    press(/^Pay /);
    render(owner(null));
    expect(paid).toEqual(['inv51']);
    wait(PAY_MS * 3);
    expect(paid).toEqual(['inv51']);
  });

  it('says it failed, and reports nothing, when the payment cannot be filed as the screen changes', () => {
    const onPaid = vi.fn();
    const onFailed = vi.fn();
    render(pay({ onPay: () => null, onFailed, onPaid }));
    press(/^Pay /);
    leave();
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onPaid).not.toHaveBeenCalled();
  });

  it('is made once when the page itself goes while it is processing', () => {
    const onPaid = vi.fn();
    const onClose = vi.fn();
    render(pay({ onPaid, onClose }));
    press(/^Pay /);
    act(() => void window.dispatchEvent(new Event('pagehide')));
    expect(onPaid).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledWith(true);
    // The page comes back as it was (kept by the browser): the sheet shows its confirmation and closes without paying again.
    wait(PAY_MS * 3);
    expect(text()).toContain('Payment complete');
    press('Done');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onPaid).toHaveBeenCalledTimes(1);
  });

  it('can be made again on a later opening of the same sheet', () => {
    const onPaid = vi.fn();
    render(pay({ onPaid }));
    press(/^Pay /);
    wait(PAY_MS + 50);
    press('Done');
    render(pay({ onPaid, open: false }));
    wait(400);
    render(pay({ onPaid }));
    press(/^Pay /);
    wait(PAY_MS + 50);
    press('Done');
    expect(onPaid).toHaveBeenCalledTimes(2);
  });
});

describe('a signature that was given', () => {
  it('is reported once when the screen changes while it is being signed', () => {
    const onSigned = vi.fn();
    render(sign({ onSigned }));
    signAll();
    expect(text()).toContain('Signing');
    wait(SIGN_MS / 3);
    leave();
    expect(onSigned).toHaveBeenCalledTimes(1);
    expect(onSigned).toHaveBeenCalledWith(true);
    wait(SIGN_MS * 3);
    expect(onSigned).toHaveBeenCalledTimes(1);
  });

  it('is reported once when the screen changes on the confirmation', () => {
    const onSigned = vi.fn();
    render(sign({ onSigned }));
    signAll();
    wait(SIGN_MS + 50);
    expect(onSigned).not.toHaveBeenCalled();
    leave();
    expect(onSigned).toHaveBeenCalledTimes(1);
    expect(onSigned).toHaveBeenCalledWith(true);
  });

  it('is reported once when the person leaves the confirmation themselves', () => {
    const onSigned = vi.fn();
    render(sign({ onSigned }));
    signAll();
    wait(SIGN_MS + 50);
    press('Done');
    expect(onSigned).toHaveBeenCalledTimes(1);
    expect(onSigned).toHaveBeenCalledWith(false);
    leave();
    expect(onSigned).toHaveBeenCalledTimes(1);
  });

  it('is not reported when nothing was signed', () => {
    const onSigned = vi.fn();
    render(sign({ onSigned }));
    press('Sign'); // refused: no signature, no consent
    leave();
    wait(SIGN_MS * 3);
    expect(onSigned).not.toHaveBeenCalled();
  });

  it('says what still has to be done when the signature does not finish the task', () => {
    render(sign({ then: { note: 'One step left: the payment. The signed document is saved once it is made.', label: 'Continue to payment' } }));
    signAll();
    wait(SIGN_MS + 50);
    expect(text()).toContain('One step left: the payment.');
    expect(text()).not.toContain('The signed document is saved in Documents and passes.');
    expect(button('Continue to payment')).toBeTruthy();
  });
});
