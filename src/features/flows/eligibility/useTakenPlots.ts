import { useMemo } from 'react';
import { useApp } from '@/state';

/**
 * The plots of the layouts that are no longer free for this investor: the ones they hold and the ones
 * an open application of theirs already names. The check and the application leave them out.
 */
export function useTakenPlots(): ReadonlySet<string> {
  const plots = useApp((state) => state.world.plots);
  const requests = useApp((state) => state.world.requests);
  return useMemo(() => {
    const taken = new Set(plots.map((plot) => plot.id));
    for (const request of requests) {
      if (request.plotId && (request.status === 'active' || request.status === 'needs_you')) taken.add(request.plotId);
    }
    return taken;
  }, [plots, requests]);
}

/** The ids of the plots the investor holds, drawn as "your plot" on a layout. */
export function useOwnPlots(): ReadonlySet<string> {
  const plots = useApp((state) => state.world.plots);
  return useMemo(() => new Set(plots.map((plot) => plot.id)), [plots]);
}
