/**
 * «دخول تجريبي»: the simulated national sign-in. One sentence on what the real service would do, the
 * two demo profiles as large option cards, one consent line and one pill. «دخول» plays a short hand-off
 * (identity ✓, commercial registration ✓), then seeds the chosen profile and opens Home (or the screen a deep link asked for).
 */
import { Check } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { Button, Card, CardChoiceGroup, Icon, List, Pill, Row, Sheet } from '@/design/core';
import { DemoPill } from '@/design/forms';
import { enterAs } from '@/state/actions';
import { useApp } from '@/state/store';
import { DEMO_PROFILES, HANDOFF, demoCompanyName, handoffStage, initialProfile, type DemoProfile } from './profiles';
import { strings } from './strings';
import styles from './SignInSheet.module.css';

export interface SignInSheetProps {
  open: boolean;
  onClose: () => void;
  /** Where to go once signed in: the screen a deep link asked for, or Home. Default Home. */
  next?: string;
}

export function SignInSheet({ open, onClose, next = '/' }: SignInSheetProps) {
  const t = useT(strings);
  const persona = useApp((s) => s.world.persona);
  const onboarded = useApp((s) => s.settings.onboarded);
  const [profile, setProfile] = useState<DemoProfile>(() => initialProfile(persona, onboarded));
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timers = useRef<number[]>([]);

  // Clear any pending hand-off when the sheet goes away.
  useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  useEffect(() => {
    if (open) {
      setProfile(initialProfile(persona, onboarded));
      setStartedAt(null);
      setElapsed(0);
    }
    // Only when the sheet opens: the persona changes as the hand-off finishes.
  }, [open]);

  const signIn = () => {
    if (startedAt !== null) return;
    const start = Date.now();
    setStartedAt(start);
    timers.current = [HANDOFF.identity, HANDOFF.registry].map((ms) => window.setTimeout(() => setElapsed(ms), ms));
    timers.current.push(
      window.setTimeout(() => {
        enterAs(profile);
        navigate(next, { replace: true });
      }, HANDOFF.done),
    );
  };

  const busy = startedAt !== null;
  const stage = handoffStage(elapsed);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('sheetTitle')}
      dismissible={!busy}
      footer={
        <div className={styles.footer}>
          <p className={styles.consent}>
            {t('consent')} <DemoPill kind="simulation" />
          </p>
          <Button block onClick={signIn} loading={busy}>
            {t('enter')}
          </Button>
        </div>
      }
    >
      {busy ? <Handoff identity={stage.identity} registry={stage.registry} /> : <Profiles value={profile} onChange={setProfile} current={onboarded ? persona : null} />}
    </Sheet>
  );
}

function Profiles({ value, onChange, current }: { value: DemoProfile; onChange: (profile: DemoProfile) => void; current: string | null }) {
  const t = useT(strings);
  const { pick } = useLang();
  const companies = useMemo(() => Object.fromEntries(DEMO_PROFILES.map((p) => [p, demoCompanyName(p)])) as Record<DemoProfile, ReturnType<typeof demoCompanyName>>, []);
  return (
    <>
      <p className={styles.lead}>{t('sheetBody')}</p>
      <CardChoiceGroup className={styles.options} label={t('chooseProfile')}>
        {DEMO_PROFILES.map((p) => {
          const company = companies[p];
          return (
            <Card key={p} choice onClick={() => onChange(p)} selected={value === p} className={styles.option}>
              <span className={styles.optionHead}>
                <strong className={styles.optionTitle}>{t(p)}</strong>
                {current === p ? <Pill tone="neutral">{t('current')}</Pill> : null}
              </span>
              <span className={styles.optionLine}>{t(p === 'prospect' ? 'prospectLine' : 'tenantLine')}</span>
              {company ? <span className={styles.optionCompany}>{pick(company)}</span> : null}
            </Card>
          );
        })}
      </CardChoiceGroup>
    </>
  );
}

function Handoff({ identity, registry }: { identity: boolean; registry: boolean }) {
  const t = useT(strings);
  const status = (done: boolean) =>
    done ? (
      <Pill tone="ok" icon={Check}>
        {t('fetched')}
      </Pill>
    ) : (
      <Pill tone="neutral">{t('waiting')}</Pill>
    );
  return (
    <div className={styles.handoff}>
      <p className={styles.fetching} role="status" aria-live="polite">
        {identity && registry ? t('ready') : t('fetching')}
      </p>
      <List variant="plain">
        <Row title={t('identity')} subtitle={t('identitySource')} leading={<Icon icon={Check} className={identity ? styles.tickOn : styles.tickOff} />} trailing={status(identity)} />
        <Row title={t('registry')} subtitle={t('registrySource')} leading={<Icon icon={Check} className={registry ? styles.tickOn : styles.tickOff} />} trailing={status(registry)} />
      </List>
    </div>
  );
}
