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

/**
 * One service in a list: plain label, official name, then the standard chip on its own line under them, with a
 * quiet "automatic" tag when the investor cannot start it and a «مسودة» tag when a draft is kept. The words take
 * the whole row (the chips never sit beside them, so they are never squeezed), and the official name wraps in
 * full instead of ending in an ellipsis.
 */
export function ServiceRow({ service }: ServiceRowProps) {
  const t = useT(strings);
  const { pick } = useLang();
  const draft = useApp(useMemo(() => selectDraft(service.id), [service.id]));
  return (
    <Row
      to={`/services/${service.id}`}
      title={pick(service.label)}
      wrap
      subtitle={
        <>
          <span className={styles.name}>{pick(service.name)}</span>
          <span className={styles.chips}>
            {draft && service.startable ? <Pill>{t('draft')}</Pill> : null}
            <StandardBadge standard={service.standard} variant="compact" />
            {service.startable ? null : <Pill>{t('automatic')}</Pill>}
          </span>
        </>
      }
    />
  );
}
