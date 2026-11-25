import { BellOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { navigate } from '@/app/router';
import { Icon, List, Row, Screen, Section, toast } from '@/design/core';
import { EmptyState } from '@/design/forms';
import type { AppNotification } from '@/domain/types';
import { useNow } from '@/features/shared/useNow';
import { markAllRead, markRead, selectNotifications, selectUnreadCount, useApp } from '@/state';
import { groupByDay } from './group';
import { notificationLook } from './look';
import styles from './Notifications.module.css';
import { strings } from './strings';

/** The notifications centre: latest first, today and earlier; a tap marks one read and opens what it is about. */
export function NotificationsScreen() {
  const t = useT(strings);
  const now = useNow(30_000);
  const notifications = useApp(selectNotifications);
  const unread = useApp(selectUnreadCount);
  const groups = groupByDay(notifications, now);

  // The live line speaks only when the count changes on its own (a request moved); the investor's own
  // "mark all" is confirmed by the toast alone, so it is announced once. Section moves the focus to the
  // heading once the button has gone.
  const [announce, setAnnounce] = useState('');
  const lastUnread = useRef(unread);
  const ownChange = useRef(false);
  useEffect(() => {
    if (unread === lastUnread.current) return;
    lastUnread.current = unread;
    if (ownChange.current) {
      ownChange.current = false;
      return;
    }
    setAnnounce(unread > 0 ? t('unreadCount', { n: unread }) : t('allRead'));
  }, [unread, t]);

  const readAll = () => {
    ownChange.current = true;
    markAllRead();
    toast(t('markedAll'), { tone: 'ok' });
  };

  // The one bulk action sits on the first group's head, where the eye starts.
  const markAction = unread > 0 ? { label: t('markAll'), onClick: readAll } : undefined;

  return (
    <Screen title={t('title')} nav="back" backTo="/">
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>
      {notifications.length === 0 ? (
        <EmptyState icon={BellOff} title={t('emptyTitle')} body={t('emptyBody')} />
      ) : (
        <div>
          {groups.today.length > 0 ? <Group title={t('today')} items={groups.today} now={now} action={markAction} /> : null}
          {groups.earlier.length > 0 ? <Group title={t('earlier')} items={groups.earlier} now={now} action={groups.today.length > 0 ? undefined : markAction} /> : null}
        </div>
      )}
    </Screen>
  );
}

function Group({ title, items, now, action }: { title: string; items: AppNotification[]; now: number; action?: { label: string; onClick: () => void } }) {
  return (
    <Section title={title} action={action}>
      <List>
        {items.map((notification) => (
          <NotificationRow key={notification.id} notification={notification} now={now} />
        ))}
      </List>
    </Section>
  );
}

function NotificationRow({ notification, now }: { notification: AppNotification; now: number }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const look = notificationLook(notification);
  const open = () => {
    if (!notification.read) markRead(notification.id);
    if (notification.route) navigate(notification.route);
  };
  return (
    <Row
      onClick={open}
      chevron={notification.route !== undefined}
      leading={<Icon icon={look.icon} size={22} className={look.asking ? styles.iconAction : styles.icon} />}
      eyebrow={
        <>
          {t(look.label)}
          <span aria-hidden="true"> · </span>
          {fmt.relative(notification.at, now)}
        </>
      }
      title={<span className={look.unread ? styles.unreadTitle : undefined}>{pick(notification.title)}</span>}
      subtitle={pick(notification.body)}
      wrap
      trailing={
        !look.unread ? undefined : (
          <span className={styles.dot}>
            <span className="visually-hidden">{t('unread')}</span>
          </span>
        )
      }
    />
  );
}
