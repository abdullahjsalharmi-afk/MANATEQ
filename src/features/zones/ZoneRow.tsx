import { useLang } from '@/app/i18n';
import { Row } from '@/design/core';
import type { Zone } from '@/data/types';
import { useZoneFacts } from './parts';

/**
 * One zone in a list (search results): its name, then type · total area · how much is taken (allocated land
 * for a land zone; operator and occupancy for a warehousing park). Links to the zone page.
 */
export function ZoneRow({ zone }: { zone: Zone }) {
  const { pick } = useLang();
  const facts = useZoneFacts();
  return <Row to={`/zones/${zone.code}`} title={pick(zone.name)} subtitle={facts(zone)} wrap chevron />;
}
