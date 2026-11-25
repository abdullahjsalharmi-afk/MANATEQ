import { useLang, useT } from '@/app/i18n';
import { Row } from '@/design/core';
import type { Zone } from '@/data/types';
import { allocatedPct } from './model';
import { strings } from './strings';

/**
 * One zone in a list: its name, then type · total area · how much is taken (allocated land for a land
 * zone; operator and occupancy for a warehousing park). Links to the zone page.
 */
export function ZoneRow({ zone }: { zone: Zone }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const facts = [pick(zone.typeLabel), fmt.areaShort(zone.totalSqm)];
  if (zone.kind === 'land') {
    const pct = allocatedPct(zone);
    if (pct !== null) facts.push(t('allocatedShort', { pct: fmt.pct(pct) }));
  } else {
    if (zone.operator) facts.push(pick(zone.operator));
    if (zone.occupancyPct !== undefined) facts.push(t('occupancyShort', { pct: fmt.pct(zone.occupancyPct) }));
  }
  return <Row to={`/zones/${zone.code}`} title={pick(zone.name)} subtitle={facts.join(' · ')} wrap chevron />;
}
