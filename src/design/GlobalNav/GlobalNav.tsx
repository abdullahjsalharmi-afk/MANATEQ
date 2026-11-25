import { Search } from 'lucide-react';
import { useT } from '@/app/i18n';
import { Link } from '@/app/router';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import { Mark } from '../Mark/Mark';
import { designStrings } from '../strings';
import type { TabItem } from '../TabBar/TabBar';
import styles from './GlobalNav.module.css';
import { strings } from './strings';

export interface GlobalNavProps {
  /** Names the navigation for screen readers. */
  label: string;
  /** The five destinations: the same items as the tab bar. */
  items: TabItem[];
  activeKey: string | null;
  /** The product name, beside the mark. Together they link home. */
  brand: string;
  /** Where the mark and the name lead. Default: home. */
  homeTo?: string;
  /** The search link at the inline end. */
  search?: { to: string; label: string };
  /** The language switch at the inline end: the other language, written in that language. */
  language?: { name: string; lang: string; onSwitch: () => void };
  /** Draw the bar in the flow of the page instead of pinning it (documentation only). */
  inline?: boolean;
}

/**
 * The global bar of wide screens (from 834 px): black, 44 px, pinned to the top. The mark, the product
 * name and the prototype capsule at the inline start; the five destinations as quiet 12 px links; search
 * and the language switch at the inline end. Below 834 px it does not exist: phones use the tab bar.
 */
export function GlobalNav({ label, items, activeKey, brand, homeTo = '/', search, language, inline = false }: GlobalNavProps) {
  const t = useT(strings);
  const d = useT(designStrings);
  const skip = () => document.querySelector<HTMLElement>('main')?.focus();
  return (
    <nav className={cx(styles.nav, inline ? styles.inline : 'mq-keep-nav')} aria-label={label} data-tone="dark">
      <div className={styles.inner}>
        <div className={styles.start}>
          {inline ? null : (
            <button type="button" className={styles.skip} onClick={skip}>
              {t('skip')}
            </button>
          )}
          <Link to={homeTo} tab className={styles.brand}>
            <Mark size={16} />
            <span className={styles.brandName}>{brand}</span>
          </Link>
          <span className={styles.proto}>{d('prototype')}</span>
        </div>

        <ul className={styles.links}>
          {items.map((item) => {
            const active = item.key === activeKey;
            return (
              <li key={item.key}>
                <Link to={item.to} tab className={cx(styles.link, active && styles.active)} aria-current={active ? 'page' : undefined}>
                  <span>{item.label}</span>
                  {item.badge ? (
                    <>
                      <span className={styles.badge} aria-hidden="true">
                        {item.badge > 9 ? '9+' : item.badge}
                      </span>
                      <span className="visually-hidden">({item.badge})</span>
                    </>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className={styles.end}>
          {search ? (
            <Link to={search.to} className={styles.iconLink} aria-label={search.label} title={search.label}>
              <Icon icon={Search} size={16} strokeWidth={2} />
            </Link>
          ) : null}
          {language ? (
            <button type="button" className={styles.utility} lang={language.lang} onClick={language.onSwitch}>
              {language.name}
            </button>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
