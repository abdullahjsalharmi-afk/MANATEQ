import { CircleUserRound, House, LayoutGrid, ListChecks, MapPinned } from 'lucide-react';
import { Suspense, useEffect, useLayoutEffect, useMemo } from 'react';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { LangProvider, useLang, useT } from '@/app/i18n';
import { navigate, useLocation } from '@/app/router';
import { resolveRoute, RouteContext, type TabKey } from '@/app/routes';
import { shell } from '@/app/strings';
import { useAppearance } from '@/app/theme';
import { catalog } from '@/data/catalog';
import { Button, Footer, GlobalNav, Render, Screen, TabBar, Tile, ToastHost, type FooterColumn, type TabItem } from '@/design/core';
import { setLang, tick } from '@/state/actions';
import { useApp } from '@/state/store';
import styles from './App.module.css';

/** How often the demo simulation moves requests forward. */
const TICK_MS = 1000;

export function App() {
  const settings = useApp((s) => s.settings);
  useAppearance(settings);

  useEffect(() => {
    tick(Date.now());
    const timer = window.setInterval(() => tick(Date.now()), TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <LangProvider lang={settings.lang}>
      <Shell />
      <ToastHost />
    </LangProvider>
  );
}

/**
 * The shell. Phones: each screen's frosted bar at the top and the tab bar at the bottom.
 * From 834 px: the black global bar at the top and the footer at the end of every tabbed screen.
 * Flows and the welcome (`plain` chrome) have neither: only the screen's own bar.
 */
function Shell() {
  const t = useT(shell);
  const { lang, pick } = useLang();
  const location = useLocation();
  const onboarded = useApp((s) => s.settings.onboarded);
  const persona = useApp((s) => s.world.persona);
  const waiting = useApp((s) => s.world.requests.filter((r) => r.status === 'needs_you').length);
  const match = useMemo(() => resolveRoute(location.path), [location.path]);

  const mustWelcome = !onboarded && location.path !== '/welcome' && location.path !== '/gallery';
  useEffect(() => {
    if (mustWelcome) navigate('/welcome', { replace: true });
  }, [mustWelcome]);

  // Tells the stylesheet what is pinned to the viewport, before the screen paints.
  const chrome = match?.route.chrome ?? 'tabs';
  useLayoutEffect(() => {
    document.documentElement.dataset.chrome = chrome;
  }, [chrome]);

  if (mustWelcome) return null;

  const tabs: TabItem[] = [
    { key: 'home', to: '/', label: t('tabHome'), icon: House },
    { key: 'services', to: '/services', label: t('tabServices'), icon: LayoutGrid },
    { key: 'requests', to: '/requests', label: t('tabRequests'), icon: ListChecks, badge: waiting },
    { key: 'zones', to: '/zones', label: t('tabZones'), icon: MapPinned },
    { key: 'account', to: '/account', label: t('tabAccount'), icon: CircleUserRound },
  ];

  const footerColumns: FooterColumn[] = [
    {
      title: t('footServices'),
      links: [
        { label: t('footAllServices'), to: '/services' },
        { label: t('footRequests'), to: '/requests' },
        { label: t('footEligibility'), to: '/eligibility' },
        { label: t('footSearch'), to: '/search' },
      ],
    },
    {
      title: t('footZones'),
      links: [
        { label: t('footZonesMap'), to: '/zones' },
        { label: t('footSolutions'), to: '/solutions' },
      ],
    },
    {
      title: t('footAccount'),
      links: [
        { label: t('footMyAccount'), to: '/account' },
        { label: t('footWallet'), to: '/account/wallet' },
        { label: t('footPayments'), to: '/account/payments' },
        { label: t('footSupport'), to: '/account/support' },
        { label: t('footSettings'), to: '/account/settings' },
      ],
    },
    {
      title: t('footAbout'),
      links: [
        { label: t('footHow'), to: '/account/about?section=prototype' },
        { label: t('footPrivacy'), to: '/account/about?section=privacy' },
        { label: t('footAccessibility'), to: '/account/about?section=accessibility' },
      ],
    },
  ];

  let content;
  if (!match) content = <NotFound />;
  else if (persona === 'guest' && !match.route.open) content = <SignInGate />;
  else content = <match.route.Component />;

  const tabbed = chrome === 'tabs';
  const activeTab: TabKey | null = match?.route.tab ?? null;
  const routeValue = { params: match?.params ?? {}, query: location.query };

  return (
    <RouteContext.Provider value={routeValue}>
      {tabbed ? (
        <GlobalNav
          label={t('tabsLabel')}
          items={tabs}
          activeKey={activeTab}
          brand={t('appName')}
          search={{ to: '/search', label: t('search') }}
          language={{ name: t('otherLanguage'), lang: lang === 'ar' ? 'en' : 'ar', onSwitch: () => setLang(lang === 'ar' ? 'en' : 'ar') }}
        />
      ) : null}
      <div className={styles.app} key={location.path}>
        <ErrorBoundary resetKey={location.path} fallback={(retry) => <Broken onRetry={retry} />}>
          <Suspense fallback={<div className={styles.loading} role="status" aria-label={t('loading')} />}>{content}</Suspense>
        </ErrorBoundary>
        {tabbed ? <Footer label={t('footerLabel')} columns={footerColumns} note={t('footNote')} edition={t('footEdition', { edition: pick(catalog.edition) })} /> : null}
      </div>
      {tabbed ? <TabBar items={tabs} activeKey={activeTab} label={t('tabsLabel')} /> : null}
    </RouteContext.Provider>
  );
}

function Broken({ onRetry }: { onRetry: () => void }) {
  const t = useT(shell);
  return (
    <Screen title={t('brokenName')} bleed>
      <Tile
        tone="light"
        fill
        headline={t('brokenTitle')}
        tagline={t('brokenBody')}
        actions={
          <>
            <Button onClick={onRetry}>{t('tryAgain')}</Button>
            <Button to="/" variant="secondary">
              {t('goHome')}
            </Button>
          </>
        }
      />
    </Screen>
  );
}

function NotFound() {
  const t = useT(shell);
  return (
    <Screen title={t('notFoundName')} bleed>
      <Tile tone="light" fill headline={t('notFoundTitle')} tagline={t('notFoundBody')} actions={<Button to="/">{t('goHome')}</Button>} media={<Render name="plot" decorative eager />} />
    </Screen>
  );
}

function SignInGate() {
  const t = useT(shell);
  return (
    <Screen title={t('signInName')} nav="back" navLabel={t('back')} bleed>
      <Tile tone="light" fill headline={t('signInTitle')} tagline={t('signInBody')} actions={<Button to="/welcome">{t('signIn')}</Button>} media={<Render name="gate" decorative eager />} />
    </Screen>
  );
}
