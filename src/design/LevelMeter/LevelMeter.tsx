import { ArrowRight } from 'lucide-react';
import { useLang, useT } from '@/app/i18n';
import { reference } from '@/data/catalog';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './LevelMeter.module.css';
import { strings } from './strings';

export interface LevelMeterProps {
  /** Automation level today, 0–5. */
  now: number;
  /** The level the service is planned to reach, 0–5. */
  target: number;
  className?: string;
}

type MarkRole = 'passed' | 'now' | 'ahead' | 'target' | 'beyond';

/**
 * How automated a service is today and where it is heading: six marks from manual to proactive,
 * with today and the target named. Indicative, like the levels themselves.
 */
export function LevelMeter({ now, target, className }: LevelMeterProps) {
  const t = useT(strings);
  const { pick } = useLang();
  const max = reference.maturity.length - 1;
  const clamp = (level: number) => Math.max(0, Math.min(max, Math.round(level)));
  const from = clamp(now);
  const to = Math.max(from, clamp(target));
  const same = from === to;
  const nowName = pick(reference.maturity[from]);
  const targetName = pick(reference.maturity[to]);

  const roleOf = (level: number): MarkRole => {
    if (level === to) return 'target';
    if (level === from) return 'now';
    if (level < from) return 'passed';
    return level < to ? 'ahead' : 'beyond';
  };

  return (
    <div className={cx(styles.meter, className)} role="img" aria-label={t('summary', { now: from, target: to, max, nowName, targetName })}>
      <div className={styles.scale}>
        {reference.maturity.map((_, level) => {
          const role = roleOf(level);
          const tag = level === to ? (same ? t('reached') : t('target')) : level === from ? t('today') : null;
          return (
            <div key={level} className={cx(styles.step, styles[role], level === from && styles.from)} data-role={role}>
              <span className={styles.tag}>{tag}</span>
              <span className={styles.mark} />
              <span className={cx(styles.digit, 'num')}>{level}</span>
            </div>
          );
        })}
      </div>
      <p className={styles.names}>
        {same ? (
          <span className={styles.name}>{targetName}</span>
        ) : (
          <>
            <span>{nowName}</span>
            <Icon icon={ArrowRight} size={14} strokeWidth={2} flip />
            <span className={styles.name}>{targetName}</span>
          </>
        )}
      </p>
    </div>
  );
}
