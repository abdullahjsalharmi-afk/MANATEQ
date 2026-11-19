import { describe, expect, it } from 'vitest';
import { zones } from '@/data/catalog';
import { findPlot, PLOT_COLS, PLOT_ROWS, plotsFor, type PlotCellStatus } from '@/domain/plots';

const codes = zones.map((zone) => zone.code);

function shares(cells: { status: PlotCellStatus }[]): Record<PlotCellStatus, number> {
  const count: Record<PlotCellStatus, number> = { available: 0, allocated: 0, reserved: 0 };
  for (const cell of cells) count[cell.status]++;
  return { available: count.available / cells.length, allocated: count.allocated / cells.length, reserved: count.reserved / cells.length };
}

describe('the illustrative plot layout', () => {
  it('is a grid of 8 columns by 5 rows, numbered row by row from 101', () => {
    const cells = plotsFor('BA');
    expect(cells).toHaveLength(PLOT_COLS * PLOT_ROWS);
    expect(cells).toHaveLength(40);
    cells.forEach((cell, index) => {
      expect(cell.zoneCode).toBe('BA');
      expect(cell.row).toBe(Math.floor(index / PLOT_COLS));
      expect(cell.col).toBe(index % PLOT_COLS);
      expect(cell.number).toBe(101 + index);
      expect(cell.id).toBe(`BA-${101 + index}`);
    });
    expect(new Set(cells.map((cell) => cell.id)).size).toBe(40);
  });

  it('is deterministic: the same zone always gives the same plots', () => {
    expect(plotsFor('BA')).toEqual(plotsFor('BA'));
    // Pinned values: they change only if the generator changes, which would move every investor's plot.
    expect(plotsFor('BA')[16]).toEqual({ id: 'BA-117', zoneCode: 'BA', number: 117, row: 2, col: 0, status: 'available', areaSqm: 5000 });
    // v = available, l = allocated, r = reserved
    const letters = plotsFor('BA')
      .map((cell) => (cell.status === 'available' ? 'v' : cell.status === 'allocated' ? 'l' : 'r'))
      .join('');
    expect(letters).toBe('lvvvvvvlvvlvvlvvvlvllvvvvvvrvrrvvlvlvlvl');
    expect(plotsFor('KH').slice(0, 3).map((cell) => `${cell.id} ${cell.status} ${cell.areaSqm}`)).toEqual(['KH-101 available 3000', 'KH-102 reserved 3000', 'KH-103 allocated 3000']);
  });

  it('gives every zone its own layout', () => {
    const signatures = codes.map((code) => plotsFor(code).map((cell) => `${cell.status}:${cell.areaSqm}`).join('|'));
    expect(new Set(signatures).size).toBe(codes.length);
  });

  it('has about 60% available, 28% allocated and 12% reserved plots', () => {
    const all = codes.flatMap((code) => plotsFor(code));
    const overall = shares(all);
    expect(overall.available).toBeGreaterThan(0.52);
    expect(overall.available).toBeLessThan(0.68);
    expect(overall.allocated).toBeGreaterThan(0.2);
    expect(overall.allocated).toBeLessThan(0.36);
    expect(overall.reserved).toBeGreaterThan(0.06);
    expect(overall.reserved).toBeLessThan(0.18);
    // Every zone can be demonstrated: there is always something to choose and something taken.
    for (const code of codes) {
      const zone = shares(plotsFor(code));
      expect(zone.available, code).toBeGreaterThanOrEqual(0.4);
      expect(zone.allocated + zone.reserved, code).toBeGreaterThanOrEqual(0.15);
    }
  });

  it('uses realistic plot areas', () => {
    for (const code of codes) {
      for (const cell of plotsFor(code)) {
        expect(cell.areaSqm).toBeGreaterThanOrEqual(1500);
        expect(cell.areaSqm).toBeLessThanOrEqual(10000);
        expect(cell.areaSqm % 500).toBe(0);
      }
    }
  });

  it('finds a plot by id within its zone', () => {
    expect(findPlot('BA', 'BA-117')?.number).toBe(117);
    expect(findPlot('BA', 'BA-140')?.row).toBe(4);
    expect(findPlot('BA', 'BA-141')).toBeUndefined();
    expect(findPlot('BA', 'AW-117')).toBeUndefined();
    expect(findPlot('AW', 'AW-117')?.zoneCode).toBe('AW');
  });
});
