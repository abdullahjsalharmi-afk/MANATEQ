import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Sketch } from '@/design/Sketch/Sketch';
import { SKETCHES, SKETCH_INK, SKETCH_NAMES, type SketchData } from '@/design/sketches';

const NAMES = ['journey', 'plot', 'warehouse', 'factory', 'crane', 'gate', 'contract', 'wallet', 'tools', 'allclear', 'search', 'inbox', 'invoice', 'handover', 'map', 'shield'];
const GENERATED = 'src/design/sketches/generated.ts';

/** Every number in a piece of path data. */
const numbers = (d: string): number[] => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe('sketches', () => {
  const all: Record<string, SketchData> = SKETCHES;

  it('has exactly the sixteen drawings of the set', () => {
    expect([...SKETCH_NAMES].sort()).toEqual([...NAMES].sort());
  });

  it.each(NAMES)('%s has a viewBox and enough strokes to be a drawing', (name) => {
    const { viewBox, strokes } = all[name]!;
    expect(viewBox).toHaveLength(4);
    expect(viewBox[0]).toBe(0);
    expect(viewBox[1]).toBe(0);
    expect(viewBox[2]).toBeGreaterThan(0);
    expect(viewBox[3]).toBeGreaterThan(0);
    expect(strokes.length).toBeGreaterThanOrEqual(5);
    expect(strokes.length).toBeLessThanOrEqual(48);
  });

  it.each(NAMES)('%s has well-formed path data that stays inside its viewBox', (name) => {
    const { viewBox, strokes } = all[name]!;
    for (const stroke of strokes) {
      expect(stroke.d.startsWith('M')).toBe(true);
      // Only move, line and curve commands, with numbers rounded to one decimal.
      expect(stroke.d).toMatch(/^(?:[MLC]-?\d+(?:\.\d)?(?: -?\d+(?:\.\d)?)*)+$/);
      const values = numbers(stroke.d);
      expect(values.length % 2).toBe(0);
      values.forEach((value, index) => {
        const limit = index % 2 === 0 ? viewBox[2] : viewBox[3];
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(limit);
      });
      if (stroke.w !== undefined) expect(stroke.w).toBeGreaterThan(0);
    }
  });

  it.each(NAMES)('%s has one accent detail, drawn after the ink', (name) => {
    const { strokes } = all[name]!;
    const accents = strokes.filter((stroke) => stroke.accent);
    expect(accents.length).toBeGreaterThanOrEqual(1);
    // The accent is a detail, never the drawing: fewer accent strokes than ink strokes.
    expect(accents.length).toBeLessThan(strokes.length / 2);
    expect(strokes[strokes.length - 1]!.accent).toBe(true);
  });

  it('keeps the generated file small', () => {
    expect(statSync(GENERATED).size).toBeLessThanOrEqual(220 * 1024);
  });

  it('is in step with scripts/build-sketches.mjs', () => {
    // Throws (non-zero exit) when the drawings were edited without rebuilding the generated file.
    const output = execFileSync(process.execPath, ['scripts/build-sketches.mjs', '--check'], { encoding: 'utf8' });
    expect(output).toContain('up to date');
  });
});

describe('<Sketch>', () => {
  const render = (props: Parameters<typeof Sketch>[0]): string => renderToStaticMarkup(createElement(Sketch, props));

  it('is decorative unless it is given a label', () => {
    const plain = render({ name: 'plot' });
    expect(plain).toContain('aria-hidden="true"');
    expect(plain).not.toContain('role="img"');

    const named = render({ name: 'plot', label: 'A surveyed plot' });
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="A surveyed plot"');
    expect(named).not.toContain('aria-hidden');
  });

  it('draws every stroke with the ink colour of its surroundings', () => {
    const html = render({ name: 'contract', animate: false });
    expect(html.match(/<path /g)).toHaveLength(SKETCHES.contract.strokes.length);
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('viewBox="0 0 240 160"');
    expect(html).toContain('pathLength="1"');
  });

  it('caps its width at the given size and keeps the line a steady weight', () => {
    const weight = (html: string): number => Number(/stroke-width="([\d.]+)"/.exec(html)?.[1]);
    const natural = render({ name: 'plot' });
    const small = render({ name: 'plot', size: 120 });
    const wide = render({ name: 'plot', size: 'fill' });
    expect(natural).toContain('--sketch-max:240px');
    expect(small).toContain('--sketch-max:120px');
    expect(wide).toContain('--sketch-max:none');
    // In viewBox units the small drawing needs a heavier line and the large one a lighter line…
    expect(weight(natural)).toBe(SKETCH_INK);
    expect(weight(small)).toBeGreaterThan(SKETCH_INK);
    expect(weight(wide)).toBeLessThan(SKETCH_INK);
    // …so that on screen the line stays between about 1.2 and 1.9 px.
    expect(weight(small) * (120 / 240)).toBeGreaterThan(1.2);
    expect(weight(wide) * (350 / 240)).toBeLessThan(1.9);
  });
});
