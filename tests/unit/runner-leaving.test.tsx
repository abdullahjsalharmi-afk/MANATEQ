// What the investor confirmed inside a request is not lost when the screen changes under the sheet: a
// signature that ends a step completes the step once; a payment completes it once; a signature that still
// needs its payment completes nothing, and the person is told. Runs the real runner against the real state.
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LangProvider } from '@/app/i18n';
import { loadAllServiceDetails, peekServiceDetail } from '@/data/catalog';
import type { ServiceDetail, StepAction } from '@/data/types';
import { dismissToast, ToastHost } from '@/design/core';
import { PAY_MS, SIGN_MS } from '@/design/forms';
import type { RequestState } from '@/domain/types';
import { ActionRunner } from '@/features/requests/ActionRunner';
import { enterAs, startRequest, tick } from '@/state/actions';
import { getState, resetEverything } from '@/state/store';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const START = new Date(2026, 10, 25, 9, 30).getTime();
let container: HTMLDivElement;
let root: Root;

beforeAll(async () => {
  await loadAllServiceDetails();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
  resetEverything();
  enterAs('tenant');
  dismissToast();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

const world = () => getState().world;
const byId = (id: string): RequestState => world().requests.find((request) => request.id === id) as RequestState;
const detailOf = (request: RequestState): ServiceDetail => peekServiceDetail(request.serviceId) as ServiceDetail;
const actionOf = (request: RequestState): StepAction | undefined => detailOf(request).actions.find((action) => action.step === request.current);
const text = () => document.body.textContent ?? '';
const wait = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const button = (name: string | RegExp) => {
  const found = [...document.querySelectorAll('button')].find((el) => (typeof name === 'string' ? el.textContent?.trim() === name : name.test(el.textContent ?? '')));
  if (!found) throw new Error(`no button ${String(name)} in: ${[...document.querySelectorAll('button')].map((el) => el.textContent?.trim()).join(' | ')}`);
  return found;
};
const press = (name: string | RegExp) => act(() => button(name).click());

/** Lets demo time pass until the request waits for the investor. */
function untilNeedsYou(id: string): RequestState {
  for (let i = 0; i < 4000 && byId(id).status !== 'needs_you'; i++) {
    vi.advanceTimersByTime(500);
    tick(Date.now());
  }
  expect(byId(id).status, 'the request never came to the investor').toBe('needs_you');
  return byId(id);
}

/** The request's page as far as the runner goes: the runner open on the step that waits, and the toasts. */
function open(id: string, onClose: () => void = () => undefined): void {
  const request = byId(id);
  const action = actionOf(request) as StepAction;
  const ui: ReactNode = (
    <LangProvider lang="en">
      <ActionRunner request={request} service={detailOf(request)} action={action} open onClose={onClose} />
      <ToastHost />
    </LangProvider>
  );
  act(() => root.render(ui));
}

/** The screen changes: the runner goes away, the toasts (part of the app's frame) stay. */
const leave = () =>
  act(() =>
    root.render(
      <LangProvider lang="en">
        <ToastHost />
      </LangProvider>,
    ),
  );

function signNow(): void {
  press(/Adopt/);
  act(() => (document.querySelector('dialog[open] input[type="checkbox"]') as HTMLInputElement).click());
  press('Sign');
}

describe('a signature that ends its step (changing an activity: sign the annex)', () => {
  const start = () => {
    const plot = world().plots.find((candidate) => candidate.status === 'operating') ?? world().plots[0]!;
    return untilNeedsYou(startRequest('B5', { plot: plot.id, changeKind: 'add', activity: 'other' }, { plotId: plot.id }));
  };

  it('completes the step once when the screen changes while it is being signed', () => {
    const request = start();
    expect(actionOf(request)?.flow).toEqual(['sign']);
    const step = request.current;
    open(request.id);
    signNow();
    expect(text()).toContain('Signing');
    wait(SIGN_MS / 3);
    leave();
    // The step is done, and the person is told on the screen they went to.
    expect(byId(request.id).current).not.toBe(step);
    expect(byId(request.id).visits.filter((visit) => visit.step === step)).toHaveLength(1);
    expect(text()).toContain('Done. The request moves on.');
    const after = JSON.stringify(byId(request.id).visits);
    wait(SIGN_MS * 3);
    expect(JSON.stringify(byId(request.id).visits)).toBe(after);
  });

  it('says the document is saved, and offers no further step, on its confirmation', () => {
    const request = start();
    open(request.id);
    signNow();
    wait(SIGN_MS + 50);
    expect(text()).toContain('The signed document is saved in Documents and passes.');
    expect(button('Done')).toBeTruthy();
  });
});

describe('the renewal: accept, sign, then pay', () => {
  const renewal = () => world().requests.find((request) => request.serviceId === 'B3' && request.status === 'needs_you') as RequestState;

  it('tells the truth after the signature: one step is left, and the document is saved once it is made', () => {
    const request = renewal();
    expect(actionOf(request)?.flow).toEqual(['accept', 'sign', 'pay']);
    open(request.id);
    press('I agree');
    signNow();
    wait(SIGN_MS + 50);
    expect(text()).toContain('One step left: the payment. The signed document is saved once it is made.');
    expect(text()).not.toContain('The signed document is saved in Documents and passes.');
    expect(button('Continue to payment')).toBeTruthy();
  });

  it('completes nothing, and says so, when the screen changes between the signature and the payment', () => {
    const request = renewal();
    const before = JSON.stringify(byId(request.id));
    open(request.id);
    press('I agree');
    signNow();
    leave();
    expect(JSON.stringify(byId(request.id))).toBe(before);
    expect(text()).toContain('Not completed: the payment was not made, so your signature was not saved. Open the request to do it again.');
    wait(SIGN_MS * 3);
    expect(JSON.stringify(byId(request.id))).toBe(before);
  });

  it('says so too, in words for where they are, when the person signs and then closes the payment', () => {
    const request = renewal();
    const before = JSON.stringify(byId(request.id));
    const onClose = vi.fn();
    open(request.id, onClose);
    press('I agree');
    signNow();
    wait(SIGN_MS + 50);
    press('Continue to payment');
    wait(400);
    expect(button(/^Pay QAR/)).toBeTruthy();
    act(() => (document.querySelector('dialog[open] button[aria-label="Close"]') as HTMLElement).click());
    expect(onClose).toHaveBeenCalledTimes(1);
    // Still on the request's page: it does not tell them to open the request.
    expect(text()).toContain('Not completed: the payment was not made, so your signature was not saved. You can start again whenever you are ready.');
    expect(text()).not.toContain('Open the request');
    expect(JSON.stringify(byId(request.id))).toBe(before);
  });

  it('renews once, with one receipt, when the screen changes while the payment is processing', () => {
    const request = renewal();
    const step = request.current;
    const receipts = () => world().docs.filter((doc) => doc.kind === 'receipt').length;
    const had = receipts();
    open(request.id);
    press('I agree');
    signNow();
    wait(SIGN_MS + 50);
    press('Continue to payment');
    wait(400);
    press(/^Pay QAR/);
    expect(text()).toContain('Processing the payment');
    wait(PAY_MS / 3);
    leave();
    expect(byId(request.id).current).not.toBe(step);
    expect(receipts()).toBe(had + 1);
    expect(text()).toMatch(/Paid\. Receipt.*is in Documents and passes\./);
    wait(PAY_MS * 3);
    expect(receipts()).toBe(had + 1);
    expect(byId(request.id).visits.filter((visit) => visit.step === step)).toHaveLength(1);
  });
});
