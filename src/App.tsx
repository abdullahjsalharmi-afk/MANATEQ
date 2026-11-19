import { CircleUserRound, House, LayoutGrid, ListChecks, MapPinned } from 'lucide-react';
import { Suspense, useEffect, useMemo } from 'react';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { LangProvider, useT } from '@/app/i18n';
import { navigate, useLocation } from '@/app/router';
import { resolveRoute, RouteContext, type TabKey } from '@/app/routes';
import { shell } from '@/app/strings';
import { useAppearance } from '@/app/theme';
import { Button, Screen, TabBar, ToastHost, type TabItem } from '@/design/core';
import { tick } from '@/state/actions';
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

function Shell() {
  const t = useT(shell);
  const location = useLocation();
  const onboarded = useApp((s) => s.settings.onboarded);
  const persona = useApp((s) => s.world.persona);
  const waiting = useApp((s) => s.world.requests.filter((r) => r.status === 'needs_you').length);
  const match = useMemo(() => resolveRoute(location.path), [location.path]);

  const mustWelcome = !onboarded && location.path !== '/welcome' && location.path !== '/gallery';
  useEffect(() => {
    if (mustWelcome) navigate('/welcome', { replace: true });
  }, [mustWelcome]);

  const chrome = match?.route.chrome ?? 'tabs';
  useEffect(() => {
    document.documentElement.dataset.chrome = chrome;
  }, [chrome]);

  const tabs: TabItem[] = [
    { key: 'home', to: '/', label: t('tabHome'), icon: House },
    { key: 'services', to: '/services', label: t('tabServices'), icon: LayoutGrid },
    { key: 'requests', to: '/requests', label: t('tabRequests'), icon: ListChecks, badge: waiting },
    { key: 'zones', to: '/zones', label: t('tabZones'), icon: MapPinned },
    { key: 'account', to: '/account', label: t('tabAccount'), icon: CircleUserRound },
  ];

  if (mustWelcome) return null;

  let content;
  if (!match) content = <NotFound />;
  else if (persona === 'guest' && !match.route.open) content = <SignInGate />;
  else content = <match.route.Component />;

  const activeTab: TabKey | null = match?.route.tab ?? null;
  const routeValue = { params: match?.params ?? {}, query: location.query };

  return (
    <RouteContext.Provider value={routeValue}>
      <div className={styles.app} key={location.path}>
        <ErrorBoundary resetKey={location.path} fallback={(retry) => <Broken onRetry={retry} />}>
          <Suspense fallback={<div className={styles.loading} role="status" aria-label={t('loading')} />}>{content}</Suspense>
        </ErrorBoundary>
      </div>
      {chrome === 'tabs' ? <TabBar items={tabs} activeKey={activeTab} label={t('tabsLabel')} /> : null}
    </RouteContext.Provider>
  );
}

function Broken({ onRetry }: { onRetry: () => void }) {
  const t = useT(shell);
  return (
    <Screen title={t('brokenTitle')} large subtitle={t('brokenBody')}>
      <div className={styles.actions}>
        <Button onClick={onRetry}>{t('tryAgain')}</Button>
        <Button to="/" variant="secondary">
          {t('goHome')}
        </Button>
      </div>
    </Screen>
  );
}

function NotFound() {
  const t = useT(shell);
  return (
    <Screen title={t('notFoundTitle')} large subtitle={t('notFoundBody')}>
      <Button to="/">{t('goHome')}</Button>
    </Screen>
  );
}

function SignInGate() {
  const t = useT(shell);
  return (
    <Screen title={t('signInTitle')} large subtitle={t('signInBody')} nav="back" navLabel={t('back')}>
      <Button to="/welcome">{t('signIn')}</Button>
    </Screen>
  );
}
