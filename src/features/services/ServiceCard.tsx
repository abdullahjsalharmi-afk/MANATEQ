import { Button, Card, Pill, StandardBadge } from '@/design/core';
import { useLang, useT } from '@/app/i18n';
import { Link } from '@/app/router';
import type { ServiceSummary } from '@/data/types';
import { useApp, selectPersona } from '@/state';
import { startTarget } from './catalogue';
import { strings } from './strings';
import styles from './ServiceCard.module.css';

export interface ServiceCardProps {
  service: ServiceSummary;
  /** `parchment` for a card that sits on a white tile. */
  tone?: 'plain' | 'parchment';
}

/**
 * One service in the catalogue grid: its plain label, one everyday line, the standard, and either a quiet
 * «ابدأ» link or the «تلقائية» tag. The whole card opens the service page; «ابدأ» goes straight to the flow.
 */
export function ServiceCard({ service, tone = 'plain' }: ServiceCardProps) {
  const t = useT(strings);
  const { pick } = useLang();
  const persona = useApp(selectPersona);
  return (
    <Card as="li" tone={tone} className={styles.card}>
      <h3 className={styles.title}>
        <Link to={`/services/${service.id}`} className={styles.link}>
          {pick(service.label)}
        </Link>
      </h3>
      <p className={styles.summary}>{pick(service.summary)}</p>
      <div className={styles.foot}>
        <StandardBadge standard={service.standard} variant="compact" />
        {service.startable ? (
          <Button variant="quiet" size="sm" to={startTarget(service.id, persona)} className={styles.start} aria-label={`${t('start')}: ${pick(service.label)}`}>
            {t('start')}
          </Button>
        ) : (
          <Pill>{t('automatic')}</Pill>
        )}
      </div>
    </Card>
  );
}
