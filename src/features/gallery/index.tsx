/**
 * Component gallery (`#/gallery`): every design-system component in its states, for visual review in
 * both languages and themes. Not linked from the app.
 *
 * The page is itself built the way every screen is: a hero tile, contained sections on the parchment
 * page, tiles for the big moments. Two reference pages show the patterns a gallery page cannot:
 * `#/gallery?page=welcome` (a whole screen as the maroon tile) and `#/gallery?page=flow` (a step of a
 * flow with the progress line and the sticky action bar).
 */
import { lazy, Suspense, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { useQuery } from '@/app/routes';
import { Button, Chip, ChipRow, Container, Grid, List, Mark, Render, Row, Screen, Section, Segmented, Tile, toast } from '@/design/core';
import { Stepper } from '@/design/forms';
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
  reference: { ar: 'صفحات مرجعية', en: 'Reference pages' },
  refWelcome: { ar: 'شاشة كاملة بالبلاطة العنّابية', en: 'A whole screen as the maroon tile' },
  refWelcomeSub: { ar: 'نمط شاشة الترحيب', en: 'The pattern of the welcome screen' },
  refFlow: { ar: 'خطوة في مسار', en: 'A step of a flow' },
  refFlowSub: { ar: 'خط التقدّم وشريط الإجراء الثابت', en: 'The progress line and the sticky action bar' },

  appName: { ar: 'مناطق ون', en: 'Manateq One' },
  line: { ar: 'خمسون خدمة. رحلة واحدة.', en: 'Fifty services. One journey.' },
  lineTagline: { ar: 'من الانضمام إلى التشغيل، ونعرف خطوتك التالية دائمًا.', en: 'From joining to operating, and we always know your next step.' },
  signIn: { ar: 'الدخول عبر توثيق', en: 'Sign in with Tawtheeq' },
  browse: { ar: 'تصفّح دون دخول', en: 'Browse without signing in' },
  finePrint: { ar: 'نسخة تجريبية للعرض. الدخول محاكاة، وجميع البيانات توضيحية.', en: 'A prototype for demonstration. Sign-in is simulated and all data is illustrative.' },
  backToGallery: { ar: 'العودة إلى المعرض', en: 'Back to the gallery' },

  flowTitle: { ar: 'فحص الأهلية', en: 'Eligibility check' },
  flowClose: { ar: 'أغلق وعُد إلى المعرض', en: 'Close and go back to the gallery' },
  step: { ar: 'الخطوة {n} من {m}', en: 'Step {n} of {m}' },
  question: { ar: 'ما المساحة التي يحتاجها مشروعك؟', en: 'How much area does your project need?' },
  questionHint: { ar: 'تقريبية الآن؛ تُحدَّد بدقة عند اختيار القطعة.', en: 'Approximate for now; it is fixed when you choose a plot.' },
  solution: { ar: 'نوع الحل', en: 'Solution type' },
  logistics: { ar: 'لوجستي', en: 'Logistics' },
  industrial: { ar: 'صناعي', en: 'Industrial' },
  openYard: { ar: 'ساحة مفتوحة', en: 'Open yard' },
  area: { ar: 'المساحة', en: 'Area' },
  perYear: { ar: '{amount} سنويًا', en: '{amount} a year' },
  estimate: { ar: 'التقدير', en: 'Estimate' },
  indicative: { ar: 'تقدير استرشادي بالسعر المنشور', en: 'An indicative estimate at the published price' },
  continue: { ar: 'متابعة', en: 'Continue' },
  saved: { ar: 'حُفظت إجابتك', en: 'Your answer was saved' },
} as const;

export function GalleryScreen() {
  const query = useQuery();
  if (query.page === 'welcome') return <WelcomePattern />;
  if (query.page === 'flow') return <FlowPattern />;
  return <Gallery />;
}

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

function Gallery() {
  const t = useT(strings);
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
          <Row title={t('language')} trailing={<LanguageSwitch />} />
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
        <Section title={t('reference')}>
          <List>
            <Row to="/gallery?page=welcome" title={t('refWelcome')} subtitle={t('refWelcomeSub')} />
            <Row to="/gallery?page=flow" title={t('refFlow')} subtitle={t('refFlowSub')} />
          </List>
        </Section>
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

/** A whole screen as the maroon tile: the bar is maroon too, and every component inside reads on it. */
function WelcomePattern() {
  const t = useT(strings);
  return (
    <Screen title={t('appName')} hideTitle tone="brand" bleed actions={<LanguageSwitch />}>
      <Tile
        tone="brand"
        size="hero"
        fill
        lead={
          <>
            <Mark size={40} />
            <span className="type-heading">{t('appName')}</span>
          </>
        }
        headline={t('line')}
        tagline={t('lineTagline')}
        actions={
          <>
            <Button size="lg" onClick={() => toast(t('signIn'), { tone: 'info' })}>
              {t('signIn')}
            </Button>
            <Button size="lg" variant="secondary" to="/gallery">
              {t('browse')}
            </Button>
          </>
        }
        media={<Render name="zone" eager />}
      >
        <p className="type-foot">{t('finePrint')}</p>
        <Button variant="quiet" size="sm" to="/gallery">
          {t('backToGallery')}
        </Button>
      </Tile>
    </Screen>
  );
}

const AREAS = [2500, 5000, 10000] as const;
const PRICE = { logistics: 15, industrial: 5, openYard: 10 } as const;

/** One step of a flow: close in the bar, the 2 px progress line under it, one question, chips, the sticky action bar. */
function FlowPattern() {
  const t = useT(strings);
  const { fmt } = useLang();
  const [solution, setSolution] = useState<keyof typeof PRICE>('logistics');
  const [area, setArea] = useState<number>(5000);
  const yearly = (sqm: number) => t('perYear', { amount: fmt.money(sqm * PRICE[solution]) });
  return (
    <Screen
      title={t('flowTitle')}
      nav="close"
      navLabel={t('flowClose')}
      onNav={() => navigate('/gallery')}
      width="form"
      header={<Stepper current={2} total={4} label={t('step', { n: 2, m: 4 })} />}
      footerContext={
        <>
          {t('estimate')} <strong>{yearly(area)}</strong>
        </>
      }
      footer={
        <Button block onClick={() => toast(t('saved'))}>
          {t('continue')}
        </Button>
      }
    >
      <p className="type-callout" style={{ color: 'var(--ink-3)' }}>
        {t('step', { n: 2, m: 4 })}
      </p>
      <h2 className="type-title" style={{ fontWeight: 600, marginBlock: 'var(--s-2)' }}>
        {t('question')}
      </h2>
      <p style={{ color: 'var(--ink-3)', marginBlockEnd: 'var(--s-8)' }}>{t('questionHint')}</p>

      <ChipRow label={t('solution')} wrap>
        {(['logistics', 'industrial', 'openYard'] as const).map((key) => (
          <Chip key={key} selected={solution === key} onClick={() => setSolution(key)}>
            {t(key)}
          </Chip>
        ))}
      </ChipRow>

      <Grid columns={2} role="group" aria-label={t('area')} style={{ marginBlockStart: 'var(--s-6)' }}>
        {AREAS.map((sqm) => (
          <Chip key={sqm} selected={area === sqm} onClick={() => setArea(sqm)} detail={yearly(sqm)}>
            {fmt.area(sqm)}
          </Chip>
        ))}
      </Grid>
      <p className="type-foot" style={{ color: 'var(--ink-3)', marginBlockStart: 'var(--s-4)' }}>
        {t('indicative')}
      </p>
    </Screen>
  );
}
