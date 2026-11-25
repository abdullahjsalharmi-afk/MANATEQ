import { beforeAll, describe, expect, it } from 'vitest';
import { loadAllServiceDetails, peekServiceDetail, services } from '@/data/catalog';
import type { ServiceDetail, ServiceId } from '@/data/types';
import { buildChains, chainFrom, followers, oncePerPlot, startedBy, unlocks } from '@/domain/chains';
import { DOC_REF_PREFIX, VERIFY_CODE_PATTERN, docSpecs, leaseContractDoc, receiptDoc, requestDocs, verifyCode, type DocFacts } from '@/domain/documents';
import { STATIONS, STATION_KEYS, checklist, focusPlot, journeyOf, stationOf } from '@/domain/journey';
import { collectNextSteps, deadlineOf, pendingAction, startRoute } from '@/domain/nextstep';
import type { Company, Invoice, Lease, Plot, PlotStatus, RequestState, World } from '@/domain/types';
import { calendarTiming, emptyWorld, seedWorld } from '@/state/seed';
import { startIn, tickWorld } from '@/state/sim';
import type { Env } from '@/state/types';

/** Display text keeps codes and amounts whole with invisible joiners and no-break spaces; compare it as plain text. */
const plain = (text: string | undefined): string | undefined => text?.replace(/\u2060/g, '').replace(/\u00A0/g, ' ');

const files = import.meta.glob<{ default: ServiceDetail[] }>('../../src/data/generated/services-*.json', { eager: true });
const all: ServiceDetail[] = Object.values(files).flatMap((m) => m.default);
const detail = (id: ServiceId): ServiceDetail => all.find((s) => s.id === id) as ServiceDetail;

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 19, 9, 30).getTime();
const env: Env = { detail: peekServiceDetail, timing: calendarTiming };

beforeAll(async () => {
  await loadAllServiceDetails();
});

describe('chains', () => {
  it('reads the application chain from the catalogue', () => {
    expect(followers('A4')).toEqual(['A5']);
    expect(followers('A5')).toEqual(['A6']);
    expect(followers('A6')).toEqual(['A7']);
    expect(chainFrom('A4').slice(0, 4)).toEqual(['A4', 'A5', 'A6', 'A7']);
  });

  it('separates what starts by itself from what the investor starts next', () => {
    // The handover is booked by the investor once the contract is signed.
    expect(unlocks('A7')).toContain('A8');
    expect(followers('A7')).not.toContain('A8');
    // The utilities request opens by itself at handover, once per plot.
    expect(followers('A8')).toContain('C4');
    expect(oncePerPlot('C4')).toBe(true);
    expect(oncePerPlot('B2')).toBe(false);
    expect(startedBy('A5')).toEqual(['A4']);
  });

  it('agrees with every trigger in the catalogue', () => {
    for (const service of services) {
      const { kind, after = [] } = service.triggeredBy;
      for (const earlier of after) {
        expect(followers(earlier).includes(service.id), `${earlier} → ${service.id}`).toBe(kind === 'after');
        expect(unlocks(earlier).includes(service.id), `${earlier} unlocks ${service.id}`).toBe(kind === 'investor');
      }
    }
  });

  it('never loops', () => {
    for (const service of services) {
      const chain = chainFrom(service.id);
      expect(new Set(chain).size).toBe(chain.length);
      expect(chain[0]).toBe(service.id);
    }
  });

  it('builds from any list of triggers', () => {
    const chains = buildChains([
      { id: 'X1', triggeredBy: { kind: 'investor', note: { ar: '', en: '' } } },
      { id: 'X2', triggeredBy: { kind: 'after', after: ['X1'], note: { ar: '', en: '' } } },
      { id: 'X3', triggeredBy: { kind: 'schedule', after: ['X2'], note: { ar: '', en: '' } } },
    ]);
    expect(chains.followers('X1')).toEqual(['X2']);
    expect(chains.followers('X2')).toEqual([]);
    expect(chains.chainFrom('X1')).toEqual(['X1', 'X2']);
  });
});

describe('documents', () => {
  const company: Company = { name: { ar: 'شركة تجريبية', en: 'Demo company' }, cr: '000001', activity: { ar: 'نشاط', en: 'Activity' }, activityCode: 'ACT-000', signatory: { name: { ar: 'مفوَّض', en: 'Signatory' }, role: { ar: 'مالك', en: 'Owner' } }, syncedAt: NOW };
  const plot: Plot = { id: 'p1', number: 'AW-116', zoneCode: 'AW', areaSqm: 5000, solution: 'logistics', status: 'leased', leaseId: 'l1' };
  const lease: Lease = { id: 'l1', ref: 'LC-2026-0001', plotId: 'p1', startsAt: NOW, endsAt: NOW + 365 * DAY, ratePerSqmYear: 15, annualRent: 75_000, status: 'active' };
  const facts: DocFacts = { company, plot, zoneName: { ar: 'مجمّع الوكرة اللوجستي', en: 'Al Wakra Logistics Park' }, lease };
  const request = (serviceId: ServiceId, form: RequestState['form'] = {}): Pick<RequestState, 'id' | 'ref' | 'serviceId' | 'form'> => ({ id: 'r1', ref: 'MQ-2611-0001', serviceId, form });
  let n = 0;
  const allocate = (spec: { kind: keyof typeof DOC_REF_PREFIX }) => ({ id: `d${++n}`, ref: `${DOC_REF_PREFIX[spec.kind]}-2611-${String(n).padStart(4, '0')}` });

  it('writes verification codes in the published format, stable for the same seed', () => {
    expect(verifyCode('LC-2026-0001:d1')).toMatch(VERIFY_CODE_PATTERN);
    expect(verifyCode('LC-2026-0001:d1')).toMatch(/^TSD-[0-9A-Z]{4}-[0-9A-Z]{4}$/);
    expect(verifyCode('LC-2026-0001:d1')).toBe(verifyCode('LC-2026-0001:d1'));
    expect(verifyCode('LC-2026-0001:d1')).not.toBe(verifyCode('LC-2026-0001:d2'));
    const codes = new Set(Array.from({ length: 500 }, (_, i) => verifyCode(`seed-${i}`)));
    expect(codes.size).toBeGreaterThan(495);
  });

  it('never issues more documents than the service publishes', () => {
    for (const service of all) {
      const published = service.receives.filter((item) => item.kind === 'document').length;
      const specs = docSpecs(service);
      expect(specs.length, service.id).toBeLessThanOrEqual(published);
      for (const spec of specs) {
        expect(spec.title.ar.trim().length, `${service.id} ar title`).toBeGreaterThan(2);
        expect(spec.title.en.trim().length, `${service.id} en title`).toBeGreaterThan(2);
        // Wallet titles are short names, not sentences, and carry no em dash.
        expect(spec.title.en.length, `${service.id} "${spec.title.en}"`).toBeLessThanOrEqual(48);
        expect(`${spec.title.ar}${spec.title.en}`).not.toContain('—');
      }
    }
  });

  it('issues the documents the journey depends on', () => {
    expect(docSpecs(detail('A7')).map((s) => s.kind)).toEqual(['contract']);
    expect(docSpecs(detail('A7'))[0]?.signed).toBe(true);
    expect(docSpecs(detail('C1')).map((s) => s.kind)).toContain('noc');
    expect(docSpecs(detail('B3')).map((s) => s.kind)).toEqual(['contract']);
    expect(docSpecs(detail('A8')).map((s) => s.kind)).toContain('certificate');
    expect(docSpecs(detail('D1'))).toEqual([]);
  });

  it('names a picked document after the pick', () => {
    const specs = docSpecs(detail('B8'), { docType: 'noDues' });
    expect(specs).toHaveLength(1);
    expect(specs[0]?.kind).toBe('letter');
    const option = detail('B8')
      .fields.find((f) => f.key === 'docType')
      ?.options?.find((o) => o.value === 'noDues');
    expect(specs[0]?.title.en).toBe(option?.en);
  });

  it('builds the lease contract of a finished contract request', () => {
    const docs = requestDocs(request('A7'), detail('A7'), facts, NOW, allocate);
    expect(docs).toHaveLength(1);
    const contract = docs[0];
    expect(contract).toMatchObject({ kind: 'contract', ref: 'LC-2026-0001', signed: true, serviceId: 'A7', requestId: 'r1', issuedAt: NOW });
    expect(contract?.verifyCode).toMatch(VERIFY_CODE_PATTERN);
    expect(plain(contract?.title.en)).toBe('Lease contract · AW-116');
    expect(contract?.title.ar).toContain('عقد الإيجار');
    const lines = contract?.lines.map((line) => plain(`${line.label.en}: ${line.value.en}`)) ?? [];
    expect(lines).toContain('Issued to: Demo company');
    expect(lines).toContain('Plot: AW-116 · Al Wakra Logistics Park');
    expect(lines).toContain('Area: 5,000 m²');
    expect(lines).toContain('Rent rate: QAR 15 / m² / year');
    expect(lines).toContain('Annual rent: QAR 75,000');
    expect(contract?.lines.every((line) => line.label.ar && line.value.ar)).toBe(true);
  });

  it('builds a no-objection certificate with the request it came from', () => {
    const docs = requestDocs(request('C1'), detail('C1'), facts, NOW, allocate);
    const noc = docs.find((doc) => doc.kind === 'noc');
    expect(noc?.ref).toMatch(/^NOC-2611-\d{4}$/);
    expect(noc?.signed).toBe(true);
    expect(noc?.lines.some((line) => plain(line.value.en) === 'MQ-2611-0001')).toBe(true);
    expect(new Set(docs.map((doc) => doc.id)).size).toBe(docs.length);
  });

  it('builds a receipt for a paid invoice and a contract for a lease', () => {
    const invoice: Invoice = { id: 'i1', ref: 'INV-2026-0007', title: { ar: 'إيجار', en: 'Rent' }, leaseId: 'l1', amount: 18_750, issuedAt: NOW - DAY, dueAt: NOW + DAY, status: 'paid', paidAt: NOW };
    const receipt = receiptDoc({ id: 'd90', ref: 'RCP-2026-0007' }, invoice, facts, NOW);
    expect(receipt).toMatchObject({ kind: 'receipt', ref: 'RCP-2026-0007', signed: false, issuedAt: NOW });
    expect(receipt.lines.map((line) => plain(line.value.en))).toContain('QAR 18,750');
    expect(receipt.lines.map((line) => plain(line.value.ar))).toContain('18,750 ر.ق');
    expect(receipt.lines.some((line) => /demo/i.test(line.value.en))).toBe(true);

    const contract = leaseContractDoc({ id: 'd91', ref: 'ignored' }, lease, facts, NOW);
    expect(contract.ref).toBe(lease.ref);
    expect(contract.signed).toBe(true);
  });
});

describe('journey', () => {
  const withPlot = (status: PlotStatus): World => ({ ...emptyWorld('tenant'), company: seedWorld('prospect', NOW).company, plots: [{ id: 'p1', number: 'AW-117', zoneCode: 'AW', areaSqm: 5000, solution: 'logistics', status }] });

  it('has four stations in order, each a list of real services', () => {
    expect(STATION_KEYS).toEqual(['join', 'contract', 'build', 'operate']);
    for (const station of STATIONS) {
      expect(station.name.ar).toBeTruthy();
      for (const item of station.items) expect(services.some((service) => service.id === item.serviceId), item.serviceId).toBe(true);
    }
  });

  it('places an investor without a plot at the start', () => {
    expect(stationOf(emptyWorld('guest'))).toBe('join');
    expect(stationOf(seedWorld('prospect', NOW))).toBe('join');
    expect(focusPlot(seedWorld('prospect', NOW))).toBeUndefined();
  });

  it('follows the status of the plot', () => {
    expect(stationOf(withPlot('reserved'), 'p1')).toBe('contract');
    expect(stationOf(withPlot('leased'), 'p1')).toBe('contract');
    expect(stationOf(withPlot('handed_over'), 'p1')).toBe('contract');
    expect(stationOf(withPlot('building'), 'p1')).toBe('build');
    expect(stationOf(withPlot('operating'), 'p1')).toBe('operate');
    expect(stationOf(withPlot('building'))).toBe('build');
  });

  it('focuses on the plot that still has the furthest to go', () => {
    const tenant = seedWorld('tenant', NOW);
    expect(focusPlot(tenant)?.number).toBe('AW-116');
    expect(stationOf(tenant)).toBe('build');
    expect(stationOf(tenant, 'BA-121')).toBe('operate');
  });

  it('opens the journey with the eligibility check, then the application', () => {
    // Before any check (the seeded prospect has saved one; see below).
    const prospect: World = { ...seedWorld('prospect', NOW), eligibility: null };
    const first = journeyOf(prospect);
    expect(first.station).toBe('join');
    expect(first.plotId).toBeNull();
    expect(first.stations.map((s) => s.state)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming']);
    const join = checklist(prospect, 'join');
    expect(join.find((i) => i.serviceId === 'A2')).toMatchObject({ state: 'current', canStart: true });
    expect(join.find((i) => i.serviceId === 'A3')?.state).toBe('done');
    expect(join.find((i) => i.serviceId === 'A4')).toMatchObject({ state: 'upcoming', canStart: false });

    const checked: World = { ...prospect, eligibility: { at: NOW, activityCode: 'ACT-101', solution: 'logistics', areaSqm: 4000, verdict: 'targeted', zoneCodes: ['AW'] } };
    const after = checklist(checked, 'join');
    expect(after.find((i) => i.serviceId === 'A2')?.state).toBe('done');
    expect(after.find((i) => i.serviceId === 'A4')).toMatchObject({ state: 'current', canStart: true });

    const refused: World = { ...checked, eligibility: { ...checked.eligibility!, verdict: 'not_targeted' } };
    expect(checklist(refused, 'join').find((i) => i.serviceId === 'A4')?.canStart).toBe(false);

    // The seeded prospect stands at that point: one saved check, the application next.
    const seeded = checklist(seedWorld('prospect', NOW), 'join');
    expect(seeded.find((i) => i.serviceId === 'A2')?.state).toBe('done');
    expect(seeded.find((i) => i.serviceId === 'A4')).toMatchObject({ state: 'current', canStart: true });
  });

  it('knows what the investor can start at each plot status', () => {
    const startable = (status: PlotStatus) =>
      journeyOf(withPlot(status), 'p1')
        .stations.flatMap((s) => s.items)
        .filter((i) => i.canStart)
        .map((i) => i.serviceId);
    expect(startable('reserved')).toEqual([]);
    expect(startable('leased')).toEqual(['A8']);
    expect(startable('handed_over')).toEqual(['C1']);
    expect(startable('operating')).toEqual([]);
  });

  it('marks everything behind an operating plot as done', () => {
    const journey = journeyOf(withPlot('operating'), 'p1');
    expect(journey.stations.map((s) => s.state)).toEqual(['done', 'done', 'done', 'current']);
    for (const station of journey.stations) for (const item of station.items) expect(item.state, item.serviceId).toBe('done');
  });

  it('shows the tenant’s build in progress', () => {
    const tenant = seedWorld('tenant', NOW);
    const build = checklist(tenant, 'build');
    expect(build.find((i) => i.serviceId === 'C1')?.state).toBe('done');
    expect(build.find((i) => i.serviceId === 'C2')?.state).toBe('current');
    expect(build.find((i) => i.serviceId === 'C4')?.state).toBe('current');
    expect(build.find((i) => i.serviceId === 'C8')?.state).toBe('upcoming');
    // Items carry the request behind them.
    const c2 = build.find((i) => i.serviceId === 'C2');
    expect(tenant.requests.find((r) => r.id === c2?.requestId)?.serviceId).toBe('C2');
    // The plot in operation has a due invoice and an open report.
    const operate = checklist(tenant, 'operate', 'BA-121');
    expect(operate.find((i) => i.serviceId === 'B1')?.state).toBe('current');
    expect(operate.find((i) => i.serviceId === 'D1')?.state).toBe('current');
    expect(checklist(tenant, 'operate', 'AK-113').find((i) => i.serviceId === 'B3')?.state).toBe('current');
  });
});

describe('next steps', () => {
  it('sends a guest and a new investor to the eligibility check', () => {
    for (const world of [emptyWorld('guest'), { ...seedWorld('prospect', NOW), eligibility: null }]) {
      const steps = collectNextSteps(world, peekServiceDetail);
      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({ kind: 'start_service', route: '/eligibility' });
      expect(steps[0]?.title).toEqual(detail('A2').label);
    }
  });

  it('offers the application after a positive result, and a saved draft instead of a fresh start', () => {
    const prospect = seedWorld('prospect', NOW);
    const checked: World = { ...prospect, eligibility: { at: NOW, activityCode: 'ACT-101', solution: 'logistics', areaSqm: 4000, verdict: 'targeted', zoneCodes: ['AW'] } };
    expect(collectNextSteps(checked, peekServiceDetail)[0]).toMatchObject({ kind: 'start_service', route: '/start/A4' });

    const drafted: World = { ...checked, drafts: { A4: { serviceId: 'A4', form: { area: 4000 }, page: 1, savedAt: NOW } } };
    const steps = collectNextSteps(drafted, peekServiceDetail);
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ id: 'draft:A4', kind: 'start_service', route: '/start/A4' });
  });

  it('builds routes for starting a service', () => {
    expect(startRoute('A2')).toBe('/eligibility');
    expect(startRoute('A8', 'AW-116')).toBe('/start/A8?plot=AW-116');
    expect(startRoute('D1')).toBe('/start/D1');
  });

  it('puts the tenant’s invoice before the renewal, each with its deadline', () => {
    const tenant = seedWorld('tenant', NOW);
    const steps = collectNextSteps(tenant, peekServiceDetail);
    expect(steps.map((s) => s.kind)).toEqual(['invoice', 'renewal']);
    const [invoice, renewal] = steps;
    expect(invoice?.dueAt).toBe(NOW + 5 * DAY);
    expect(invoice?.route).toMatch(/^\/account\/payments\//);
    expect(plain(invoice?.context.en)).toContain('QAR 37,500');
    expect(plain(invoice?.context.ar)).toContain('37,500 ر.ق');
    const yard = tenant.leases.find((l) => l.plotId === 'AK-113');
    expect(renewal?.dueAt).toBe(yard?.endsAt);
    expect(renewal?.route).toMatch(/^\/requests\//);
    expect(plain(renewal?.context.en)).toContain('QAR 50,000');
    for (const step of steps) {
      expect(step.title.ar && step.title.en && step.cta.ar && step.cta.en).toBeTruthy();
      expect(`${step.title.ar}${step.title.en}${step.context.ar}${step.context.en}`).not.toContain('—');
    }
  });

  it('orders by urgency: overdue, then the nearest deadline, then the longest wait, then suggestions', () => {
    // Six days on: the invoice is overdue, the street light is fixed and waits for a rating, and the
    // building permit is through, so the mobilisation permit is what moves the build forward.
    const later = tickWorld(seedWorld('tenant', NOW), NOW + 6 * DAY, env);
    const steps = collectNextSteps(later, peekServiceDetail);
    const overdue = later.invoices.filter((i) => i.status === 'overdue');
    expect(overdue).toHaveLength(1);
    expect(steps[0]?.id).toBe(`invoice:${overdue[0]?.id}`);
    expect(steps[1]?.kind).toBe('renewal');
    const kinds = steps.map((s) => s.kind);
    expect(kinds).toContain('request_action');
    expect(kinds[kinds.length - 1]).toBe('start_service');
    // Requests come before suggestions, and urgency never decreases along the list.
    expect(kinds.lastIndexOf('request_action')).toBeLessThan(kinds.indexOf('start_service'));
    for (let i = 1; i < steps.length; i++) expect(steps[i]!.urgency).toBeGreaterThanOrEqual(steps[i - 1]!.urgency);
    // One suggestion only: the journey has one next step.
    expect(kinds.filter((k) => k === 'start_service')).toHaveLength(1);
  });

  it('sorts hand-made cases exactly', () => {
    const base: World = { ...emptyWorld('tenant'), company: seedWorld('prospect', NOW).company, plots: [{ id: 'p1', number: 'AW-117', zoneCode: 'AW', areaSqm: 5000, solution: 'logistics', status: 'operating' }] };
    const invoice = (id: string, dueAt: number, status: Invoice['status']): Invoice => ({ id, ref: id, title: { ar: id, en: id }, amount: 100, issuedAt: dueAt - 30 * DAY, dueAt, status });
    // Two requests that wait for the investor: the one started earlier has waited longer. Since v1.1 the
    // utilities case first spends Manateq's network capacity check (10 working days, 8 on the demo path).
    let world = startIn(base, { serviceId: 'C4', plotId: 'p1' }, NOW - 20 * DAY, env).world;
    world = startIn(world, { serviceId: 'C4', plotId: 'p1' }, NOW - 10 * DAY, env).world;
    world = tickWorld(world, NOW, env);
    const waiting = world.requests.filter((r) => r.status === 'needs_you');
    expect(waiting).toHaveLength(2);
    world = { ...world, invoices: [invoice('soon', NOW + 3 * DAY, 'due'), invoice('late', NOW - 2 * DAY, 'overdue'), invoice('later', NOW + 20 * DAY, 'due'), invoice('very-late', NOW - 10 * DAY, 'overdue'), invoice('paid', NOW - 40 * DAY, 'paid')] };
    const ids = collectNextSteps(world, peekServiceDetail).map((s) => s.id);
    expect(ids).toEqual(['invoice:very-late', 'invoice:late', 'invoice:soon', 'invoice:later', `request:${waiting[0]!.id}`, `request:${waiting[1]!.id}`]);
  });

  it('reads the pending action and the deadline of a waiting request', () => {
    const tenant = seedWorld('tenant', NOW);
    const renewal = tenant.requests.find((r) => r.serviceId === 'B3') as RequestState;
    const action = pendingAction(renewal, detail('B3'));
    expect(action?.flow).toContain('pay');
    expect(deadlineOf(tenant, renewal)).toBe(tenant.leases.find((l) => l.plotId === renewal.plotId)?.endsAt);
    const moving = tenant.requests.find((r) => r.status === 'active') as RequestState;
    expect(pendingAction(moving, detail(moving.serviceId))).toBeUndefined();
    expect(deadlineOf(tenant, moving)).toBeUndefined();
    // Without the full record the step still shows, with a generic button.
    const bare = collectNextSteps(tenant, () => undefined).find((s) => s.kind === 'renewal');
    expect(bare?.title).toEqual(detail('B3').label);
    expect(bare?.cta.en).toBe('Open request');
  });
});
