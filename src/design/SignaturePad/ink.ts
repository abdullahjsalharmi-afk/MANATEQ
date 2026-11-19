/**
 * Drawing a signature on a canvas: strokes are kept as points, so the pad can be redrawn when it is
 * resized or when the theme (and with it the ink colour) changes.
 */

export interface InkPoint {
  x: number;
  y: number;
  /** Line width at this point, in CSS px. */
  w: number;
}

export type InkStroke = InkPoint[];

export const INK_MIN_WIDTH = 1.3;
export const INK_MAX_WIDTH = 3.1;

/** A fast hand leaves a thinner line, like a pen. `speed` is in px per millisecond. */
export function inkWidth(previous: number, speed: number): number {
  const target = Math.max(INK_MIN_WIDTH, Math.min(INK_MAX_WIDTH, INK_MAX_WIDTH - speed * 1.15));
  return previous * 0.72 + target * 0.28;
}

function dot(ctx: CanvasRenderingContext2D, point: InkPoint): void {
  ctx.beginPath();
  ctx.arc(point.x, point.y, Math.max(point.w, 1.6) / 1.4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Draws the piece of a stroke that ends at point `index`: a curve between the midpoints on either
 * side of the previous point, which makes one smooth line out of the straight steps of a pointer.
 */
export function drawSegment(ctx: CanvasRenderingContext2D, stroke: InkStroke, index: number): void {
  const p2 = stroke[index];
  const p1 = stroke[index - 1];
  if (!p1 || !p2) return;
  const p0 = stroke[index - 2] ?? p1;
  ctx.beginPath();
  ctx.lineWidth = (p1.w + p2.w) / 2;
  ctx.moveTo((p0.x + p1.x) / 2, (p0.y + p1.y) / 2);
  ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
  ctx.stroke();
}

/** Finishes a stroke: the last half step up to where the pointer was lifted. */
export function drawTail(ctx: CanvasRenderingContext2D, stroke: InkStroke): void {
  const last = stroke[stroke.length - 1];
  const before = stroke[stroke.length - 2];
  if (!last) return;
  if (!before) {
    dot(ctx, last);
    return;
  }
  ctx.beginPath();
  ctx.lineWidth = last.w;
  ctx.moveTo((before.x + last.x) / 2, (before.y + last.y) / 2);
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

export function drawStroke(ctx: CanvasRenderingContext2D, stroke: InkStroke): void {
  for (let index = 1; index < stroke.length; index++) drawSegment(ctx, stroke, index);
  drawTail(ctx, stroke);
}
