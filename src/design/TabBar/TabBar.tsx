import type { LucideIcon } from 'lucide-react';
import { Link } from '@/app/router';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './TabBar.module.css';

export interface TabItem {
  key: string;
  to: string;
  label: string;
  icon: LucideIcon;
  /** A count on the tab (e.g. requests waiting for the investor). */
  badge?: number;
}

export interface TabBarProps {
  items: TabItem[];
  activeKey: string | null;
  /** Names the navigation for screen readers. */
  label: string;
}

/** The five-tab bar at the bottom of the app. */
export function TabBar({ items, activeKey, label }: TabBarProps) {
  return (
    <nav className={cx(styles.bar, 'mq-keep')} aria-label={label}>
      <ul className={styles.inner}>
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <li key={item.key} className={styles.cell}>
              <Link to={item.to} tab replace={activeKey !== null} className={cx(styles.tab, active && styles.active)} aria-current={active ? 'page' : undefined}>
                <span className={styles.iconWrap}>
                  <Icon icon={item.icon} size={24} strokeWidth={active ? 2.1 : 1.75} />
                  {item.badge ? (
                    <span className={styles.badge} aria-hidden="true">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  ) : null}
                </span>
                <span className={styles.label}>{item.label}</span>
                {item.badge ? <span className="visually-hidden">({item.badge})</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
