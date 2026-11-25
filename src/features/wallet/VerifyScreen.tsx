import { ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useT } from '@/app/i18n';
import { useQuery } from '@/app/routes';
import { Button, Card, Container, Icon, Screen, Tile } from '@/design/core';
import { TextField } from '@/design/forms';
import type { Doc } from '@/domain/types';
import { selectDocs, selectPersona, useApp } from '@/state';
import { findByCode, isCodeShape, normalizeCode } from './logic';
import { strings } from './strings';
import { VERIFY_MS, VerifyResult } from './VerifySheet';
import styles from './Wallet.module.css';

type Phase = { state: 'idle' } | { state: 'checking' } | { state: 'done'; code: string; doc: Doc | undefined };

/**
 * The public side of "every document is verifiable": anyone, signed in or not, types the code printed
 * on a document and learns whether Manateq issued it. A simulation of the Tasdeeq check.
 */
export function VerifyScreen() {
  const t = useT(strings);
  const query = useQuery();
  const persona = useApp(selectPersona);
  const docs = useApp(selectDocs);
  const docsRef = useRef(docs);
  docsRef.current = docs;
  const [code, setCode] = useState(() => (query.code ? normalizeCode(query.code) : ''));
  const [error, setError] = useState<string | undefined>(undefined);
  const [phase, setPhase] = useState<Phase>({ state: 'idle' });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // The verdict lands under the tile: bring it into view and give it the focus, so nobody has to look for it.
  const result = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (phase.state !== 'done') return;
    const verdict = result.current?.querySelector<HTMLElement>('[data-verdict]');
    if (!verdict) return;
    verdict.focus({ preventScroll: true });
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    result.current?.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
  }, [phase]);

  const check = (raw: string) => {
    const typed = raw.trim();
    if (!typed) return setError(t('vEmpty'));
    if (!isCodeShape(typed)) return setError(t('vShape'));
    const canonical = normalizeCode(typed);
    setError(undefined);
    setCode(canonical);
    setPhase({ state: 'checking' });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setPhase({ state: 'done', code: canonical, doc: findByCode(docsRef.current, canonical) });
    }, VERIFY_MS);
  };

  // A link with ?code= checks at once.
  const initial = useRef(query.code);
  useEffect(() => {
    if (initial.current && isCodeShape(initial.current)) check(initial.current);
    // Only on arrival.
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    check(code);
  };

  const again = () => {
    setPhase({ state: 'idle' });
    setCode('');
    window.requestAnimationFrame(() => document.getElementById('verify-code')?.focus());
  };

  return (
    <Screen title={t('vTitle')} nav="back" backTo={persona === 'guest' ? '/' : '/account/wallet'} bleed width="form">
      <Tile tone="light" lead={<Icon icon={ShieldCheck} size={32} className={styles.okMark} />} headline={t('vHeadline')} tagline={t('vTagline')}>
        <div className={styles.verifyColumn}>
          <Card tone="parchment">
            <form className={styles.form} onSubmit={submit} noValidate>
              <TextField
                id="verify-code"
                label={t('vLabel')}
                hint={t('vHint')}
                error={error}
                value={code}
                onChange={(value) => {
                  setCode(value.toUpperCase());
                  if (error) setError(undefined);
                }}
                ltr
                placeholder="TSD-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                inputMode="text"
                maxLength={20}
              />
              <Button type="submit" loading={phase.state === 'checking'}>
                {phase.state === 'checking' ? t('vChecking') : t('vSubmit')}
              </Button>
            </form>
          </Card>
        </div>
      </Tile>

      <Container width="form">
        <div className={styles.verifyColumn}>
          <div aria-live="polite" ref={result}>
            {phase.state === 'done' ? (
              <Card className={styles.result}>
                <VerifyResult doc={phase.doc} code={phase.code} link="open" />
                {phase.doc ? null : (
                  <div className={styles.status}>
                    <Button variant="secondary" onClick={again}>
                      {t('vAgain')}
                    </Button>
                  </div>
                )}
              </Card>
            ) : null}
          </div>
          <p className={styles.note}>{t('vNote')}</p>
        </div>
      </Container>
    </Screen>
  );
}
