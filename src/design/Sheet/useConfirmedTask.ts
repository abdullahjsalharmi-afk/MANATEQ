import { useEffect, useRef } from 'react';

export interface ConfirmedTask {
  /** The person has confirmed: the task is carried out after the wait, or sooner if the sheet goes away first. */
  start: () => void;
  /** The person is leaving the confirmation: report the task done. Safe to call again; it reports once. */
  settle: () => void;
}

/**
 * A payment or a signature the person has confirmed happens exactly once, whatever becomes of the sheet.
 *
 * The sheet shows it "processing" for `ms`, then its confirmation, and the task is reported done when the
 * person leaves that confirmation. But a sheet can go away before that: the person presses Back or follows a
 * link and the screen changes, or the page itself is closed. Pressing "Pay" or "Sign" was the decision, so
 * what was confirmed is not dropped: it is carried out and reported at once, with `away` set so the caller can
 * tell the person on the screen they have gone to.
 *
 * `carryOut` does the work that ends the processing (it returns false when it failed, and nothing is reported
 * done). `done` reports the task. Both are the ones of the last render in which the sheet was open.
 */
export function useConfirmedTask(open: boolean, ms: number, carryOut: () => boolean, done: (away: boolean) => void): ConfirmedTask {
  const stage = useRef<'idle' | 'running' | 'carried'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ carryOut, done });
  // A parent that closes the sheet by taking its data away must not blank what the task needs.
  if (open) latest.current = { carryOut, done };

  // These touch only the refs, so any render's copy of them does the same thing.
  const carry = () => {
    if (stage.current !== 'running') return;
    clearTimeout(timer.current);
    stage.current = latest.current.carryOut() ? 'carried' : 'idle';
  };
  const report = (away: boolean) => {
    if (stage.current !== 'carried') return;
    stage.current = 'idle';
    latest.current.done(away);
  };
  const through = () => {
    carry();
    report(true);
  };

  useEffect(() => {
    if (!open) return;
    stage.current = 'idle';
    // The page itself is going (closed, reloaded, another address): the same as the sheet going away.
    window.addEventListener('pagehide', through);
    return () => {
      window.removeEventListener('pagehide', through);
      through();
    };
    // `through` does the same thing in every render (see above), so it is not a dependency.
  }, [open]);

  return {
    start: () => {
      clearTimeout(timer.current);
      stage.current = 'running';
      timer.current = setTimeout(carry, ms);
    },
    settle: () => report(false),
  };
}
