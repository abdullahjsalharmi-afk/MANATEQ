/**
 * The route table. Every screen is loaded on demand; each feature exports its screens from
 * `src/features/<name>/index.ts(x)`.
 */
import { createContext, lazy, useContext, type ComponentType, type LazyExoticComponent } from 'react';
import { matchPath } from './router';

export type TabKey = 'home' | 'services' | 'requests' | 'zones' | 'account';

/** `tabs` shows the tab bar; `plain` is a full-screen flow or the welcome screen. */
export type Chrome = 'tabs' | 'plain';

export interface RouteDef {
  pattern: string;
  Component: LazyExoticComponent<ComponentType>;
  chrome: Chrome;
  /** The tab that is highlighted while this route is open. */
  tab: TabKey | null;
  /** Screens that guests may open. Everything else asks for sign-in first. */
  open?: boolean;
}

const screen = <M,>(load: () => Promise<M>, pick: (module: M) => ComponentType) => lazy(() => load().then((module) => ({ default: pick(module) })));

export const routes: RouteDef[] = [
  { pattern: '/welcome', Component: screen(() => import('@/features/welcome'), (m) => m.WelcomeScreen), chrome: 'plain', tab: null, open: true },

  { pattern: '/', Component: screen(() => import('@/features/home'), (m) => m.HomeScreen), chrome: 'tabs', tab: 'home', open: true },
  { pattern: '/notifications', Component: screen(() => import('@/features/notifications'), (m) => m.NotificationsScreen), chrome: 'tabs', tab: 'home' },
  { pattern: '/search', Component: screen(() => import('@/features/search'), (m) => m.SearchScreen), chrome: 'tabs', tab: 'services', open: true },

  { pattern: '/services', Component: screen(() => import('@/features/services'), (m) => m.ServicesScreen), chrome: 'tabs', tab: 'services', open: true },
  { pattern: '/services/:id', Component: screen(() => import('@/features/services'), (m) => m.ServiceScreen), chrome: 'tabs', tab: 'services', open: true },
  { pattern: '/start/:id', Component: screen(() => import('@/features/start'), (m) => m.StartScreen), chrome: 'plain', tab: null },
  { pattern: '/eligibility', Component: screen(() => import('@/features/flows'), (m) => m.EligibilityScreen), chrome: 'plain', tab: null, open: true },

  { pattern: '/requests', Component: screen(() => import('@/features/requests'), (m) => m.RequestsScreen), chrome: 'tabs', tab: 'requests' },
  { pattern: '/requests/:id', Component: screen(() => import('@/features/requests'), (m) => m.RequestScreen), chrome: 'tabs', tab: 'requests' },

  { pattern: '/zones', Component: screen(() => import('@/features/zones'), (m) => m.ZonesScreen), chrome: 'tabs', tab: 'zones', open: true },
  { pattern: '/zones/:code', Component: screen(() => import('@/features/zones'), (m) => m.ZoneScreen), chrome: 'tabs', tab: 'zones', open: true },
  { pattern: '/solutions', Component: screen(() => import('@/features/zones'), (m) => m.SolutionsScreen), chrome: 'tabs', tab: 'zones', open: true },

  { pattern: '/account', Component: screen(() => import('@/features/account'), (m) => m.AccountScreen), chrome: 'tabs', tab: 'account', open: true },
  { pattern: '/account/company', Component: screen(() => import('@/features/account'), (m) => m.CompanyScreen), chrome: 'tabs', tab: 'account' },
  { pattern: '/account/plots', Component: screen(() => import('@/features/account'), (m) => m.PlotsScreen), chrome: 'tabs', tab: 'account' },
  { pattern: '/account/plots/:id', Component: screen(() => import('@/features/account'), (m) => m.PlotScreen), chrome: 'tabs', tab: 'account' },
  { pattern: '/account/team', Component: screen(() => import('@/features/account'), (m) => m.TeamScreen), chrome: 'tabs', tab: 'account' },
  { pattern: '/account/settings', Component: screen(() => import('@/features/account'), (m) => m.SettingsScreen), chrome: 'tabs', tab: 'account', open: true },
  { pattern: '/account/support', Component: screen(() => import('@/features/account'), (m) => m.SupportScreen), chrome: 'tabs', tab: 'account', open: true },
  { pattern: '/account/about', Component: screen(() => import('@/features/account'), (m) => m.AboutScreen), chrome: 'tabs', tab: 'account', open: true },

  { pattern: '/account/wallet', Component: screen(() => import('@/features/wallet'), (m) => m.WalletScreen), chrome: 'tabs', tab: 'account' },
  { pattern: '/account/wallet/:id', Component: screen(() => import('@/features/wallet'), (m) => m.WalletItemScreen), chrome: 'tabs', tab: 'account' },
  { pattern: '/verify', Component: screen(() => import('@/features/wallet'), (m) => m.VerifyScreen), chrome: 'tabs', tab: 'account', open: true },
  { pattern: '/account/payments', Component: screen(() => import('@/features/payments'), (m) => m.PaymentsScreen), chrome: 'tabs', tab: 'account' },
  { pattern: '/account/payments/:id', Component: screen(() => import('@/features/payments'), (m) => m.InvoiceScreen), chrome: 'tabs', tab: 'account' },

  { pattern: '/gallery', Component: screen(() => import('@/features/gallery'), (m) => m.GalleryScreen), chrome: 'plain', tab: null, open: true },
];

export interface RouteMatch {
  route: RouteDef;
  params: Record<string, string>;
}

export function resolveRoute(path: string): RouteMatch | null {
  for (const route of routes) {
    const params = matchPath(route.pattern, path);
    if (params) return { route, params };
  }
  return null;
}

export interface RouteContextValue {
  params: Record<string, string>;
  query: Record<string, string>;
}

export const RouteContext = createContext<RouteContextValue>({ params: {}, query: {} });

/** The `:params` of the current route, e.g. `{ id: 'A4' }`. */
export function useParams<P extends Record<string, string> = Record<string, string>>(): P {
  return useContext(RouteContext).params as P;
}

/** The `?query` of the current route. */
export function useQuery(): Record<string, string> {
  return useContext(RouteContext).query;
}
