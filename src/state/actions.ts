/**
 * Everything that changes the app state. Components never call `setState` directly.
 */
import type { Lang } from '@/data/types';
import type { Persona, TextSize, ThemeChoice } from '@/domain/types';
import { emptyWorld } from './seed';
import { setState } from './store';

export function setLang(lang: Lang): void {
  setState((s) => (s.settings.lang === lang ? s : { ...s, settings: { ...s.settings, lang } }));
}

export function setTheme(theme: ThemeChoice): void {
  setState((s) => (s.settings.theme === theme ? s : { ...s, settings: { ...s.settings, theme } }));
}

export function setTextSize(textSize: TextSize): void {
  setState((s) => (s.settings.textSize === textSize ? s : { ...s, settings: { ...s.settings, textSize } }));
}

/** Finishes the welcome screen as a guest or with a demo profile. */
export function enterAs(persona: Persona): void {
  setState((s) => ({ ...s, settings: { ...s.settings, onboarded: true }, world: emptyWorld(persona) }));
}

/** Advances the simulation: called once a second by the app shell. */
export function tick(_now: number): void {
  /* implemented with the request simulation */
}
