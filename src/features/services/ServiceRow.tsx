import { useMemo } from 'react';
import { Pill, Row, StandardBadge } from '@/design/core';
import { useLang, useT } from '@/app/i18n';
import type { ServiceSummary } from '@/data/types';
import { selectDraft, useApp } from '@/state';
import { strings } from './strings';
import styles from './ServiceRow.module.css';

export interface ServiceRowProps {
  service: ServiceSummary;
}

/** One service in a list: plain label, official name, standard chip; a quiet "automatic" tag when the investor cannot start it, a «مسودة» tag when a draft is kept. */
export function ServiceRow({ service }: ServiceRowProps) {
  const t = useT(strings);
  const { pick } = useLang();
  const draft = useApp(useMemo(() => selectDraft(service.id), [service.id]));
  return (
    <Row
      to={`/services/${service.id}`}
      title={pick(service.label)}
      subtitle={pick(service.name)}
      trailing={
        <span className={styles.trailing}>
          {draft && service.startable ? <Pill>{t('draft')}</Pill> : null}
          <StandardBadge standard={service.standard} variant="compact" />
          {service.startable ? null : <Pill>{t('automatic')}</Pill>}
        </span>
      }
    />
  );
}
