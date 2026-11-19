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
  /** `full`: the figure in large type with the full text. `compact`: a small chip for list rows. */
  variant?: 'full' | 'compact';
  /** `full` only: show the standard's full sentence under the figure. Default true. */
  showText?: boolean;
  className?: string;
}

/**
 * A service standard. The figure is short ("5 أيام عمل", "فوري"); the sentence under it says what it
 * measures. Every standard is labelled indicative. The compact chip renders nothing when the standard
 * has no headline duration.
 */
export function StandardBadge({ standard, variant = 'full', showText = true, className }: StandardBadgeProps) {
  const t = useT(strings);
  const { lang, pick } = useLang();

  if (variant === 'compact') {
    const headline = standardHeadline(standard, lang);
    if (headline === null) return null;
    return (
      <span className={cx(styles.chip, className)}>
        <Icon icon={isInstant(standard) ? Zap : Clock} size={13} strokeWidth={2} />
        <span className="visually-hidden">{t('label')}: </span>
        <span>{headline}</span>
      </span>
    );
  }

  const figure = standardFigure(standard, lang);
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
