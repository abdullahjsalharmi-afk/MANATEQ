import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { IconButton } from '../Button/Button';
import { useT } from '@/app/i18n';
import { cx } from '../cx';
import { designStrings } from '../strings';
import styles from './Sheet.module.css';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One line under the title. */
  description?: ReactNode;
  children: ReactNode;
  /** A fixed area at the bottom of the sheet for its action button(s). */
  footer?: ReactNode;
  /** When false the sheet can only be closed through its own buttons (e.g. while a payment is in progress). */
  dismissible?: boolean;
  /** Override the label of the close button. */
  closeLabel?: string;
  className?: string;
}

const CLOSE_MS = 220;

/**
 * The page behind a sheet does not scroll. Sheets hand over to one another (accept, then sign, then pay): the
 * next one opens while the last is still closing, so each cannot simply put back what it found. They share one
 * lock: the first sheet to open holds the page still, and it scrolls again only when the last one lets go.
 */
let scrollLocks = 0;
let overflowBefore = '';

function lockPageScroll(): () => void {
  const root = document.documentElement;
  if (scrollLocks === 0) {
    overflowBefore = root.style.overflow;
    root.style.overflow = 'hidden';
  }
  scrollLocks += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks -= 1;
    if (scrollLocks === 0) root.style.overflow = overflowBefore;
  };
}

/**
 * What had focus before each open sheet took it. A sheet opened from inside another sheet (the next step of the
 * same task) inherits that sheet's opener, so focus returns to the control on the page that started it all.
 */
const openers = new WeakMap<HTMLDialogElement, HTMLElement | null>();

function noteOpener(dialog: HTMLDialogElement): void {
  const active = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  const host = active?.closest('dialog');
  openers.set(dialog, host instanceof HTMLDialogElement && openers.has(host) ? (openers.get(host) ?? null) : active);
}

/** Puts focus back on what opened the sheet, when closing it left focus nowhere. Never steals it from a sheet that took over. */
function returnFocus(dialog: HTMLDialogElement): void {
  const opener = openers.get(dialog);
  const active = document.activeElement;
  const dropped = !active || active === document.body || !active.isConnected || dialog.contains(active);
  if (dropped && opener?.isConnected) opener.focus({ preventScroll: true });
}

/**
 * A modal sheet that rises from the bottom on phones and appears as a centred dialog on wide screens.
 * Built on the native <dialog>: focus is trapped, the page behind is inert, Escape closes it. Closing it
 * returns focus to the control that opened it, and the page behind scrolls again once no sheet is left.
 * On phones it can be dragged down by its grabber to dismiss. Give it one pill in `footer`.
 */
export function Sheet({ open, onClose, title, description, children, footer, dismissible = true, closeLabel, className }: SheetProps) {
  const t = useT(designStrings);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const titleId = useId();
  const drag = useRef<{ startY: number; lastY: number; lastT: number; velocity: number } | null>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const timer = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, CLOSE_MS);
    return () => clearTimeout(timer);
  }, [open, mounted]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!mounted || !dialog) return;
    if (!dialog.open) {
      noteOpener(dialog);
      try {
        dialog.showModal();
      } catch {
        dialog.setAttribute('open', '');
      }
    }
    const release = lockPageScroll();
    return () => {
      release();
      if (dialog.open) dialog.close();
      // By now the dialog may already be out of the page, where closing it cannot hand focus back.
      returnFocus(dialog);
    };
  }, [mounted]);

  if (!mounted) return null;

  const requestClose = () => {
    if (dismissible) onClose();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dismissible) return;
    drag.current = { startY: event.clientY, lastY: event.clientY, lastT: event.timeStamp, velocity: 0 };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const panel = panelRef.current;
    if (!state || !panel) return;
    const delta = Math.max(0, event.clientY - state.startY);
    const dt = Math.max(1, event.timeStamp - state.lastT);
    state.velocity = (event.clientY - state.lastY) / dt;
    state.lastY = event.clientY;
    state.lastT = event.timeStamp;
    panel.style.transition = 'none';
    panel.style.transform = `translateY(${delta}px)`;
  };
  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    const panel = panelRef.current;
    drag.current = null;
    if (!state || !panel) return;
    const delta = Math.max(0, event.clientY - state.startY);
    panel.style.transition = '';
    panel.style.transform = '';
    if (delta > 110 || state.velocity > 0.7) onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className={cx(styles.dialog, closing && styles.closing)}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) requestClose();
      }}
    >
      <div ref={panelRef} className={cx(styles.panel, className)}>
        <div className={styles.grip} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
          <span className={styles.handle} aria-hidden="true" />
        </div>
        <header className={styles.head}>
          <div className={styles.titles}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            {description ? <p className={styles.description}>{description}</p> : null}
          </div>
          {dismissible ? <IconButton icon={X} label={closeLabel ?? t('close')} variant="soft" size="sm" onClick={onClose} className={styles.close} /> : null}
        </header>
        <div className={styles.body}>{children}</div>
        {footer ? <footer className={styles.footer}>{footer}</footer> : null}
      </div>
    </dialog>
  );
}
