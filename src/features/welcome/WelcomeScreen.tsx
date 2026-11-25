/**
 * The welcome (`#/welcome`): the first five seconds. One maroon brand tile fills the viewport: the mark
 * and the name, the line, two pills and the `zone` render resting below them. The primary opens the
 * demo sign-in sheet; once a visitor has entered, the screen serves as the profile switcher.
 */
import { useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { Button, Mark, Render, Screen, Segmented, Tile } from '@/design/core';
import { enterAs, setLang } from '@/state/actions';
import { useApp } from '@/state/store';
import { SignInSheet } from './SignInSheet';
import { strings } from './strings';
import styles from './WelcomeScreen.module.css';

export function WelcomeScreen() {
  const t = useT(strings);
  const onboarded = useApp((s) => s.settings.onboarded);
  const [signingIn, setSigningIn] = useState(false);

  const browse = () => {
    enterAs('guest');
    navigate('/', { replace: true });
  };

  // The verifier is open to everyone; a first-time visitor enters as a guest on the way there.
  const verify = () => {
    if (!onboarded) enterAs('guest');
    navigate('/verify');
  };

  return (
    <Screen
      title={t('appName')}
      hideTitle
      tone="brand"
      bleed
      nav={onboarded ? 'close' : 'none'}
      navLabel={t('close')}
      backTo="/"
      actions={<LanguageSwitch />}
    >
      <Tile
        tone="brand"
        size="hero"
        fill
        className={styles.tile}
        lead={
          <>
            <Mark size={48} />
            <span className={styles.name}>{t('appName')}</span>
          </>
        }
        headline={t('line')}
        tagline={t('tagline')}
        actions={
          <div className={styles.actions}>
            <Button size="lg" onClick={() => setSigningIn(true)}>
              {t('signIn')}
            </Button>
            <Button size="lg" variant="secondary" onClick={browse}>
              {t('browse')}
            </Button>
          </div>
        }
        mediaWidth="wide"
        media={
          <div className={styles.render}>
            <Render name="zone" eager decorative />
          </div>
        }
      >
        <div className={styles.foot}>
          <Button variant="quiet" size="sm" chevron onClick={verify}>
            {t('verify')}
          </Button>
          <p className={styles.finePrint}>{t('finePrint')}</p>
        </div>
      </Tile>
      <SignInSheet open={signingIn} onClose={() => setSigningIn(false)} />
    </Screen>
  );
}

/** العربية | English at the inline end of the bar; the whole app flips at once. */
function LanguageSwitch() {
  const t = useT(strings);
  const { lang } = useLang();
  return (
    <Segmented
      inline
      size="sm"
      label={t('language')}
      value={lang}
      onChange={setLang}
      options={[
        { value: 'ar', label: 'العربية' },
        { value: 'en', label: 'English' },
      ]}
    />
  );
}
