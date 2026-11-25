import type { LucideIcon } from 'lucide-react';
import { cx } from '../cx';
import styles from './Icon.module.css';

export interface IconProps {
  icon: LucideIcon;
  /** Pixel size of the icon box. Default 22; use 20 to 22 beside text, 16 for chevrons. */
  size?: number;
  /** Mirror the icon in right-to-left layouts (arrows, chevrons, anything that points). */
  flip?: boolean;
  /** Give the icon a name for screen readers; without it the icon is decorative. */
  label?: string;
  /** Stroke weight on the 24-unit grid. Default 1.5. */
  strokeWidth?: number;
  className?: string;
}

/**
 * A line icon in the current text colour. Icons are functional (a row's leading glyph, a bar action):
 * never decoration, and never set inside a tinted shape.
 */
export function Icon({ icon: Glyph, size = 22, flip = false, label, strokeWidth = 1.5, className }: IconProps) {
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
