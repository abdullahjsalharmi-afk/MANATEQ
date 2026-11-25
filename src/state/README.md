# The state layer (`src/state`)

Everything a screen reads or changes goes through `@/state`. Read with `useApp(selector)`; change only with
the actions below. All world text is bilingual `L10n` (read it with `pick()`); all times are ms since epoch.

## The shape

`AppState = { version, settings, world, demo }` (types in `src/domain/types.ts`).

- `settings`: `{ lang: 'ar'|'en', theme: 'auto'|'light'|'dark', textSize: 0..3, onboarded, notifications }`.
- `demo`: `{ speed }` (1 normal, larger faster, 0 paused).
- `world` (one demo profile): `persona` ('guest'|'prospect'|'tenant'), `company | null`, `team[]`, `plots[]`,
  `leases[]`, `requests[]`, `invoices[]`, `docs[]`, `passes[]`, `notifications[]`, `appointments[]`,
  `drafts{serviceId → Draft}`, `eligibility | null`, `watchedZones[]`, `seq`.
- `RequestState`: `id`, `ref` ("MQ-2611-0042"), `serviceId`, `threadId` (A4 → A5 → A6 → A7 → A8 share one),
  `parentId?`, `createdAt`, `updatedAt`, `form`, `plotId?`, `zoneCode?`, `visits[]` (`{ step, enteredAt, doneAt?,
  stoppedAt?, outcome? }`), `current` (open step id or null), `status` ('active'|'needs_you'|'done'|'stopped'), `investorMs`,
  `docIds[]`, `amount?`, `rating?`, `prepaidDocId?` (the receipt that already covers the open step's payment:
  the deposit paid with the offer, A6, in the same thread; the step then asks for no payment),
  `reopenedAt?` and `reopenedRating?` (a low rating reopened the request: when, and the rating that did it;
  `rating` is always the latest rating given).
  `holdOf(request)` tells when a seeded step is held until.
- `Visit.stoppedAt`: the request was withdrawn while this step was open. The step did not finish, so it has no
  `doneAt`; it is never the open visit (`currentVisit`), never shown as done (timeline state `stopped`), and the
  standard clock counts only the share it had run when it was stopped.
- `AppNotification`: `{ id, at, kind, title, body, route?, read, subject?, resolvedAt? }`. `subject: { requestId?,
  step?, invoiceId? }` is what it is about. A "needs you" notification (`kind: 'action'`) is settled (`resolvedAt`
  set, and `read: true`) when the invoice it points to is paid, when the investor completes the step of its request,
  or when that request finishes or is withdrawn. Show a settled one as done, not as asking.
- `Appointment.requestId?`: the request it was booked with (E1 with «أريد حجز موعد»).
- A `Plot.id` and `Plot.number` are always a plot of its zone's layout (`plotsFor(zone)`, "BA-121").
- `Pass.kind` is `'visitor' | 'worker' | 'vehicle'`; `Pass.requestId?` is the request that issued it (D2).

## Reading: selectors (`useApp(selectX)` or `useApp(selectX(id))`)

| Selector | Returns |
|---|---|
| `selectNextStep` / `selectNextSteps` | `NextStep \| null` / `NextStep[]` most urgent first: `{ id, kind: 'request_action'\|'invoice'\|'start_service'\|'renewal', title, context, cta, route, urgency, dueAt?, invoiceId? }`. `invoiceId` is set on an invoice step, so the screen can open the payment sheet in place. A suggestion's `context` is the plot and the service's one-line `hint`. |
| `selectJourney` / `selectJourneyOfPlot(id)` | `Journey { station, plotId \| null, stations: [{ key, name, state, items: [{ serviceId, state: 'done'\|'current'\|'upcoming', open, requestId?, stoppedRequestId?, canStart }] }] }`. `open`: a request is open for the item now; in the station the investor stands in, the first item not done is `current` even when nothing is open (it means "next": label `current && !open` as next, not in progress). `stoppedRequestId`: the latest request for it was withdrawn and nothing newer exists. |
| `selectStation` | `'join' \| 'contract' \| 'build' \| 'operate'` |
| `selectActiveRequests` / `selectDoneRequests` | `RequestState[]` (waiting for the investor first / latest first) |
| `selectRequest(id)` · `selectThread(id)` · `selectRequestsOfPlot(id)` | one request / its chain oldest first / a plot's requests |
| `selectDocsOfRequest(id)` · `selectDeadline(id)` | `Doc[]` it issued / `number \| undefined` (renewal: lease end; offer: 14 days) |
| `selectPassesOfRequest(id)` | `Pass[]` the request issued (D2), latest first |
| `selectStepAmount(requestId: string \| undefined, action: Pick<StepAction, 'amount'> \| null \| undefined)` | `number \| undefined`: what the open step will charge (`request.amount`, else `amountFor`); undefined when it charges nothing (no action, or `request.prepaidDocId` is set) |
| `selectWaitingCount` · `selectUnreadCount` | badge numbers (a settled notification never counts as unread) |
| `selectDues` | `{ total, count, overdue, next: Invoice \| null }` |
| `selectInvoices` · `selectInvoice(id)` | outstanding first (soonest due), then paid (latest first) |
| `selectDocs` · `selectDoc(id)` · `selectDocsOfPlot(id)` | wallet documents, latest first |
| `selectPasses` · `selectPass(id)` | active first |
| `selectNotifications` | latest first |
| `selectPlots` · `selectPlot(id)` · `selectLeases` · `selectLeaseOfPlot(id)` | records as stored |
| `selectPlotsFor(serviceId)` | `Plot[]`: the investor's plots a request of the service can be started for (`plotsFor(world, serviceId)`): A8 only plots `leased` and not handed over; any other service every plot held (not `reserved`). Same array per world. |
| `selectHasPlots` | `boolean`: the company holds at least one plot (a plot only reserved by a running application does not count) |
| `selectRenewalTerms(requestId)` | `RenewalTerms \| undefined` for a B3 request: `{ plotId, until, years, ratePerSqm, annualRent, firstInstalment }`, by the rule the renewal applies when it finishes (one more term of the solution's length, the lease's own rate; no incentive is modelled). Same object per world. |
| `selectAppointments` · `selectDraft(serviceId)` · `selectCompany` · `selectPersona` · `selectSpeed` | |

Every selector that returns a list or an object gives the same value for the same world, even when
`selectX(id)` is built afresh on each render (lists are kept per world and per id): a screen re-renders
only when the world changes, and `useMemo` on a selected value holds. Do not build new arrays inside a
selector you pass to `useApp`.

## Reading one request

```ts
const ready = useCatalogueReady();                       // re-render when the workflows arrive
const service = peekServiceDetail(request.serviceId);     // '@/data/catalog'; undefined until loaded
const view = requestView(request, service, now, speed);   // RequestView
<Timeline items={timelineRows(view.timeline, lang, now)} />   // lang = useLang()
```

`RequestView = { status, holder: Holder | null, currentStep, pendingAction: StepAction | null, clock, progress (0-1),
timeline: TimelineEntry[], heldSince?, expectedAt?, finishedAt?, focus }`. `Holder = { lane, name, entity? }`; the
investor is "You", a national step is named after its platform, and `entity = { name, inText }` names the body
behind it in both languages ("Ministry of Municipality" / "the Ministry of Municipality"). `holderOf(step) → Holder`.

`view.focus: { step: WorkflowStep; holder: Holder; expectedAt?: number } | null` is the step a headline describes:
the open step, or, while the open step is a decision or a step Manateq's systems run by themselves, the next step a
person or an entity holds. Null when nothing human is left. Never put a step's raw text in a headline: use the
action title, the holder or `expectedAt`; the book's wording belongs in the timeline. `TimelineEntry = { id, step, kind, title, text, lane, holderName,
state: 'done'|'current'|'upcoming'|'stopped', time?, auto, outcome?, standard }` (`stopped`: the step that was open when
the investor withdrew; its `time` is when it was stopped). `timelineRows(entries, lang, now)` gives
`TimelineRow { id, title, text?, lane, holderName?, state, time?, auto, outcome?, standard? }` as display strings.

`view.clock` is the service-standard clock (`StandardClock { usedDays, targetDays | null, ratio | null, dayNumber }`),
in working days of the story: seeded requests carry calendar dates, live ones demo seconds, and the clock reads
both correctly. Never rebuild it from timestamps. Time waiting for the investor never counts. `targetDays` and
`ratio` are null when the standard has no duration, or promises an update per event rather than a deadline (C2,
C3): show the standard text, no ring and no "Day n of m". `standardClockOf(request, service, now, speed)` gives the clock alone.

### The action card

`view.pendingAction` is the `StepAction` of the open step: `{ step, flow: ActionAtom[], title, cta, detail, amount?,
document?, docs?, options?, fields? }`. Atoms: accept, pay, sign, upload, choose, form, rate, reference, declare,
schedule, acknowledge. When `options` exist, show the choice first, then only `stepTasks(serviceId, action, choice)`:

`stepTasks(serviceId: ServiceId, action: Pick<StepAction, 'step' | 'flow'>, choice?: string, request?: Pick<RequestState, 'prepaidDocId'>): ActionAtom[]`
(pass `request`: a prepaid step drops `pay`).

- B2 step 3: `guarantee` → upload; `deposit` → pay (nothing to pay when the offer, A6, already took the deposit:
  `request.prepaidDocId` names that receipt; show it with `selectDoc(request.prepaidDocId)`).
- D6 step 5: `rectified` → upload; `appeal` / `extension` → form (reason).
- B10 step 6: `paymentPlan` → choose only; `payNow` → pay (settles every unpaid invoice of the lease).

Where the step's own text says so, an option or a rating goes on at another step (`steeredMoves(serviceId, step)`
lists them): B2 step 3 `deposit` goes on to step 9 («a paid deposit is recorded without bank verification»: no
guarantee reading or bank check). The three rating steps say «a low rating reopens the request for the
supervisor»: with 1 or 2 stars D1 step 11 goes on to step 10, «Supervisor re-dispatches», E1 step 9 goes back
to step 5 (the Business Services Center handles it) and E6 step 10 to step 6 (the owner investigates); the
workflow then runs as written until the investor is asked to rate again. 3 stars or more finishes it.

The amount to show is `useApp(selectStepAmount(request.id, action))`: exactly what the state will charge.
`amountFor(world: World, request: RequestState, action: Pick<StepAction, 'amount'>): number` is the rule behind it.

## Changing: actions (all from `@/state`; each reads the clock once)

| Action | What it does |
|---|---|
| `startRequest(serviceId, form?, { plotId?, zoneCode?, threadId?, parentId? }) → id` | Starts a service. `plotId` must be one of the investor's plots (or a `plot` field in `form`); for the land application (A4) it may be a plot of a zone's layout ("AW-117") with `zoneCode`. Anything else is ignored. A service that `needsTenancy`, started with no plot while exactly one plot qualifies (`plotsFor(world, serviceId)`), takes that plot; with several, ask the investor. E1 with `bookAppointment: true` and `preferredDate` books an appointment at 10:00 that day (`form.channel` or in person), linked by `requestId`, and notifies. Removes the service's draft. |
| `completeStep(requestId: string, payload?: ActPayload) → StepResult` | `actOnRequest`, telling what it produced: `StepResult = { ok: boolean; receiptDocIds: string[] }` (oldest first). Run it when the payment sheet confirms, then show `selectDoc(receiptDocIds.at(-1))?.ref` ("RCP-2026-0101"): the receipt really filed. |
| `actOnRequest(id, { choice?, form?, files?, rating? }) → boolean` | Completes the open investor step and settles the notifications that asked for it. `pay` files a paid invoice and receipt; `sign` / `accept` are recorded; `rate` takes 1-5 or `{ stars, comment? }`. Some choices steer: B2 `deposit` skips the guarantee checks; B4 `withdraw` stops the request; B7 `acceptCharge` skips the re-inspection; B10 and D6 choices decide the next decision. A D1 rating of 1-2 stars reopens the report (`reopenedAt`, `reopenedRating`, a notification). |
| `fastForwardRequest(id)` | Demo control "تقديم الزمن": the open non-investor step finishes now. |
| `cancelRequest(id)` | The investor withdraws an open request (status `stopped`); the open step gets `stoppedAt`, not `doneAt`. Its asks are settled, an appointment booked with it is cancelled, and an application gives its plot back. Only an application of their own can be withdrawn: a service the investor starts, and the stages of a land application that follow it (`withdrawable(serviceId)` in `@/domain/chains`). For a request Manateq started (an invoice, a renewal, an inspection, a notice, the tracking of a ministry permit) it does nothing. Offer it only when `useApp(selectCanWithdraw(request.id))` is true. |
| `payInvoice(id) → receiptDocId \| null` | Demo payment; files the receipt in the wallet, settles the reminders to pay it, and adds a read «استلمنا سدادك» / "Payment received" notification that opens the receipt (`/account/wallet/<receiptDocId>`). A payment made inside a request step (`pay`) leaves the same note. The note's id is `pay-<receiptDocId>`: it takes no number from the sequence, so the seeded ids stay as they are. |
| `issuePass({ kind, holder, idOrPlate?, company?, plotId, from, to }) → id` · `revokePass(id)` | Wallet passes. |
| `bookAppointment({ at, topic, channel: 'in_person'\|'video'\|'phone' }) → id` · `cancelAppointment(id)` | BSC visits. |
| `markRead(id)` · `markAllRead()` | Notifications. |
| `saveDraft(serviceId, form, page?)` or `saveDraft({ serviceId, form, page? })` · `clearDraft(serviceId)` | One draft per service. |
| `saveEligibility({ activityCode, solution, areaSqm, verdict, zoneCodes, at? })` | Keeps the latest check (use `toEligibilityResult` from `@/domain/eligibility`). |
| `toggleWatchZone(code)` · `setDelegated(memberId, on)` | Zone alerts; team mandates (the owner keeps theirs). |
| `enterAs(persona)` · `signOut()` · `resetDemo()` | Seed a profile afresh / back to welcome / restart the profile at speed 1. |
| `setSpeed(n)` · `setLang(l)` · `setTheme(t)` · `setTextSize(n)` · `setNotifications(on)` | Settings. |
| `tick(now)` | Called once a second by `App.tsx`; nobody else calls it. |

## Names, references and text the state writes

- `receiptRefFor(invoiceRef: string): string` ("INV-2026-0051" → "RCP-2026-0051") is the one rule for a
  receipt's reference (also from `@/state`). Never derive a receipt number from a request.
- `requestLabelOf(service: Pick<ServiceSummary, 'label' | 'requestLabel'>): L10n` (`@/data/catalog`) is what a
  request is called once it exists: a noun («طلب أرض» / "Land application"), never the call to action that starts it.
  The state uses it in notifications and in the next step's context; screens use it for request rows and titles.
  `ServiceSummary.requestLabel?` is set only where the label is a call to action. `ServiceSummary.hint?` is the
  one-line suggestion text of the next-step card.
- `Integration.entity?: { name: L10n; inText: L10n }` (`reference.json`) is the body behind a national platform.
- `FieldDef.showIf?: { key: string; equals: string | boolean }`: the field is asked only while that answer has that
  value; while hidden it is not asked, checked, reviewed or sent (E1 `preferredDate`).
- `@/domain/text`: `keepWhole(text: string): string` keeps a code, an amount or a date on one line: a word joiner
  (U+2060) after each real hyphen, the same rule as `keep()` / `ltr()` in `@/app/i18n` (never U+2011, which the
  fonts lack), and no-break spaces. It is idempotent and only for display text, never for ids. `DOT` (no-break
  space, `·`, space) is the list separator: the dot stays with the item before it, so no line starts with a dot.
  Document titles, invoice titles, notifications and the next step are written with them, so their text carries
  invisible joiners and no-break spaces: compare it as plain text in tests.
- `@/domain/standard`: `durationText(value, unit, lang, options?: DurationOptions)` and
  `standardHeadline(standard, lang, options?: DurationOptions)`; `DurationOptions = { afterPreposition?: boolean }`
  gives the Arabic genitive dual after a preposition («في يومَي عمل»).
- `@/domain/plots` (also from `@/state`): `plotsFor(zoneCode): PlotCell[]` is a zone's layout;
  `plotsFor(world, serviceId): Plot[]` the investor's plots the service can be started for (see `selectPlotsFor`);
  `needsTenancy(service: Pick<ServiceSummary, 'audiences'> & { fields? }): boolean` is true when the service is only
  for a company that holds a plot (offered to tenants and not to prospects, or, given the full record, its form
  requires a plot). Use it with `selectHasPlots` to stop offering Start to a company with no plot.
- Documents a request issues name it with `requestLabelOf` in their «الخدمة» / "Service" line and carry no issue-date
  line: the issue date is `doc.issuedAt`, shown once by the screen.
- `leaseOfPlot(world: Pick<World, 'plots' | 'leases'>, plotId: string | undefined): Lease | undefined` lives in
  `@/domain/plots`; `plotIdOfDoc(world: World, doc: Doc): string | undefined` (selectors) finds the plot a document is about.

## The demo clock

- One working day of the story lasts 4.5 s at speed 1 (`DAY_MS`); a step takes 1.2 to 12 s (an instant one 1.2 s), a decision 0.9 s.
  Step times come from the workflow's own step standards, scaled so the usual path uses at most 80% of the
  service standard. Speed divides every duration; 0 pauses (nothing moves,
  and on resume open steps start their time again).
- Investor steps wait for `actOnRequest`. A step already answered in the start flow (A4 documents and plot,
  G1 documents) or by a correction that loops back to it (C6, B2, E5, G1) is never asked twice.
- Seeded requests are replayed on calendar time and some are held (`holdOf`) so the demo opens on a moment
  ("with the Ministry of Municipality"); fast-forward releases them.
- The calendar raises overdue invoices, expires passes, closes past appointments and opens the renewal (B3)
  120 days before a lease ends. Finished requests issue their documents and start their followers
  (A4 → A5 → A6 → A7; A7, B3 and B4 → B2; A8 → C4).

## The demo worlds (all illustrative)

- **guest**: empty; next step is the eligibility check.
- **prospect** «شركة النموذج للتجارة» / "Sample Trading Co." (dry warehousing): no plot, one saved eligibility
  check (logistics, 5,000 m², targeted in BA, AW, JS, AS); next step is the land application (A4).
- **tenant** «شركة المثال للصناعات» / "Example Industries Co.": BA-121 (logistics 10,000 m², operating, rent
  due in 5 days), AW-116 (logistics 5,000 m², building: permit C2 held at the Ministry, utilities C4 at Kahramaa),
  AK-113 (open yard 5,000 m², renewal B3 waiting to be accepted, signed and paid), the Kahramaa request at day 8 of
  10 and expected within the 2 days left, a street-light report (D1) with
  the field team, an active worker pass and an expired visitor pass, one appointment in two days.

Demo links: `?demo=tenant|prospect|guest`, `?reset=1`, `?lang=ar|en`, `?theme=light|dark|auto`, `?text=0..3`,
`?speed=n` (see `boot.ts`).

## Examples

```ts
const next = useApp(selectNextStep);                      // Home card; null → the calm all-clear
const dues = useApp(selectDues);                          // dues.next?.amount
const id = startRequest('D1', { category: 'lighting', photo: { name: 'p.jpg' } }, { plotId: 'BA-121' });
actOnRequest(id, { rating: { stars: 5, comment: 'شكرًا' } });
actOnRequest(renewalId, { form: {} });                    // accept + sign + pay in one go after the sheets
const receipt = payInvoice(dues.next!.id);                 // then navigate(`/account/wallet/${receipt}`)
const { receiptDocIds } = completeStep(requestId, {});     // a pay step: show selectDoc(receiptDocIds.at(-1))?.ref
```
