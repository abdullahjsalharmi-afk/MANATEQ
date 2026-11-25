/**
 * The state layer in one import.
 *
 *   import { useApp, selectNextStep, startRequest, actOnRequest } from '@/state';
 *
 * READ — `useApp(selector)` re-renders a component when its slice changes.
 *   Home          selectNextStep · selectNextSteps · selectJourney · selectStation · selectDues · selectUnreadCount
 *   Requests      selectActiveRequests · selectDoneRequests · selectRequest(id) · selectThread(id) ·
 *                 selectDocsOfRequest(id) · selectDeadline(id) · selectWaitingCount
 *   Account       selectCompany · selectPlots · selectPlot(id) · selectLeaseOfPlot(id) · selectRequestsOfPlot(id) ·
 *                 selectDocsOfPlot(id) · selectInvoices · selectInvoice(id) · selectDocs · selectDoc(id) ·
 *                 selectPasses · selectPass(id) · selectAppointments · selectNotifications · selectDraft(serviceId)
 *
 *   One request on screen:
 *     const ready = useCatalogueReady();                         // re-render when the workflows arrive
 *     const service = peekServiceDetail(request.serviceId);      // from '@/data/catalog'
 *     const view = requestView(request, service, now, speed);    // holder, pendingAction, clock, progress, timeline
 *     <Timeline items={timelineRows(view.timeline, lang, now)} />
 *   `view.clock` is the service-standard clock to show (working days of the story); do not rebuild it
 *   from timestamps: seeded requests carry real dates, live ones demo seconds.
 *
 * CHANGE — only through actions. Each returns at once; the store notifies subscribers.
 *   startRequest(serviceId, form, { plotId?, zoneCode?, threadId?, parentId? }) → request id
 *       · the land application (A4): pass the picked plot as `plotId` ("AW-117") with its `zoneCode`; the
 *         form may add `solution`, `area` (asked for) and `areaSqm` (the plot's own). Its documents and
 *         plot steps are then taken as answered: the request is submitted, not asked again.
 *       · any service about one of the investor's plots: `plotId`, or a `plot` field in the form.
 *       · the handover (A8) after the contract: `{ plotId, threadId, parentId }` of the contract request.
 *   completeStep(id, payload) → { ok, receiptDocIds }: the same, telling which receipts the payment filed
 *   actOnRequest(id, { rating?, choice?, form?, files? }) → completes the step in `view.pendingAction`
 *       (with a choice, only the tasks `stepTasks(serviceId, action, choice)` lists apply): `pay` files a paid invoice and its receipt, `sign`/`accept` are recorded, `rate` saves the rating.
 *   fastForwardRequest(id) · cancelRequest(id) · payInvoice(id) → receipt doc id
 *   issuePass(input) · revokePass(id) · bookAppointment(input) · cancelAppointment(id)
 *   markRead(id) · markAllRead() · saveDraft(serviceId, form, page) · clearDraft(serviceId)
 *   saveEligibility(result) · toggleWatchZone(code) · setDelegated(memberId, on)
 *   enterAs(persona) · signOut() · resetDemo() · setSpeed(n) · setLang · setTheme · setTextSize · setNotifications
 *
 * Full guide: src/state/README.md.
 *
 * The simulation (`tick`, once a second from the app shell) moves requests through their real
 * workflows, raises notifications, issues documents and starts the services that follow by themselves.
 */
export * from './actions';
export * from './selectors';
export { appStore, getState, useApp, resetEverything, STORAGE_KEY } from './store';
export { applyBootParams, loadCatalogue } from './boot';
export { isCatalogueReady, useCatalogueReady } from './catalogue';
export { receiptRefFor } from './refs';
export { amountFor } from './effects';
export { stepTasks } from './sim';
export { STATE_VERSION, seedWorld } from './seed';
export { holdOf, type ActPayload, type AppointmentInput, type FileValue, type PassInput, type StartOptions } from './types';
export type { Journey, JourneyItem, JourneyStation, StationKey, ItemState } from '@/domain/journey';
