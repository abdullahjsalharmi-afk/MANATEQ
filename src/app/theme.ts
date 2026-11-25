/**
 * Applies language, direction, theme and text size to the document, and keeps the browser chrome
 * colour (the status bar of a phone, the title bar of an installed app) in step with the page.
 */
import { useEffect } from 'react';
import type { Settings, ThemeChoice } from '@/domain/types';

/** The page colour of each theme: parchment, and true black. Mirrors `--bg` in tokens.css. */
const THEME_COLOR = { light: '#f5f5f7', dark: '#000000' } as const;

/** A screen that is dark from edge to edge (the welcome) asks for its own chrome colour while it is open. */
let chromeOverride: string | null = null;

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'auto') return systemPrefersDark() ? 'dark' : 'light';
  return choice;
}

function writeChromeColor(theme: 'light' | 'dark'): void {
  const color = chromeOverride ?? THEME_COLOR[theme];
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = color;
    document.head.appendChild(meta);
    return;
  }
  // index.html ships one tag per colour scheme for the moment before the app starts; from here on the app decides.
  metas.forEach((meta) => {
    meta.removeAttribute('media');
    meta.content = color;
  });
}

export function applyAppearance(settings: Pick<Settings, 'lang' | 'theme' | 'textSize'>): void {
  const root = document.documentElement;
  const theme = resolveTheme(settings.theme);
  root.lang = settings.lang;
  root.dir = settings.lang === 'ar' ? 'rtl' : 'ltr';
  root.dataset.theme = theme;
  root.dataset.text = String(settings.textSize);
  writeChromeColor(theme);
}

/**
 * Sets the browser chrome colour for as long as a full-colour screen is open; pass `null` to go back
 * to the theme's page colour.
 */
export function setChromeColor(color: string | null): void {
  chromeOverride = color;
  if (typeof document === 'undefined') return;
  writeChromeColor(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
}

/** Keeps the document in step with the settings, including when the system theme changes. */
export function useAppearance(settings: Pick<Settings, 'lang' | 'theme' | 'textSize'>): void {
  const { lang, theme, textSize } = settings;
  useEffect(() => {
    applyAppearance({ lang, theme, textSize });
    if (theme !== 'auto' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyAppearance({ lang, theme, textSize });
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [lang, theme, textSize]);
}
