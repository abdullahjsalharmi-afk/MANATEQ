import { Pill, Row, StandardBadge } from '@/design/core';
import { useLang, useT } from '@/app/i18n';
import type { ServiceSummary } from '@/data/types';
import { strings } from './strings';
import styles from './ServiceRow.module.css';

export interface ServiceRowProps {
  service: ServiceSummary;
}

/** One service in a list: plain label, official name, standard chip; a quiet "automatic" tag when the investor cannot start it. */
export function ServiceRow({ service }: ServiceRowProps) {
  const t = useT(strings);
  const { pick } = useLang();
  return (
    <Row
      to={`/services/${service.id}`}
      title={pick(service.label)}
      subtitle={pick(service.name)}
      trailing={
        <span className={styles.trailing}>
          <StandardBadge standard={service.standard} variant="compact" />
          {service.startable ? null : <Pill>{t('automatic')}</Pill>}
        </span>
      }
    />
  );
}
