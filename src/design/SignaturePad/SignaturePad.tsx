import { X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useT } from '@/app/i18n';
import { Button } from '../Button/Button';
import { cx } from '../cx';
import { Field } from '../Field/Field';
import { Icon } from '../Icon/Icon';
import { drawSegment, drawStroke, drawTail, INK_MAX_WIDTH, inkWidth, type InkStroke } from './ink';
import styles from './SignaturePad.module.css';
import { strings } from './strings';

export interface SignaturePadProps {
  /** Names the pad, e.g. "توقيعك". Pass translated text. */
  label: string;
  hint?: string;
  /** What is missing, e.g. "أضف توقيعك أولًا". */
  error?: string;
  required?: boolean;
  labelHidden?: boolean;
  /** The signer's name: written under the line, and placed as the signature by "Adopt my signature". */
  signerName: string;
  /** Called when the pad gains or loses a signature. */
  onChange: (hasSignature: boolean) => void;
  /** Start with the typed signature already placed. */
  defaultAdopted?: boolean;
  /** The id of the pad's group, so a form can move focus to it when the signature is missing. */
  id?: string;
  className?: string;
}

type Mode = 'empty' | 'drawn' | 'typed';

/** Ink shorter than this, in px, is a stray touch and not yet a signature. */
const MIN_INK = 24;
/** Sharper than this gains nothing visible and costs memory. */
const MAX_PIXEL_RATIO = 3;

interface ActiveStroke {
  pointerId: number;
  stroke: InkStroke;
  ctx: CanvasRenderingContext2D;
  time: number;
  /** Left, top and scale of the canvas on screen when the stroke began. */
  left: number;
  top: number;
  scaleX: number;
  scaleY: number;
}

/**
 * A pad to sign on with a finger, a pen or a mouse. The line is smoothed and thins with speed, the
 * canvas is as sharp as the screen, and the ink takes the theme's colour. For people who cannot or
 * would rather not draw, "Adopt my signature" places their typed name instead, by keyboard too.
 */
export function SignaturePad({ label, hint, error, required, labelHidden, signerName, onChange, defaultAdopted = false, id, className }: SignaturePadProps) {
  const t = useT(strings);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<InkStroke[]>([]);
  const inkLength = useRef(0);
  const active = useRef<ActiveStroke | null>(null);
  const reported = useRef(false);
  const [mode, setMode] = useState<Mode>(defaultAdopted ? 'typed' : 'empty');
  const [announcement, setAnnouncement] = useState('');

  const latestOnChange = useRef(onChange);
  useEffect(() => {
    latestOnChange.current = onChange;
  });

  const report = useCallback((hasSignature: boolean) => {
    if (reported.current === hasSignature) return;
    reported.current = hasSignature;
    latestOnChange.current(hasSignature);
  }, []);

  // A pad that starts with the adopted signature tells its parent so.
  useEffect(() => {
    if (defaultAdopted) report(true);
  }, [defaultAdopted, report]);

  /** The drawing context, sized to the canvas on screen and set to the theme's ink. */
  const prepare = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext('2d');
    } catch {
      ctx = null;
    }
    if (!ctx) return null;
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
      canvas.width = width;
      canvas.height = height;
    }
    const ink = getComputedStyle(canvas).color;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    return ctx;
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = prepare();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    for (const stroke of strokes.current) drawStroke(ctx, stroke);
  }, [prepare]);

  // Keep the drawing when the pad changes size or the theme changes the ink.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    redraw();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(redraw);
    resize?.observe(canvas);
    const theme = typeof MutationObserver === 'undefined' ? null : new MutationObserver(redraw);
    theme?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      resize?.disconnect();
      theme?.disconnect();
    };
  }, [redraw]);

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (mode === 'typed' || active.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const canvas = event.currentTarget;
    const ctx = prepare();
    if (!ctx) return;
    event.preventDefault();
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* The stroke still works while the pointer stays over the pad. */
    }
    const box = canvas.getBoundingClientRect();
    const scaleX = box.width > 0 ? canvas.clientWidth / box.width : 1;
    const scaleY = box.height > 0 ? canvas.clientHeight / box.height : 1;
    const stroke: InkStroke = [{ x: (event.clientX - box.left) * scaleX, y: (event.clientY - box.top) * scaleY, w: INK_MAX_WIDTH * 0.8 }];
    strokes.current.push(stroke);
    active.current = { pointerId: event.pointerId, stroke, ctx, time: event.timeStamp, left: box.left, top: box.top, scaleX, scaleY };
    if (mode === 'empty') setMode('drawn');
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const state = active.current;
    if (!state || state.pointerId !== event.pointerId) return;
    // Browsers merge fast pointer moves into one event; the merged samples give a rounder line.
    const native = event.nativeEvent;
    const merged = typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : [];
    for (const sample of merged.length ? merged : [native]) {
      const previous = state.stroke[state.stroke.length - 1];
      if (!previous) continue;
      const x = (sample.clientX - state.left) * state.scaleX;
      const y = (sample.clientY - state.top) * state.scaleY;
      const distance = Math.hypot(x - previous.x, y - previous.y);
      if (distance < 0.8) continue;
      const elapsed = Math.max(1, sample.timeStamp - state.time);
      state.stroke.push({ x, y, w: inkWidth(previous.w, distance / elapsed) });
      state.time = sample.timeStamp;
      inkLength.current += distance;
      drawSegment(state.ctx, state.stroke, state.stroke.length - 1);
    }
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const state = active.current;
    if (!state || state.pointerId !== event.pointerId) return;
    active.current = null;
    drawTail(state.ctx, state.stroke);
    if (inkLength.current >= MIN_INK && !reported.current) {
      setAnnouncement(t('added'));
      report(true);
    }
  };

  const adopt = () => {
    strokes.current = [];
    inkLength.current = 0;
    active.current = null;
    redraw();
    setMode('typed');
    setAnnouncement(t('added'));
    report(true);
  };

  const clear = () => {
    if (mode === 'empty') return;
    strokes.current = [];
    inkLength.current = 0;
    active.current = null;
    redraw();
    setMode('empty');
    setAnnouncement(t('cleared'));
    report(false);
  };

  return (
    <Field as="group" label={label} hint={hint} error={error} required={required} labelHidden={labelHidden} id={id} className={className}>
      {(control) => (
        <div id={control.id} role="group" tabIndex={-1} aria-labelledby={control.labelId} aria-describedby={control.describedBy} className={styles.wrap}>
          <div className={cx(styles.pad, control.invalid && styles.invalid, mode === 'typed' && styles.padTyped)}>
            <span className={styles.line} aria-hidden="true">
              <Icon icon={X} size={14} strokeWidth={2} className={styles.cross} />
            </span>
            <span className={styles.signer} aria-hidden="true">
              {t('signer', { name: signerName })}
            </span>
            {mode === 'empty' ? (
              <span className={styles.placeholder} aria-hidden="true">
                {t('signHere')}
              </span>
            ) : null}
            {mode === 'typed' ? (
              <span className={styles.typed}>
                <span className={styles.typedName} dir="auto">
                  {signerName}
                </span>
              </span>
            ) : null}
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              role="img"
              aria-label={mode === 'empty' ? t('padEmpty') : t('padSigned')}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
            />
          </div>
          <div className={styles.actions}>
            <Button size="md" variant="quiet" onClick={adopt} aria-disabled={mode === 'typed' || undefined} className={cx(mode === 'typed' && styles.off)}>
              {t('adopt')}
            </Button>
            <Button size="md" variant="quiet" onClick={clear} aria-disabled={mode === 'empty' || undefined} className={cx(mode === 'empty' && styles.off)}>
              {t('clear')}
            </Button>
          </div>
          <span className="visually-hidden" role="status">
            {announcement}
          </span>
        </div>
      )}
    </Field>
  );
}
