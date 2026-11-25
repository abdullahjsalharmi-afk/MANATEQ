// Builds the app's data (src/data/generated/*.json) from the sources in data/source/.
//
//   data/source/guide-services.json   the 50 services of the Service Guide v4.1 (bilingual) with their workflows
//   data/source/reference.json        domains, integrations, patterns, systems, lanes, maturity levels, phases, zones
//   data/source/meta/<A..G>.json      investor-facing metadata per domain (labels, forms, actions, standards…)
//   data/source/glance.json           "Manateq at a glance": solutions and published prices, channels, procedure
//   data/source/zones-geo.json        zone coordinates and extra facts (illustrative)
//   data/source/qatar-outline.json    outline of Qatar (Natural Earth, public domain)
//   data/source/knowledge/*.json      principles, journeys, today-vs-after (optional)
//   data/source/activities.json       illustrative activity list for the eligibility check (optional)
//
// Usage: node scripts/build-data.mjs   (run from the repository root; exits non-zero on any integrity error)

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'data', 'source');
const OUT = path.join(ROOT, 'src', 'data', 'generated');

const read = (rel) => JSON.parse(fs.readFileSync(path.join(SRC, rel), 'utf8'));
const readOptional = (rel, fallback) => (fs.existsSync(path.join(SRC, rel)) ? read(rel) : fallback);
const write = (name, value) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(value) + '\n');
  return Buffer.byteLength(JSON.stringify(value));
};

const errors = [];
const warn = [];
const bi = (ar, en) => ({ ar: clean(ar), en: clean(en) });
const zip = (ars, ens, what) => {
  if ((ars || []).length !== (ens || []).length) errors.push(`${what}: Arabic has ${(ars || []).length} items, English ${(ens || []).length}`);
  return (ars || []).map((ar, i) => bi(ar, (ens || [])[i] ?? ''));
};
function clean(text) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
}
const isBi = (o) => o && typeof o.ar === 'string' && typeof o.en === 'string' && o.ar.trim() !== '' && o.en.trim() !== '';

// ----------------------------------------------------------------------------- sources
const guide = read('guide-services.json');
const reference = read('reference.json');
const glance = read('glance.json');
const geo = readOptional('zones-geo.json', { zones: [] });
const outline = read('qatar-outline.json');
const DOMAIN_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const meta = Object.fromEntries(DOMAIN_CODES.map((code) => [code, read(`meta/${code}.json`)]));
const metaById = new Map();
for (const code of DOMAIN_CODES) for (const s of meta[code].services) metaById.set(s.id, s);

// ----------------------------------------------------------------------------- reference
const INTEGRATION_SHORT_EN = {
  I1: 'National sign-in (Tawtheeq)', I2: 'Government Data Exchange', I3: 'Government e-payment', I4: 'Government SMS gateway',
  I5: 'Morasalat', I6: 'Tasdeeq', I7: 'Hukoomi contact centre', I8: 'MOCI Single Window', I9: 'Ministry of Municipality permits',
  I10: 'Civil Defence', I11: 'Kahramaa', I12: 'Telecom providers', I13: 'Customs (Al Nadeeb)', I14: 'Ministry of Labour',
  I15: 'Ministry of Environment', I16: 'Qatar Chamber and Invest Qatar', I17: 'Banks and QDB', I18: 'Warehousing park operators',
  I19: 'Gates, ANPR and CCTV', I20: 'Smart meters and IoT', I21: 'GIS and land data', I22: 'E-signature service',
};
const GROUP_AR = {
  'National shared platforms': 'المنصات الوطنية المشتركة',
  'Regulators, utilities & agencies': 'الجهات التنظيمية وجهات المرافق والهيئات',
  'Partners & field': 'الشركاء والميدان',
};
// The body behind a platform, for "who has your request now" (headline form, then the form used in a sentence).
const ENTITY = {
  I8: [['وزارة التجارة والصناعة', 'Ministry of Commerce and Industry'], ['وزارة التجارة والصناعة', 'the Ministry of Commerce and Industry']],
  I9: [['وزارة البلدية', 'Ministry of Municipality'], ['وزارة البلدية', 'the Ministry of Municipality']],
  I10: [['الدفاع المدني', 'Civil Defence'], ['الدفاع المدني', 'Civil Defence']],
  I11: [['كهرماء', 'Kahramaa'], ['كهرماء', 'Kahramaa']],
  I13: [['الهيئة العامة للجمارك', 'General Authority of Customs'], ['الهيئة العامة للجمارك', 'the General Authority of Customs']],
  I14: [['وزارة العمل', 'Ministry of Labour'], ['وزارة العمل', 'the Ministry of Labour']],
  I15: [['وزارة البيئة والتغير المناخي', 'Ministry of Environment and Climate Change'], ['وزارة البيئة والتغير المناخي', 'the Ministry of Environment and Climate Change']],
};
const statusOverride = readOptional('knowledge/integration-status.json', null);
const statusList = Array.isArray(statusOverride) ? statusOverride : Array.isArray(statusOverride?.integrations) ? statusOverride.integrations : [];
const statusById = new Map(statusList.map((s) => [s.id, s]));

const integrations = reference.integrations.map((i) => {
  const extra = statusById.get(i.id);
  const statusEn = clean(i.status);
  return {
    id: i.id,
    name: bi(i.nameAr, i.name),
    short: bi(i.short, INTEGRATION_SHORT_EN[i.id] ?? i.name),
    purpose: bi(i.purposeAr, i.purpose),
    group: bi(GROUP_AR[i.group] ?? i.group, i.group),
    status: extra && isBi(extra.status) ? extra.status : bi(i.statusAr ?? statusEn, statusEn),
    phase: i.phase,
    live: extra && typeof extra.liveNationally === 'boolean' ? extra.liveNationally : /available nationally/i.test(statusEn),
    ...(ENTITY[i.id] ? { entity: { name: bi(...ENTITY[i.id][0]), inText: bi(...ENTITY[i.id][1]) } } : {}),
  };
});
const integrationIds = new Set(integrations.map((i) => i.id));
const patterns = reference.patterns.map((p) => ({ id: p.id, name: bi(p.nameAr, p.name), short: bi(p.shortAr ?? p.nameAr, p.short) }));
const patternIds = new Set(patterns.map((p) => p.id));
const systems = reference.systems.map((s) => ({ id: s.id, name: bi(s.nameAr, s.name), status: bi(s.statusAr ?? s.status, s.status) }));
const systemIds = new Set(systems.map((s) => s.id));
const lanes = Object.fromEntries(
  reference.lanes.order.map((key) => [key, { name: bi(reference.lanes.ar[key], reference.lanes.en[key]), short: bi(reference.lanes.arShort[key], reference.lanes.enShort[key]) }]),
);
const maturity = [0, 1, 2, 3, 4, 5].map((n) => bi(reference.maturity.ar[n], reference.maturity.en[n]));
const phases = reference.phases.map((p) => ({ n: p.n, name: bi(p.nameAr, p.name), when: bi(p.whenAr, p.when) }));

// ----------------------------------------------------------------------------- services
const LANES = new Set(reference.lanes.order);
const KINDS = new Set(['start', 'auto', 'human', 'gate', 'stop', 'end']);

function buildWorkflow(id, wf) {
  const steps = wf.steps.map((st) => {
    if (!LANES.has(st.lane)) errors.push(`${id} step ${st.id}: unknown lane ${st.lane}`);
    if (!KINDS.has(st.kind)) errors.push(`${id} step ${st.id}: unknown kind ${st.kind}`);
    const step = { id: st.id, lane: st.lane, kind: st.kind, label: bi(st.labelAr, st.label), text: bi(st.textAr, st.text), std: { ar: clean(st.stdAr), en: clean(st.std) }, enablers: st.en ?? [] };
    for (const key of ['yes', 'no', 'next', 'back']) if (typeof st[key] === 'number') step[key] = st[key];
    return step;
  });
  const ids = new Set(steps.map((s) => s.id));
  for (const s of steps) {
    for (const key of ['yes', 'no', 'next', 'back']) if (s[key] !== undefined && !ids.has(s[key])) errors.push(`${id} step ${s.id}: ${key} → ${s[key]} does not exist`);
    if (s.kind === 'gate' && (s.yes === undefined || s.no === undefined)) errors.push(`${id} step ${s.id}: gate without yes/no`);
    for (const e of s.enablers) if (!integrationIds.has(e) && !patternIds.has(e) && !systemIds.has(e)) errors.push(`${id} step ${s.id}: unknown enabler ${e}`);
  }
  // the usual path must reach an end
  let cur = steps[0];
  const seen = new Set();
  while (cur && !seen.has(cur.id) && cur.kind !== 'end' && cur.kind !== 'stop') {
    seen.add(cur.id);
    const nextId = cur.kind === 'gate' ? cur.yes : (cur.back ?? cur.next ?? steps[steps.indexOf(cur) + 1]?.id);
    cur = steps.find((s) => s.id === nextId);
  }
  if (!cur || cur.kind !== 'end') errors.push(`${id}: the usual path does not reach an end step`);
  return { lanes: wf.lanes, standard: bi(wf.standardAr, wf.standard), exceptions: zip(wf.exceptionsAr, wf.exceptions, `${id} exceptions`), data: bi(wf.dataAr, wf.data), steps };
}

const details = [];
for (const s of guide.services) {
  const m = metaById.get(s.id);
  if (!m) {
    errors.push(`${s.id}: no metadata`);
    continue;
  }
  const workflow = buildWorkflow(s.id, s.wf);
  for (const st of workflow.steps) {
    if (st.lane === 'inv' && st.kind === 'human' && !m.actions.some((a) => a.step === st.id)) errors.push(`${s.id}: investor step ${st.id} has no action`);
  }
  for (const key of ['integrations', 'patterns', 'systems']) {
    const pool = key === 'integrations' ? integrationIds : key === 'patterns' ? patternIds : systemIds;
    for (const ref of s[key]) if (!pool.has(ref)) errors.push(`${s.id}: unknown ${key} ${ref}`);
  }
  for (const f of m.fetched) if (f.source && !integrationIds.has(f.source) && !systemIds.has(f.source)) errors.push(`${s.id}: fetched source ${f.source} unknown`);
  for (const n of m.next) if (!guide.services.some((x) => x.id === n)) errors.push(`${s.id}: next → ${n} unknown`);
  if (m.startable && workflow.steps[0].lane !== 'inv') warn.push(`${s.id}: marked startable but its workflow starts in lane "${workflow.steps[0].lane}"`);
  if (!m.startable && workflow.steps[0].lane === 'inv') warn.push(`${s.id}: workflow starts with the investor but it is not marked startable`);

  for (const key of ['requestLabel', 'hint']) if (m[key] !== undefined && !isBi(m[key])) errors.push(`${s.id}: ${key} must be bilingual`);
  for (const f of m.fields ?? []) {
    if (!f.showIf) continue;
    const on = (m.fields ?? []).find((other) => other.key === f.showIf.key);
    if (!on || on === f) errors.push(`${s.id} field ${f.key}: showIf names an unknown field ${f.showIf.key}`);
  }

  const summary = {
    id: s.id,
    domain: s.domain,
    name: bi(s.nameAr, s.name),
    label: m.label,
    ...(m.requestLabel ? { requestLabel: m.requestLabel } : {}),
    summary: m.summary,
    ...(m.hint ? { hint: m.hint } : {}),
    promise: bi(s.promiseAr, s.promise),
    initiator: m.initiator,
    startable: m.startable,
    audiences: m.audiences,
    stage: m.stage,
    standard: { ar: clean(m.standard.ar), en: clean(m.standard.en), value: m.standard.unit === 'instant' ? null : (m.standard.value ?? null), unit: m.standard.unit ?? null },
    level: { now: s.now, target: s.target },
    phase: s.phase,
    triggeredBy: { kind: m.triggeredBy.kind, ...(m.triggeredBy.after?.length ? { after: m.triggeredBy.after } : {}), note: m.triggeredBy.note },
    lanes: s.wf.lanes,
  };
  details.push({
    ...summary,
    description: bi(s.ar.desc, s.en.desc),
    benefits: zip(s.ar.benefits, s.en.benefits, `${s.id} benefits`),
    who: zip(s.ar.who, s.en.who, `${s.id} who`),
    steps: zip(s.ar.steps, s.en.steps, `${s.id} steps`),
    inputs: bi(s.ar.inputs, s.en.inputs),
    outputs: bi(s.ar.outputs, s.en.outputs),
    note: bi(s.ar.note, s.en.note),
    example: bi(s.ar.example, s.en.example),
    channel: bi(s.channelAr, s.channel),
    kpi: bi(s.kpiAr, s.kpi),
    trigger: bi(s.triggerAr, s.trigger),
    output: bi(s.outputAr, s.output),
    flow: zip(s.flowAr, s.flow, `${s.id} flow`),
    patterns: s.patterns,
    integrations: s.integrations,
    systems: s.systems,
    provides: m.provides,
    fetched: m.fetched,
    receives: m.receives,
    fields: m.fields,
    actions: m.actions,
    next: m.next,
    appNote: m.appNote,
    workflow,
  });
}
if (details.length !== 50) errors.push(`expected 50 services, built ${details.length}`);

const domains = reference.domains.map((d) => {
  const intro = meta[d.code].intro;
  return { code: d.code, name: bi(d.nameAr, d.name), tagline: bi(d.taglineAr, d.tagline), purpose: intro.purpose, customers: intro.customers, journey: intro.journey, topTasks: intro.topTasks, services: d.services };
});

// ----------------------------------------------------------------------------- zones and map
const ZONE_CODES = {
  'Mesaieed Industrial Zone': 'MIZ', 'Small and Medium Industries Zone': 'SMI', 'Al Karaana Industrial Zone': 'AK', 'Al Khor Industrial Zone': 'KH',
  'Birkat Al Awamer Logistics Park': 'BA', 'Al Wakra Logistics Park': 'AW', 'Jery Al Samur Logistics Park': 'JS', 'Aba Saleel Logistics Park': 'AS',
  'Al Wukair Warehousing Park': 'WK', 'Bu Sulba Warehousing Park': 'BS', 'Bu Fesseela Warehousing Park': 'BF',
  'Umm Shaharaine 1 Warehousing Park': 'US1', 'Umm Shaharaine 2 Warehousing Park': 'US2',
};
// Which of the five solutions each zone offers (Service Guide v4.1, "Manateq at a glance").
const ZONE_SOLUTIONS = {
  MIZ: ['industrial'], SMI: ['industrial'], AK: ['industrial', 'openYard'], KH: ['industrial', 'openYard'],
  BA: ['logistics', 'commercial'], AW: ['logistics', 'commercial'], JS: ['logistics'], AS: ['logistics', 'commercial'],
  WK: ['warehousing'], BS: ['warehousing'], BF: ['warehousing'], US1: ['warehousing'], US2: ['warehousing'],
};
const TYPE_AR = { Industrial: 'صناعية', 'Industrial / open yards': 'صناعية / ساحات مفتوحة', Logistics: 'لوجستية' };
// Approximate centres [lon, lat] for zones the geo file does not cover or covers jointly. Schematic only.
const CENTER_FALLBACK = { WK: [51.502, 25.118], US1: [51.3566, 25.3915], US2: [51.3586, 25.3953] };
const GEO_ALIAS = { US1: 'US', US2: 'US' };
const geoByCode = new Map((geo.zones || []).map((z) => [z.code, z]));

// Equirectangular projection of the outline into a 100-wide box (north up).
const ring = outline.coordinates[0];
const lons = ring.map((p) => p[0]);
const lats = ring.map((p) => p[1]);
const lon0 = Math.min(...lons), lon1 = Math.max(...lons), lat0 = Math.min(...lats), lat1 = Math.max(...lats);
const kx = Math.cos((((lat0 + lat1) / 2) * Math.PI) / 180);
const scale = 100 / ((lon1 - lon0) * kx);
const mapHeight = +((lat1 - lat0) * scale).toFixed(2);
const project = ([lon, lat]) => [+(((lon - lon0) * kx) * scale).toFixed(2), +((lat1 - lat) * scale).toFixed(2)];

// Douglas–Peucker simplification in projected units.
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  let index = -1, max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1e-9;
    const dist = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / len;
    if (dist > max) { max = dist; index = i; }
  }
  if (max <= tolerance) return [a, b];
  return simplify(points.slice(0, index + 1), tolerance).slice(0, -1).concat(simplify(points.slice(index), tolerance));
}
const projected = ring.map(project);
const half = Math.floor(projected.length / 2);
const simple = simplify(projected.slice(0, half + 1), 0.35).slice(0, -1).concat(simplify(projected.slice(half), 0.35));
const outlinePath = 'M' + simple.map((p) => `${p[0]} ${p[1]}`).join('L') + 'Z';

function mapPosition(center) {
  const [x, y] = project(center);
  return { x: +x.toFixed(1), y: +((y / mapHeight) * 100).toFixed(1) };
}

const zones = [];
for (const z of reference.zones.land) {
  const code = ZONE_CODES[z.name];
  if (!code) { errors.push(`zone without code: ${z.name}`); continue; }
  const g = geoByCode.get(code);
  const center = g?.center ?? CENTER_FALLBACK[code];
  if (!center) { errors.push(`zone ${code}: no coordinates`); continue; }
  const facts = g?.facts ?? {};
  const extra = {};
  if (typeof g?.plots === 'number' && g.plots > 0) extra.plots = g.plots;
  if (facts.distance) extra.distancesKm = facts.distance;
  if (facts.sectors?.ar?.length) extra.sectors = facts.sectors.ar.map((ar, i) => bi(ar, facts.sectors.en[i] ?? ''));
  if (Array.isArray(g?.utilities)) extra.utilities = g.utilities;
  zones.push({
    code, kind: 'land', name: bi(z.nameAr, z.name), typeLabel: bi(TYPE_AR[z.type] ?? z.type, z.type), solutions: ZONE_SOLUTIONS[code],
    totalSqm: z.total, allocatedSqm: z.allocated, units: z.units, center, map: mapPosition(center), ...(Object.keys(extra).length ? { extra } : {}),
  });
}
for (const z of reference.zones.warehousing) {
  const code = ZONE_CODES[z.name];
  if (!code) { errors.push(`park without code: ${z.name}`); continue; }
  const g = geoByCode.get(GEO_ALIAS[code] ?? code);
  const center = CENTER_FALLBACK[code] ?? g?.center;
  if (!center) { errors.push(`park ${code}: no coordinates`); continue; }
  zones.push({
    code, kind: 'warehousing', name: bi(z.nameAr, z.name), typeLabel: bi('تخزين', 'Warehousing'), solutions: ['warehousing'],
    totalSqm: z.total, operator: bi(z.operatorAr, z.operator), occupancyPct: z.occupancy, center, map: mapPosition(center),
  });
}
if (zones.length !== 13) errors.push(`expected 13 zones, built ${zones.length}`);

const solutions = glance.solutions.map((s) => ({
  key: s.key,
  name: s.name,
  price: { qarPerSqmYear: s.price?.qarPerSqmYear ?? null, text: s.price?.text ?? bi('', '') },
  term: s.term ?? bi('', ''),
  notes: s.notes ?? bi('', ''),
  zones: s.zones ?? bi('', ''),
  zoneCodes: zones.filter((z) => z.solutions.includes(s.key)).map((z) => z.code),
}));
for (const s of solutions) if (!isBi(s.name)) errors.push(`solution ${s.key}: name missing`);

const zonesData = {
  totals: { zones: reference.zones.totals.zones, totalSqm: reference.zones.totals.totalSqm, allocatedSqm: reference.zones.totals.allocatedSqm, operationalRatePct: reference.zones.totals.operationalRate },
  zones,
  solutions,
  channels: glance.channels ?? [],
  procedure: glance.procedure ?? [],
  sources: glance.sources ?? bi('', ''),
};

// ----------------------------------------------------------------------------- knowledge
const principlesSrc = readOptional('knowledge/principles.json', { principles: [], serviceStandards: bi('', '') });
const changesSrc = readOptional('knowledge/today-vs-after.json', { changes: [] });
const journeysSrc = readOptional('knowledge/journeys.json', { journeys: [] });
const knowledge = {
  principles: principlesSrc.principles ?? [],
  serviceStandards: principlesSrc.serviceStandards ?? bi('', ''),
  changes: changesSrc.changes ?? [],
  journeys: (journeysSrc.journeys ?? []).map((j) => ({ n: j.n, title: j.title, services: j.services ?? [], withServices: j.withServices ?? [], summary: j.summary, steps: j.steps ?? [], metrics: j.metrics ?? [], integrations: j.integrations ?? [] })),
};
const activities = readOptional('activities.json', []);
const zoneCodes = new Set(zones.map((z) => z.code));
for (const a of activities) for (const code of a.zones ?? []) if (!zoneCodes.has(code)) errors.push(`activity ${a.code}: unknown zone ${code}`);

// ----------------------------------------------------------------------------- house style
// SPEC 3.7: no em dashes in user-facing text, and «طلب» / "request", never "case" or "ticket", in the
// investor-facing metadata. (The workflows and the guide text are transcribed from the owner's books
// word for word and are not checked here.)
function walkStrings(value, where, visit) {
  if (typeof value === 'string') visit(where, value);
  else if (Array.isArray(value)) value.forEach((item, i) => walkStrings(item, `${where}[${i}]`, visit));
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) walkStrings(item, `${where}.${key}`, visit);
}
const BANNED = [
  [/\u2014/, 'an em dash'],
  [/\b(case|cases|ticket|tickets)\b/i, '"case" or "ticket" (write "request")'],
  [/رقم الحالة|رقم التذكرة|التذكرة/, '«رقم الحالة» or «التذكرة» (write «الطلب»)'],
];
for (const code of DOMAIN_CODES) {
  // The investor actions are transcribed with the workflows; the rest of the metadata is the app's own copy.
  const { services: metaServices, ...intro } = meta[code];
  walkStrings(intro, `meta/${code}`, check);
  for (const m of metaServices) {
    const { actions: _actions, ...rest } = m;
    walkStrings(rest, `meta/${code} ${m.id}`, check);
  }
}
function check(where, text) {
  for (const [pattern, what] of BANNED) if (pattern.test(text)) errors.push(`${where}: ${what} in "${text.slice(0, 80)}"`);
}
const STRINGS_DIR = path.join(ROOT, 'src');
(function lintStrings(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) lintStrings(full);
    else if (entry.name === 'strings.ts') {
      fs.readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
        const code = line.replace(/^\s*(\/\/|\/?\*).*$/, '');
        if (code.includes('\u2014')) errors.push(`${path.relative(ROOT, full)}:${i + 1}: an em dash in user-facing text`);
      });
    }
  }
})(STRINGS_DIR);

// ----------------------------------------------------------------------------- write
if (errors.length) {
  console.error(`DATA BUILD FAILED — ${errors.length} problem(s):\n - ` + errors.join('\n - '));
  process.exit(1);
}
const sizes = {};
sizes['catalog.json'] = write('catalog.json', {
  edition: bi('دليل الخدمات ودليل أتمتة الخدمات والربط (الإصدار 4.1) وكتاب «سير عمل الخدمات» (الإصدار 1.1)، أكتوبر 2026', 'Service Guide and Services Automation & Integration Manual (version 4.1) and the Service Workflows book (version 1.1), October 2026'),
  generated: guide.generated ?? '',
  domains,
  services: details.map(({ description, benefits, who, steps, inputs, outputs, note, example, channel, kpi, trigger, output, flow, patterns: _p, integrations: _i, systems: _s, provides, fetched, receives, fields, actions, next, appNote, workflow, ...summary }) => summary),
});
for (const code of DOMAIN_CODES) sizes[`services-${code}.json`] = write(`services-${code}.json`, details.filter((d) => d.domain === code));
sizes['reference.json'] = write('reference.json', { integrations, patterns, systems, lanes, maturity, phases });
sizes['zones.json'] = write('zones.json', zonesData);
sizes['knowledge.json'] = write('knowledge.json', knowledge);
sizes['activities.json'] = write('activities.json', activities);
sizes['qatar.json'] = write('qatar.json', { viewBox: [0, 0, 100, mapHeight], path: outlinePath, note: 'Outline: Natural Earth (public domain), simplified. Zone positions are approximate.' });

for (const w of warn) console.warn('warning:', w);
console.log('data built:', Object.entries(sizes).map(([k, v]) => `${k} ${(v / 1024).toFixed(0)}k`).join(' · '));
console.log(`${details.length} services · ${zones.length} zones · ${integrations.length} integrations · ${activities.length} activities · ${knowledge.journeys.length} journeys · outline ${simple.length} points`);
