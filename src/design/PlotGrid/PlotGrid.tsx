import { useRef, type KeyboardEvent } from 'react';
import { useLang, useT } from '@/app/i18n';
import { PLOT_COLS, type PlotCell, type PlotCellStatus } from '@/domain/plots';
import { cx } from '../cx';
import styles from './PlotGrid.module.css';
import { strings } from './strings';

export interface PlotGridProps {
  /** The plots of one zone, row by row (see `plotsFor`). */
  plots: PlotCell[];
  /** The id of the chosen plot. */
  selected?: string;
  /** Called when an available plot is chosen. */
  onSelect: (plot: PlotCell) => void;
  /** Ids of plots the investor already holds: shown as "your plot", whatever the layout says. */
  own?: string[];
  /**
   * Whether an available plot can be chosen for this request (for example, it is large enough for the area
   * asked for). A plot that fails is drawn as available but dimmed, is not focusable and says why
   * (`unfitLabel`); the legend gains a key for it. Default: every available plot can be chosen.
   */
  isSelectable?: (plot: PlotCell) => boolean;
  /** Why a dimmed plot cannot be chosen, e.g. «أصغر من المساحة المطلوبة». Default «لا تناسب طلبك». */
  unfitLabel?: string;
  /** Names the layout for screen readers. Default "مخطط القطع". */
  label?: string;
  className?: string;
}

const LEGEND: PlotCellStatus[] = ['available', 'allocated', 'reserved'];

/** What a cell shows: its status in the layout, "own" for a plot the investor holds, "unfit" for an available plot this request cannot use. */
type CellLook = PlotCellStatus | 'own' | 'unfit';

const STEP: Record<string, [number, number]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };

/**
 * The illustrative plot layout of a zone. Available plots are outlined buttons; leased plots are plain
 * wells and reserved plots hatched wells, both disabled, so the difference never depends on colour alone. The layout is a plan, so it
 * keeps the same orientation in Arabic and English. Arrow keys move between available plots.
 */
export function PlotGrid({ plots, selected, onSelect, own, isSelectable, unfitLabel, label, className }: PlotGridProps) {
  const t = useT(strings);
  const { fmt } = useLang();
  const gridRef = useRef<HTMLDivElement>(null);
  const lookOf = (plot: PlotCell): CellLook => {
    if (own?.includes(plot.id)) return 'own';
    if (plot.status === 'available' && isSelectable && !isSelectable(plot)) return 'unfit';
    return plot.status;
  };
  const unfitText = unfitLabel ?? t('unfit');
  const statusText = (look: CellLook) => (look === 'unfit' ? unfitText : t(look));
  const isFree = (plot: PlotCell) => lookOf(plot) === 'available';
  const chosen = plots.find((plot) => plot.id === selected && isFree(plot));
  // One plot is in the tab order: the chosen one, or the first available.
  const tabStop = chosen ?? plots.find(isFree);
  const hasOwn = plots.some((plot) => lookOf(plot) === 'own');
  const hasUnfit = plots.some((plot) => lookOf(plot) === 'unfit');
  const keys: CellLook[] = [...LEGEND, ...(hasUnfit ? (['unfit'] as const) : []), ...(hasOwn ? (['own'] as const) : [])];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const id = (event.target as HTMLElement).dataset.plot;
    const here = plots.find((plot) => plot.id === id);
    if (!here) return;
    let next: PlotCell | undefined;
    const step = STEP[event.key];
    if (step) {
      // Walk in the direction of the arrow to the next available plot.
      let row = here.row + step[0];
      let col = here.col + step[1];
      for (let guard = 0; guard < plots.length && !next; guard++) {
        const cell = plots.find((plot) => plot.row === row && plot.col === col);
        if (!cell) break;
        if (isFree(cell)) next = cell;
        row += step[0];
        col += step[1];
      }
    } else if (event.key === 'Home' || event.key === 'End') {
      const free = plots.filter((plot) => plot.row === here.row && isFree(plot));
      next = event.key === 'Home' ? free[0] : free[free.length - 1];
    } else {
      return;
    }
    event.preventDefault();
    if (next) gridRef.current?.querySelector<HTMLButtonElement>(`[data-plot="${next.id}"]`)?.focus();
  };

  return (
    <div className={cx(styles.plots, className)}>
      <div ref={gridRef} role="group" aria-label={label ?? t('grid')} className={styles.grid} style={{ gridTemplateColumns: `repeat(${PLOT_COLS}, minmax(0, 1fr))` }} onKeyDown={onKeyDown}>
        {plots.map((plot) => {
          const look = lookOf(plot);
          const free = look === 'available';
          const on = chosen?.id === plot.id;
          return (
            <button
              key={plot.id}
              type="button"
              data-plot={plot.id}
              className={cx(styles.cell, styles[look], on && styles.on)}
              disabled={!free}
              aria-pressed={free ? on : undefined}
              aria-label={t('cell', { id: plot.id, area: fmt.area(plot.areaSqm), status: statusText(look) })}
              title={look === 'unfit' ? unfitText : undefined}
              tabIndex={free ? (tabStop?.id === plot.id ? 0 : -1) : undefined}
              onClick={() => onSelect(plot)}
            >
              <span className="num" aria-hidden="true">
                {plot.number}
              </span>
            </button>
          );
        })}
      </div>

      <div className={styles.foot}>
        <ul className={styles.legend}>
          {keys.map((look) => (
            <li key={look} className={styles.key}>
              <span className={cx(styles.swatch, styles[look])} aria-hidden="true" />
              {statusText(look)}
            </li>
          ))}
        </ul>
        <p className={styles.caption}>{t('caption')}</p>
      </div>

      <p className={styles.choice} aria-live="polite">
        {chosen ? (
          <>
            <span className={styles.choiceLabel}>{t('chosen')}</span>{' '}
            <strong className={cx(styles.choiceId, 'ltr num')}>{chosen.id}</strong>{' '}
            <span className={cx(styles.choiceArea, 'num')}>{fmt.area(chosen.areaSqm)}</span>
          </>
        ) : (
          <span className={styles.choiceHint}>{t('pick')}</span>
        )}
      </p>
    </div>
  );
}
