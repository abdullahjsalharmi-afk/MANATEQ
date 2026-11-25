/**
 * Catalogue types — the contract between the generated data (src/data/generated/*.json, produced by
 * scripts/build-data.mjs from the Service Guide v4.1 and the Automation & Integration Manual v4.1)
 * and the rest of the app. Every user-visible text in the data is bilingual (`L10n`).
 */

export type Lang = 'ar' | 'en';

/** A bilingual string. Read it with `pick()` from the i18n module. */
export interface L10n {
  ar: string;
  en: string;
}

export type DomainCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

/** 'A1' … 'G5' */
export type ServiceId = string;

/** Who holds a workflow step. */
export type Lane =
  | 'inv' // the investor (or the consultant / contractor acting for them)
  | 'one' // Manateq One — the portal and this app
  | 'eng' // the rules and workflow engine (automatic)
  | 'staff' // Manateq staff — Business Services Center and departments
  | 'nat' // national platforms and counterpart entities
  | 'field'; // field teams and operations

export type StepKind = 'start' | 'auto' | 'human' | 'gate' | 'stop' | 'end';

export type Initiator = 'investor' | 'manateq' | 'partner' | 'system';

export type Audience = 'prospect' | 'tenant' | 'consultant' | 'contractor' | 'operator' | 'vendor' | 'staff';

/** Where a service sits for the investor. The first five follow the journey; the rest support it. */
export type Stage = 'explore' | 'apply' | 'contract' | 'build' | 'operate' | 'account' | 'support' | 'partner' | 'internal';

export type StandardUnit = 'instant' | 'minute' | 'hour' | 'working_day' | 'day' | 'month';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'area' // m²
  | 'amount' // QAR
  | 'select'
  | 'date'
  | 'file' // a document upload; the label is the document's name
  | 'photo'
  | 'plot' // one of the investor's plots
  | 'zone'
  | 'activity' // a business activity
  | 'toggle'
  | 'person'; // a named contact or visitor

/** The atomic things an investor can be asked to do in the middle of a request. */
export type ActionAtom =
  | 'accept'
  | 'pay'
  | 'sign'
  | 'upload'
  | 'choose'
  | 'form'
  | 'rate'
  | 'reference'
  | 'declare'
  | 'schedule'
  | 'acknowledge';

export type AmountBasis = 'deposit' | 'rent' | 'fee' | 'balance' | 'fine' | 'other';

export interface Option extends L10n {
  value: string;
}

export interface FieldDef {
  key: string;
  type: FieldType;
  label: L10n;
  required: boolean;
  help?: L10n;
  options?: Option[];
  /**
   * The field is asked only while another answer of the same form has this value (a toggle that is on,
   * an option that is picked). While hidden it is neither asked, checked, reviewed nor sent.
   */
  showIf?: { key: string; equals: string | boolean };
}

/** The published service standard. `value`/`unit` hold the headline duration when one is stated. */
export interface Standard extends L10n {
  value: number | null;
  unit: StandardUnit | null;
}

/** Something the app fetches so the investor is never asked for it. `source` is an integration (I#) or system (S#) id. */
export interface Fetched extends L10n {
  source?: string;
}

export type ReceiveKind = 'document' | 'decision' | 'status' | 'payment' | 'pass' | 'appointment' | 'other';

export interface Receives extends L10n {
  kind: ReceiveKind;
}

/** What the app asks the investor to do at one investor-lane step of a workflow. */
export interface StepAction {
  /** The workflow step id this action belongs to. */
  step: number;
  /** Ordered atomic tasks, e.g. ['accept', 'pay']. */
  flow: ActionAtom[];
  title: L10n;
  cta: L10n;
  detail: L10n;
  amount?: { basis: AmountBasis; label: L10n };
  /** The name of the document being signed (when the flow includes 'sign'). */
  document?: L10n;
  /** The documents to upload (when the flow includes 'upload'). */
  docs?: L10n[];
  options?: Option[];
  fields?: FieldDef[];
}

export type TriggerKind = 'investor' | 'after' | 'schedule' | 'event' | 'staff';

/** How a case of a service comes to exist. */
export interface TriggeredBy {
  kind: TriggerKind;
  /** For kind 'after': the services whose completion starts this one. */
  after?: ServiceId[];
  note: L10n;
}

export interface WorkflowStep {
  id: number;
  lane: Lane;
  kind: StepKind;
  label: L10n;
  text: L10n;
  /** The step-level standard as text ('Instant', '2 working days', …). May be empty. */
  std: L10n;
  /** Pattern / integration / system ids that make the step possible (P#, I#, S#). */
  enablers: string[];
  /** Gate branches. */
  yes?: number;
  no?: number;
  /** Explicit successor (otherwise the next id). */
  next?: number;
  /** Loop back to an earlier step once this one is done. */
  back?: number;
}

export interface Workflow {
  lanes: Lane[];
  standard: L10n;
  exceptions: L10n[];
  data: L10n;
  steps: WorkflowStep[];
}

/** The light record of a service, available synchronously for lists, search and Home. */
export interface ServiceSummary {
  id: ServiceId;
  domain: DomainCode;
  /** The official name in the Service Guide. */
  name: L10n;
  /** The plain, verb-first label the investor sees. */
  label: L10n;
  /**
   * A request of the service once it exists, as a noun («طلب أرض» / "Land application"), for lists,
   * titles and notifications. Only set where the label is a call to action; read it with `requestLabelOf`.
   */
  requestLabel?: L10n;
  /** One everyday sentence. */
  summary: L10n;
  /** One short line for the next-step card when the service is suggested (no more than one line on a phone). */
  hint?: L10n;
  promise: L10n;
  initiator: Initiator;
  startable: boolean;
  audiences: Audience[];
  stage: Stage;
  standard: Standard;
  /** Automation level today → target (L0–L5). Indicative. */
  level: { now: number; target: number };
  /** Roadmap phase (0–3) in which the target state lands. */
  phase: number;
  triggeredBy: TriggeredBy;
  /** Lanes that take part in the workflow, for the "who is involved" hint. */
  lanes: Lane[];
}

/** The full record of a service, loaded per domain on demand. */
export interface ServiceDetail extends ServiceSummary {
  description: L10n;
  benefits: L10n[];
  who: L10n[];
  /** "How to request the service" — the investor's steps in the target state. */
  steps: L10n[];
  inputs: L10n;
  outputs: L10n;
  note: L10n;
  example: L10n;
  channel: L10n;
  kpi: L10n;
  trigger: L10n;
  output: L10n;
  /** "Behind the scenes" — the automated path. */
  flow: L10n[];
  patterns: string[];
  integrations: string[];
  systems: string[];
  provides: L10n[];
  fetched: Fetched[];
  receives: Receives[];
  fields: FieldDef[];
  actions: StepAction[];
  next: ServiceId[];
  appNote: L10n;
  workflow: Workflow;
}

export interface Domain {
  code: DomainCode;
  name: L10n;
  tagline: L10n;
  purpose: L10n;
  customers: L10n;
  journey: L10n;
  topTasks: L10n[];
  services: ServiceId[];
}

export interface Integration {
  id: string;
  name: L10n;
  short: L10n;
  purpose: L10n;
  group: L10n;
  status: L10n;
  phase: number;
  /** True when the platform is available nationally today (the app must be honest about the rest). */
  live: boolean;
  /**
   * The entity behind the platform, where it is a government body or utility: `name` as a headline
   * ("Ministry of Municipality"), `inText` inside a sentence ("the Ministry of Municipality").
   */
  entity?: { name: L10n; inText: L10n };
}

export interface Pattern {
  id: string;
  name: L10n;
  short: L10n;
}

export interface SystemRef {
  id: string;
  name: L10n;
  status: L10n;
}

export interface Phase {
  n: number;
  name: L10n;
  when: L10n;
}

export interface Reference {
  integrations: Integration[];
  patterns: Pattern[];
  systems: SystemRef[];
  lanes: Record<Lane, { name: L10n; short: L10n }>;
  /** Index = level 0–5. */
  maturity: L10n[];
  phases: Phase[];
}

export type SolutionKey = 'logistics' | 'industrial' | 'commercial' | 'openYard' | 'warehousing';

export interface Solution {
  key: SolutionKey;
  name: L10n;
  /** Published price. `qarPerSqmYear` is null where operators set the price. */
  price: { qarPerSqmYear: number | null; text: L10n };
  term: L10n;
  notes: L10n;
  zones: L10n;
  zoneCodes: string[];
}

export type ZoneKind = 'land' | 'warehousing';

export interface Zone {
  code: string;
  kind: ZoneKind;
  name: L10n;
  typeLabel: L10n;
  solutions: SolutionKey[];
  totalSqm: number;
  /** Land zones. */
  allocatedSqm?: number;
  units?: number;
  /** Warehousing parks. */
  operator?: L10n;
  occupancyPct?: number;
  /** [longitude, latitude] — approximate, for the schematic map. */
  center?: [number, number];
  /** Position on the schematic map, 0–100 on both axes of the map's box. */
  map: { x: number; y: number };
  /** Facts whose provenance is not the v4.1 guides; always shown with an "illustrative" label. */
  extra?: {
    plots?: number;
    distancesKm?: { airport?: number; port?: number; doha?: number; landBorder?: number };
    sectors?: L10n[];
    utilities?: string[];
  };
}

export interface ZonesData {
  totals: { zones: number; totalSqm: number; allocatedSqm: number; operationalRatePct: number };
  zones: Zone[];
  solutions: Solution[];
  channels: { key: string; name: L10n; what: L10n; contact: string | null }[];
  procedure: L10n[];
  sources: L10n;
}

export interface Principle {
  n: number;
  title: L10n;
  text: L10n;
}

export interface JourneyStep {
  n: number;
  lane: L10n;
  laneKey: Lane | 'other';
  what: L10n;
  services: ServiceId[];
  integrations: string[];
  patterns: string[];
  automated: boolean;
}

export interface PriorityJourney {
  n: number;
  title: L10n;
  services: ServiceId[];
  withServices: ServiceId[];
  summary: L10n;
  steps: JourneyStep[];
  metrics: L10n[];
  integrations: string[];
}

export interface Knowledge {
  principles: Principle[];
  serviceStandards: L10n;
  changes: { today: L10n; after: L10n }[];
  journeys: PriorityJourney[];
}

/** A business activity for the eligibility check. The list and its rules are illustrative. */
export interface Activity {
  code: string;
  name: L10n;
  sector: L10n;
  /** Solutions the activity can use. */
  solutions: SolutionKey[];
  /** Zone codes where the activity is targeted. */
  zones: string[];
  /** 'review' activities need a planning review instead of an instant answer. */
  verdict: 'targeted' | 'review' | 'not_targeted';
  hazard?: 'low' | 'medium' | 'high';
  reason?: L10n;
}

export interface Catalog {
  edition: L10n;
  generated: string;
  domains: Domain[];
  services: ServiceSummary[];
}
