// CONTRACT STUB — the services feature replaces the body, not the props.
import { Row } from '@/design/core';
import type { ServiceSummary } from '@/data/types';

export interface ServiceRowProps {
  service: ServiceSummary;
}

/** One service in a list: plain label, official name, standard chip; a quiet "automatic" tag when the investor cannot start it. */
export function ServiceRow({ service }: ServiceRowProps) {
  return <Row to={`/services/${service.id}`} title={service.label.ar} subtitle={service.name.ar} />;
}
