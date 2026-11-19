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
  side: 'above' | 'below';
}

function clamp(value: number, min: number, max: number): number {
  return max < min ? min : Math.max(min, Math.min(max, value));
}

/** How much further than the nearest spot the label may sit, and how far it may slide sideways (share of its width). */
const LABEL_LIFTS = [0, 6, 12, 18];
const LABEL_SLIDES = [0, -0.25, 0.25, -0.45, 0.45];

/**
 * Where the name of the selected marker goes. The label tries the spot right above the marker first,
 * then a little further, to one side, or below — and takes the first spot that covers none of the other
 * markers (or the spot that covers the fewest). It always stays inside the bounds.
 */
export function placeLabel(marker: Point, size: Size, others: Point[], bounds: Bounds, offset: number, markerRadius: number): LabelPlace {
  let best: LabelPlace | undefined;
  let bestCost = Infinity;
  for (const side of ['above', 'below'] as const) {
    for (const lift of LABEL_LIFTS) {
      for (const slide of LABEL_SLIDES) {
        const left = clamp(marker.x - size.width / 2 + slide * size.width, bounds.minX, bounds.maxX - size.width);
        const top = side === 'above' ? marker.y - offset - lift - size.height : marker.y + offset + lift;
        // Small preferences: above, close, centred. Covering a marker or leaving the map costs far more.
        let cost = (side === 'above' ? 0 : 0.05) + lift * 0.01 + Math.abs(slide) * 0.2;
        if (top < bounds.minY) cost += 100 + (bounds.minY - top);
        if (top + size.height > bounds.maxY) cost += 100 + (top + size.height - bounds.maxY);
        for (const other of others) {
          const nearX = clamp(other.x, left, left + size.width);
          const nearY = clamp(other.y, top, top + size.height);
          if (Math.hypot(other.x - nearX, other.y - nearY) < markerRadius) cost += 1;
        }
        if (cost < bestCost) {
          best = { left, top, side };
          bestCost = cost;
        }
      }
    }
  }
  return best as LabelPlace;
}
