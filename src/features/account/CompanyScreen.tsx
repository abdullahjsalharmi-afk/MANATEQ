import { BadgeCheck, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Button, Container, List, Pill, Row, Screen, Section, Tile, toast } from '@/design/core';
import { Avatar } from '@/design/forms';
import { FetchedList } from '@/design/signature';
import { selectCompany, useApp } from '@/state';
import styles from './CompanyScreen.module.css';
import { strings } from './strings';

/** How long the simulated synchronisation with the source registries takes. */
export const SYNC_MS = 1000;

/** The verified company profile: read-only facts, where each came from, and a simulated update from the source. */
export function CompanyScreen() {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const company = useApp(selectCompany);
  const [syncing, setSyncing] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!company) return null; // The route needs a signed-in investor; the shell shows the sign-in screen first.

  const name = pick(company.name);
  const sync = () => {
    if (syncing) return;
    setSyncing(true);
    timer.current = window.setTimeout(() => {
      setSyncing(false);
      toast(t('synced'), { tone: 'ok' });
    }, SYNC_MS);
  };

  return (
    <Screen title={t('companyTitle')} nav="back" backTo="/account" bleed>
      <Tile
        tone="light"
        lead={<Avatar name={name} size="xl" tone="accent" />}
        headline={name}
        tagline={
          <>
            {t('crLabel')} <span className="ltr num">{company.cr}</span>
          </>
        }
      >
        <Pill tone="gold" icon={BadgeCheck}>
          {t('verified')}
        </Pill>
      </Tile>
      <Container width="content">
        <div className={styles.columns}>
          <Section title={t('factsLabel')}>
            <List aria-label={t('factsLabel')}>
              <Row eyebrow={t('legalNameAr')} title={<span lang="ar" dir="rtl">{company.name.ar}</span>} wrap />
              <Row eyebrow={t('legalNameEn')} title={<span lang="en" dir="ltr">{company.name.en}</span>} wrap />
              <Row eyebrow={t('crNumber')} title={<span className="ltr num">{company.cr}</span>} />
              <Row eyebrow={t('activity')} title={pick(company.activity)} wrap />
              <Row eyebrow={t('signatory')} title={pick(company.signatory.name)} subtitle={pick(company.signatory.role)} wrap />
            </List>
            <p className={`type-callout ${styles.note}`}>{t('readOnly')}</p>
          </Section>
          <Section title={t('sourcesTitle')}>
            <FetchedList
              label={t('sourcesTitle')}
              items={[
                { text: t('fromGdx'), source: { name: t('gdxName'), live: true } },
                { text: t('fromNas'), source: { name: t('nasName'), live: true } },
              ]}
              caption={t('syncedAt', { date: fmt.date(company.syncedAt), time: fmt.time(company.syncedAt) })}
            />
            <div className={styles.sync}>
              <Button variant="secondary" icon={RefreshCw} loading={syncing} onClick={sync}>
                {t('syncNow')}
              </Button>
              <p className={`type-foot ${styles.note}`} aria-live="polite">
                {syncing ? t('syncing') : t('syncSimulated')}
              </p>
            </div>
          </Section>
        </div>
      </Container>
    </Screen>
  );
}
