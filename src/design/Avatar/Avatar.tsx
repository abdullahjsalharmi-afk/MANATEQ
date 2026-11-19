import { cx } from '../cx';
import styles from './Avatar.module.css';
import { initials } from './initials';

export interface AvatarProps {
  /** The person's or company's name; the avatar shows its initials. */
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** `accent` for the signed-in investor, `gold` for a verified entity. */
  tone?: 'neutral' | 'accent' | 'gold';
  /** Give the avatar a name for screen readers; without it it is decoration beside the written name. */
  label?: string;
  className?: string;
}

/** Initials in a circle. */
export function Avatar({ name, size = 'md', tone = 'neutral', label, className }: AvatarProps) {
  return (
    <span className={cx(styles.avatar, styles[size], styles[tone], className)} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      {initials(name)}
    </span>
  );
}
