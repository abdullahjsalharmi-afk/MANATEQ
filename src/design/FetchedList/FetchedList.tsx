import { Check, Link2 } from 'lucide-react';
import { useT } from '@/app/i18n';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './FetchedList.module.css';
import { strings } from './strings';

export interface FetchedItem {
  /** What was fetched, e.g. "اسم الشركة ورقم السجل التجاري". */
  text: string;
  /** Where it comes from. `live: false` marks a source that is not connected nationally yet. */
  source?: { name: string; live: boolean };
}

export interface FetchedListProps {
  items: FetchedItem[];
  /** The line under the list. Defaults to the once-only principle; pass `false` to leave it out. */
  caption?: string | false;
  /** `card` puts the list on its own surface; `plain` leaves it on the page (inside another card or a sheet). */
  variant?: 'card' | 'plain';
  /** Names the list for screen readers, e.g. "جلبناها عنك". */
  label?: string;
  className?: string;
}

/**
 * "جلبناها عنك": the once-only principle made visible: every item the investor is not asked for,
 * with the source it comes from. Sources that are not live nationally yet say so.
 */
export function FetchedList({ items, caption, variant = 'card', label, className }: FetchedListProps) {
  const t = useT(strings);
  const note = caption === false ? null : (caption ?? t('onceOnly'));
  return (
    <div className={cx(styles.fetched, styles[variant], className)}>
      <ul className={styles.list} aria-label={label}>
        {items.map((item, index) => (
          <li key={index} className={styles.item}>
            <span className={styles.tick} aria-hidden="true">
              <Icon icon={Check} size={18} strokeWidth={2} />
            </span>
            <div className={styles.words}>
              <p className={styles.text}>{item.text}</p>
              {item.source ? (
                <p className={styles.source}>
                  <span className={styles.name}>{t('source', { name: item.source.name })}</span>{' '}
                  {item.source.live ? null : (
                    <span className={styles.planned}>
                      <Icon icon={Link2} size={14} strokeWidth={1.75} />
                      {t('planned')}
                    </span>
                  )}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {note ? <p className={styles.caption}>{note}</p> : null}
    </div>
  );
}
