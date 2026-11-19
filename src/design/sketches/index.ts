/**
 * The app's line sketches: hand-drawn, single-line illustrations — the only ornament in the product.
 * The drawings live in scripts/build-sketches.mjs; `generated.ts` is its output. Render them with `<Sketch>`.
 */
import { SKETCHES } from './generated';

export { SKETCHES, SKETCH_INK } from './generated';
export type { SketchData, SketchStroke } from './types';

/** The name of a sketch, e.g. `'plot'`. */
export type SketchName = keyof typeof SKETCHES;

/** Every sketch name, in catalogue order. */
export const SKETCH_NAMES = Object.keys(SKETCHES) as SketchName[];
