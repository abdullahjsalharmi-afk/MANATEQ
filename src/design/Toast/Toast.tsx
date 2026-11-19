import { CircleAlert, CircleCheck, Info } from 'lucide-react';
import { useEffect, useSyncExternalStore } from 'react';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './Toast.module.css';

export interface ToastOptions {
  tone?: 'ok' | 'info' | 'bad';
  /** How long the toast stays, in ms. Default 3200. */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface ToastState extends ToastOptions {
  id: number;
  message: string;
}

let current: ToastState | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => {
  for (const listener of [...listeners]) listener();
};

/** Shows a short confirmation at the bottom of the screen. A new toast replaces the current one. */
export function toast(message: string, options: ToastOptions = {}): void {
  current = { id: nextId++, message, ...options };
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

  useEffect(() => {
    if (!state) return;
    const timer = setTimeout(() => {
      if (current?.id === state.id) dismissToast();
    }, state.duration ?? 3200);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className={cx(styles.host, 'mq-keep-toast')} role="status" aria-live="polite" aria-atomic="true">
      {state ? (
        <div key={state.id} className={cx(styles.toast, styles[state.tone ?? 'ok'])}>
          <Icon icon={ICONS[state.tone ?? 'ok']} size={20} />
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
