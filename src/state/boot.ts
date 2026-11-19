/**
 * Start-up. Two things happen once, before the first paint:
 *
 * 1. Demo links. A presenter can open the app in a given state with query parameters:
 *      ?demo=tenant|prospect|guest   choose the demo profile (and skip the welcome screen);
 *                                    a different profile from the saved one starts afresh
 *      ?reset=1                      forget what this device saved and start from the beginning
 *      ?lang=ar|en                   language
 *      ?theme=light|dark|auto        appearance
 *      ?text=0..3                    text size
 *      ?speed=0..                    simulation speed (1 is normal, 0 pauses)
 *    Without parameters the saved state is used as is.
 *
 * 2. The simulation's catalogue. Every workflow is asked for once; when they have all arrived, demo
 *    worlds seeded before then are completed and requests start moving.
 */
import { loadAllServiceDetails } from '@/data/catalog';
import type { TextSize } from '@/domain/types';
import { catalogueLoaded, enterAs, setLang, setSpeed, setTextSize, setTheme } from './actions';
import { getState, resetEverything } from './store';

let catalogueRequested = false;

/** Loads every service's full record once and tells the simulation when they are all in memory. */
export function loadCatalogue(): Promise<void> {
  if (catalogueRequested) return Promise.resolve();
  catalogueRequested = true;
  return loadAllServiceDetails().then(
    () => catalogueLoaded(),
    () => {
      // A domain file failed to load (offline before the files were cached): try again on the next call.
      catalogueRequested = false;
    },
  );
}

export function applyBootParams(search: string): void {
  const params = new URLSearchParams(search);
  if (params.get('reset') === '1') resetEverything();

  const lang = params.get('lang');
  if (lang === 'ar' || lang === 'en') setLang(lang);
  const theme = params.get('theme');
  if (theme === 'light' || theme === 'dark' || theme === 'auto') setTheme(theme);
  const text = params.get('text');
  if (text !== null && ['0', '1', '2', '3'].includes(text)) setTextSize(Number(text) as TextSize);
  const speed = params.get('speed');
  if (speed !== null && speed.trim() !== '' && Number.isFinite(Number(speed))) setSpeed(Number(speed));

  const demo = params.get('demo');
  if (demo === 'tenant' || demo === 'prospect' || demo === 'guest') {
    const state = getState();
    if (!state.settings.onboarded || state.world.persona !== demo) enterAs(demo);
  }

  void loadCatalogue();
}
