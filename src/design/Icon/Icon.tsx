import type { LucideIcon } from 'lucide-react';
import { cx } from '../cx';
import styles from './Icon.module.css';

export interface IconProps {
  icon: LucideIcon;
  /** Pixel size of the icon box. Default 22. */
  size?: number;
  /** Mirror the icon in right-to-left layouts (arrows, chevrons, anything that points). */
  flip?: boolean;
  /** Give the icon a name for screen readers; without it the icon is decorative. */
  label?: string;
  strokeWidth?: number;
  className?: string;
}

/** A line icon. One stroke weight across the app. */
export function Icon({ icon: Glyph, size = 22, flip = false, label, strokeWidth = 1.75, className }: IconProps) {
  return (
    <Glyph
      className={cx(styles.icon, flip && styles.flip, className)}
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth={false}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      focusable={false}
    />
  );
}
