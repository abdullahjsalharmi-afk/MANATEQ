/**
 * Starting a service: the `#/start/:id` screen and the pieces the bespoke flows reuse.
 *
 *   FlowPage        one page of a flow (close, progress line, step, heading, action bar)
 *   KnownCard       the verified company the flow already knows · useFetchedItems for FetchedList
 *   ReviewList      "check your answers" with edit links
 *   LeaveSheet      keep the draft or discard it before closing
 *   SubmittedState  "تم الاستلام": reference, the next steps of the real workflow, "تتبّع الطلب"
 *   buildPages …    how fields are cut into pages
 */
export { StartScreen } from './StartScreen';
export { GenericFlow, type GenericFlowProps } from './GenericFlow';
export { FlowPage, type FlowPageProps } from './FlowPage';
export { KnownCard, useFetchedItems, type KnownCardProps } from './KnownCard';
export { ReviewList, type ReviewItem, type ReviewListProps } from './ReviewList';
export { LeaveSheet, type LeaveSheetProps } from './LeaveSheet';
export { SubmittedState, type SubmittedStateProps } from './SubmittedState';
export { buildPages, chunkFields, fieldWeight, pageOfField, reviewIndex, MAX_PER_PAGE, type FlowPageDef } from './paginate';
