import type { ReactNode } from 'react';
import { Link } from '@/app/router';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import type { TabItem } from '../TabBar/TabBar';
import styles from './SideNav.module.css';

export interface SideNavProps {
  items: TabItem[];
  activeKey: string | null;
  /** Names the navigation for screen readers. */
  label: string;
  /** The product mark and name at the top. */
  brand: ReactNode;
  /** Controls pinned to the bottom (e.g. the language switch). */
  footer?: ReactNode;
}

/**
 * The navigation on wide screens: the same five destinations as the tab bar, as a rail at the
 * inline-start edge. On phones it is hidden and the tab bar takes over.
 */
export function SideNav({ items, activeKey, label, brand, footer }: SideNavProps) {
  return (
    <aside className={cx(styles.rail, 'mq-keep-side')}>
      <div className={styles.brand}>{brand}</div>
      <nav aria-label={label} className={styles.nav}>
        <ul className={styles.list}>
          {items.map((item) => {
            const active = item.key === activeKey;
            return (
              <li key={item.key}>
                <Link to={item.to} tab className={cx(styles.item, active && styles.active)} aria-current={active ? 'page' : undefined}>
                  <Icon icon={item.icon} size={22} strokeWidth={active ? 2.1 : 1.75} />
                  <span className={styles.label}>{item.label}</span>
                  {item.badge ? (
                    <span className={styles.badge}>
                      <span aria-hidden="true">{item.badge > 9 ? '9+' : item.badge}</span>
                      <span className="visually-hidden">({item.badge})</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </aside>
  );
}
