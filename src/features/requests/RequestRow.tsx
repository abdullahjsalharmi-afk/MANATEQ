// CONTRACT STUB — the requests feature replaces the body, not the props.
import { Row } from '@/design/core';
import type { RequestState } from '@/domain/types';

export interface RequestRowProps {
  request: RequestState;
  /** The current time (pass the value of useNow()). */
  now: number;
}

/** One request in a list: plain label, who holds it now, the service-standard ring, a link to its page. */
export function RequestRow({ request }: RequestRowProps) {
  return <Row to={`/requests/${request.id}`} title={request.ref} subtitle={request.serviceId} />;
}
