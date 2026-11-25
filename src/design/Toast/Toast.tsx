import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './Toast.module.css';

export interface ToastOptions {
  /** Chooses the icon; the pill itself never changes colour. */
  tone?: 'ok' | 'info' | 'bad';
  /** How long the toast stays, in ms. Default 3200. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastState extends ToastOptions {
  id: number;
  message: string;
  /** The control that asked for the toast (the one it confirms), so the toast never lands on top of it. */
  origin: Element | null;
}

/** The last control pressed with a pointer: Safari does not focus a button on click, so focus alone is not enough. */
let pressed: { element: Element; at: number } | null = null;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'pointerdown',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest('button, a, [role="button"], [role="switch"], [role="radio"]') : null;
      pressed = target ? { element: target, at: Date.now() } : null;
    },
    { capture: true, passive: true },
  );
}

/** The control a toast confirms: the one just pressed, or else the one with the keyboard. */
function originOfToast(): Element | null {
  if (typeof document === 'undefined') return null;
  if (pressed && Date.now() - pressed.at < 1000) return pressed.element;
  const active = document.activeElement;
  return active && active !== document.body ? active : null;
}

let current: ToastState | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of [...listeners]) listener();
};

/**
 * Shows a short confirmation at the bottom of the screen, above the tab bar and a screen's action bar. When the
 * control it confirms sits where the toast would land (a link at the foot of the page), it shows under the top bar
 * instead. A new toast replaces the current one.
 */
export function toast(message: string, options: ToastOptions = {}): void {
  current = { id: nextId++, message, ...options, origin: originOfToast() };
  emit();
}

export function dismissToast(): void {
  if (!current) return;
  current = null;
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => current;

const ICONS = { ok: CircleCheck, info: Info, bad: CircleAlert } as const;

/** Mount once at the root of the app. */
export function ToastHost() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const pillRef = useRef<HTMLDivElement>(null);
  // Which toast was found to cover the control it confirms; that one shows under the top bar.
  const [topId, setTopId] = useState(0);
  const atTop = state !== null && topId === state.id;

  // Before the toast paints, it is measured where it lands at the bottom: if it would cover its control, it moves.
  useLayoutEffect(() => {
    const pill = pillRef.current;
    const origin = state?.origin;
    if (!state || !pill || !origin || !origin.isConnected) return;
    const a = pill.getBoundingClientRect();
    const b = origin.getBoundingClientRect();
    const gap = 8;
    const covers = b.width > 0 && a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;
    if (covers) setTopId(state.id);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const timer = setTimeout(() => {
      if (current?.id === state.id) dismissToast();
    }, state.duration ?? 3200);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className={cx(styles.host, atTop && styles.top, 'mq-keep-toast')} role="status" aria-live="polite" aria-atomic="true">
      {state ? (
        <div key={state.id} ref={pillRef} className={styles.toast}>
          <Icon icon={ICONS[state.tone ?? 'ok']} size={18} />
          <span className={styles.message}>{state.message}</span>
          {state.action ? (
            <button
              type="button"
              className={styles.action}
              onClick={() => {
                state.action?.onClick();
                dismissToast();
              }}
            >
              {state.action.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
