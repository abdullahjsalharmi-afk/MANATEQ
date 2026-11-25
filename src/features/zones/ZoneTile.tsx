import { useLang, useT } from '@/app/i18n';
import { Card, Render, cx } from '@/design/core';
import type { Zone } from '@/data/types';
import { usePrices, useZoneFacts, zoneRender } from './parts';
import { strings } from './strings';
import styles from './Zones.module.css';

/**
 * One zone in the card grid: its render, name, the facts (type · area · how much is taken) and the published
 * price. The whole card links to the zone page.
 */
export function ZoneTile({ zone }: { zone: Zone }) {
  const t = useT(strings);
  const { pick } = useLang();
  const prices = usePrices();
  const facts = useZoneFacts();
  return (
    <Card as="li" to={`/zones/${zone.code}`} media={<Render name={zoneRender(zone)} decorative />} className={styles.tile}>
      <h3 className="type-body">
        <strong>{pick(zone.name)}</strong>
      </h3>
      <p className={cx('type-callout num', styles.muted)}>{facts(zone)}</p>
      <p className={cx('type-callout', styles.tilePrice)}>
        <span className={styles.muted}>{t('price')}</span> <strong className="num">{prices.zone(zone)}</strong>
      </p>
    </Card>
  );
}
