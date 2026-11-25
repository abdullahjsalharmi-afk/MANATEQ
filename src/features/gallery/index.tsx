/**
 * Component gallery (`#/gallery`): every design-system component in its states, for visual review in
 * both languages and themes. Not linked from the app.
 *
 * The page is itself built the way every screen is: a hero tile, contained sections on the parchment
 * page, tiles for the big moments, the footer at the end.
 */
import { lazy, Suspense } from 'react';
import { useLang, useT } from '@/app/i18n';
import { Button, Container, List, Render, Row, Screen, Segmented, Tile } from '@/design/core';
import { setLang, setTheme } from '@/state/actions';
import { useApp } from '@/state/store';

const CoreGallery = lazy(() => import('./CoreGallery').then((m) => ({ default: m.CoreGallery })));
const RenderGallery = lazy(() => import('./RenderGallery').then((m) => ({ default: m.RenderGallery })));
const FormsGallery = lazy(() => import('./FormsGallery').then((m) => ({ default: m.FormsGallery })));
const SignatureGallery = lazy(() => import('./SignatureGallery').then((m) => ({ default: m.SignatureGallery })));

const strings = {
  title: { ar: 'معرض المكوّنات', en: 'Component gallery' },
  eyebrow: { ar: 'نظام تصميم مناطق ون', en: 'The Manateq One design system' },
  headline: { ar: 'كل مكوّن. في كل حالة.', en: 'Every component. Every state.' },
  tagline: { ar: 'واجهة هادئة تتراجع، ومجسّمات المباني في الصدارة.', en: 'A quiet interface that recedes, with the building renders in front.' },
  open: { ar: 'افتح التطبيق', en: 'Open the app' },
  welcome: { ar: 'شاشة الترحيب', en: 'Welcome screen' },
  view: { ar: 'خيارات العرض', en: 'View options' },
  language: { ar: 'اللغة', en: 'Language' },
  theme: { ar: 'المظهر', en: 'Appearance' },
  auto: { ar: 'تلقائي', en: 'Auto' },
  light: { ar: 'فاتح', en: 'Light' },
  dark: { ar: 'داكن', en: 'Dark' },
} as const;

export function GalleryScreen() {
  const t = useT(strings);
  const { lang } = useLang();
  const theme = useApp((s) => s.settings.theme);
  return (
    <Screen title={t('title')} bleed>
      <Tile
        tone="light"
        size="hero"
        eyebrow={t('eyebrow')}
        headline={t('headline')}
        tagline={t('tagline')}
        actions={
          <>
            <Button to="/">{t('open')}</Button>
            <Button to="/welcome" variant="secondary">
              {t('welcome')}
            </Button>
          </>
        }
        media={<Render name="zone" eager decorative />}
      />

      <Container width="form">
        <List aria-label={t('view')}>
          <Row
            title={t('language')}
            trailing={
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
            }
          />
          <Row
            title={t('theme')}
            trailing={
              <Segmented
                inline
                size="sm"
                label={t('theme')}
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'auto', label: t('auto') },
                  { value: 'light', label: t('light') },
                  { value: 'dark', label: t('dark') },
                ]}
              />
            }
          />
        </List>
      </Container>

      <Suspense fallback={null}>
        <CoreGallery />
        <RenderGallery />
        <Container>
          <FormsGallery />
        </Container>
        <Container>
          <SignatureGallery />
        </Container>
      </Suspense>
    </Screen>
  );
}
