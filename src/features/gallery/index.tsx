/**
 * Component gallery (`#/gallery`): every design-system component in its states, for visual review in
 * both languages and themes. Not linked from the app.
 */
import { lazy, Suspense } from 'react';
import { useLang } from '@/app/i18n';
import { Button, Screen, Segmented } from '@/design/core';
import { setLang, setTheme } from '@/state/actions';
import { useApp } from '@/state/store';

const CoreGallery = lazy(() => import('./CoreGallery').then((m) => ({ default: m.CoreGallery })));
const FormsGallery = lazy(() => import('./FormsGallery').then((m) => ({ default: m.FormsGallery })));
const SignatureGallery = lazy(() => import('./SignatureGallery').then((m) => ({ default: m.SignatureGallery })));
const SketchGallery = lazy(() => import('./SketchGallery').then((m) => ({ default: m.SketchGallery })));

export function GalleryScreen() {
  const { lang } = useLang();
  const theme = useApp((s) => s.settings.theme);
  return (
    <Screen title="Gallery" large subtitle="Design-system components in every state.">
      <div style={{ display: 'grid', gap: 12, marginBlockEnd: 32 }}>
        <Segmented label="Language" value={lang} onChange={setLang} options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
        <Segmented label="Theme" value={theme} onChange={setTheme} options={[{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        <Button to="/" variant="quiet" size="sm">
          Open the app
        </Button>
      </div>
      <Suspense fallback={null}>
        <CoreGallery />
        <FormsGallery />
        <SignatureGallery />
        <SketchGallery />
      </Suspense>
    </Screen>
  );
}
