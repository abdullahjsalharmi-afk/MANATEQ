import { Check } from 'lucide-react';
import { useT } from '@/app/i18n';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './JourneyRibbon.module.css';
import { strings } from './strings';

export type JourneyState = 'done' | 'current' | 'upcoming';

export interface JourneyStation {
  key: string;
  /** One word: "الانضمام", "العقد", "البناء", "التشغيل". */
  label: string;
  state: JourneyState;
}

export interface JourneyRibbonProps {
  /** The stations in order. The first one sits at the start of the line (on the right in Arabic). */
  stations: JourneyStation[];
  /** Names the ribbon for screen readers. Default "رحلتك". */
  label?: string;
  /** One short line under the ribbon about where the investor is now. */
  caption?: string;
  /** Makes the stations buttons. Called with the station's key. */
  onSelect?: (key: string) => void;
  /** `compact` for Home, `expanded` (numbered, larger) for the journey sheet. */
  size?: 'compact' | 'expanded';
  className?: string;
}

/**
 * The journey ribbon: the investor's whole path on one line: join, contract, build, operate.
 * Four equal segments on a thin rail. Passed stations are solid ink dots, the current one carries the
 * accent, the rest are hollow and wait quietly.
 */
export function JourneyRibbon({ stations, label, caption, onSelect, size = 'compact', className }: JourneyRibbonProps) {
  const t = useT(strings);
  const expanded = size === 'expanded';
  return (
    <div className={cx(styles.ribbon, styles[size], className)}>
      <ol className={styles.track} aria-label={label ?? t('journey')}>
        {stations.map((station, index) => {
          const content = (
            <>
              <span className={styles.node} aria-hidden="true">
                {expanded ? station.state === 'done' ? <Icon icon={Check} size={14} strokeWidth={2.25} /> : <span className="num">{index + 1}</span> : null}
              </span>
              <span className={styles.label}>{station.label}</span>
              <span className="visually-hidden">{t('stateOf', { state: t(station.state) })}</span>
            </>
          );
          return (
            <li key={station.key} className={cx(styles.station, styles[station.state])} aria-current={station.state === 'current' ? 'step' : undefined} data-state={station.state}>
              {onSelect ? (
                <button type="button" className={styles.hit} onClick={() => onSelect(station.key)}>
                  {content}
                </button>
              ) : (
                <span className={styles.hit}>{content}</span>
              )}
            </li>
          );
        })}
      </ol>
      {caption ? <p className={styles.caption}>{caption}</p> : null}
    </div>
  );
}
