// CONTRACT STUB — the zones feature replaces the body, not the props.
import { Row } from '@/design/core';
import type { Zone } from '@/data/types';

/** One zone in a list: name, type, a one-line fact. Links to the zone page. */
export function ZoneRow({ zone }: { zone: Zone }) {
  return <Row to={`/zones/${zone.code}`} title={zone.name.ar} subtitle={zone.typeLabel.ar} />;
}
