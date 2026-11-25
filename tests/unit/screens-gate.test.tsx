/**
 * Regression tests for the release gate's findings on the screens (packet "screens"). Each block names the
 * finding it pins. The screens' rules are pure helpers; they run here on the seeded worlds, as the app does.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { makeFormatters } from '@/app/i18n';
import { loadAllServiceDetails, peekServiceDetail } from '@/data/catalog';
import type { L10n } from '@/data/types';
import { journeyOf } from '@/domain/journey';
import { timingFor } from '@/domain/simulation';
import type { AppNotification, Pass, RequestState } from '@/domain/types';
import { itemRoute, itemWords } from '@/features/home/logic';
import { strings as homeStrings } from '@/features/home/strings';
import { notificationLook } from '@/features/notifications/look';
import { strings as noteStrings } from '@/features/notifications/strings';
import { paidToastText } from '@/features/payments/paidToast';
import { strings as payStrings } from '@/features/payments/strings';
import { ratingFacts, renewalLines } from '@/features/requests/logic';
import { strings as requestStrings } from '@/features/requests/strings';
import { passCardState, passValidity } from '@/features/wallet/logic';
import { renewalTerms } from '@/state/effects';
import { seedWorld } from '@/state/seed';
import { cancelIn, payInvoiceIn } from '@/state/sim';
import type { Env } from '@/state/types';

const NOW = new Date(2026, 10, 25, 9, 30).getTime();
const DAY = 86_400_000;
const live: Env = { detail: peekServiceDetail, timing: (service) => timingFor(service, 1) };
const plain = (text: string): string => text.replace(/[⁠⁦⁩]/g, '').replace(/ /g, ' ');

/** A `t` over one strings table, as `useT` gives it. */
function tOf<T extends Record<string, L10n>>(table: T, lang: 'ar' | 'en') {
  return (key: keyof T & string, vars: Record<string, string | number> = {}): string =>
    Object.entries(vars).reduce((text, [name, value]) => text.split(`{${name}}`).join(String(value)), table[key]![lang]);
}

beforeAll(async () => {
  await loadAllServiceDetails();
});

describe('n=3, n=6 · a settled "needs you" notification reads as done', () => {
  const base: Pick<AppNotification, 'kind' | 'read' | 'resolvedAt'> = { kind: 'action', read: false };

  it('an open ask is "Needs you", unread and in the accent', () => {
    expect(notificationLook(base)).toMatchObject({ label: 'kindAction', asking: true, unread: true, settled: false });
  });

  it('a settled ask is "Done", with a quiet check, never unread', () => {
    const look = notificationLook({ ...base, resolvedAt: NOW });
    expect(look).toMatchObject({ label: 'kindSettled', asking: false, unread: false, settled: true });
    expect(look.icon.displayName ?? '').not.toMatch(/Bell/);
    expect(noteStrings.kindSettled).toEqual({ ar: 'تم', en: 'Done' });
  });

  it('paying the invoice settles its reminder in the seeded world', () => {
    const world = seedWorld('tenant', NOW);
    const due = world.invoices.find((invoice) => invoice.status !== 'paid');
    expect(due).toBeDefined();
    const paid = payInvoiceIn(world, due!.id, NOW + 1000).world;
    const asks = paid.notifications.filter((note) => note.kind === 'action' && note.subject?.invoiceId === due!.id);
    expect(asks.length).toBeGreaterThan(0);
    for (const note of asks) expect(notificationLook(note).label).toBe('kindSettled');
  });
});

describe('n=8, n=12 · the Home journey checklist', () => {
  it('labels an item with nothing open as next, not in progress', () => {
    expect(itemWords({ serviceId: 'C1', state: 'current', open: false, canStart: false }).status).toEqual(['itemNext']);
    expect(itemWords({ serviceId: 'C3', state: 'current', open: true, requestId: 'r1', canStart: false }).status).toEqual(['itemCurrent']);
  });

  it('says a withdrawn request was closed and links to it', () => {
    const world = cancelIn(seedWorld('tenant', NOW), 'r95', NOW + 1000, live);
    const build = journeyOf(world).stations.find((station) => station.key === 'build');
    const permit = build?.items.find((item) => item.serviceId === 'C2');
    expect(permit).toMatchObject({ open: false, stoppedRequestId: 'r95' });
    const words = itemWords(permit!);
    expect(words.status).toContain('itemClosed');
    expect(words.status).not.toContain('itemCurrent');
    expect(itemRoute(permit!)).toBe('/requests/r95');
  });

  it('keeps the start for an item that can be started again, and links the closed request beside it', () => {
    const words = itemWords({ serviceId: 'C1', state: 'current', open: false, canStart: true, stoppedRequestId: 'r9' });
    expect(words).toEqual({ name: 'cta', status: ['itemNext', 'itemClosed', 'itemStartAgain'], closedLink: '/requests/r9' });
  });

  it('names a finished or running request with its noun, the call to action only for what can be started', () => {
    expect(itemWords({ serviceId: 'C1', state: 'done', open: false, requestId: 'r88', canStart: false }).name).toBe('noun');
    expect(itemWords({ serviceId: 'C1', state: 'current', open: true, requestId: 'r88', canStart: false }).name).toBe('noun');
    expect(itemWords({ serviceId: 'C1', state: 'current', open: false, canStart: true }).name).toBe('cta');
  });

  it('has the new words in both languages', () => {
    for (const key of ['itemNext', 'itemClosed', 'itemStartAgain', 'itemClosedLink'] as const) {
      expect(homeStrings[key].ar).toBeTruthy();
      expect(homeStrings[key].en).toBeTruthy();
    }
  });
});

describe('n=10 · the renewal sheet shows what is agreed', () => {
  it('lists the new end date, the term, the rate, the yearly rent and the first instalment', () => {
    const world = seedWorld('tenant', NOW);
    const request = world.requests.find((candidate) => candidate.id === 'r85') as RequestState;
    const terms = renewalTerms(world, request);
    expect(terms).toBeDefined();
    const fmt = makeFormatters('en');
    const lines = renewalLines(terms!, fmt, tOf(requestStrings, 'en'), true);
    expect(lines.map((line) => line.label)).toEqual(['Renewed lease ends on', 'Renewal term', 'Rate', 'Yearly rent', 'First instalment']);
    expect(plain(lines[0]!.value)).toBe(plain(fmt.date(terms!.until)));
    expect(lines[1]!.value).toMatch(/^\d+ years?$/);
    expect(plain(lines[2]!.value)).toContain(plain(fmt.money(terms!.ratePerSqm)));
    expect(plain(lines[4]!.value)).toBe(plain(fmt.money(terms!.firstInstalment)));
    // The payment line of the sheet already shows the instalment: it is not repeated.
    expect(renewalLines(terms!, fmt, tOf(requestStrings, 'en'), false)).toHaveLength(4);
  });

  it('never mentions incentives', () => {
    for (const lang of ['ar', 'en'] as const) {
      const text = ['renewIntro', 'renewUntil', 'renewTerm', 'renewRate', 'renewRent', 'renewFirst'].map((key) => requestStrings[key as keyof typeof requestStrings][lang]).join(' ');
      expect(text).not.toMatch(/incentive|حوافز|الحوافز/i);
    }
  });
});

describe('n=11 · one toast after any payment', () => {
  it('names the receipt and the place by the title of its screen, with one verb', () => {
    const en = paidToastText(tOf(payStrings, 'en'), makeFormatters('en'), 'RCP-2026-0101');
    const ar = paidToastText(tOf(payStrings, 'ar'), makeFormatters('ar'), 'RCP-2026-0101');
    expect(plain(en)).toBe('Paid. Receipt RCP-2026-0101 is in Documents and passes.');
    expect(plain(ar)).toBe('تم الدفع. الإيصال RCP-2026-0101 في «وثائقي وتصاريحي».');
    expect(plain(paidToastText(tOf(payStrings, 'en'), makeFormatters('en'), undefined))).toBe('Paid. The receipt is in Documents and passes.');
  });

  it('no screen of the packet calls the place a wallet or uses another verb', () => {
    for (const table of [payStrings, requestStrings, homeStrings] as Record<string, L10n>[]) {
      for (const value of Object.values(table)) {
        expect(value.ar).not.toMatch(/محفظ|تم السداد/);
        expect(value.en).not.toMatch(/\bwallet\b/i);
      }
    }
  });
});

describe('n=15 · a low rating reopened the fault report', () => {
  const low = { stars: 1, comment: 'Still dark' };

  it('says so while it is open again, naming the supervisor while they hold it', () => {
    const request = { status: 'active' as const, rating: low, reopenedAt: NOW, reopenedRating: low };
    expect(ratingFacts(request, 'staff', null)).toMatchObject({ reopened: 'reopenedSupervisor', ratingNote: 'ratingReopenedThis', askAgain: false });
    expect(ratingFacts(request, 'field', null).reopened).toBe('reopened');
  });

  it('asks for a new rating when the workflow comes back to the rating step', () => {
    const request = { status: 'needs_you' as const, rating: low, reopenedAt: NOW, reopenedRating: low };
    expect(ratingFacts(request, 'inv', { flow: ['rate'] })).toMatchObject({ askAgain: true, reopened: undefined });
  });

  it('shows the latest rating and which one reopened the report', () => {
    const done = { status: 'done' as const, rating: { stars: 5 }, reopenedAt: NOW, reopenedRating: low };
    expect(ratingFacts(done, undefined, null)).toMatchObject({ reopened: undefined, rating: { stars: 5 }, ratingNote: 'ratingReopenedEarlier' });
    expect(ratingFacts({ status: 'done', rating: { stars: 4 } }, undefined, null)).toMatchObject({ rating: { stars: 4 }, ratingNote: undefined });
  });
});

describe('n=16 · a pass that starts later is upcoming, with its start date', () => {
  it('carries the start date to the pass page', () => {
    const pass = { status: 'active', from: NOW + 6 * DAY, to: NOW + 15 * DAY } as Pass;
    const state = passCardState(passValidity(pass, NOW));
    expect(state.upcomingFrom).toBe(NOW + 6 * DAY);
    expect(passCardState(passValidity({ ...pass, from: NOW - DAY }, NOW)).upcomingFrom).toBeUndefined();
  });
});

describe('copy rules for the strings this packet added', () => {
  const added: [Record<string, L10n>, string[]][] = [
    [noteStrings, ['kindSettled']],
    [homeStrings, ['itemNext', 'itemClosed', 'itemStartAgain', 'itemClosedLink']],
    [payStrings, ['paidToast', 'paidToastPlain']],
    [requestStrings, ['renewIntro', 'renewUntil', 'renewTerm', 'renewRate', 'renewRateValue', 'renewRent', 'renewFirst', 'reopenedSupervisor', 'reopened', 'ratingTitle', 'ratingStars', 'ratingReopenedThis', 'ratingReopenedEarlier', 'rateAgain']],
  ];
  it('exist in both languages, with no em dash and never "case" or "ticket"', () => {
    for (const [table, keys] of added) {
      for (const key of keys) {
        const value = table[key];
        expect(value?.ar, key).toBeTruthy();
        expect(value?.en, key).toBeTruthy();
        expect(`${value!.ar} ${value!.en}`).not.toMatch(/—|\bcase\b|\bticket\b/i);
        expect(value!.ar).not.toMatch(/[٠-٩]/);
      }
    }
  });
});
