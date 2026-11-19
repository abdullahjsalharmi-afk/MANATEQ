import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './Pill.module.css';

export type Tone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'info' | 'gold';

export interface PillProps {
  children: ReactNode;
  tone?: Tone;
  /** Status is never colour alone: give status pills an icon. */
  icon?: LucideIcon;
  /** `solid` is for the single most important state on a screen; default is a quiet tint. */
  solid?: boolean;
  className?: string;
}

/** A small label for a state or a category. */
export function Pill({ children, tone = 'neutral', icon, solid = false, className }: PillProps) {
  return (
    <span className={cx(styles.pill, styles[tone], solid && styles.solid, className)}>
      {icon ? <Icon icon={icon} size={13} strokeWidth={2} /> : null}
      <span>{children}</span>
    </span>
  );
}
