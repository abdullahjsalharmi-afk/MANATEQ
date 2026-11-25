import { getZone } from '@/data/catalog';
import type { L10n } from '@/data/types';
import type { Plot } from '@/domain/types';

/** One of the investor's plots, ready to show as a choice. */
export interface PlotOption {
  id: string;
  number: string;
  zoneName: L10n | undefined;
}

export function plotOptions(plots: readonly Plot[]): PlotOption[] {
  return plots.map((plot) => ({ id: plot.id, number: plot.number, zoneName: getZone(plot.zoneCode)?.name }));
}

/**
 * The plot a flow starts on: the one named in `?plot=` when it is one of the investor's, otherwise the
 * only plot when there is exactly one, otherwise none (the investor chooses).
 */
export function initialPlotId(plots: readonly Pick<Plot, 'id' | 'number'>[], requested: string | undefined): string | null {
  if (requested) {
    const match = plots.find((plot) => plot.id === requested || plot.number === requested);
    if (match) return match.id;
  }
  return plots.length === 1 ? plots[0]!.id : null;
}
