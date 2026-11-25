import { BellRing, CircleCheck, Info, RefreshCw, type LucideIcon } from 'lucide-react';
import type { AppNotification, NotificationKind } from '@/domain/types';
import type { strings } from './strings';

const KIND: Record<NotificationKind, { icon: LucideIcon; label: keyof typeof strings }> = {
  action: { icon: BellRing, label: 'kindAction' },
  update: { icon: RefreshCw, label: 'kindUpdate' },
  done: { icon: CircleCheck, label: 'kindDone' },
  info: { icon: Info, label: 'kindInfo' },
};

export interface NotificationLook {
  icon: LucideIcon;
  label: keyof typeof strings;
  /** Draw the icon in the accent: only an ask that is still open. */
  asking: boolean;
  /** Show the unread dot and the strong title. */
  unread: boolean;
  /** The ask was done (the invoice paid, the step completed, the request finished or withdrawn). */
  settled: boolean;
}

/**
 * How one notification reads in the list. A settled ask (`resolvedAt` set) is shown as done: a quiet check,
 * the word for done, never "Needs you" and never unread. It still opens what it is about.
 */
export function notificationLook(notification: Pick<AppNotification, 'kind' | 'read' | 'resolvedAt'>): NotificationLook {
  const settled = notification.resolvedAt !== undefined;
  if (settled) return { icon: CircleCheck, label: 'kindSettled', asking: false, unread: false, settled };
  const kind = KIND[notification.kind];
  return { icon: kind.icon, label: kind.label, asking: notification.kind === 'action', unread: !notification.read, settled };
}
