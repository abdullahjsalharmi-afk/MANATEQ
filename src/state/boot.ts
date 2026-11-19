/**
 * Demo links. A presenter can open the app in a given state with query parameters:
 *   ?demo=tenant|prospect|guest   choose the demo profile (and skip the welcome screen)
 *   ?lang=ar|en                   language
 *   ?theme=light|dark|auto        appearance
 *   ?text=0..3                    text size
 * Parameters are applied once at start-up; without them the saved state is used as is.
 */
import type { Persona, TextSize, ThemeChoice } from '@/domain/types';
import { enterAs, setLang, setTextSize, setTheme } from './actions';
import { getState } from './store';

export function applyBootParams(search: string): void {
  const params = new URLSearchParams(search);
  const lang = params.get('lang');
  if (lang === 'ar' || lang === 'en') setLang(lang);
  const theme = params.get('theme');
  if (theme === 'light' || theme === 'dark' || theme === 'auto') setTheme(theme as ThemeChoice);
  const text = params.get('text');
  if (text !== null && ['0', '1', '2', '3'].includes(text)) setTextSize(Number(text) as TextSize);
  const demo = params.get('demo');
  if (demo === 'tenant' || demo === 'prospect' || demo === 'guest') {
    const state = getState();
    if (!state.settings.onboarded || state.world.persona !== demo) enterAs(demo as Persona);
  }
}
