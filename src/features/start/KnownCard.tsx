import { BadgeCheck } from 'lucide-react';
import { useLang, useT } from '@/app/i18n';
import { getIntegration, getSystem, getZone } from '@/data/catalog';
import type { Fetched } from '@/data/types';
import { Card, Icon, List, Row } from '@/design/core';
import type { FetchedItem } from '@/design/signature';
import type { Company, Plot } from '@/domain/types';
import styles from './Start.module.css';
import { strings } from './strings';

export interface KnownCardProps {
  company: Company;
  /** The plot the request is about, when the flow already knows it. */
  plot?: Plot;
}

/** The investor's verified company, as the flow already knows it: name, CR, signatory, activity. */
export function KnownCard({ company, plot }: KnownCardProps) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const zone = plot ? getZone(plot.zoneCode) : undefined;
  return (
    <section aria-label={t('companyLabel')} className={styles.known}>
      <Card>
        <div className={styles.companyHead}>
          <h3 className={styles.companyName}>{pick(company.name)}</h3>
          <p className={styles.verified}>
            <Icon icon={BadgeCheck} size={18} />
            <span>{t('verified')}</span>
          </p>
        </div>
        <List variant="plain">
          <Row title={t('cr')} trailing={<span className="ltr">{company.cr}</span>} />
          <Row title={t('signatory')} subtitle={pick(company.signatory.role)} trailing={pick(company.signatory.name)} />
          <Row title={t('activity')} trailing={pick(company.activity)} />
          {plot ? <Row title={t('plot')} subtitle={zone ? pick(zone.name) : undefined} trailing={<span className="ltr">{fmt.ltr(plot.number)}</span>} /> : null}
        </List>
      </Card>
    </section>
  );
}

/** The service's "fetched for you" items with their sources, for `FetchedList`. */
export function useFetchedItems(fetched: Fetched[]): FetchedItem[] {
  const { pick } = useLang();
  return fetched.map((item) => {
    const integration = item.source ? getIntegration(item.source) : undefined;
    const system = item.source && !integration ? getSystem(item.source) : undefined;
    const source = integration ? { name: pick(integration.short) || pick(integration.name), live: integration.live } : system ? { name: pick(system.name), live: true } : undefined;
    return source ? { text: pick(item), source } : { text: pick(item) };
  });
}
