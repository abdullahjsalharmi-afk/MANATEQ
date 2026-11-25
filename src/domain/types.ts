/**
 * State types — everything the demo "world" holds for one persona, plus settings.
 * All of it is plain JSON so it can be persisted and restored as is.
 */
import type { Lane, L10n, Lang, ServiceId, SolutionKey } from '@/data/types';

export type Persona = 'guest' | 'prospect' | 'tenant';
export type ThemeChoice = 'auto' | 'light' | 'dark';
/** 0 = compact … 3 = largest. */
export type TextSize = 0 | 1 | 2 | 3;

export interface Settings {
  lang: Lang;
  theme: ThemeChoice;
  textSize: TextSize;
  /** True once the welcome screen has been completed. */
  onboarded: boolean;
  notifications: boolean;
}

export interface Signatory {
  name: L10n;
  role: L10n;
}

export interface Company {
  name: L10n;
  /** Commercial registration number (demo). */
  cr: string;
  activity: L10n;
  activityCode: string;
  signatory: Signatory;
  /** When the profile was last synchronised with the Government Data Exchange (ms since epoch). */
  syncedAt: number;
}

export interface TeamMember {
  id: string;
  name: L10n;
  role: L10n;
  /** What the person may do on behalf of the company. */
  scope: 'owner' | 'finance' | 'engineering' | 'operations';
  delegated: boolean;
}

export type PlotStatus = 'reserved' | 'leased' | 'handed_over' | 'building' | 'operating';

export interface Plot {
  id: string;
  /** The plot number as printed on documents, e.g. "BA-117" (one of its zone's layout, see `plotsFor`). */
  number: string;
  zoneCode: string;
  areaSqm: number;
  solution: SolutionKey;
  status: PlotStatus;
  leaseId?: string;
}

export interface Lease {
  id: string;
  ref: string;
  plotId: string;
  /** ms since epoch */
  startsAt: number;
  endsAt: number;
  ratePerSqmYear: number;
  annualRent: number;
  status: 'active' | 'expiring' | 'ended';
}

export type FormValue = string | number | boolean | null | { name: string; size?: number } | { name: string; id?: string; phone?: string };

/** One visited step of a request's workflow. */
export interface Visit {
  step: number;
  enteredAt: number;
  doneAt?: number;
  /**
   * The request was withdrawn while this step was open: when it was stopped. The step did not finish, so
   * `doneAt` stays empty; a stopped visit is never the open one (`currentVisit`).
   */
  stoppedAt?: number;
  /** Gate outcome; on an investor step that loops back, "no" means the investor declined the loop and went on. */
  outcome?: 'yes' | 'no';
}

export type RequestStatus =
  | 'active' // moving; someone else holds it
  | 'needs_you' // waiting for the investor
  | 'done'
  | 'stopped'; // closed without the usual outcome (with a reason)

export interface RequestState {
  id: string;
  /** Human reference, e.g. "MQ-2611-0042". */
  ref: string;
  serviceId: ServiceId;
  /** Requests that belong to one investor intent share a thread (e.g. A4 → A5 → A6 → A7 → A8). */
  threadId: string;
  parentId?: string;
  createdAt: number;
  updatedAt: number;
  form: Record<string, FormValue>;
  plotId?: string;
  zoneCode?: string;
  visits: Visit[];
  /** The step currently open, or null when the request is finished. */
  current: number | null;
  status: RequestStatus;
  /** Scripted gate outcomes for the demo; gates not listed take the "yes" branch. */
  decisions?: Record<number, 'yes' | 'no'>;
  /** Total time (ms) spent waiting for the investor, excluded from the service-standard clock. */
  investorMs: number;
  /** Ids of documents issued by this request. */
  docIds: string[];
  /** An amount attached to the request (deposit, fee…), in QAR. */
  amount?: number;
  /**
   * The open step's payment was already made earlier in the thread (the deposit, paid with the offer):
   * the receipt that covers it. The step asks for no payment.
   */
  prepaidDocId?: string;
  /** The investor's latest rating of the outcome (stars 1-5 and an optional comment). */
  rating?: { stars: number; comment?: string };
  /**
   * A low rating reopened the request (D1 step 11: "a low rating reopens the request for the supervisor"):
   * when it was reopened, and the rating that reopened it. `rating` keeps the latest rating given.
   */
  reopenedAt?: number;
  reopenedRating?: { stars: number; comment?: string };
}

export type InvoiceStatus = 'due' | 'overdue' | 'paid';

export interface Invoice {
  id: string;
  ref: string;
  title: L10n;
  leaseId?: string;
  requestId?: string;
  amount: number;
  issuedAt: number;
  dueAt: number;
  status: InvoiceStatus;
  paidAt?: number;
  receiptDocId?: string;
}

export type DocKind = 'contract' | 'offer' | 'noc' | 'permit' | 'certificate' | 'receipt' | 'statement' | 'letter' | 'report';

export interface DocLine {
  label: L10n;
  value: L10n;
}

export interface Doc {
  id: string;
  ref: string;
  kind: DocKind;
  title: L10n;
  issuedAt: number;
  issuer: L10n;
  serviceId?: ServiceId;
  requestId?: string;
  /** The code a third party types or scans to verify the document. */
  verifyCode: string;
  signed: boolean;
  lines: DocLine[];
}

export type PassKind = 'visitor' | 'worker' | 'vehicle';

export interface Pass {
  id: string;
  kind: PassKind;
  holder: string;
  /** ID number for a person, plate for a vehicle. */
  idOrPlate?: string;
  company?: string;
  plotId: string;
  from: number;
  to: number;
  status: 'active' | 'expired' | 'revoked';
  code: string;
  /** The request that issued the pass, when it came from one (D2). */
  requestId?: string;
}

export type NotificationKind = 'action' | 'update' | 'done' | 'info';

export interface AppNotification {
  id: string;
  at: number;
  kind: NotificationKind;
  title: L10n;
  body: L10n;
  /** Hash route to open, e.g. "/requests/r3". */
  route?: string;
  read: boolean;
  /** What the notification is about, so it can be settled when that is done. */
  subject?: NotificationSubject;
  /**
   * A "needs you" notification whose ask was answered: the invoice was paid, the step completed, or the
   * request finished or was withdrawn. Settled notifications are also `read`.
   */
  resolvedAt?: number;
}

/** The record a notification is about: a request (and the step it asked for) or an invoice. */
export interface NotificationSubject {
  requestId?: string;
  step?: number;
  invoiceId?: string;
}

export interface Appointment {
  id: string;
  at: number;
  topic: L10n;
  channel: 'in_person' | 'video' | 'phone';
  status: 'booked' | 'done' | 'cancelled';
  /** The request the appointment was booked with (E1 with "book an appointment"). */
  requestId?: string;
}

/** A started-but-unsent request form. */
export interface Draft {
  serviceId: ServiceId;
  form: Record<string, FormValue>;
  page: number;
  savedAt: number;
}

export interface EligibilityResult {
  at: number;
  activityCode: string;
  solution: SolutionKey;
  areaSqm: number;
  verdict: 'targeted' | 'review' | 'not_targeted';
  zoneCodes: string[];
}

export interface World {
  persona: Persona;
  company: Company | null;
  team: TeamMember[];
  plots: Plot[];
  leases: Lease[];
  requests: RequestState[];
  invoices: Invoice[];
  docs: Doc[];
  passes: Pass[];
  notifications: AppNotification[];
  appointments: Appointment[];
  drafts: Record<ServiceId, Draft>;
  eligibility: EligibilityResult | null;
  /** Zone codes the investor follows for availability alerts. */
  watchedZones: string[];
  /** Counter for human-readable references. */
  seq: number;
}

export interface DemoState {
  /** Simulation speed multiplier (1 = normal demo pace). 0 pauses the simulation. */
  speed: number;
}

export interface AppState {
  /** Bumped when the persisted shape changes; older saves are discarded. */
  version: number;
  settings: Settings;
  world: World;
  demo: DemoState;
}

/** A pending thing the investor should do, from any source. Home shows the most urgent one. */
export interface NextStep {
  id: string;
  kind: 'request_action' | 'invoice' | 'start_service' | 'renewal';
  title: L10n;
  context: L10n;
  cta: L10n;
  /** Hash route the button opens. */
  route: string;
  /** For an invoice step: the invoice, so the screen can open the payment sheet in place. */
  invoiceId?: string;
  /** Lower sorts first. */
  urgency: number;
  dueAt?: number;
}

export interface Holder {
  lane: Lane;
  /** A specific entity name when the workflow step names one (e.g. the Ministry of Municipality). */
  name: L10n;
  /**
   * The government body or utility behind a national platform, when there is one: `name` for a headline
   * ("Ministry of Municipality"), `inText` inside a sentence ("With the Ministry of Municipality").
   */
  entity?: { name: L10n; inText: L10n };
}
