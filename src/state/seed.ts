/**
 * First-run state and the demo worlds of each persona.
 * Everything here is illustrative: invented companies, plots, amounts and dates.
 *
 * A persona's history is not written by hand. It is replayed: the same reducers the app uses
 * (`sim.ts`) run the real workflows on calendar time, with the investor's part scripted — apply for
 * a plot six weeks ago, accept the offer the next day, sign, book the handover … — so every seeded
 * request is a true engine state and every document, invoice and notification is what the app itself
 * would have produced. All dates are relative to `now`.
 */
import { getActivity, peekServiceDetail } from '@/data/catalog';
import type { L10n, ServiceDetail, ServiceId, WorkflowStep } from '@/data/types';
import { leaseContractDoc } from '@/domain/documents';
import { pathScale, stepDays } from '@/domain/simulation';
import { checkEligibility, toEligibilityResult } from '@/domain/eligibility';
import { plotsFor } from '@/domain/plots';
import type { AppState, Company, EligibilityResult, Invoice, Lease, Persona, Plot, RequestState, Settings, TeamMember, World } from '@/domain/types';
import { currentStep, currentVisit, findStep, mainPath, waitsForInvestor, type Timing } from '@/domain/workflow';
import { addPass, issueRentInvoice, settleInvoice } from './effects';
import { allocate, invoiceRef } from './refs';
import { actIn, bookAppointmentIn, dueAtOf, holdIn, startIn, tickWorld, type StartInput } from './sim';
import { dateText, dots, fill, moneyText, rentTitle, text } from './strings';
import type { ActPayload, Env, PendingWorld } from './types';
import { DAY, HOUR, MINUTE, PAYMENT_TERM_MS, addDocs, addYears, annualRentOf, docFacts, findRequest, isFinished, isOpen, notify, periodRentOf, rateOf, startOfDay } from './world';

/** Bump when the saved shape changes; older saves are discarded on load. */
export const STATE_VERSION = 3;

export function initialSettings(): Settings {
  return { lang: 'ar', theme: 'auto', textSize: 1, onboarded: false, notifications: true };
}

export function emptyWorld(persona: Persona = 'guest'): World {
  return {
    persona,
    company: null,
    team: [],
    plots: [],
    leases: [],
    requests: [],
    invoices: [],
    docs: [],
    passes: [],
    notifications: [],
    appointments: [],
    drafts: {},
    eligibility: null,
    watchedZones: [],
    seq: 40,
  };
}

export function initialState(): AppState {
  return { version: STATE_VERSION, settings: initialSettings(), world: emptyWorld('guest'), demo: { speed: 1 } };
}

/* ───────────────────────────── calendar time ───────────────────────────── */

/**
 * How long steps take in a seeded history: a working day of the story is a real day, a part of a day
 * is that part of eight working hours, and an "instant" step takes about a minute. Gates decide at once.
 */
export function calendarTiming(service: Pick<ServiceDetail, 'standard' | 'workflow'>): Timing {
  const scale = pathScale(service);
  return {
    duration(step) {
      if (step.kind === 'gate') return 2000;
      const days = stepDays(step) * scale;
      if (days <= 0) return 30_000 + ((step.id * 7) % 5) * 15_000;
      const whole = Math.floor(days);
      return whole * DAY + Math.round((days - whole) * 8 * HOUR);
    },
  };
}

const calendarEnv: Env = { detail: peekServiceDetail, timing: calendarTiming };

/** A time of day on the day `days` away from `now` (negative: in the past), on this device's clock. */
function dayAt(now: number, days: number, hour: number, minute = 0): number {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
}

/** How long the scripted investor takes to answer a step that opens after their planned time. */
const INVESTOR_DELAY_MS = 20 * MINUTE;

/**
 * A small script runner over the pure reducers: the world it holds moves forward call by call.
 * It makes no assumption about the shape of a workflow — the investor's part is played step by step,
 * whatever the steps are — and it never writes a time later than `now`.
 */
function story(initial: World, env: Env, now: number) {
  let world = initial;
  const read = (id: string | undefined) => (id === undefined ? undefined : findRequest(world, id));
  const stepOf = (request: RequestState): WorkflowStep | undefined => {
    const service = env.detail(request.serviceId);
    return service ? currentStep(service.workflow, request) : undefined;
  };

  /**
   * Lets one request move until it finishes, `stop` accepts the step it is on, or the next move would
   * be in the future. The investor's steps are completed on the way: the first at `playAt`, later ones
   * shortly after they open. Without `playAt` the request stops at the first step that needs the investor.
   */
  const advance = (id: string, options: { stop?: (step: WorkflowStep) => boolean; playAt?: number; payload?: ActPayload }): void => {
    let playAt = options.playAt;
    for (let guard = 0; guard < 300; guard++) {
      const request = read(id);
      const service = request ? env.detail(request.serviceId) : undefined;
      if (!request || !service || isFinished(request)) return;
      const step = stepOf(request);
      if (step && options.stop?.(step)) return;

      if (request.status === 'needs_you') {
        if (playAt === undefined) return;
        const opened = currentVisit(request)?.enteredAt ?? playAt;
        const at = Math.max(playAt, opened + INVESTOR_DELAY_MS);
        if (at >= now) return;
        world = actIn(world, id, options.payload ?? {}, at, env);
        playAt = at + 2 * MINUTE;
        continue;
      }

      const due = dueAtOf(request, service, env.timing(service));
      if (due === undefined || due >= now) return;
      world = tickWorld(world, due, env);
    }
  };

  return {
    get world(): World {
      return world;
    },
    set world(next: World) {
      world = next;
    },
    /** Starts a request, unless the moment is not in the past. */
    start(input: StartInput, at: number): string | undefined {
      if (at >= now) return undefined;
      const started = startIn(world, input, at, env);
      world = started.world;
      return started.id;
    },
    /** The request the given one started by itself (application → review → offer …), once it exists. */
    follower(parentId: string | undefined, serviceId: ServiceId): string | undefined {
      return world.requests.find((request) => request.parentId === parentId && request.serviceId === serviceId)?.id;
    },
    /** When the request finished with its usual outcome, or undefined. */
    doneAt(id: string | undefined): number | undefined {
      const request = read(id);
      return request?.status === 'done' ? request.updatedAt : undefined;
    },
    /** Runs a request to its end, playing the investor from `at` on. */
    complete(id: string | undefined, at: number, payload?: ActPayload): void {
      if (id !== undefined) advance(id, { playAt: at, ...(payload ? { payload } : {}) });
    },
    /**
     * Runs a request (playing the investor from `at` on) to the first step `where` accepts and holds
     * it there until `until`, so the demo opens on that moment. A request that never gets there is
     * left wherever it stands.
     */
    park(id: string | undefined, where: (step: WorkflowStep) => boolean, until: number, at?: number, payload?: ActPayload): void {
      if (id === undefined) return;
      const stop = (step: WorkflowStep) => !waitsForInvestor(step) && where(step);
      advance(id, { stop, ...(at !== undefined ? { playAt: at } : {}), ...(payload ? { payload } : {}) });
      const request = read(id);
      const step = request ? stepOf(request) : undefined;
      if (request && step && isOpen(request) && stop(step)) world = holdIn(world, id, until);
    },
    until(at: number): void {
      world = tickWorld(world, Math.min(at, now), env);
    },
  };
}

/* ───────────────────────────── people and companies ───────────────────────────── */

/** People of the demo are plainly illustrative: a role and the word «تجريبي» / "demo", never a real-looking name. */
const demoName = (ar: string, en: string): L10n => ({ ar: `${ar} تجريبي`, en: `Demo ${en}` });

const SIGNATORY = { name: demoName('مستثمر', 'investor'), role: { ar: 'المالك والمفوَّض بالتوقيع', en: 'Owner and authorised signatory' } };

const OWNER: TeamMember = { id: 'm1', name: SIGNATORY.name, role: { ar: 'المالك · كل الصلاحيات', en: 'Owner · full access' }, scope: 'owner', delegated: true };

const TENANT_TEAM: TeamMember[] = [
  OWNER,
  { id: 'm2', name: demoName('محاسب', 'accountant'), role: { ar: 'الفواتير والسداد', en: 'Invoices and payments' }, scope: 'finance', delegated: true },
  { id: 'm3', name: demoName('مهندس', 'engineer'), role: { ar: 'التصاميم والتراخيص', en: 'Designs and permits' }, scope: 'engineering', delegated: true },
  { id: 'm4', name: demoName('مشرف عمليات', 'operations lead'), role: { ar: 'تصاريح الدخول والبلاغات', en: 'Gate passes and reports' }, scope: 'operations', delegated: false },
];

function company(name: L10n, cr: string, activityCode: string, fallbackActivity: L10n, syncedAt: number): Company {
  return { name, cr, activity: getActivity(activityCode)?.name ?? fallbackActivity, activityCode, signatory: SIGNATORY, syncedAt };
}

/* ───────────────────────────── prospect ───────────────────────────── */

/** The prospect's one saved eligibility check: dry warehousing and distribution on 5,000 m² of logistics land. */
function savedCheck(at: number): EligibilityResult {
  const input = { activityCode: PROSPECT_ACTIVITY, solution: 'logistics', areaSqm: 5000 } as const;
  const free = (zoneCode: string, areaSqm: number) => plotsFor(zoneCode).filter((cell) => cell.status === 'available' && cell.areaSqm >= areaSqm).length;
  return toEligibilityResult(input, checkEligibility(input, free), at);
}

const PROSPECT_ACTIVITY = 'ACT-501';

function prospectWorld(now: number): World {
  const world: World = {
    ...emptyWorld('prospect'),
    company: company({ ar: 'شركة النموذج للتجارة', en: 'Sample Trading Co.' }, '123456', PROSPECT_ACTIVITY, { ar: 'التخزين الجاف والتوزيع', en: 'Dry warehousing and distribution' }, now - 5 * MINUTE),
    team: [OWNER],
    eligibility: savedCheck(now - 3 * MINUTE),
  };
  return notify(world, {
    at: now - 4 * MINUTE,
    kind: 'info',
    title: { ar: 'ملف شركتك موثّق', en: 'Your company profile is verified' },
    body: {
      ar: 'جلبنا بيانات السجل التجاري والمفوَّضين بالتوقيع عنك؛ لن نطلبها منك مرة أخرى.',
      en: 'We fetched your commercial registration and authorised signatories for you; we will not ask for them again.',
    },
    route: '/account/company',
  });
}

/* ───────────────────────────── tenant ───────────────────────────── */

/** Services the tenant's history runs through; their workflows must be in memory to build it. */
const TENANT_SERVICES: ServiceId[] = ['A4', 'A5', 'A6', 'A7', 'A8', 'B2', 'B3', 'B8', 'C1', 'C2', 'C4', 'D1', 'D2'];

/** The tenant's three plots, each one of its zone's layout (`plotsFor`) and shown there as allocated. */
const BA_PLOT = 'BA-121';
const AW_PLOT = 'AW-116';
const AK_YARD = 'AK-113';

/** A plot the company already holds, with its lease and signed contract. */
function withLeasedPlot(world: World, plot: Omit<Plot, 'leaseId'>, startsAt: number, years: number, refNumber: string): World {
  const leaseSlot = allocate(world, 'ls');
  const lease: Lease = {
    id: leaseSlot.id,
    ref: `LC-${new Date(startsAt).getFullYear()}-${refNumber}`,
    plotId: plot.id,
    startsAt,
    endsAt: addYears(startsAt, years) - DAY,
    ratePerSqmYear: rateOf(plot.solution),
    annualRent: annualRentOf(plot.solution, plot.areaSqm),
    status: 'active',
  };
  let next: World = { ...leaseSlot.world, plots: [...leaseSlot.world.plots, { ...plot, leaseId: lease.id }], leases: [...leaseSlot.world.leases, lease] };
  const docSlot = allocate(next, 'd');
  next = addDocs(docSlot.world, [leaseContractDoc({ id: docSlot.id, ref: lease.ref }, lease, docFacts(docSlot.world, plot.id), startsAt)]);
  return next;
}

/** A rent invoice of the past, already paid, with its receipt. */
function withPaidRent(world: World, plotId: string, issuedAt: number, paidAt: number): World {
  const plot = world.plots.find((candidate) => candidate.id === plotId);
  const lease = world.leases.find((candidate) => candidate.plotId === plotId);
  if (!plot || !lease) return world;
  const slot = allocate(world, 'inv');
  const invoice: Invoice = {
    id: slot.id,
    ref: invoiceRef(slot.seq, issuedAt),
    title: rentTitle(plot.solution === 'openYard' ? 'year' : 'quarter', issuedAt, plot.number),
    leaseId: lease.id,
    amount: periodRentOf(plot.solution, lease.annualRent),
    issuedAt,
    dueAt: issuedAt + PAYMENT_TERM_MS,
    status: 'due',
  };
  return settleInvoice({ ...slot.world, invoices: [...slot.world.invoices, invoice] }, invoice.id, paidAt).world;
}

/** What the company held before the history below: its people, two plots in operation and their accounts. */
function tenantBase(now: number): World {
  let world: World = {
    ...emptyWorld('tenant'),
    company: company(
      { ar: 'شركة المثال للصناعات', en: 'Example Industries Co.' },
      '654321',
      'ACT-301',
      { ar: 'تشكيل المعادن', en: 'Metal fabrication' },
      now - 2 * HOUR,
    ),
    team: TENANT_TEAM,
    watchedZones: ['AW'],
  };

  // BA-121: a logistics plot of 10,000 m² in operation for five years, on a 25-year lease invoiced each quarter.
  const baStart = new Date(new Date(now).getFullYear() - 5, 3, 1).getTime();
  world = withLeasedPlot(world, { id: BA_PLOT, number: BA_PLOT, zoneCode: 'BA', areaSqm: 10000, solution: 'logistics', status: 'operating' }, baStart, 25, '0318');

  // AK-113: an open yard on a one-year lease that ends in about a hundred days.
  const yardEnd = startOfDay(now) + 100 * DAY;
  const yardStart = addYears(yardEnd + DAY, -1);
  world = withLeasedPlot(world, { id: AK_YARD, number: AK_YARD, zoneCode: 'AK', areaSqm: 5000, solution: 'openYard', status: 'operating' }, yardStart, 1, '0077');
  world = withPaidRent(world, AK_YARD, yardStart - 14 * DAY, yardStart - 3 * DAY);

  // BA-121's last three quarters: two paid, one due in five days.
  const dueSoon = now + 5 * DAY;
  const issuedLatest = dueSoon - PAYMENT_TERM_MS;
  world = withPaidRent(world, BA_PLOT, issuedLatest - 182 * DAY, issuedLatest - 182 * DAY + 21 * DAY);
  world = withPaidRent(world, BA_PLOT, issuedLatest - 91 * DAY, issuedLatest - 91 * DAY + 26 * DAY);
  const ba = world.plots.find((plot) => plot.id === BA_PLOT);
  const baLease = world.leases.find((lease) => lease.plotId === BA_PLOT);
  if (ba && baLease) {
    world = issueRentInvoice(world, baLease, ba, issuedLatest);
    // The notification of that invoice is weeks old; the reminder below is the one that matters now.
    world = { ...world, notifications: [] };
  }
  return world;
}

/**
 * On the usual path of a workflow, the last step held by a national entity that names the given
 * integration; failing that, the first national step.
 */
function nationalStep(service: ServiceDetail | undefined, integration: string): number | undefined {
  if (!service) return undefined;
  const usual = mainPath(service.workflow)
    .map((id) => findStep(service.workflow, id))
    .filter((step): step is WorkflowStep => step !== undefined && step.lane === 'nat');
  const named = usual.filter((step) => step.enablers.includes(integration));
  return (named[named.length - 1] ?? usual[0])?.id;
}

/** The last seven weeks, replayed: a third plot from application to building, and the daily business of the other two. */
function tenantHistory(base: World, now: number): World {
  const tale = story(base, calendarEnv, now);
  const ago = (days: number, hour: number, minute = 0) => dayAt(now, -days, hour, minute);
  const after = (planned: number, earlier: number | undefined, gap: number) => (earlier === undefined ? planned : Math.max(planned, earlier + gap));

  // AW-116: applied for 46 days ago; evaluated, offered, signed and handed over since.
  const application = tale.start(
    {
      serviceId: 'A4',
      plotId: AW_PLOT,
      zoneCode: 'AW',
      form: {
        detailsConfirmed: true,
        area: 5000,
        areaSqm: 5000,
        solution: 'logistics',
        preferredPlot: AW_PLOT,
        businessPlan: { name: 'business-plan.pdf', size: 1_240_000 },
        financials: { name: 'financial-statements.pdf', size: 860_000 },
      },
    },
    ago(46, 9, 12),
  );
  tale.complete(application, ago(46, 9, 30));
  const review = tale.follower(application, 'A5');
  tale.complete(review, ago(45, 9, 0));
  const offer = tale.follower(review, 'A6');
  tale.complete(offer, ago(43, 10, 5));
  const contract = tale.follower(offer, 'A7');
  tale.complete(contract, ago(43, 14, 30));
  const signedAt = tale.doneAt(contract);

  const guarantee = tale.follower(contract, 'B2');
  tale.complete(guarantee, ago(41, 11, 0), { choice: 'guarantee', files: [{ name: 'bank-guarantee.pdf', size: 310_000 }] });

  let handover: string | undefined;
  if (signedAt !== undefined) {
    const booked = after(ago(40, 8, 40), signedAt, HOUR);
    handover = tale.start(
      { serviceId: 'A8', plotId: AW_PLOT, threadId: application, parentId: contract, form: { slot: booked + 20 * MINUTE, representative: { name: 'ممثل موقع تجريبي · Demo site representative' } } },
      booked,
    );
    tale.complete(handover, booked + 4 * HOUR);
  }
  const handedOverAt = tale.doneAt(handover);

  // The utilities request opened by itself at handover; the consultant applied to Kahramaa and recorded the references.
  const utilities = tale.follower(handover, 'C4');
  tale.park(utilities, (step) => step.lane === 'nat', now + 9 * DAY, ago(38, 10, 0), { form: { reference: 'KM-DEMO-0116', designLoad: 850 } });

  // A certificate for the bank, for the plot in operation.
  const certificate = tale.start({ serviceId: 'B8', plotId: BA_PLOT, form: { docType: 'toWhomItMayConcern', plot: BA_PLOT } }, ago(40, 13, 15));
  tale.complete(certificate, ago(40, 13, 40));

  // The first rent of AW-116, paid before it fell due.
  const firstRent = tale.world.invoices.find((invoice) => invoice.requestId === contract && invoice.status === 'due');
  if (firstRent) {
    const paidAt = after(ago(20, 9, 30), firstRent.issuedAt, HOUR);
    if (paidAt < now) tale.world = settleInvoice(tale.world, firstRent.id, paidAt).world;
  }

  // Design submitted 16 days ago: checked by rule, no-objection certificate issued the same morning.
  let design: string | undefined;
  if (handedOverAt !== undefined) {
    const submitted = after(ago(16, 10, 10), handedOverAt, DAY);
    design = tale.start(
      { serviceId: 'C1', plotId: AW_PLOT, form: { plot: AW_PLOT, drawings: { name: 'aw-116-drawings.pdf', size: 8_400_000 }, calculations: { name: 'aw-116-calculations.pdf', size: 2_100_000 } } },
      submitted,
    );
    tale.complete(design, submitted + 2 * HOUR, { files: [{ name: 'aw-116-drawings-v2.pdf', size: 8_600_000 }] });

    // A worker's pass for the site.
    const requested = after(ago(10, 8, 5), handedOverAt, 2 * DAY);
    const pass = tale.start(
      {
        serviceId: 'D2',
        plotId: AW_PLOT,
        form: { passType: 'worker', holder: 'عامل تجريبي · Demo worker', company: 'شركة مقاولات تجريبية · Demo Contracting Co.', qid: '2•••••••••', validFrom: startOfDay(requested), validTo: dayAt(now, 80, 18), plot: AW_PLOT },
      },
      requested,
    );
    tale.complete(pass, requested + HOUR);
  }

  // A visitor's pass that has since expired.
  tale.world = addPass(tale.world, { kind: 'visitor', holder: 'زائر تجريبي · Demo visitor', plotId: BA_PLOT, from: ago(3, 9, 0), to: ago(3, 17, 0) }, ago(3, 8, 30)).world;

  // A street light reported yesterday morning: the crew has the work order.
  const light = tale.start(
    {
      serviceId: 'D1',
      plotId: BA_PLOT,
      form: {
        category: 'lighting',
        photo: { name: 'street-light.jpg', size: 482_000 },
        location: `قرب القطعة ${BA_PLOT} · Near plot ${BA_PLOT}`,
        details: 'عمود إنارة لا يعمل ليلًا · A street light is out at night',
      },
    },
    ago(1, 8, 20),
  );
  tale.park(light, (step) => step.lane === 'field', now + 5 * HOUR);

  // The building permit: lodged with the Ministry yesterday afternoon, now in the national permit system.
  if (tale.doneAt(design) !== undefined) {
    const lodged = ago(1, 14, 10);
    const permit = tale.start({ serviceId: 'C2', plotId: AW_PLOT, form: {} }, lodged);
    const target = nationalStep(peekServiceDetail('C2'), 'I9');
    tale.park(permit, (step) => step.id === target, now + DAY, lodged + HOUR);
  }

  // Everything else the calendar brings: the renewal of the yard opened 120 days before its lease ends.
  tale.until(now);

  let world = bookAppointmentIn(tale.world, { at: dayAt(now, 2, 10, 30), topic: { ar: `متابعة رخصة البناء للقطعة ${AW_PLOT}`, en: `Building permit follow-up for plot ${AW_PLOT}` }, channel: 'in_person' }).world;
  world = withRecentNotifications(world, now, light);
  return world;
}

/** Raises a notification that the investor has already opened. */
function notifyRead(world: World, input: Parameters<typeof notify>[1]): World {
  const next = notify(world, input);
  const last = next.notifications.length - 1;
  return { ...next, notifications: next.notifications.map((notification, index) => (index === last ? { ...notification, read: true } : notification)) };
}

/**
 * Keeps the notification centre to a handful: what the history raised in the last month (opened,
 * unless it still asks for something), plus what arrived in the last days.
 */
function withRecentNotifications(world: World, now: number, maintenanceId: string | undefined): World {
  const recent = world.notifications.filter((notification) => notification.at >= now - 30 * DAY).map((notification) => ({ ...notification, read: notification.kind !== 'action' }));
  let next: World = { ...world, notifications: recent };
  const maintenance = maintenanceId === undefined ? undefined : findRequest(next, maintenanceId);
  const invoice = next.invoices.find((candidate) => candidate.status === 'due');
  const appointment = next.appointments[0];

  if (appointment) {
    next = notifyRead(next, {
      at: now - 2 * DAY - 3 * HOUR,
      kind: 'info',
      title: { ar: 'تأكّد موعدك في مركز خدمات الأعمال', en: 'Your Business Services Center appointment is confirmed' },
      body: dots(appointment.topic, dateText(appointment.at)),
      route: '/account/support',
    });
  }
  if (maintenance) {
    next = notifyRead(next, {
      at: maintenance.createdAt + 4 * MINUTE,
      kind: 'update',
      title: { ar: 'استلمنا بلاغك وأُرسل أمر العمل إلى الفريق الميداني', en: 'We received your report and sent the work order to the field team' },
      body: dots({ ar: 'عطل في الإنارة', en: 'Street lighting issue' }, BA_PLOT),
      route: `/requests/${maintenance.id}`,
    });
  }
  next = notify(next, {
    at: now - 26 * HOUR,
    kind: 'info',
    title: { ar: 'إعلان المنطقة: صيانة مجدولة لطريق داخلي', en: 'Zone announcement: planned maintenance on an internal road' },
    body: {
      ar: 'مجمّع بركة العوامر اللوجستي · إغلاق جزئي يوم الجمعة من 6 إلى 10 صباحًا (إعلان توضيحي).',
      en: 'Birkat Al Awamer Logistics Park · partial closure on Friday, 6 to 10 am (illustrative announcement).',
    },
    route: '/zones/BA',
  });
  if (invoice) {
    next = notify(next, {
      at: now - 3 * HOUR,
      kind: 'action',
      title: text.invoiceDueSoon,
      body: dots(invoice.title, moneyText(invoice.amount), fill(text.dueOn, { date: dateText(invoice.dueAt) })),
      route: `/account/payments/${invoice.id}`,
    });
  }
  return next;
}

const historyReady = (): boolean => TENANT_SERVICES.every((id) => peekServiceDetail(id) !== undefined);

/* ───────────────────────────── the worlds ───────────────────────────── */

/**
 * The demo world of a persona at `now`.
 *
 * The tenant's history needs the workflows of the services it runs through. They load on demand, so
 * a world seeded before they arrive holds what needs no workflow (company, plots in operation, their
 * accounts), is marked as pending, and is completed with `completeSeed` once they are in memory.
 */
export function seedWorld(persona: Persona, now: number): World {
  if (persona === 'guest') return emptyWorld('guest');
  if (persona === 'prospect') return prospectWorld(now);
  const base = tenantBase(now);
  if (historyReady()) return tenantHistory(base, now);
  const pending: PendingWorld = { ...base, historyPending: true };
  return pending;
}

/** True when a persona's history could not be replayed yet because its workflows were not in memory. */
export function seedIsPartial(world: World): boolean {
  return (world as PendingWorld).historyPending === true;
}

/**
 * Replays the history of a world that was seeded too early, from the beginning. Such a world only
 * exists for the moment the catalogue takes to load, so nothing the investor did is lost in practice.
 * Returns the world unchanged when there is nothing to complete, or when it still cannot be done.
 */
export function completeSeed(world: World, now: number): World {
  return seedIsPartial(world) && historyReady() ? seedWorld(world.persona, now) : world;
}
