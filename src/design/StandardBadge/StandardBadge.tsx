import { Clock, Zap } from 'lucide-react';
import { useLang, useT } from '@/app/i18n';
import type { Standard } from '@/data/types';
import { isInstant, standardFigure, standardHeadline } from '@/domain/standard';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './StandardBadge.module.css';
import { strings } from './strings';

export interface StandardBadgeProps {
  /** The published standard of a service. */
  standard: Standard;
  /**
   * `full`: the figure in large type with the full text. `compact`: a small chip for list rows. `hero`: the
   * figure alone, centred, in 34/600 with «معيار الخدمة · استرشادي» in fine print under it, for the white tile
   * of a service page.
   */
  variant?: 'full' | 'compact' | 'hero';
  /**
   * `hero` and `compact`: the words to show when the standard has no headline duration (e.g. «عند التقديم»), so
   * every card in a grid ends the same way. Without it the hero and the chip render nothing.
   */
  fallback?: string;
  /** `full` only: show the standard's full sentence under the figure. Default true. */
  showText?: boolean;
  className?: string;
}

/**
 * A service standard. The figure is short ("5 أيام عمل", "فوري"); the sentence under it says what it
 * measures. Every standard is labelled indicative, the compact chip included («3 أيام عمل · استرشادي»). The
 * compact chip shows the `fallback` when the standard has no headline duration, and nothing without one.
 */
export function StandardBadge({ standard, variant = 'full', showText = true, fallback, className }: StandardBadgeProps) {
  const t = useT(strings);
  const { lang, pick } = useLang();

  if (variant === 'compact') {
    const headline = standardHeadline(standard, lang) ?? fallback ?? null;
    if (headline === null) return null;
    return (
      <span className={cx(styles.chip, className)}>
        <Icon icon={isInstant(standard) ? Zap : Clock} size={14} strokeWidth={1.75} />
        <span className="visually-hidden">{t('label')}: </span>
        <span>{headline}</span>
        <span className={styles.chipTag}>
          <span aria-hidden="true">· </span>
          {t('indicativeInline')}
        </span>
      </span>
    );
  }

  const figure = standardFigure(standard, lang);

  if (variant === 'hero') {
    if (!figure && !fallback) return null;
    return (
      <div className={cx(styles.hero, className)}>
        <p className={styles.heroFigure}>
          {figure ? (
            <>
              {figure.value !== null ? <span className="num">{figure.value} </span> : null}
              <span>{figure.words}</span>
            </>
          ) : (
            fallback
          )}
        </p>
        <p className={styles.heroFine}>
          {t('label')} · {t('indicativeInline')}
        </p>
      </div>
    );
  }

  const text = pick(standard);
  const tag = <span className={styles.tag}>{t('indicative')}</span>;
  if (!figure) {
    // No headline duration: the sentence is the standard.
    return (
      <div className={cx(styles.badge, className)}>
        <p className={styles.plain}>{text}</p>
        {tag}
      </div>
    );
  }
  return (
    <div className={cx(styles.badge, className)}>
      <div className={styles.top}>
        <p className={styles.figure}>
          <span className="visually-hidden">{t('label')}: </span>
          {figure.value !== null ? <span className={cx(styles.value, 'num')}>{figure.value} </span> : null}
          <span className={figure.value !== null ? styles.unit : styles.words}>{figure.words}</span>
        </p>
        {tag}
      </div>
      {showText && text ? <p className={styles.text}>{text}</p> : null}
    </div>
  );
}
