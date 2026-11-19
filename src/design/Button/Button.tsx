import type { LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from '@/app/router';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch to the full width of the container. */
  block?: boolean;
  /** Shows a spinner and blocks presses while something is in progress. */
  loading?: boolean;
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
  /** Mirror the trailing icon in right-to-left layouts (for arrows). */
  flipIcons?: boolean;
  /** Render as an in-app link to this route instead of a button. */
  to?: string;
}

/** The app's button. Use one `primary` per screen. */
export function Button({ children, variant = 'primary', size = 'lg', block = false, loading = false, icon, trailingIcon, flipIcons = false, to, className, disabled, type, ...rest }: ButtonProps) {
  const classes = cx(styles.button, styles[variant], styles[size], block && styles.block, loading && styles.loading, className);
  const iconSize = size === 'sm' ? 16 : 20;
  const content = (
    <>
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon ? <Icon icon={icon} size={iconSize} /> : null}
      <span className={styles.label}>{children}</span>
      {trailingIcon && !loading ? <Icon icon={trailingIcon} size={iconSize} flip={flipIcons} /> : null}
    </>
  );
  if (to !== undefined && !disabled && !loading) {
    return (
      <Link to={to} className={classes} aria-label={rest['aria-label']} data-block={block || undefined}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type ?? 'button'} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} data-block={block || undefined} {...rest}>
      {content}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> {
  icon: LucideIcon;
  /** Required: what the button does, for screen readers and tooltips. */
  label: string;
  /** `plain` has no background; `soft` sits on a quiet circle. */
  variant?: 'plain' | 'soft';
  flip?: boolean;
  /** A small count or dot on the corner. */
  badge?: number | boolean;
  to?: string;
}

/** A 44 px round button that holds only an icon. */
export function IconButton({ icon, label, variant = 'plain', flip = false, badge, to, className, type, ...rest }: IconButtonProps) {
  const classes = cx(styles.iconButton, variant === 'soft' && styles.soft, className);
  const content = (
    <>
      <Icon icon={icon} flip={flip} />
      {badge ? (
        <span className={cx(styles.badge, badge === true && styles.dot)} aria-hidden="true">
          {typeof badge === 'number' ? (badge > 9 ? '9+' : badge) : null}
        </span>
      ) : null}
    </>
  );
  if (to !== undefined) {
    return (
      <Link to={to} className={classes} aria-label={label} title={label}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type ?? 'button'} className={classes} aria-label={label} title={label} {...rest}>
      {content}
    </button>
  );
}
