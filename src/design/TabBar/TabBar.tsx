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
  /** Draw the bar in the flow of the page instead of pinning it to the viewport (documentation only). */
  inline?: boolean;
}

/**
 * The five destinations at the bottom of the app on phones: a frosted bar, a 22 px icon over a 12 px label.
 * The active tab is the accent colour and nothing else: no pill, no shape behind it.
 * From 834 px it is hidden; the global bar takes over.
 */
export function TabBar({ items, activeKey, label, inline = false }: TabBarProps) {
  return (
    <nav className={cx(styles.bar, 'mq-frost', inline ? styles.inline : 'mq-keep')} aria-label={label}>
      <ul className={styles.inner}>
        {items.map((item) => {
          const active = item.key === activeKey;
          return (
            <li key={item.key} className={styles.cell}>
              <Link to={item.to} tab replace={activeKey !== null} className={cx(styles.tab, active && styles.active)} aria-current={active ? 'page' : undefined}>
                <span className={styles.iconWrap}>
                  <Icon icon={item.icon} size={22} strokeWidth={active ? 1.9 : 1.5} />
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
