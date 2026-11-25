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
  outcome? }`), `current` (open step id or null), `status` ('active'|'needs_you'|'done'|'stopped'), `investorMs`,
  `docIds[]`, `amount?`, `rating?`. `holdOf(request)` tells when a seeded step is held until.
- A `Plot.id` and `Plot.number` are always a plot of its zone's layout (`plotsFor(zone)`, "BA-121").
- `Pass.kind` is `'visitor' | 'worker' | 'vehicle'`.

## Reading: selectors (`useApp(selectX)` or `useApp(selectX(id))`)

| Selector | Returns |
|---|---|
| `selectNextStep` / `selectNextSteps` | `NextStep \| null` / `NextStep[]` most urgent first: `{ id, kind: 'request_action'\|'invoice'\|'start_service'\|'renewal', title, context, cta, route, urgency, dueAt? }` |
| `selectJourney` / `selectJourneyOfPlot(id)` | `Journey { station, plotId \| null, stations: [{ key, name, state, items: [{ serviceId, state: 'done'\|'current'\|'upcoming', requestId?, canStart }] }] }` |
| `selectStation` | `'join' \| 'contract' \| 'build' \| 'operate'` |
| `selectActiveRequests` / `selectDoneRequests` | `RequestState[]` (waiting for the investor first / latest first) |
| `selectRequest(id)` · `selectThread(id)` · `selectRequestsOfPlot(id)` | one request / its chain oldest first / a plot's requests |
| `selectDocsOfRequest(id)` · `selectDeadline(id)` | `Doc[]` it issued / `number \| undefined` (renewal: lease end; offer: 14 days) |
| `selectWaitingCount` · `selectUnreadCount` | badge numbers |
| `selectDues` | `{ total, count, overdue, next: Invoice \| null }` |
| `selectInvoices` · `selectInvoice(id)` | outstanding first (soonest due), then paid (latest first) |
| `selectDocs` · `selectDoc(id)` · `selectDocsOfPlot(id)` | wallet documents, latest first |
| `selectPasses` · `selectPass(id)` | active first |
| `selectNotifications` | latest first |
| `selectPlots` · `selectPlot(id)` · `selectLeases` · `selectLeaseOfPlot(id)` | records as stored |
| `selectAppointments` · `selectDraft(serviceId)` · `selectCompany` · `selectPersona` · `selectSpeed` | |

Lists keep their identity between renders; do not build new arrays inside a selector you pass to `useApp`.

## Reading one request

```ts
const ready = useCatalogueReady();                       // re-render when the workflows arrive
const service = peekServiceDetail(request.serviceId);     // '@/data/catalog'; undefined until loaded
const view = requestView(request, service, now, speed);   // RequestView
<Timeline items={timelineRows(view.timeline, lang, now)} />   // lang = useLang()
```

`RequestView = { status, holder: Holder | null, currentStep, pendingAction: StepAction | null, clock, progress (0-1),
timeline: TimelineEntry[], heldSince?, expectedAt?, finishedAt? }`. `Holder = { lane, name }`; the investor is "You",
a national step is named after its platform. `TimelineEntry = { id, step, kind, title, text, lane, holderName,
state: 'done'|'current'|'upcoming', time?, auto, outcome?, standard }`. `timelineRows(entries, lang, now)` gives
`TimelineRow { id, title, text?, lane, holderName?, state, time?, auto, outcome?, standard? }` as display strings.

`view.clock` is the service-standard clock (`StandardClock { usedDays, targetDays | null, ratio | null, dayNumber }`),
in working days of the story: seeded requests carry calendar dates, live ones demo seconds, and the clock reads
both correctly. Never rebuild it from timestamps. Time waiting for the investor never counts. `ratio` is null when
the standard has no duration. `standardClockOf(request, service, now, speed)` gives the clock alone.

### The action card

`view.pendingAction` is the `StepAction` of the open step: `{ step, flow: ActionAtom[], title, cta, detail, amount?,
document?, docs?, options?, fields? }`. Atoms: accept, pay, sign, upload, choose, form, rate, reference, declare,
schedule, acknowledge. When `options` exist, show the choice first, then only `stepTasks(serviceId, action, choice)`:

- B2 step 3: `guarantee` → upload; `deposit` → pay (asks nothing more if the offer, A6, already took the deposit).
- D6 step 5: `rectified` → upload; `appeal` / `extension` → form (reason).
- B10 step 6: `paymentPlan` → choose only; `payNow` → pay (settles every unpaid invoice of the lease).

The amount to show is `request.amount` (set as soon as the step opens).

## Changing: actions (all from `@/state`; each reads the clock once)

| Action | What it does |
|---|---|
| `startRequest(serviceId, form?, { plotId?, zoneCode?, threadId?, parentId? }) → id` | Starts a service. `plotId` must be one of the investor's plots (or a `plot` field in `form`); for the land application (A4) it may be a plot of a zone's layout ("AW-117") with `zoneCode`. Anything else is ignored. Removes the service's draft. |
| `actOnRequest(id, { choice?, form?, files?, rating? }) → boolean` | Completes the open investor step. `pay` files a paid invoice and receipt; `sign` / `accept` are recorded; `rate` takes 1-5 or `{ stars, comment? }`. Some choices steer: B4 `withdraw` stops the request; B7 `acceptCharge` skips the re-inspection; B10 and D6 choices decide the next decision. |
| `fastForwardRequest(id)` | Demo control "تقديم الزمن": the open non-investor step finishes now. |
| `cancelRequest(id)` | Withdraws an open request (status `stopped`). An application gives its plot back. |
| `payInvoice(id) → receiptDocId \| null` | Demo payment; files the receipt in the wallet. |
| `issuePass({ kind, holder, idOrPlate?, company?, plotId, from, to }) → id` · `revokePass(id)` | Wallet passes. |
| `bookAppointment({ at, topic, channel: 'in_person'\|'video'\|'phone' }) → id` · `cancelAppointment(id)` | BSC visits. |
| `markRead(id)` · `markAllRead()` | Notifications. |
| `saveDraft(serviceId, form, page?)` or `saveDraft({ serviceId, form, page? })` · `clearDraft(serviceId)` | One draft per service. |
| `saveEligibility({ activityCode, solution, areaSqm, verdict, zoneCodes, at? })` | Keeps the latest check (use `toEligibilityResult` from `@/domain/eligibility`). |
| `toggleWatchZone(code)` · `setDelegated(memberId, on)` | Zone alerts; team mandates (the owner keeps theirs). |
| `enterAs(persona)` · `signOut()` · `resetDemo()` | Seed a profile afresh / back to welcome / restart the profile at speed 1. |
| `setSpeed(n)` · `setLang(l)` · `setTheme(t)` · `setTextSize(n)` · `setNotifications(on)` | Settings. |
| `tick(now)` | Called once a second by `App.tsx`; nobody else calls it. |

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
  AK-113 (open yard 5,000 m², renewal B3 waiting to be accepted, signed and paid), a street-light report (D1) with
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
```
