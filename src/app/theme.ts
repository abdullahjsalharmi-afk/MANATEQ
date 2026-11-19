/**
 * Applies language, direction, theme and text size to the document, and keeps the browser chrome
 * colour in step with the theme.
 */
import { useEffect } from 'react';
import type { Settings, ThemeChoice } from '@/domain/types';

const THEME_COLOR = { light: '#f6f4f0', dark: '#121011' } as const;

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'auto') return systemPrefersDark() ? 'dark' : 'light';
  return choice;
}

export function applyAppearance(settings: Pick<Settings, 'lang' | 'theme' | 'textSize'>): void {
  const root = document.documentElement;
  const theme = resolveTheme(settings.theme);
  root.lang = settings.lang;
  root.dir = settings.lang === 'ar' ? 'rtl' : 'ltr';
  root.dataset.theme = theme;
  root.dataset.text = String(settings.textSize);
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = THEME_COLOR[theme];
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
