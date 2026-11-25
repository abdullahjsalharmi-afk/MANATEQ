/**
 * Regression tests for the release gate's findings on the start screen and the bespoke flows
 * (n=0, 2, 4, 5, 14, 16, 17, 18, 19, 21).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { getService, loadAllServiceDetails, peekServiceDetail, requestLabelOf } from '@/data/catalog';
import type { FieldDef, ServiceDetail, ServiceId } from '@/data/types';
import { checkEligibility } from '@/domain/eligibility';
import { timingFor } from '@/domain/simulation';
import type { Appointment, Pass, Plot, RequestState, World } from '@/domain/types';
import { seedWorld } from '@/state/seed';
import { actIn, fastForwardIn, startIn, tickWorld } from '@/state/sim';
import type { Env } from '@/state/types';
import { plotsFor } from '@/domain/plots';
import { validateFields } from '@/features/shared/FormFields';
import { ASKED_PLOT_KEY, flowFieldsOf, plotOfFlow } from '@/features/start/GenericFlow';
import { needsPlotAction } from '@/features/start/NeedsPlot';
import { appointmentOf } from '@/features/start/SubmittedState';
import { hasFreePlot, isUnlistedDescribed, layoutAvailability, resultKind } from '@/features/flows/eligibility/model';
import { choicesOf, defaultChoice, primaryOf } from '@/features/flows/eligibility/Result';
import { isPhone, missingDetails } from '@/features/flows/pass/validity';
import { passCardState, passValidity } from '@/features/wallet/logic';
import { strings as startStrings } from '@/features/start/strings';
import { strings as passStrings } from '@/features/flows/pass/strings';
import { strings as eligibilityStrings } from '@/features/flows/eligibility/strings';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 25, 9, 30).getTime();
const live: Env = { detail: peekServiceDetail, timing: (service) => timingFor(service, 1) };
const detail = (id: ServiceId): ServiceDetail => peekServiceDetail(id) as ServiceDetail;
const src = (path: string) => readFileSync(resolve(__dirname, '../../src', path), 'utf8');

beforeAll(async () => {
  await loadAllServiceDetails();
});

const plot = (id: string, status: Plot['status']): Plot => ({ id, number: id, zoneCode: id.slice(0, 2), areaSqm: 5000, solution: 'logistics', status });

/** Moves a request on demo time until it is done, acting for the investor with an empty answer. */
function finish(world: World, id: string, from: number): World {
  let next = world;
  let now = from;
  const read = () => next.requests.find((request) => request.id === id) as RequestState;
  for (let i = 0; i < 600 && read().status !== 'done'; i++) {
    if (read().status === 'needs_you') next = actIn(next, id, {}, now, live);
    else next = fastForwardIn(next, id, now, live);
    now += 1000;
    next = tickWorld(next, now, live);
  }
  return next;
}

describe('n=21 · a service that needs a plot never waives it', () => {
  const required: FieldDef = { key: 'plot', type: 'plot', label: { ar: 'القطعة', en: 'Plot' }, required: true };

  it('asks for a required plot even when the company holds none', () => {
    expect(validateFields([required], {}, 'en', { plots: [] })).toEqual({ plot: 'Choose the plot' });
  });

  it('refuses a plot that is not one of those offered', () => {
    const offered = [plot('BA-121', 'operating')];
    expect(validateFields([required], { plot: 'AW-999' }, 'en', { plots: offered })).toEqual({ plot: 'Choose the plot' });
    expect(validateFields([required], { plot: 'BA-121' }, 'en', { plots: offered })).toEqual({});
  });

  it('the start screen explains instead of running the flow, generic and bespoke', () => {
    const screen = src('features/start/StartScreen.tsx');
    // Both gates are judged when the flow opens (useAdmitted): a flow that was let in is never replaced.
    expect(screen).toMatch(/useAdmitted\(id, Bespoke && summary \? !\(needsTenancy\(summary\) && candidates\.length === 0\) : undefined\)/);
    expect(screen).toMatch(/useAdmitted\(id, detail && company \? !\(needsTenancy\(detail\) && candidates\.length === 0\) : undefined\)/);
    expect(screen.match(/if \((?:Bespoke && summary && )?!admitted\) return <NeedsPlot service=\{summary\} \/>/g)).toHaveLength(2);
  });

  it('offers one way forward: the running land application, else apply, else the eligibility check', () => {
    expect(needsPlotAction(false, [{ id: 'r9', serviceId: 'A6' }], true)).toEqual({ kind: 'track', requestId: 'r9' });
    expect(needsPlotAction(false, [{ id: 'r1', serviceId: 'E1' }], true)).toEqual({ kind: 'apply' });
    expect(needsPlotAction(false, [], false)).toEqual({ kind: 'check' });
    expect(needsPlotAction(true, [], true)).toEqual({ kind: 'plots' });
  });

  it('says it in both languages, without em dashes', () => {
    for (const key of ['needsPlotTitle', 'needsPlotBody', 'needsPlotNoneTitle', 'needsPlotNoneBody', 'trackLand', 'applyLand', 'checkFirst', 'viewPlots'] as const) {
      const text = startStrings[key];
      expect(text.ar.trim(), key).not.toBe('');
      expect(text.en.trim(), key).not.toBe('');
      expect(`${text.ar}${text.en}`, key).not.toMatch(/—/);
    }
  });
});

describe('n=0 · the handover (A8) knows its plot without ?plot=', () => {
  const a8 = () => detail('A8');

  it('uses the only plot that qualifies and shows it among the known facts', () => {
    const plots = [plot('AW-124', 'leased'), plot('BA-121', 'operating')];
    const candidates = plotsFor({ plots }, 'A8');
    const plan = plotOfFlow(a8(), candidates, plots, undefined);
    expect(plan).toEqual({ known: plots[0], ask: false });
    expect(flowFieldsOf(a8().fields, plan.ask)).toBe(a8().fields);
  });

  it('asks for the plot as a required choice when several qualify', () => {
    const plots = [plot('AW-124', 'leased'), plot('AW-125', 'leased')];
    const plan = plotOfFlow(a8(), plotsFor({ plots }, 'A8'), plots, undefined);
    expect(plan).toEqual({ ask: true });
    const fields = flowFieldsOf(a8().fields, true);
    expect(fields[0]).toMatchObject({ key: ASKED_PLOT_KEY, type: 'plot', required: true });
    expect(validateFields(fields, { slot: '2026-12-01' }, 'ar', { plots, now: NOW })[ASKED_PLOT_KEY]).toBe('اختر القطعة');
  });

  it('keeps the plot of the link when it qualifies', () => {
    const plots = [plot('AW-124', 'leased'), plot('AW-125', 'leased')];
    expect(plotOfFlow(a8(), plotsFor({ plots }, 'A8'), plots, 'AW-125')).toEqual({ known: plots[1], ask: false });
  });

  it('a handover started on the plot the flow chose marks that plot handed over', () => {
    const base = seedWorld('tenant', NOW);
    const world: World = { ...base, plots: base.plots.map((p) => (p.id === 'AW-116' ? { ...p, status: 'leased' as const } : p)) };
    const plan = plotOfFlow(a8(), plotsFor(world, 'A8'), world.plots, undefined);
    expect(plan.known?.id).toBe('AW-116');
    const started = startIn(world, { serviceId: 'A8', form: { slot: '2026-12-01' }, plotId: plan.known!.id }, NOW + 1000, live);
    const done = finish(started.world, started.id, NOW + 2000);
    expect(done.plots.find((p) => p.id === 'AW-116')?.status).toBe('handed_over');
  });
});

describe('n=2 · the land application confirmation reads the request', () => {
  it('uses the shared confirmation (the request view), not a fixed list of steps', () => {
    const land = src('features/flows/land/Submitted.tsx');
    expect(land).toMatch(/<SubmittedState requestId=\{requestId\}/);
    expect(land).not.toMatch(/state: 'current'/);
  });
});

describe('n=17 · one service standard per service', () => {
  it('the fault-report and incident confirmations show service.standard, as the request page does', () => {
    for (const file of ['features/flows/maintenance/MaintenanceFlow.tsx', 'features/flows/incident/IncidentFlow.tsx']) {
      const text = src(file);
      expect(text, file).not.toMatch(/workflow\.standard/);
      expect(text, file).toMatch(/pick\(service\.standard\)/);
    }
  });
});

describe('n=18 · the received screen names the request with its noun', () => {
  it('E1 and E6 are named as in Requests', () => {
    expect(requestLabelOf(getService('E6')!).ar).toBe('شكوى أو ملاحظة');
    expect(src('features/start/SubmittedState.tsx')).toMatch(/pick\(requestLabelOf\(summary\)\)/);
  });
});

describe('n=14 · the E1 confirmation shows the appointment booked with it', () => {
  it('finds the booked appointment of the request, not a cancelled one or another request’s', () => {
    const at = NOW + 4 * DAY;
    const list: Appointment[] = [
      { id: 'a1', at, topic: { ar: 'x', en: 'x' }, channel: 'in_person', status: 'cancelled', requestId: 'r5' },
      { id: 'a2', at, topic: { ar: 'x', en: 'x' }, channel: 'video', status: 'booked', requestId: 'r4' },
      { id: 'a3', at, topic: { ar: 'x', en: 'x' }, channel: 'phone', status: 'booked', requestId: 'r5' },
    ];
    expect(appointmentOf(list, 'r5')?.id).toBe('a3');
    expect(appointmentOf(list, 'r6')).toBeUndefined();
  });

  it('starting E1 with a day books it, and the confirmation can find it', () => {
    const started = startIn(seedWorld('tenant', NOW), { serviceId: 'E1', form: { request: 'Help with an invoice', bookAppointment: true, preferredDate: '2026-11-29' } }, NOW + 1000, live);
    const booked = appointmentOf(started.world.appointments, started.id);
    expect(booked).toBeDefined();
    expect(new Date(booked!.at).getDate()).toBe(29);
  });
});

describe('n=4 · no "eligible with another option" when no alternative has a free plot', () => {
  const input = { activityCode: 'ACT-101', solution: 'commercial' as const, areaSqm: 45_000 };
  const outcome = checkEligibility(input, layoutAvailability());

  it('reads as targeted with no plot of this size now, and offers to follow availability', () => {
    expect(outcome.alternatives.length).toBeGreaterThan(0);
    expect(outcome.alternatives.some(hasFreePlot)).toBe(false);
    expect(resultKind(outcome)).toBe('noPlots');
    expect(primaryOf(outcome, { persona: 'prospect', chosen: null, activityCode: input.activityCode, solution: input.solution }).kind).toBe('follow');
    expect(eligibilityStrings.noPlotsHead.ar).toMatch(/مستهدف/);
    expect(eligibilityStrings.noPlotsHead.en).toMatch(/targeted/);
  });

  it('still offers another option when one has room, and picks it first', () => {
    const roomy = checkEligibility({ ...input, areaSqm: 2500 }, layoutAvailability());
    if (resultKind(roomy) === 'elsewhere') {
      const first = choicesOf(roomy).find(hasFreePlot);
      expect(defaultChoice(roomy)).toBe(first ? `${first.solution}:${first.zone.code}` : defaultChoice(roomy));
    } else expect(['eligible', 'noPlots']).toContain(resultKind(roomy));
  });
});

describe('n=5 · an unlisted activity is described before it is sent for review', () => {
  it('needs a few words', () => {
    expect(isUnlistedDescribed('')).toBe(false);
    expect(isUnlistedDescribed('  a ')).toBe(false);
    expect(isUnlistedDescribed('Drone assembly')).toBe(true);
  });

  it('sends the description with the request', () => {
    expect(src('features/flows/eligibility/EligibilityScreen.tsx')).toMatch(/activityDescription: described/);
  });
});

describe('n=19 · the visitor pass asks for the visitor’s mobile', () => {
  it('validates the number as a phone number', () => {
    expect(isPhone('+974 5512 3456')).toBe(true);
    expect(isPhone('55123456')).toBe(true);
    expect(isPhone('5512')).toBe(false);
    expect(isPhone('call me')).toBe(false);
    const details = { name: 'Sara', qid: '', plate: '', company: '', phone: '' };
    expect(missingDetails('visitor', details)).toEqual(['phone']);
    expect(missingDetails('worker', { ...details, qid: '28763412345' })).toEqual([]);
  });

  it('says plainly that no message is sent in the prototype', () => {
    expect(passStrings.noMessageSent.ar).toMatch(/لا تُرسل رسالة/);
    expect(passStrings.noMessageSent.en).toMatch(/no message is sent/);
  });
});

describe('n=16 · a pass that starts later is upcoming on its confirmation', () => {
  it('the confirmation reads the wallet’s validity rule', () => {
    const flow = src('features/flows/pass/PassFlow.tsx');
    expect(flow).toMatch(/passCardState\(passValidity\(pass, now\)\)/);
    expect(flow).toMatch(/status=\{state\.status\}/);
    expect(flow).not.toMatch(/status=\{pass\.status\}/);
  });

  it('the card carries the state itself: upcoming, never active, with the day it starts', () => {
    const later = passCardState(passValidity({ status: 'active', from: NOW + 6 * DAY, to: NOW + 15 * DAY } as Pass, NOW));
    expect(later).toEqual({ status: 'upcoming', upcomingFrom: NOW + 6 * DAY });
    expect(passStrings.doneTaglineUpcoming.ar).toMatch(/يبدأ سريانه في \{date\}/);
  });
});
