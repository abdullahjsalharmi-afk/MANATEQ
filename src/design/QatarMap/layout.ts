/**
 * Geometry of the schematic map — pure functions, in pixels of the map box.
 *
 * Several zones sit within a few kilometres of each other, which is a few pixels on a phone. The map is
 * schematic, so crowded markers are moved apart just enough to be told apart and tapped; markers with
 * room around them stay exactly where they are. The result depends only on the input.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Anchor extends Point {
  id: string;
}

export interface Placed extends Point {
  id: string;
  /** Where the place really is, before it was moved. */
  ax: number;
  ay: number;
  /** Distance to the nearest other marker: the room this marker has for its touch target. */
  room: number;
}

const ROUNDS = 320;
/** After this round the pull back towards the true position stops and markers only separate. */
const SETTLE_FROM = 200;
/** Share of an overlap resolved per round. Small steps keep neighbours in their real order. */
const STEP = 0.5;
/** Pull back towards the true position, per round. */
const SPRING = 0.1;
const GOLDEN_ANGLE = 2.39996323;
const EPSILON = 0.01;

/**
 * Moves markers apart until no two are closer than `gap`, moving each as little as possible.
 * Deterministic: markers are processed in id order and every round moves all of them at once.
 */
export function spreadMarkers(anchors: Anchor[], gap: number): Placed[] {
  const sorted = [...anchors].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  // A hair of offset in a fixed pattern, so that markers at the very same spot have a direction to part in.
  const points = sorted.map((anchor, i) => ({
    id: anchor.id,
    ax: anchor.x,
    ay: anchor.y,
    x: anchor.x + Math.cos(i * GOLDEN_ANGLE) * EPSILON * (i + 1),
    y: anchor.y + Math.sin(i * GOLDEN_ANGLE) * EPSILON * (i + 1),
  }));
  const count = points.length;
  const moveX = new Array<number>(count);
  const moveY = new Array<number>(count);

  for (let round = 0; round < ROUNDS; round++) {
    moveX.fill(0);
    moveY.fill(0);
    let touching = false;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const a = points[i] as (typeof points)[number];
        const b = points[j] as (typeof points)[number];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= gap - EPSILON || distance === 0) continue;
        const push = ((gap - distance) / 2) * STEP;
        const ux = dx / distance;
        const uy = dy / distance;
        moveX[i] = (moveX[i] as number) - ux * push;
        moveY[i] = (moveY[i] as number) - uy * push;
        moveX[j] = (moveX[j] as number) + ux * push;
        moveY[j] = (moveY[j] as number) + uy * push;
        touching = true;
      }
    }
    for (let i = 0; i < count; i++) {
      const point = points[i] as (typeof points)[number];
      point.x += moveX[i] as number;
      point.y += moveY[i] as number;
      if (round < SETTLE_FROM) {
        point.x += (point.ax - point.x) * SPRING;
        point.y += (point.ay - point.y) * SPRING;
      }
    }
    if (round >= SETTLE_FROM && !touching) break;
  }

  const byId = new Map<string, Placed>();
  for (const point of points) {
    let room = Infinity;
    for (const other of points) {
      if (other !== point) room = Math.min(room, Math.hypot(other.x - point.x, other.y - point.y));
    }
    byId.set(point.id, { id: point.id, x: point.x, y: point.y, ax: point.ax, ay: point.ay, room });
  }
  return anchors.map((anchor) => byId.get(anchor.id) as Placed);
}

/** The marker closest to a point, if one is within `reach`. Makes a tap near a marker count. */
export function nearestMarker<T extends Point>(markers: T[], to: Point, reach: number): T | undefined {
  let best: T | undefined;
  let bestDistance = reach;
  for (const marker of markers) {
    const distance = Math.hypot(marker.x - to.x, marker.y - to.y);
    if (distance <= bestDistance) {
      best = marker;
      bestDistance = distance;
    }
  }
  return best;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

const VECTOR: Record<Direction, Point> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

/**
 * The marker an arrow key moves to: the nearest one in that direction, preferring markers that lie
 * along the arrow over markers far off to the side. Undefined when there is nothing that way.
 */
export function neighbourMarker<T extends Point & { id: string }>(markers: T[], fromId: string, direction: Direction): T | undefined {
  const from = markers.find((marker) => marker.id === fromId);
  if (!from) return undefined;
  const v = VECTOR[direction];
  let best: T | undefined;
  let bestCost = Infinity;
  for (const marker of markers) {
    if (marker.id === fromId) continue;
    const dx = marker.x - from.x;
    const dy = marker.y - from.y;
    const along = dx * v.x + dy * v.y;
    if (along <= 0.5) continue;
    const across = Math.abs(dx * v.y - dy * v.x);
    const cost = along + across * 2;
    if (cost < bestCost) {
      best = marker;
      bestCost = cost;
    }
  }
  return best;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface LabelPlace {
  /** Top-left corner of the label. */
  left: number;
  top: number;
  side: 'above' | 'below' | 'left' | 'right';
  /** Where the stem from the marker meets the label. */
  stem: Point;
}

function clamp(value: number, min: number, max: number): number {
  return max < min ? min : Math.max(min, Math.min(max, value));
}

/** Distance from a point to the nearest point of a rectangle (0 inside it). */
function distanceToBox(point: Point, left: number, top: number, size: Size): number {
  const nearX = clamp(point.x, left, left + size.width);
  const nearY = clamp(point.y, top, top + size.height);
  return Math.hypot(point.x - nearX, point.y - nearY);
}

/** Distance from a point to the segment a–b. */
function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / length, 0, 1);
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

/** How much further than the nearest spot the label may sit. */
const LABEL_LIFTS = [0, 8, 16, 24];
/** How far the label may slide along its side, as a share of its length on that side. */
const LABEL_SLIDES = [0, -0.25, 0.25, -0.45, 0.45];
/** The stem meets the label at least this far from its corners. */
const STEM_INSET = 10;

/**
 * Where the name of the selected marker goes. The label tries the spot right above the marker first,
 * then further away, slid to one side, below, or beside the marker — and takes the spot that covers
 * the fewest other markers, with a stem that crosses none. It always stays inside the bounds and
 * never sits on its own marker.
 */
export function placeLabel(marker: Point, size: Size, others: Point[], bounds: Bounds, offset: number, clearance: number): LabelPlace {
  let best: LabelPlace | undefined;
  let bestCost = Infinity;
  const sides = [
    { side: 'above', preference: 0 },
    { side: 'below', preference: 0.05 },
    { side: 'left', preference: 0.1 },
    { side: 'right', preference: 0.1 },
  ] as const;

  for (const { side, preference } of sides) {
    const upright = side === 'above' || side === 'below';
    for (const lift of LABEL_LIFTS) {
      for (const slide of LABEL_SLIDES) {
        let left: number;
        let top: number;
        if (upright) {
          left = marker.x - size.width / 2 + slide * size.width;
          top = side === 'above' ? marker.y - offset - lift - size.height : marker.y + offset + lift;
        } else {
          left = side === 'left' ? marker.x - offset - lift - size.width : marker.x + offset + lift;
          top = marker.y - size.height / 2 + slide * size.height;
        }
        left = clamp(left, bounds.minX, bounds.maxX - size.width);

        const stem: Point = upright
          ? { x: clamp(marker.x, left + STEM_INSET, left + size.width - STEM_INSET), y: side === 'above' ? top + size.height - 2 : top + 2 }
          : { x: side === 'left' ? left + size.width - 2 : left + 2, y: clamp(marker.y, top + STEM_INSET / 2, top + size.height - STEM_INSET / 2) };

        // Small preferences: above, close, centred. Covering a marker or leaving the map costs far more.
        let cost = preference + lift * 0.01 + Math.abs(slide) * 0.2;
        if (top < bounds.minY) cost += 100 + (bounds.minY - top);
        if (top + size.height > bounds.maxY) cost += 100 + (top + size.height - bounds.maxY);
        if (distanceToBox(marker, left, top, size) < offset - 1) cost += 50;
        for (const other of others) {
          if (distanceToBox(other, left, top, size) < clearance) cost += 1;
          else if (distanceToSegment(other, marker, stem) < clearance - 2) cost += 0.6;
        }
        if (cost < bestCost) {
          best = { left, top, side, stem };
          bestCost = cost;
        }
      }
    }
  }
  return best as LabelPlace;
}
