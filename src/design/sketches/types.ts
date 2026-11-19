/** One pen stroke of a sketch. */
export interface SketchStroke {
  /** SVG path data, in the sketch's own viewBox. */
  readonly d: string;
  /** Drawn in the accent colour instead of ink. A sketch has one accent detail. */
  readonly accent?: boolean;
  /** Stroke weight in viewBox units, when it differs from the pen's usual weight. */
  readonly w?: number;
}

/** A line sketch: its viewBox and its strokes in the order they are drawn. */
export interface SketchData {
  readonly viewBox: readonly [number, number, number, number];
  readonly strokes: readonly SketchStroke[];
}
