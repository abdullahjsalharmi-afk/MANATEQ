// Draws the app's line sketches and writes them to src/design/sketches/generated.ts.
//
//   node scripts/build-sketches.mjs            write the file
//   node scripts/build-sketches.mjs --check    exit 1 when the file on disk is out of date
//
// Every sketch is a short list of pen strokes in its own viewBox, drawn the way an architect sketches on
// tracing paper: one weight of line, corners that cross a little, plenty of white space and one accent
// detail. rough.js (generator API, no DOM) gives each stroke a slightly unsteady hand. Seeds are fixed
// per stroke, so the output only changes when a drawing is edited here.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import rough from 'roughjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = path.join(ROOT, 'src/design/sketches/generated.ts');
const QATAR_FILE = path.join(ROOT, 'src/data/generated/qatar.json');

/** The pen's weight in viewBox units. A stroke only records its weight when it differs. */
const INK = 1.6;
/** How far structural lines run past a corner, on average. */
const CROSS = 1.8;
/** The steadiness of the hand: enough wobble to feel drawn, never enough to look careless. */
const HAND = { roughness: 0.8, bowing: 1, maxRandomnessOffset: 1.5, disableMultiStroke: true };

const gen = rough.generator();

// ---------------------------------------------------------------------------------------------------
// Small maths
// ---------------------------------------------------------------------------------------------------

const RAD = Math.PI / 180;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/** One decimal is plenty at these sizes and keeps the file small. */
function fmt(n) {
  const r = Math.round(n * 10) / 10;
  return Object.is(r, -0) ? '0' : String(r);
}

/** A stable seed from a label (FNV-1a), never zero. */
function seedOf(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 2147483646) + 1;
}

/** A small seeded random source for the choices rough.js does not make (overshoot, where a circle starts). */
function randomFrom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Points along an arc. Angles in degrees, measured clockwise on screen from the positive x axis. */
function arcPoints([cx, cy], r, from, to, steps) {
  const [rx, ry] = Array.isArray(r) ? r : [r, r];
  const n = steps ?? Math.max(2, Math.ceil((Math.abs(to - from) * RAD * Math.max(rx, ry)) / 9));
  const points = [];
  for (let i = 0; i <= n; i++) {
    const a = (from + ((to - from) * i) / n) * RAD;
    points.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return points;
}

/** A point on a cubic Bézier. */
function cubicAt([p0, p1, p2, p3], t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

/** Affine matrices as [a, b, c, d, e, f]: x' = ax + cy + e, y' = bx + dy + f. */
const IDENTITY = [1, 0, 0, 1, 0, 0];
function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/** Ramer–Douglas–Peucker: drops points that do not change the shape by more than `tolerance`. */
function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const [ax, ay] = points[0];
  const [bx, by] = points[points.length - 1];
  const length = Math.hypot(bx - ax, by - ay) || 1;
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i];
    const distance = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
    if (distance > worst) {
      worst = distance;
      index = i;
    }
  }
  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  return [...simplify(points.slice(0, index + 1), tolerance).slice(0, -1), ...simplify(points.slice(index), tolerance)];
}

/** The same for a closed outline: split it at the point farthest from the start, simplify both halves, close it again. */
function simplifyRing(ring, tolerance) {
  let far = 0;
  let farthest = 0;
  ring.forEach(([x, y], i) => {
    const distance = Math.hypot(x - ring[0][0], y - ring[0][1]);
    if (distance > farthest) {
      farthest = distance;
      far = i;
    }
  });
  const there = simplify(ring.slice(0, far + 1), tolerance);
  const back = simplify([...ring.slice(far), ring[0]], tolerance);
  return [...there.slice(0, -1), ...back];
}

// ---------------------------------------------------------------------------------------------------
// The pen
// ---------------------------------------------------------------------------------------------------

/** rough.js operations → compact path data. `join` keeps the pen down where one segment ends exactly where the next begins. */
function pathData(drawable, { join = false } = {}) {
  let d = '';
  let at = null;
  for (const set of drawable.sets) {
    for (const { op, data } of set.ops) {
      if (op === 'move') {
        if (join && at && Math.hypot(data[0] - at[0], data[1] - at[1]) < 0.05) continue;
        d += `M${fmt(data[0])} ${fmt(data[1])}`;
        at = data;
      } else if (op === 'bcurveTo') {
        d += `C${data.map(fmt).join(' ')}`;
        at = data.slice(4);
      } else {
        d += `L${fmt(data[0])} ${fmt(data[1])}`;
        at = data;
      }
    }
  }
  return d;
}

/**
 * A pen for one sketch. Every method adds strokes in the order they should be drawn.
 * Shared stroke options: `accent` (the one accent colour), `w` (weight, when not INK), `rough`, `bow`,
 * `salt` (re-rolls the hand for this stroke without touching the others).
 */
function createPen(name) {
  const strokes = [];
  let part = '';
  let count = 0;
  let matrix = IDENTITY;
  let bucket = null;

  const nextSeed = (salt = 0) => seedOf(`${name}/${part}/${count++}/${salt}`);
  const place = ([x, y]) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
  const hand = (seed, o, extra = {}) => ({
    ...HAND,
    seed,
    ...(o.rough !== undefined ? { roughness: o.rough } : {}),
    ...(o.bow !== undefined ? { bowing: o.bow } : {}),
    ...extra,
  });

  function emit(d, o) {
    if (bucket) {
      bucket.push(d);
      return;
    }
    const stroke = { d };
    if (o.accent) stroke.accent = true;
    if (o.w !== undefined && o.w !== INK) stroke.w = o.w;
    strokes.push(stroke);
  }

  const pen = {
    strokes,

    /** Names the part being drawn. Seeds restart per part, so editing one part leaves the others as they were. */
    part(label) {
      part = label;
      count = 0;
    },

    /** One straight stroke. `over` runs it past its ends so that it crosses what it meets: a number, or [start, end]. */
    line(a, b, o = {}) {
      const seed = nextSeed(o.salt);
      const random = randomFrom(seed);
      let [x1, y1] = place(a);
      let [x2, y2] = place(b);
      const length = Math.hypot(x2 - x1, y2 - y1) || 1;
      const ux = (x2 - x1) / length;
      const uy = (y2 - y1) / length;
      const [startOver, endOver] = Array.isArray(o.over) ? o.over : [o.over ?? 0, o.over ?? 0];
      const reach = (amount) => amount * (0.6 + 0.8 * random());
      const drift = () => (random() - 0.5) * Math.min(0.7, length / 30);
      const s = reach(startOver);
      const e = reach(endOver);
      const ds = drift();
      const de = drift();
      x1 += -ux * s - uy * ds;
      y1 += -uy * s + ux * ds;
      x2 += ux * e - uy * de;
      y2 += uy * e + ux * de;
      emit(pathData(gen.line(x1, y1, x2, y2, hand(seed, o, { preserveVertices: true }))), o);
    },

    /** Separate strokes from point to point, crossing a little at every corner. */
    lines(points, o = {}) {
      const all = o.close ? [...points, points[0]] : points;
      for (let i = 0; i < all.length - 1; i++) pen.line(all[i], all[i + 1], { ...o, over: o.over ?? CROSS });
    },

    /** A rectangle as four crossing strokes. */
    rect(x, y, width, height, o = {}) {
      pen.lines(
        [
          [x, y],
          [x + width, y],
          [x + width, y + height],
          [x, y + height],
        ],
        { ...o, close: true },
      );
    },

    /** One continuous stroke through the points: the pen turns at each corner without lifting. */
    poly(points, o = {}) {
      const seed = nextSeed(o.salt);
      const random = randomFrom(seed);
      const loose = o.loose ?? 0.5;
      const placed = points.map(place).map(([x, y]) => [x + (random() - 0.5) * loose, y + (random() - 0.5) * loose]);
      if (o.close) placed.push(placed[0]);
      emit(pathData(gen.linearPath(placed, hand(seed, o, { preserveVertices: true })), { join: true }), o);
    },

    /** One smooth stroke through the points. */
    curve(points, o = {}) {
      const seed = nextSeed(o.salt);
      emit(pathData(gen.curve(points.map(place), hand(seed, { rough: 0.45, ...o }))), o);
    },

    /** Part of a circle or an ellipse (`r` or [rx, ry]); angles in degrees, clockwise on screen from the x axis. */
    arc(centre, r, from, to, o = {}) {
      const [rx, ry] = Array.isArray(r) ? r : [r, r];
      const big = Math.max(rx, ry);
      const sweep = Math.abs(to - from);
      const steps = Math.max(2, Math.ceil(sweep / 40), Math.ceil((sweep * RAD * big) / (o.step ?? 15)));
      pen.curve(arcPoints(centre, [rx, ry], from, to, steps), { rough: clamp(big / 60, 0.08, 0.35), ...o });
    },

    /**
     * A full circle in one confident turn: slightly out of round, closed where it began.
     * `tail` (degrees) lets the pen run on past its start and drift inside, as a quick hand does.
     */
    circle(centre, r, o = {}) {
      const random = randomFrom(nextSeed(o.salt));
      const [cx, cy] = centre;
      const count = clamp(Math.round((2 * Math.PI * r) / 11), 8, 14);
      const start = (o.start ?? -100) + (random() - 0.5) * 40;
      const squash = 1 + (random() - 0.5) * 0.06;
      const wobble = Math.min(0.5, r * 0.035);
      const ring = [];
      for (let i = 0; i < count; i++) {
        const a = (start + (360 * i) / count) * RAD;
        const radius = r + (random() - 0.5) * 2 * wobble;
        ring.push(place([cx + radius * squash * Math.cos(a), cy + (radius / squash) * Math.sin(a)]));
      }
      // Closed Catmull–Rom spline: every joint, the closing one included, is smooth.
      const at = (i) => ring[((i % count) + count) % count];
      const segment = (i, from, to) => {
        const [p0, p1, p2, p3] = [at(i - 1), from ?? at(i), to ?? at(i + 1), at(i + 2)];
        return `C${[p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]].map(fmt).join(' ')}`;
      };
      let d = `M${fmt(ring[0][0])} ${fmt(ring[0][1])}`;
      for (let i = 0; i < count; i++) d += segment(i);
      if (o.tail) {
        const a = (start + o.tail) * RAD;
        const inside = r - Math.min(1.6, r * 0.09);
        const end = place([cx + inside * squash * Math.cos(a), cy + (inside / squash) * Math.sin(a)]);
        d += segment(0, undefined, end);
      }
      emit(d, o);
    },

    /** A dashed line: one hand-drawn line, lifted at even intervals. Counts as a single stroke. */
    dashed(a, b, o = {}) {
      const seed = nextSeed(o.salt);
      const random = randomFrom(seed);
      const p0 = place(a);
      const p3 = place(b);
      const ops = gen.line(p0[0], p0[1], p3[0], p3[1], hand(seed, o, { preserveVertices: true })).sets[0].ops;
      const bezier = [ops[0].data, ops[1].data.slice(0, 2), ops[1].data.slice(2, 4), ops[1].data.slice(4, 6)];
      // Arc-length table, so the dashes are even along the line.
      const SAMPLES = 48;
      const lengths = [0];
      let previous = bezier[0];
      for (let i = 1; i <= SAMPLES; i++) {
        const point = cubicAt(bezier, i / SAMPLES);
        lengths.push(lengths[i - 1] + Math.hypot(point[0] - previous[0], point[1] - previous[1]));
        previous = point;
      }
      const total = lengths[SAMPLES];
      const pointAt = (distance) => {
        const target = clamp(distance, 0, total);
        let i = 1;
        while (i < SAMPLES && lengths[i] < target) i++;
        const span = lengths[i] - lengths[i - 1] || 1;
        return cubicAt(bezier, (i - 1 + (target - lengths[i - 1]) / span) / SAMPLES);
      };
      const gap = o.gap ?? 5.5;
      const dashes = Math.max(1, Math.round((total + gap) / ((o.dash ?? 8) + gap)));
      const dash = (total - (dashes - 1) * gap) / dashes;
      let d = '';
      for (let i = 0; i < dashes; i++) {
        const from = i * (dash + gap) + (i === 0 ? 0 : (random() - 0.5) * 1.2);
        const to = i * (dash + gap) + dash + (i === dashes - 1 ? 0 : (random() - 0.5) * 1.2);
        const [x1, y1] = pointAt(from);
        const [x2, y2] = pointAt(to);
        d += `M${fmt(x1)} ${fmt(y1)}L${fmt(x2)} ${fmt(y2)}`;
      }
      emit(d, o);
    },

    /** Everything drawn inside `draw` becomes one stroke (for small marks that belong together). */
    merge(o, draw) {
      const outer = bucket;
      bucket = [];
      draw();
      const d = bucket.join('');
      bucket = outer;
      emit(d, o);
    },

    /** Draws inside a moved, turned or scaled frame: { move: [dx, dy], rotate: degrees, scale, about: [x, y] }. */
    at({ move = [0, 0], rotate = 0, scale = 1, about = [0, 0] }, draw) {
      const outer = matrix;
      const cos = Math.cos(rotate * RAD) * scale;
      const sin = Math.sin(rotate * RAD) * scale;
      const turn = [cos, sin, -sin, cos, about[0] - cos * about[0] + sin * about[1], about[1] - sin * about[0] - cos * about[1]];
      matrix = multiply(multiply(outer, [1, 0, 0, 1, move[0], move[1]]), turn);
      draw();
      matrix = outer;
    },
  };
  return pen;
}

// ---------------------------------------------------------------------------------------------------
// Motifs shared by several sketches
// ---------------------------------------------------------------------------------------------------

/** A ground line that trails off, the way a pencil line is left unfinished. */
function ground(p, y, x1, x2) {
  p.part('ground');
  p.line([x1, y], [x2 - 24, y]);
  p.line([x2 - 18, y], [x2 - 8, y]);
  p.line([x2 - 3.5, y], [x2, y]);
}

/** A surveyed plot seen from above and to one side: a dashed boundary between four corner pegs. */
function plotOutline(p, [a, b, c, d], { pegs = [13, 11, 0, 11], dash = 8.5, gap = 5.5 } = {}) {
  p.dashed(a, b, { dash, gap });
  p.dashed(b, c, { dash, gap });
  p.dashed(c, d, { dash, gap });
  p.dashed(d, a, { dash, gap });
  [a, b, c, d].forEach(([x, y], i) => {
    if (pegs[i]) p.line([x, y + 2], [x, y - pegs[i]]);
  });
}

/** An open-end spanner along the x axis, ring end at the origin: one continuous outline and the ring's hole. */
function spanner(p, length, o = {}) {
  const head = [length, 0];
  const outline = [
    ...arcPoints(head, 13, -157.4, -22.6, 9), // over the top of the head to the upper jaw
    [length - 2, -5],
    ...arcPoints([length - 2, 0], 5, -90, -270, 6).slice(1, -1), // the bottom of the slot
    [length - 2, 5],
    ...arcPoints(head, 13, 22.6, 157.4, 9), // under the head, back to the handle
    ...arcPoints([0, 0], 10, 24.8, 335.2, 16), // round the ring
  ];
  p.poly(outline, { ...o, close: true, loose: 0.3, rough: 0.5 });
  p.circle([0, 0], 4.6, o);
}

/** A map pin whose tip touches `tip`. */
function pin(p, [x, y], r, o = {}) {
  const centre = [x, y - r * 2.35];
  p.poly([[x, y], ...arcPoints(centre, r, 128, 412, 12), [x, y]], { ...o, loose: 0.2, rough: 0.4 });
  p.circle(centre, r * 0.36, o);
}

// ---------------------------------------------------------------------------------------------------
// The sketches
// ---------------------------------------------------------------------------------------------------

const DRAWINGS = [];
function sketch(name, width, height, draw) {
  DRAWINGS.push({ name, width, height, draw });
}

// The whole journey on one ground line: a surveyed plot → a building going up → a working warehouse → the gate.
sketch('journey', 360, 140, (p) => {
  const G = 100;
  p.part('ground');
  p.line([12, G], [348, G]);

  p.part('plot');
  const dash = { dash: 5, gap: 3.6 };
  p.dashed([22, G], [38, 84], dash);
  p.dashed([38, 84], [92, 84], dash);
  p.dashed([92, 84], [76, G], dash);
  p.line([22, G + 1.5], [22, 91]);
  p.line([76, G + 1.5], [76, 91]);
  p.line([38, 85.5], [38, 77]);
  p.line([92, 85.5], [92, 58]);
  p.poly([
    [92, 59],
    [105.5, 63.5],
    [92, 68.5],
  ]);

  p.part('frame');
  p.line([126, G], [126, 66], { over: [0, 1.6] });
  p.line([144, G], [144, 66], { over: [0, 1.6] });
  p.line([162, G], [162, 78]);
  p.line([126, 83], [162, 83], { over: 1.4 });
  p.line([126, 66], [144, 66], { over: 1.4 });

  p.part('crane');
  p.line([107.5, G], [107.5, 29]);
  p.line([113, G], [113, 29]);
  p.poly(
    [
      [107.5, 98],
      [113, 88],
      [107.5, 78],
      [113, 68],
      [107.5, 58],
      [113, 48],
      [107.5, 38],
      [113, 29],
    ],
    { loose: 0.2 },
  );
  p.line([93, 28], [172, 28]);
  p.line([110.2, 28], [110.2, 15]);
  p.poly([
    [95, 28],
    [110.2, 15.5],
    [150, 28],
  ]);
  p.poly([
    [95, 28.5],
    [95, 36],
    [103, 36],
    [103, 28.5],
  ]);
  p.line([153, 28.5], [153, 43]);
  p.poly([
    [145, 50],
    [153, 43],
    [161, 50],
  ]);
  p.line([143.5, 50.5], [162.5, 50.5]);

  p.part('shed');
  p.poly([
    [192, G],
    [192, 76],
    [204, 67],
    [216, 76],
    [216, G],
  ]);
  p.poly([
    [204, 67],
    [254, 67],
    [266, 76],
    [266, G],
  ]);
  p.line([216, 76], [266, 76]);
  p.poly([
    [224, G],
    [224, 86],
    [236, 86],
    [236, G],
  ]);
  p.poly([
    [245, G],
    [245, 86],
    [257, 86],
    [257, G],
  ]);

  p.part('truck');
  p.poly(
    [
      [274, 96],
      [274, 84],
      [289.5, 84],
      [289.5, 96],
    ],
    { close: true },
  );
  p.poly([
    [289.5, 88],
    [294.5, 88],
    [298.5, 92],
    [298.5, 96],
    [289.5, 96],
  ]);
  p.circle([278.5, 97], 3);
  p.circle([294, 97], 3);

  p.part('gate');
  p.poly([
    [331, G],
    [331, 78],
    [345, 78],
    [345, G],
  ]);
  p.line([327.5, 77], [348.5, 77]);
  p.poly(
    [
      [334.5, 83],
      [341.5, 83],
      [341.5, 90],
      [334.5, 90],
    ],
    { close: true },
  );
  p.poly([
    [317, G],
    [317, 88],
    [321, 88],
    [321, G],
  ]);
  p.line([319, 89], [301, 61]);

  // The path between the stations: the only accent.
  p.part('path');
  const stations = [58, 136, 243, 330];
  const Y = 119;
  stations.forEach((x, i) => {
    p.circle([x, Y], 3.6, { accent: true });
    if (i < stations.length - 1) p.line([x + 7, Y], [stations[i + 1] - 7, Y], { accent: true });
  });
});

sketch('plot', 240, 160, (p) => {
  p.part('boundary');
  plotOutline(p, [
    [102, 128],
    [210, 98],
    [136, 68],
    [28, 98],
  ]);

  // A dimension line: the plot has been measured.
  p.part('measure');
  p.line([106, 140.5], [212, 111]);
  p.line([104.2, 137.4], [107.6, 143.8]);
  p.line([210.6, 107.8], [214, 114.2]);

  p.part('flag');
  p.line([136, 70], [136, 24]);
  p.poly(
    [
      [136, 26],
      [159, 33.5],
      [136, 41.5],
    ],
    { accent: true },
  );
});

sketch('warehouse', 240, 160, (p) => {
  const G = 116;
  const E = 72;
  const R = 56;
  ground(p, G, 14, 228);

  p.part('gable');
  p.line([30, G], [30, E], { over: [0, CROSS] });
  p.line([57, R], [25.5, E + 2.7], { over: [CROSS, 0] });
  p.line([57, R], [84, E], { over: CROSS });
  p.line([84, G], [84, E], { over: [0, CROSS] });

  p.part('side');
  p.line([57, R], [185, R], { over: CROSS });
  p.line([84, E], [216.5, E], { over: [CROSS, 0] });
  p.line([185, R], [212, E], { over: CROSS });
  p.line([212, G], [212, E], { over: [0, CROSS] });

  // The portal frames show through the cladding.
  p.part('frames');
  p.poly([
    [126.7, G],
    [126.7, E],
    [99.7, R],
  ]);
  p.poly([
    [169.3, G],
    [169.3, E],
    [142.3, R],
  ]);

  p.part('doors');
  const door = (x, o) => p.poly([[x, G], [x, 88], [x + 24, 88], [x + 24, G]], o);
  door(93.3);
  door(178.7);
  p.poly([
    [51, G],
    [51, 95],
    [63, 95],
    [63, G],
  ]);
  p.circle([57, 74], 3.4);

  p.part('bay');
  door(136, { accent: true });
  for (const y of [94.5, 101, 107.5]) p.line([139.5, y], [156.5, y], { accent: true });
});

sketch('factory', 240, 160, (p) => {
  const G = 130;
  ground(p, G, 14, 228);

  p.part('hall');
  p.line([28, G], [28, 71], { over: [0, CROSS] });
  p.poly([
    [28, 72],
    [65.5, 96],
    [65.5, 72],
    [103, 96],
    [103, 72],
    [140.5, 96],
    [140.5, 72],
    [178, 96],
  ]);
  p.line([178, G], [178, 96], { over: [0, CROSS] });

  p.part('openings');
  p.poly([
    [46, G],
    [46, 105],
    [76, 105],
    [76, G],
  ]);
  p.poly(
    [
      [96, 107],
      [162, 107],
      [162, 117.5],
      [96, 117.5],
    ],
    { close: true },
  );
  p.line([118, 108], [118, 116.5]);
  p.line([140, 108], [140, 116.5]);

  p.part('chimney');
  p.line([192, G], [195, 45]);
  p.line([208, G], [205, 45]);
  p.poly(
    [
      [193, 39.5],
      [207, 39.5],
      [207, 45],
      [193, 45],
    ],
    { close: true, loose: 0.3 },
  );

  p.part('plume');
  p.circle([190, 27], 7, { accent: true });
  p.circle([175, 18.5], 5.3, { accent: true });
  p.circle([163.5, 13.5], 3.7, { accent: true });
});

sketch('crane', 240, 160, (p) => {
  const G = 140;
  ground(p, G, 14, 228);

  p.part('frame');
  for (const x of [132, 158, 184, 210]) p.line([x, G], [x, 100], { over: [0, CROSS] });
  p.line([132, 120], [210, 120], { over: CROSS });
  p.line([132, 100], [184, 100], { over: CROSS });
  p.line([133.5, 138.5], [156.5, 121.5]);

  p.part('mast');
  p.line([69.5, G], [69.5, 49]);
  p.line([78.5, G], [78.5, 49]);
  p.poly(
    [
      [69.5, 138],
      [78.5, 125.5],
      [69.5, 113],
      [78.5, 100.5],
      [69.5, 88],
      [78.5, 75.5],
      [69.5, 63],
      [78.5, 50],
    ],
    { loose: 0.2 },
  );

  p.part('jib');
  p.line([34, 43], [216, 43]);
  p.poly([
    [66, 43.5],
    [66, 49],
    [82, 49],
    [82, 43.5],
  ]);
  p.line([74, 43], [74, 20], { over: [0, 1] });
  p.poly([
    [40, 43],
    [74, 21],
    [164, 43],
  ]);
  p.poly([
    [38, 43.5],
    [38, 56],
    [54, 56],
    [54, 43.5],
  ]);
  p.poly([
    [79, 51.5],
    [91, 51.5],
    [91, 61.5],
    [79, 61.5],
  ]);

  p.part('load');
  p.poly([
    [192, 43.5],
    [192, 47.5],
    [202, 47.5],
    [202, 43.5],
  ]);
  p.line([197, 47.5], [197, 68]);
  p.poly([
    [185, 82],
    [197, 68],
    [209, 82],
  ]);
  p.poly(
    [
      [182, 82],
      [212, 82],
      [212, 86.5],
      [182, 86.5],
    ],
    { accent: true, close: true },
  );
});

sketch('gate', 240, 160, (p) => {
  const G = 124;
  ground(p, G, 14, 228);

  p.part('booth');
  p.line([32, G], [32, 76], { over: [0, 1] });
  p.line([68, G], [68, 76], { over: [0, 1] });
  p.poly(
    [
      [25, 70],
      [77, 70],
      [77, 76],
      [25, 76],
    ],
    { close: true },
  );
  p.poly(
    [
      [39.5, 86],
      [60.5, 86],
      [60.5, 102],
      [39.5, 102],
    ],
    { close: true },
  );

  p.part('car');
  p.curve(
    [
      [144, 119],
      [134, 118],
      [132, 106],
      [147, 91],
      [161, 87.5],
      [176, 88.5],
      [190, 101],
      [208, 104],
      [215.5, 110],
      [214.5, 118],
      [206, 119],
    ],
    { rough: 0.3 },
  );
  p.poly(
    [
      [151, 93],
      [173.5, 92.5],
      [184, 101.5],
      [145, 102.5],
    ],
    { close: true },
  );
  p.line([161.5, 119], [188.5, 119]);
  p.circle([152.5, 116], 8);
  p.circle([197.5, 116], 8);

  p.part('barrier');
  p.poly([
    [88, G],
    [88, 100],
    [99, 100],
    [99, G],
  ]);
  p.at({ move: [93.5, 104], rotate: -50 }, () => {
    p.poly(
      [
        [-12, -2.3],
        [84, -2.3],
        [84, 2.3],
        [-12, 2.3],
      ],
      { accent: true, close: true, loose: 0.2 },
    );
    for (const x of [22, 40, 58]) p.line([x - 1.5, -2.3], [x + 1.5, 2.3], { accent: true });
  });
});

sketch('contract', 240, 160, (p) => {
  p.at({ move: [-4, 0] }, () => {
    // The sheet's right edge is left open where the pen lies across it.
    p.part('sheet');
    p.poly([
      [146, 86.5],
      [146, 34],
      [132, 20],
      [58, 20],
      [58, 138],
      [146, 138],
      [146, 106],
    ]);
    p.poly([
      [132, 20.5],
      [132, 34],
      [145.5, 34],
    ]);

    p.part('text');
    p.line([70, 38], [102, 38]);
    for (const [y, x] of [
      [52, 134],
      [62, 134],
      [72, 124],
      [82, 134],
      [92, 110],
    ]) {
      p.line([70, y], [x, y]);
    }

    p.part('signature');
    p.curve(
      [
        [101, 119],
        [105, 111],
        [108, 120],
        [112, 112],
        [115, 119],
        [120, 115],
        [127, 118],
      ],
      { rough: 0.3 },
    );
    p.line([98, 125], [136, 125]);

    p.part('pen');
    p.at({ move: [128.5, 118.5], rotate: -52 }, () => {
      p.poly([
        [12, -4.2],
        [0, 0],
        [12, 4.2],
      ]);
      p.line([12, -4.2], [12, 4.2]);
      p.line([12, -4.2], [92, -4.2]);
      p.line([12, 4.2], [92, 4.2]);
      p.line([92, -4.2], [92, 4.2], { over: 0.6 });
      p.line([74, -4.2], [74, 4.2]);
    });

    p.part('seal');
    p.circle([80, 113], 13, { accent: true });
    p.circle([80, 113], 8.2, { accent: true });
  });
});

sketch('wallet', 240, 160, (p) => {
  p.at({ rotate: -4, about: [118, 84] }, () => {
    const X = 66;
    const Y = 40;
    const W = 84;
    const H = 106;
    const S = 9.5;
    p.part('stack');
    p.poly(
      [
        [X, Y],
        [X + W, Y],
        [X + W, Y + H],
        [X, Y + H],
      ],
      { close: true },
    );
    for (const k of [1, 2]) {
      p.poly([
        [X + S * k, Y - S * (k - 1)],
        [X + S * k, Y - S * k],
        [X + W + S * k, Y - S * k],
        [X + W + S * k, Y + H - S * k],
        [X + W + S * (k - 1), Y + H - S * k],
      ]);
    }

    p.part('text');
    p.line([77, 55], [108, 55]);
    for (const [y, x] of [
      [68, 139],
      [78, 139],
      [88, 122],
    ]) {
      p.line([77, y], [x, y]);
    }
    p.line([77, 122], [100, 122]);
    p.line([77, 132], [94, 132]);

    // A code to check the document by: three corner squares and a few marks.
    p.part('code');
    const box = (x, y, s) =>
      p.poly(
        [
          [x, y],
          [x + s, y],
          [x + s, y + s],
          [x, y + s],
        ],
        { accent: true, close: true, loose: 0.2 },
      );
    box(112, 107, 9);
    box(130, 107, 9);
    box(112, 125, 9);
    p.merge({ accent: true }, () => {
      p.line([125, 109], [125, 113.5]);
      p.line([124, 119.5], [129, 119.5]);
      p.line([133, 120.5], [133, 125]);
      p.line([127, 127], [132.5, 127]);
      p.line([136, 130.5], [139, 130.5]);
      p.line([127.5, 133], [131, 133]);
    });
  });
});

sketch('tools', 240, 160, (p) => {
  const G = 132;
  ground(p, G, 14, 228);

  // The pole is left open where the spanner lies across it.
  p.part('light');
  p.line([92, G], [92, 100.5]);
  p.curve(
    [
      [92, 84],
      [92, 67],
      [92.3, 51],
      [95, 40.5],
      [102, 33.5],
      [112, 31],
      [123, 30.5],
    ],
    { rough: 0.15 },
  );
  p.poly(
    [
      [121, 27.5],
      [142, 28.5],
      [141, 34],
      [121, 33.5],
    ],
    { close: true, loose: 0.3 },
  );
  p.poly([
    [87.5, G],
    [87.5, 122],
    [96.5, 122],
    [96.5, G],
  ]);

  p.part('spanner');
  p.at({ move: [63, 115], rotate: -38 }, () => spanner(p, 68));

  p.part('cone');
  p.poly([
    [165, 128],
    [174.5, 92],
    [180.5, 92],
    [190, 128],
  ]);
  p.poly(
    [
      [158, 128],
      [197, 128],
      [197, G],
      [158, G],
    ],
    { close: true, loose: 0.3 },
  );
  p.line([171.5, 104], [183.5, 104]);
  p.line([168.5, 116], [186.5, 116]);

  p.part('glow');
  p.line([124, 40], [120, 50], { accent: true });
  p.line([131.5, 41], [131.5, 52], { accent: true });
  p.line([139, 40], [143, 50], { accent: true });
});

sketch('allclear', 240, 160, (p) => {
  const H = 100;
  const sun = [120, 94];
  p.part('horizon');
  p.line([14, H], [226, H]);

  p.part('sun');
  p.arc(sun, 40, 171.4, 368.6);
  for (const a of [-150, -120, -90, -60, -30]) {
    const [x, y] = [Math.cos(a * RAD), Math.sin(a * RAD)];
    p.line([sun[0] + x * 48.5, sun[1] + y * 48.5], [sun[0] + x * 57, sun[1] + y * 57]);
  }

  p.part('haze');
  p.line([90, 111], [150, 111]);
  p.line([102, 120], [138, 120]);
  p.line([112, 128.5], [128, 128.5]);

  p.part('tick');
  p.poly(
    [
      [104, 80],
      [115.5, 91.5],
      [137, 66.5],
    ],
    { accent: true, loose: 0.2 },
  );
});

sketch('search', 240, 160, (p) => {
  const plot = (x, y, o) =>
    p.poly(
      [
        [x, y],
        [x + 40, y],
        [x + 40, y + 30],
        [x, y + 30],
      ],
      { ...o, close: true },
    );
  const tilt = { rotate: -7, about: [104, 74] };
  p.part('plots');
  p.at(tilt, () => {
    plot(32, 36);
    plot(80, 36);
    plot(128, 36);
    plot(32, 74);
    plot(80, 74);
  });

  p.part('glass');
  p.circle([149.5, 83.5], 30);
  p.at({ move: [149.5, 83.5], rotate: 45 }, () => {
    p.poly([
      [30.5, -3.2],
      [62, -3.6],
      [62, 3.6],
      [30.5, 3.2],
    ]);
  });
  p.arc([149.5, 83.5], 24.5, 112, 150);

  p.part('found');
  p.at(tilt, () => plot(128, 74, { accent: true }));
});

sketch('inbox', 240, 160, (p) => {
  p.at({ move: [0, -14] }, () => {
    p.part('tray');
    p.poly([
      [50, 98],
      [72, 62],
      [168, 62],
      [190, 98],
    ]);
    p.poly([
      [72, 62.5],
      [77, 84],
      [163, 84],
      [168, 62.5],
    ]);
    p.line([77, 84], [69.9, 97.5]);
    p.line([163, 84], [170.1, 97.5]);

    p.part('front');
    p.line([50, 98], [100, 98]);
    p.curve(
      [
        [100, 98],
        [103, 105.5],
        [111, 109],
        [120, 109.5],
        [129, 109],
        [137, 105.5],
        [140, 98],
      ],
      { rough: 0.2 },
    );
    p.line([140, 98], [190, 98]);
    p.poly([
      [50, 98],
      [50, 132],
      [190, 132],
      [190, 98],
    ]);

    p.part('table');
    p.line([20, 132], [41, 132]);
    p.line([199, 132], [221, 132]);

    p.part('label');
    p.poly(
      [
        [104, 116],
        [136, 116],
        [136, 124.5],
        [104, 124.5],
      ],
      { accent: true, close: true, loose: 0.2 },
    );
  });
});

sketch('invoice', 240, 160, (p) => {
  p.at({ rotate: 4, about: [120, 80] }, () => {
    p.part('paper');
    const teeth = [];
    for (let i = 0; i <= 16; i++) teeth.push([84 + i * 4.5, i % 2 ? 134.5 : 140]);
    p.poly([
      [84, 140],
      [84, 18],
      [156, 18],
      [156, 140],
    ]);
    p.poly(teeth, { loose: 0.2 });

    p.part('text');
    p.line([104, 31], [136, 31]);
    for (const y of [46, 57, 68]) {
      p.line([95, y], [126, y]);
      p.line([137, y], [146, y]);
    }
    p.line([95, 80], [146, 80]);
    p.line([95, 91], [113, 91]);
    p.line([131, 91], [146, 91]);

    p.part('tick');
    p.poly(
      [
        [103, 113],
        [114, 124],
        [138, 99.5],
      ],
      { accent: true, loose: 0.2 },
    );
  });
});

sketch('handover', 240, 160, (p) => {
  p.part('plot');
  plotOutline(
    p,
    [
      [108, 144],
      [196, 120],
      [134, 98],
      [46, 122],
    ],
    { pegs: [11, 10, 8, 10], dash: 8, gap: 5.5 },
  );

  p.part('tag');
  p.curve(
    [
      [66.5, 43],
      [62.5, 51],
      [61.5, 60.5],
    ],
    { rough: 0.15 },
  );
  p.poly(
    [
      [57.5, 60],
      [66, 61],
      [68.5, 64.5],
      [66.5, 82],
      [54, 80.5],
      [56, 63],
    ],
    { close: true, loose: 0.3 },
  );

  p.part('key');
  p.at({ move: [72, 38], rotate: 15 }, () => {
    const T = 96;
    p.poly(
      [
        [14.7, -3],
        [T - 5, -3],
        [T, 0],
        [T - 5, 3],
        [T - 9, 3],
        [T - 9, 9],
        [T - 14.5, 9],
        [T - 14.5, 13],
        [T - 20.5, 13],
        [T - 20.5, 8],
        [T - 26, 8],
        [T - 26, 12],
        [T - 32, 12],
        [T - 32, 3],
        ...arcPoints([0, 0], 15, 11.5, 348.5, 20),
      ],
      { accent: true, close: true, loose: 0.25, rough: 0.5 },
    );
    p.circle([-3.5, 0], 5.6, { accent: true });
  });
});

sketch('map', 240, 160, (p) => {
  const source = JSON.parse(fs.readFileSync(QATAR_FILE, 'utf8'));
  const ring = [...source.path.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
  const scale = 128 / source.viewBox[3];
  const left = 120 - (source.viewBox[2] * scale) / 2;
  const coast = simplifyRing(ring, 2.6).map(([x, y]) => [left + x * scale, 16 + y * scale]);
  p.part('coast');
  p.curve(coast, { rough: 0.3 });

  p.part('sea');
  const wave = (x, y) =>
    p.curve(
      [
        [x, y],
        [x + 4, y - 2.2],
        [x + 8, y],
        [x + 12, y - 2.2],
        [x + 16, y],
      ],
      { rough: 0.15 },
    );
  wave(50, 58);
  wave(38, 104);
  wave(174, 44);
  wave(186, 96);

  p.part('pins');
  pin(p, [128, 78], 4.6);
  pin(p, [112, 118], 4.6);
  p.part('here');
  pin(p, [141, 104], 6.4, { accent: true });
});

sketch('shield', 240, 160, (p) => {
  const centre = [120, 104];
  const RX = 58;
  const RY = 66;
  /** A line running over the shell from brim to crown, `k` of the way from the middle to the edge. */
  const meridian = (k, heights) => heights.map((y) => [centre[0] + k * RX * Math.sqrt(1 - ((centre[1] - y) / RY) ** 2), y]);

  p.part('shell');
  p.arc(centre, [RX, RY], -180, 0, { step: 24 });
  p.poly(
    [
      [52, 104],
      [188, 104],
      ...arcPoints([188, 110], 6, -90, 90, 5).slice(1),
      [160, 117.2],
      [120, 117.8],
      [80, 117.2],
      [52, 116],
      ...arcPoints([52, 110], 6, 90, 270, 5).slice(1, -1),
    ],
    { close: true, loose: 0.2, rough: 0.5 },
  );
  p.curve(meridian(-0.22, [103, 88, 73, 60, 50, 43.5]), { rough: 0.2 });
  p.curve(meridian(0.22, [103, 88, 73, 60, 50, 43.5]), { rough: 0.2 });
  p.curve(meridian(-0.6, [103, 88, 74, 62, 53]), { rough: 0.2 });
  p.curve(meridian(0.6, [103, 88, 74, 62, 53]), { rough: 0.2 });

  p.part('ground');
  p.line([64, 134], [158, 134]);
  p.line([165, 134], [178, 134]);

  p.part('badge');
  p.poly(
    [
      [114, 76],
      [126, 76],
      [126, 83.5],
      [120, 90],
      [114, 83.5],
    ],
    { accent: true, close: true, loose: 0.2 },
  );
});

// ---------------------------------------------------------------------------------------------------
// Build and write
// ---------------------------------------------------------------------------------------------------

/** Draws every sketch: { name: { viewBox: [0, 0, w, h], strokes: [{ d, accent?, w? }] } }. */
export function buildSketches() {
  const sketches = {};
  for (const { name, width, height, draw } of DRAWINGS) {
    const pen = createPen(name);
    draw(pen);
    sketches[name] = { viewBox: [0, 0, width, height], strokes: pen.strokes };
  }
  return sketches;
}

/** The generated module as text. One stroke per line, so that diffs stay readable. */
export function renderModule(sketches) {
  const quote = (text) => `'${text}'`;
  const blocks = Object.entries(sketches).map(([name, { viewBox, strokes }]) => {
    const lines = strokes.map((s) => `      { d: ${quote(s.d)}${s.accent ? ', accent: true' : ''}${s.w !== undefined ? `, w: ${s.w}` : ''} },`);
    return `  ${name}: {\n    viewBox: [${viewBox.join(', ')}],\n    strokes: [\n${lines.join('\n')}\n    ],\n  },`;
  });
  return [
    '// Generated by scripts/build-sketches.mjs — do not edit by hand.',
    '// To change a drawing, edit the script and run: node scripts/build-sketches.mjs',
    "import type { SketchData } from './types';",
    '',
    'export const SKETCHES = {',
    blocks.join('\n'),
    '} as const satisfies Record<string, SketchData>;',
    '',
  ].join('\n');
}

function main() {
  const sketches = buildSketches();
  const text = renderModule(sketches);
  const relative = path.relative(ROOT, OUT_FILE);
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
    if (current !== text) {
      console.error(`${relative} is out of date — run: node scripts/build-sketches.mjs`);
      process.exit(1);
    }
    console.log(`${relative} is up to date`);
    return;
  }
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, text);
  for (const [name, { strokes }] of Object.entries(sketches)) {
    console.log(`${name.padEnd(10)} ${String(strokes.length).padStart(3)} strokes`);
  }
  console.log(`wrote ${relative} (${(Buffer.byteLength(text) / 1024).toFixed(1)} KB)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
