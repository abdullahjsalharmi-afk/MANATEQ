/**
 * About (`#/account/about`): the idea, the six rules, what is simulated, where the content comes from,
 * privacy and accessibility (as a government service site states them), the ten design principles,
 * the version, and the two demo tools: reset and the component gallery.
 * `?section=prototype|privacy|accessibility` opens the page at that section (links from the footer).
 */
import { CalendarClock, ChevronDown, Database, FileSignature, KeyRound, LayoutGrid, RotateCcw, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { useQuery } from '@/app/routes';
import { catalog, knowledge } from '@/data/catalog';
import { Button, Card, Container, Grid, Icon, List, Mark, Render, Row, Screen, Section, Sheet, Tile, toast } from '@/design/core';
import { DemoPill } from '@/design/forms';
import { resetDemo } from '@/state/actions';
import { version } from '../../../package.json';
import { aboutStrings as strings } from './misc-strings';
import styles from './AboutScreen.module.css';

/** The size of the Service Workflows book, version 1.1. */
export const WORKFLOW_STEPS = 588;

const RULES = ['1', '2', '3', '4', '5', '6'] as const;

const SIMULATED = [
  { key: 'simSignIn', icon: KeyRound },
  { key: 'simData', icon: Database },
  { key: 'simPay', icon: Wallet },
  { key: 'simSign', icon: FileSignature },
  { key: 'simTime', icon: CalendarClock },
] as const;

/** The sections a link may open the page at. */
export const ABOUT_SECTIONS = ['prototype', 'privacy', 'accessibility'] as const;

export function AboutScreen() {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const query = useQuery();
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const section = query.section;
    if (!section || !(ABOUT_SECTIONS as readonly string[]).includes(section)) return;
    // Wait one frame: the router resets the scroll position right after a screen renders, and would cancel a
    // scroll started now (the page is already loaded, or only the query changed).
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(`about-${section}`);
      if (!target) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      // Move focus to the section's heading, so keyboard and screen-reader users arrive where the link pointed.
      const heading = target.querySelector<HTMLElement>('h2, h3');
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [query.section]);

  const reset = () => {
    resetDemo();
    setResetting(false);
    toast(t('resetDone'), { tone: 'ok' });
    navigate('/');
  };

  return (
    <Screen title={t('title')} nav="back" backTo="/account" bleed>
      <Tile
        tone="light"
        lead={<Mark size={40} />}
        eyebrow={t('eyebrow')}
        headline={t('headline')}
        tagline={t('tagline')}
        mediaWidth="wide"
        media={<Render name="journey" eager mirrorInRtl decorative />}
      >
        <p className={styles.idea}>{t('idea')}</p>
      </Tile>

      <Container width="content">
        <Section title={t('rules')} hint={t('rulesHint')}>
          <Card pad="none">
            <ol className={styles.rules}>
              {RULES.map((n) => (
                <li key={n} className={styles.rule}>
                  <span className={styles.ruleNumber} aria-hidden="true">
                    {fmt.num(Number(n))}
                  </span>
                  <div>
                    <h3 className={styles.ruleTitle}>{t(`rule${n}`)}</h3>
                    <p className={styles.ruleText}>{t(`rule${n}Text`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </Section>

        <div id="about-prototype" className={styles.anchor}>
          <Section title={t('simulated')} hint={t('simulatedHint')}>
            <p className={styles.tag}>
              <DemoPill kind="simulation" />
            </p>
            <List>
              {SIMULATED.map(({ key, icon }) => (
                <Row key={key} leading={<Icon icon={icon} />} title={t(key)} subtitle={t(`${key}Text`)} wrap />
              ))}
            </List>
          </Section>
        </div>

        <Section title={t('sources')}>
          <Card className={styles.prose}>
            <p>{t('sourcesText', { workflows: fmt.num(catalog.services.length), steps: fmt.num(WORKFLOW_STEPS) })}</p>
            <p className={styles.quiet}>{t('sourcesCaveat')}</p>
          </Card>
        </Section>

        <Grid columns={2} className={styles.pair}>
          <div id="about-privacy" className={styles.anchor}>
            <Section title={t('privacy')}>
              <Card className={styles.prose}>
                <p>{t('privacyText')}</p>
              </Card>
            </Section>
          </div>
          <div id="about-accessibility" className={styles.anchor}>
            <Section title={t('accessibility')}>
              <Card className={styles.prose}>
                <p>{t('accessibilityText')}</p>
                <Button variant="quiet" to="/account/settings">
                  {t('textSizeLink')}
                </Button>
              </Card>
            </Section>
          </div>
        </Grid>

        <Section title={t('principles')}>
          <Card pad="none">
            <details className={styles.disclosure}>
              <summary className={styles.summary}>
                <span>{t('principlesSummary')}</span>
                <Icon icon={ChevronDown} size={18} className={styles.chevron} />
              </summary>
              <ol className={styles.principles}>
                {knowledge.principles.map((p) => (
                  <li key={p.n} className={styles.principle}>
                    <span className={styles.ruleNumber} aria-hidden="true">
                      {fmt.num(p.n)}
                    </span>
                    <div>
                      <h3 className={styles.ruleTitle}>{pick(p.title)}</h3>
                      <p className={styles.ruleText}>{pick(p.text)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          </Card>
        </Section>

        <Section title={t('demo')}>
          <List>
            <Row leading={<Icon icon={LayoutGrid} />} title={t('gallery')} subtitle={t('galleryLine')} to="/gallery" wrap />
            <Row leading={<Icon icon={RotateCcw} />} title={<span className={styles.danger}>{t('reset')}</span>} subtitle={t('resetLine')} onClick={() => setResetting(true)} wrap />
          </List>
          <p className={styles.version}>{t('version', { version: fmt.ltr(version), date: fmt.date(Date.parse(catalog.generated)) })}</p>
        </Section>
      </Container>

      <Sheet
        open={resetting}
        onClose={() => setResetting(false)}
        title={t('resetTitle')}
        footer={
          <div className={styles.sheetActions}>
            <Button block tone="danger" onClick={reset}>
              {t('resetConfirm')}
            </Button>
            <Button block variant="quiet" onClick={() => setResetting(false)}>
              {t('keep')}
            </Button>
          </div>
        }
      >
        <p className={styles.quiet}>{t('resetBody')}</p>
      </Sheet>
    </Screen>
  );
}
