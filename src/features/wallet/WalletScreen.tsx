import { FileText, Plus, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { useQuery } from '@/app/routes';
import { Button, Chip, ChipRow, EmptyState, Grid, Screen, Section, Segmented } from '@/design/core';
import { Skeleton } from '@/design/forms';
import { useNow } from '@/features/shared/useNow';
import { selectDocs, selectPasses, useApp, useCatalogueReady } from '@/state';
import { DocTile, PassTile } from './DocRow';
import { byYear, countByFilter, DOC_FILTERS, filterDocs, passValidity, type DocFilter } from './logic';
import { strings } from './strings';
import styles from './Wallet.module.css';

type Tab = 'docs' | 'passes';

/** The wallet: every document the investor holds as a grid of cards by year, and the gate passes. */
export function WalletScreen() {
  const t = useT(strings);
  const query = useQuery();
  const ready = useCatalogueReady();
  const docs = useApp(selectDocs);
  const passes = useApp(selectPasses);
  const now = useNow(30_000);
  const [tab, setTabState] = useState<Tab>(query.tab === 'passes' ? 'passes' : 'docs');
  const [filter, setFilter] = useState<DocFilter>('all');

  // Remember the tab in the address, so "back" from a pass returns to the passes.
  const setTab = (next: Tab) => {
    setTabState(next);
    navigate(next === 'passes' ? '/account/wallet?tab=passes' : '/account/wallet', { replace: true });
  };

  const counts = useMemo(() => countByFilter(docs), [docs]);
  const shown = useMemo(() => filterDocs(docs, filter), [docs, filter]);
  const years = useMemo(() => byYear(shown), [shown]);
  const [current, past] = useMemo(() => {
    const live = passes.filter((pass) => {
      const state = passValidity(pass, now).state;
      return state === 'valid' || state === 'upcoming';
    });
    return [live, passes.filter((pass) => !live.includes(pass))];
  }, [passes, now]);

  return (
    <Screen title={t('title')} nav="back" backTo="/account">
      <div className={styles.controls}>
        <Segmented<Tab>
          label={t('view')}
          value={tab}
          onChange={setTab}
          options={[
            { value: 'docs', label: t('documents'), count: docs.length },
            { value: 'passes', label: t('passes'), count: passes.length },
          ]}
        />
      </div>

      {!ready ? (
        <Section>
          <Skeleton variant="row" count={4} label={t('loading')} />
        </Section>
      ) : tab === 'docs' ? (
        <div>
          {docs.length === 0 ? (
            <EmptyState icon={FileText} title={t('noDocs')} body={t('noDocsBody')} action={<Button to="/services">{t('browse')}</Button>} />
          ) : (
            <>
              <ChipRow label={t('filter')} className={styles.filters}>
                {DOC_FILTERS.filter((key) => key === 'all' || counts[key] > 0).map((key) => (
                  <Chip key={key} selected={filter === key} onClick={() => setFilter(key)}>
                    {t(key)}
                  </Chip>
                ))}
              </ChipRow>
              <Section>
                {shown.length === 0 ? (
                  <EmptyState compact icon={FileText} title={t('noDocsInFilter')} body={t('noDocsInFilterBody')} action={<Button variant="quiet" onClick={() => setFilter('all')}>{t('showAll')}</Button>} />
                ) : (
                  years.map((group) => (
                    <section key={group.year} className={styles.year} aria-labelledby={`docs-${group.year}`}>
                      <h2 id={`docs-${group.year}`} className={styles.yearHead}>
                        <span className="num">{group.year}</span>
                      </h2>
                      <Grid as="ul">
                        {group.docs.map((doc) => (
                          <DocTile key={doc.id} doc={doc} />
                        ))}
                      </Grid>
                    </section>
                  ))
                )}
              </Section>
              <p className={styles.more}>
                <Button variant="quiet" icon={ShieldCheck} to="/verify">
                  {t('verifyAny')}
                </Button>
              </p>
            </>
          )}
        </div>
      ) : passes.length === 0 ? (
        <EmptyState render="gate" title={t('noPasses')} body={t('noPassesBody')} action={<Button icon={Plus} to="/start/D2">{t('newPass')}</Button>} />
      ) : (
        <>
          {current.length > 0 ? (
            <Section title={t('activePasses')}>
              <Grid as="ul">
                {current.map((pass) => (
                  <PassTile key={pass.id} pass={pass} now={now} />
                ))}
              </Grid>
            </Section>
          ) : null}
          {past.length > 0 ? (
            <Section title={t('pastPasses')}>
              <Grid as="ul">
                {past.map((pass) => (
                  <PassTile key={pass.id} pass={pass} now={now} />
                ))}
              </Grid>
            </Section>
          ) : null}
          <p className={styles.cta}>
            <Button icon={Plus} to="/start/D2">
              {t('newPass')}
            </Button>
          </p>
        </>
      )}
    </Screen>
  );
}
