import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { Button, Card, Container, Grid, Render, Section, Tile } from '@/design/core';
import { QatarMap } from '@/design/signature';
import { solutions, zones } from '@/data/catalog';
import { STATIONS } from '@/domain/journey';
import type { StationKey } from '@/state';
import { SOLUTION_RENDER, STATION_RENDER } from './logic';
import styles from './Home.module.css';
import { strings } from './strings';

const HOW_LINE: Record<StationKey, keyof typeof strings> = { join: 'howJoin', contract: 'howContract', build: 'howBuild', operate: 'howOperate' };

/** A white tile: the four stations of the journey, each with its own render above its caption, in reading order. */
export function HowTile() {
  const t = useT(strings);
  const { pick } = useLang();
  return (
    <Tile tone="light" headline={t('howTitle')} tagline={t('howTagline')}>
      <ol className={styles.how}>
        {STATIONS.map((station, index) => (
          <li key={station.key} className={styles.howItem}>
            <Render name={STATION_RENDER[station.key]} decorative className={styles.howRender} />
            <span className={styles.howNum} aria-hidden="true">
              {index + 1}
            </span>
            <h3 className={styles.howName}>{pick(station.name)}</h3>
            <p className={styles.howLine}>{t(HOW_LINE[station.key])}</p>
          </li>
        ))}
      </ol>
    </Tile>
  );
}

/** The five solutions as product cards with their published prices. */
export function SolutionsSection() {
  const t = useT(strings);
  const { pick } = useLang();
  return (
    <Container width="grid">
      <Section title={t('solutionsTitle')} hint={t('solutionsHint')} action={{ label: t('solutionsAll'), to: '/solutions' }}>
        <Grid as="ul" columns={3}>
          {solutions.map((solution) => (
            <Card as="li" key={solution.key} to={`/solutions?solution=${solution.key}`} media={<Render name={SOLUTION_RENDER[solution.key]} decorative />} className={styles.solution}>
              <h3 className={styles.solutionName}>{pick(solution.name)}</h3>
              <p className={styles.solutionPrice}>{pick(solution.price.text)}</p>
              <p className={styles.solutionTerm}>{pick(solution.term)}</p>
            </Card>
          ))}
        </Grid>
      </Section>
    </Container>
  );
}

/** The dark tile that invites to the map of the zones. */
export function ZonesTile() {
  const t = useT(strings);
  const { fmt } = useLang();
  return (
    <Tile
      tone="dark"
      eyebrow={t('zonesEyebrow', { n: fmt.num(zones.length) })}
      headline={t('zonesTitle')}
      tagline={t('zonesTagline')}
      actions={
        <Button variant="secondary" to="/zones">
          {t('zonesCta')}
        </Button>
      }
    >
      <QatarMap height={360} label={t('zonesMap')} onSelect={(code) => navigate(`/zones/${code}`)} className={styles.map} />
    </Tile>
  );
}
