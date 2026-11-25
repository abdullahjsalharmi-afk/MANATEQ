import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './Pill.module.css';

/** `accent` is the investor's turn or a category; `gold` marks "verified / official"; the rest are states. */
export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'info' | 'gold';

export interface PillProps {
  children: ReactNode;
  tone?: Tone;
  /** A 14 px icon before the text. Status is never colour alone: the pill always says the state in words too. */
  icon?: LucideIcon;
  /** A 6 px dot before the text. On by default for every tone except `neutral`, when there is no icon. */
  dot?: boolean;
  /** `solid` is for the single most important state on a screen; default is a quiet tint. */
  solid?: boolean;
  className?: string;
}

/** A small status label: 12 px text with a dot or an icon on a tint. `neutral` is a plain category label. */
export function Pill({ children, tone = 'neutral', icon, dot, solid = false, className }: PillProps) {
  const showDot = dot ?? (!icon && !solid && tone !== 'neutral');
  return (
    <span className={cx(styles.pill, styles[tone], solid && styles.solid, className)}>
      {icon ? <Icon icon={icon} size={14} strokeWidth={2} /> : showDot ? <span className={styles.dot} aria-hidden="true" /> : null}
      <span>{children}</span>
    </span>
  );
}
