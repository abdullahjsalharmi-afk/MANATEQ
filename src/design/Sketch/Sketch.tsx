import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cx } from '../cx';
import { SKETCHES, SKETCH_INK, type SketchData, type SketchName } from '../sketches';
import styles from './Sketch.module.css';

export type { SketchName } from '../sketches';

export interface SketchProps {
  /** Which drawing. */
  name: SketchName;
  /**
   * The widest the sketch may get, in px. It always shrinks to fit its container.
   * Default: the drawing's natural width (240, or 360 for `journey`). `'fill'` takes the container's full width.
   */
  size?: number | 'fill';
  /** Draw the strokes in, once, when the sketch first comes into view. Default true. */
  animate?: boolean;
  /** Names the drawing for screen readers. Without it the sketch is decorative. */
  label?: string;
  className?: string;
}

/** Sketches that read as a sequence follow the reading direction: they are mirrored in right-to-left layouts. */
const SEQUENCES: ReadonlySet<SketchName> = new Set<SketchName>(['journey']);

/** The width a sketch is tuned for when it fills its container: the phone's content column. */
const FILL_WIDTH = 350;

/**
 * The line keeps a steady hand at every size. A plain enlargement would make it heavy and a plain
 * reduction would make it faint, so the weight follows the size only gently: about 1.3 px at 120 px wide,
 * 1.6 px at the natural 240 px and 1.8 px across a phone.
 */
function inkScale(shownWidth: number, naturalWidth: number): number {
  const scale = Math.min(3, Math.max(0.25, shownWidth / naturalWidth));
  return scale ** -0.7;
}

const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * A hand-drawn line sketch: ink follows the text colour, one detail takes the accent colour.
 * The strokes draw themselves in when the sketch is first seen; with reduced motion it simply appears.
 */
export function Sketch({ name, size, animate = true, label, className }: SketchProps) {
  const sketch: SketchData = SKETCHES[name];
  const [, , width, height] = sketch.viewBox;
  const ref = useRef<SVGSVGElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (!animate || seen) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setSeen(true);
      },
      { threshold: 0.25 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [animate, seen]);

  const fill = size === 'fill';
  const ink = inkScale(fill ? FILL_WIDTH : (size ?? width), width);
  const style = { '--sketch-max': fill ? 'none' : `${size ?? width}px`, '--n': sketch.strokes.length } as CSSProperties;

  return (
    <svg
      key={name}
      ref={ref}
      className={cx(styles.sketch, animate && (seen ? styles.drawing : styles.waiting), SEQUENCES.has(name) && styles.sequence, className)}
      style={style}
      viewBox={sketch.viewBox.join(' ')}
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      strokeWidth={round(SKETCH_INK * ink)}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable={false}
      data-sketch={name}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {sketch.strokes.map((stroke, index) => (
        <path
          key={index}
          d={stroke.d}
          pathLength={1}
          className={stroke.accent ? styles.accent : undefined}
          strokeWidth={stroke.w === undefined ? undefined : round(stroke.w * ink)}
          style={{ '--i': index } as CSSProperties}
        />
      ))}
    </svg>
  );
}
