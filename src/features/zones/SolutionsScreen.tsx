import { useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Link } from '@/app/router';
import { useQuery } from '@/app/routes';
import { Button, Card, Chip, ChipRow, Container, Grid, Money, Render, Screen, Stat, Tile, cx } from '@/design/core';
import { NumberField } from '@/design/forms';
import { getZone, solutions, zonesData } from '@/data/catalog';
import type { SolutionKey, Zone } from '@/data/types';
import { annualEstimate, isValidArea } from './model';
import { FinePrint, SOLUTION_RENDER, usePrices } from './parts';
import { strings } from './strings';
import styles from './Solutions.module.css';

const DEFAULT_AREA = 5_000;

const isSolutionKey = (value: string | undefined): value is SolutionKey => solutions.some((solution) => solution.key === value);

/** The five solutions with their published prices, and a yearly rent estimate at the top. */
export function SolutionsScreen() {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const prices = usePrices();
  const query = useQuery();
  const [key, setKey] = useState<SolutionKey>(isSolutionKey(query.solution) ? query.solution : 'logistics');
  const [area, setArea] = useState<number | null>(DEFAULT_AREA);

  const estimate = annualEstimate(area, key);
  const operatorPriced = solutions.find((solution) => solution.key === key)?.price.qarPerSqmYear === null;
  const areaError = area !== null && !isValidArea(area) ? t('areaError') : undefined;

  return (
    <Screen
      title={t('solutionsTitle')}
      nav="back"
      backTo="/zones"
      bleed
      width="grid"
      footerContext={estimate !== null ? t('estimateContext', { value: t('perYear', { money: fmt.money(estimate) }) }) : undefined}
      footer={
        <Button block to="/eligibility">
          {t('checkEligibility')}
        </Button>
      }
    >
      <Tile tone="light" headline={t('solutionsHeadline')} tagline={t('solutionsTagline')}>
        <Card tone="parchment" className={styles.estimator}>
          <h2 className={cx('type-heading', styles.estimatorHead)}>{t('estimator')}</h2>
          <ChipRow label={t('chooseSolution')} wrap>
            {solutions.map((solution) => (
              <Chip key={solution.key} selected={solution.key === key} onClick={() => setKey(solution.key)}>
                {pick(solution.name)}
              </Chip>
            ))}
          </ChipRow>
          {operatorPriced ? null : <NumberField label={t('areaField')} hint={areaError ? undefined : t('areaHint')} error={areaError} unit={t('sqm')} value={area} onChange={setArea} />}
          <div className={styles.result} aria-live="polite">
            {operatorPriced ? (
              <>
                <p className="type-heading">{t('estimateOperator')}</p>
                <p className={cx('type-callout', styles.muted)}>{t('estimateOperatorNote')}</p>
              </>
            ) : (
              <>
                <Stat size="lg" label={t('estimate')} value={estimate !== null ? <Money amount={estimate} /> : t('noEstimate')} />
                <p className={cx('type-callout', styles.muted)}>{t('estimateNote')}</p>
              </>
            )}
          </div>
        </Card>
      </Tile>

      <Container width="grid">
        <Grid columns={3} as="ul" className={styles.cards}>
          {solutions.map((solution) => {
            const offeredIn = solution.zoneCodes.map((code) => getZone(code)).filter((zone): zone is Zone => zone !== undefined);
            const amount = solution.price.qarPerSqmYear;
            return (
              <Card as="li" key={solution.key} id={`solution-${solution.key}`} media={<Render name={SOLUTION_RENDER[solution.key]} decorative />} className={styles.card}>
                <h2 className="type-heading">{pick(solution.name)}</h2>
                <p className={cx('type-title num', styles.price)}>
                  <strong>{amount === null ? t('byOperator') : prices.solution(solution)}</strong>
                </p>
                <dl className={styles.terms}>
                  <div>
                    <dt className={cx('type-callout', styles.muted)}>{t('term')}</dt>
                    <dd className="type-callout">{pick(solution.term)}</dd>
                  </div>
                </dl>
                {pick(solution.notes) ? <p className={cx('type-callout', styles.muted)}>{pick(solution.notes)}</p> : null}
                {offeredIn.length > 0 ? (
                  <div className={styles.offered}>
                    <p className={cx('type-callout', styles.muted)}>{t('offeredIn')}</p>
                    <ul className={styles.zoneLinks}>
                      {offeredIn.map((zone) => (
                        <li key={zone.code}>
                          <Link to={`/zones/${zone.code}`} className={cx('type-callout', styles.zoneLink)}>
                            {pick(zone.name)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </Grid>
        <div className={styles.notes}>
          <FinePrint>
            {t('sources')} {t('source', { source: pick(zonesData.sources) })}
          </FinePrint>
        </div>
      </Container>
    </Screen>
  );
}
