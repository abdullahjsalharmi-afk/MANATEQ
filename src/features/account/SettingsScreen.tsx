/**
 * Settings (`#/account/settings`): language, appearance, text size, notifications and the demo profile,
 * as controls in cards and lists. Every change applies at once; there is nothing to save.
 */
import { Bell, Mail, MessageSquareText, Repeat2, Smartphone, UserRound } from 'lucide-react';
import { useId } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Card, Chip, ChipRow, Grid, Icon, List, Row, Screen, Section, Segmented } from '@/design/core';
import { DemoPill, Switch } from '@/design/forms';
import type { Lang } from '@/data/types';
import type { TextSize, ThemeChoice } from '@/domain/types';
import { selectCompany, selectPersona, selectSpeed } from '@/state/selectors';
import { setLang, setNotifications, setSpeed, setTextSize, setTheme } from '@/state/actions';
import { useApp } from '@/state/store';
import { settingsStrings as strings } from './misc-strings';
import styles from './SettingsScreen.module.css';

/** The three simulation speeds offered, and the speed each one sets. */
export const SPEEDS = { calm: 0.5, normal: 1, fast: 4 } as const;
export type SpeedKey = keyof typeof SPEEDS;

/** The speed option that best describes the current speed (a demo link may set any number). */
export function speedKey(speed: number): SpeedKey {
  if (speed < 0.75) return 'calm';
  if (speed < 2) return 'normal';
  return 'fast';
}

const TEXT_SIZES: readonly TextSize[] = [0, 1, 2, 3];

export function SettingsScreen() {
  const t = useT(strings);
  const { lang } = useLang();
  const settings = useApp((s) => s.settings);
  const speed = useApp(selectSpeed);

  return (
    <Screen title={t('title')} nav="back" backTo="/account">
      <Section title={t('display')}>
        <Grid>
          <Card className={styles.control}>
            <h3 className={styles.label}>{t('language')}</h3>
            <Segmented<Lang>
              label={t('language')}
              value={lang}
              onChange={setLang}
              options={[
                { value: 'ar', label: 'العربية' },
                { value: 'en', label: 'English' },
              ]}
            />
            <p className={styles.hint}>{t('languageHint')}</p>
          </Card>

          <Card className={styles.control}>
            <h3 className={styles.label}>{t('appearance')}</h3>
            <Segmented<ThemeChoice>
              label={t('appearance')}
              value={settings.theme}
              onChange={setTheme}
              options={[
                { value: 'auto', label: t('auto') },
                { value: 'light', label: t('light') },
                { value: 'dark', label: t('dark') },
              ]}
            />
            <p className={styles.hint}>{t('appearanceHint')}</p>
          </Card>

          <Card className={styles.control}>
            <h3 className={styles.label}>{t('textSize')}</h3>
            <ChipRow label={t('textSize')} wrap>
              {TEXT_SIZES.map((size) => (
                <Chip key={size} selected={settings.textSize === size} onClick={() => setTextSize(size)}>
                  {t(`size${size}`)}
                </Chip>
              ))}
            </ChipRow>
            <p className={styles.preview} aria-live="polite">
              <span className="visually-hidden">{t('previewLabel')}: </span>
              {t('preview')}
            </p>
          </Card>
        </Grid>
      </Section>

      <Section title={t('notifications')}>
        <Notifications on={settings.notifications} />
      </Section>

      <Section title={t('demo')}>
        <Grid columns={2}>
          <Profile />
          <Card className={styles.control}>
            <h3 className={styles.label}>{t('speed')}</h3>
            <Segmented<SpeedKey>
              label={t('speed')}
              value={speedKey(speed)}
              onChange={(key) => setSpeed(SPEEDS[key])}
              options={[
                { value: 'calm', label: t('calm') },
                { value: 'normal', label: t('normal') },
                { value: 'fast', label: t('fast') },
              ]}
            />
            <p className={styles.hint}>{t('speedHint')}</p>
          </Card>
        </Grid>
      </Section>
    </Screen>
  );
}

function Notifications({ on }: { on: boolean }) {
  const t = useT(strings);
  const labelId = useId();
  const state = on ? t('on') : t('off');
  return (
    <>
      <List>
        <Row
          leading={<Icon icon={Bell} />}
          title={<span id={labelId}>{t('notify')}</span>}
          subtitle={t('notifyHint')}
          wrap
          trailing={<Switch checked={on} onChange={setNotifications} aria-labelledby={labelId} />}
        />
        <Row leading={<Icon icon={Smartphone} />} title={t('channelApp')} subtitle={t('channelAppLine')} wrap trailing={state} />
        <Row leading={<Icon icon={MessageSquareText} />} title={t('channelSms')} subtitle={t('channelSmsLine')} wrap trailing={state} />
        <Row leading={<Icon icon={Mail} />} title={t('channelEmail')} subtitle={t('channelEmailLine')} wrap trailing={state} />
      </List>
      <p className={styles.note}>
        <DemoPill kind="illustrative" /> {t('channelsNote')}
      </p>
    </>
  );
}

function Profile() {
  const t = useT(strings);
  const { pick } = useLang();
  const persona = useApp(selectPersona);
  const company = useApp(selectCompany);
  const name = persona === 'guest' ? t('guest') : t(persona);
  const line = persona === 'guest' || !company ? t('guestLine') : pick(company.name);
  return (
    <List>
      <Row leading={<Icon icon={UserRound} />} title={name} subtitle={line} wrap />
      <Row leading={<Icon icon={Repeat2} />} title={t('switchProfile')} subtitle={t('switchLine')} to="/welcome" wrap />
    </List>
  );
}
