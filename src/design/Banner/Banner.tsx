import { CircleAlert, CircleCheck, FlaskConical, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/app/i18n';
import { Link } from '@/app/router';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './Banner.module.css';
import { strings } from './strings';

export type BannerTone = 'info' | 'ok' | 'warn' | 'bad' | 'demo';

export interface BannerProps {
  /** `demo` marks something as simulated or illustrative. */
  tone?: BannerTone;
  /** A short bold line above the text. */
  title?: string;
  /** The notice itself. Pass translated text. */
  children: ReactNode;
  /** Replace the tone's icon. */
  icon?: LucideIcon;
  /** One quiet action under the text. */
  action?: { label: string; onClick?: () => void; to?: string };
  /** Smaller text and padding, for a footnote-like notice inside a sheet or a card. */
  compact?: boolean;
  className?: string;
}

const ICONS: Record<BannerTone, LucideIcon> = { info: Info, ok: CircleCheck, warn: TriangleAlert, bad: CircleAlert, demo: FlaskConical };

/**
 * A notice inside the page: an icon, a sentence and at most one action. Errors are announced at
 * once (`role="alert"`); every other tone is a note.
 */
export function Banner({ tone = 'info', title, children, icon, action, compact = false, className }: BannerProps) {
  const t = useT(strings);
  const spoken = tone === 'warn' || tone === 'bad' ? t(tone) : null;
  return (
    <div role={tone === 'bad' ? 'alert' : 'note'} className={cx(styles.banner, styles[tone], compact && styles.compact, className)}>
      <Icon icon={icon ?? ICONS[tone]} size={compact ? 18 : 20} className={styles.icon} />
      <div className={styles.body}>
        {spoken ? <span className="visually-hidden">{spoken} </span> : null}
        {title ? <p className={styles.title}>{title}</p> : null}
        <div className={styles.text}>{children}</div>
        {action ? (
          action.to !== undefined ? (
            <Link to={action.to} className={styles.action}>
              {action.label}
            </Link>
          ) : (
            <button type="button" className={styles.action} onClick={action.onClick}>
              {action.label}
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
