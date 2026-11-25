import { ChevronRight, type LucideIcon } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from '@/app/router';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './Button.module.css';

/**
 * `primary` accent pill · `secondary` ghost pill · `quiet` text link · `danger` the pill in the error colour ·
 * `utility` compact dark rectangle · `pearl` quiet light capsule.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'utility' | 'pearl';
/** `md` is the standard 17 px pill · `sm` the 14 px one · `lg` the rare, airy hero pill (one per hero tile at most). */
export type ButtonSize = 'lg' | 'md' | 'sm';

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  children: ReactNode;
  variant?: ButtonVariant;
  /** Default `md`. `utility` and `pearl` are always compact. */
  size?: ButtonSize;
  /** `danger` gives a pill, a ghost pill or a text link the error colour, for actions that remove or cancel. */
  tone?: 'accent' | 'danger';
  /** Stretch to the full width of the container (capped at 420 px on wide screens). */
  block?: boolean;
  /** Shows a spinner and blocks presses while something is in progress. The width does not change. */
  loading?: boolean;
  icon?: LucideIcon;
  trailingIcon?: LucideIcon;
  /** Mirror the trailing icon in right-to-left layouts (for arrows). */
  flipIcons?: boolean;
  /** A small forward chevron after the label. On by default for a `quiet` button that is a link. */
  chevron?: boolean;
  /** Render as an in-app link to this route instead of a button. */
  to?: string;
}

/** The app's button. One `primary` per screen; where two pills sit together the second is `secondary`. */
export function Button({
  children,
  variant = 'primary',
  size = 'md',
  tone,
  block = false,
  loading = false,
  icon,
  trailingIcon,
  flipIcons = false,
  chevron,
  to,
  className,
  disabled,
  type,
  ...rest
}: ButtonProps) {
  const compact = variant === 'utility' || variant === 'pearl';
  const shape = variant === 'danger' ? 'primary' : variant;
  const danger = variant === 'danger' || tone === 'danger';
  const scale = compact ? 'sm' : size;
  const showChevron = (chevron ?? (variant === 'quiet' && to !== undefined)) && !trailingIcon;
  const classes = cx(styles.button, styles[shape], styles[scale], danger && styles.danger, block && styles.block, loading && styles.loading, className);
  const iconSize = scale === 'sm' ? 16 : 20;
  const content = (
    <>
      <span className={styles.content}>
        {icon ? <Icon icon={icon} size={iconSize} /> : null}
        <span className={styles.label}>{children}</span>
        {trailingIcon ? <Icon icon={trailingIcon} size={iconSize} flip={flipIcons} /> : null}
        {showChevron ? <Icon icon={ChevronRight} size={scale === 'sm' ? 12 : 14} strokeWidth={2.25} flip className={styles.chevron} /> : null}
      </span>
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : null}
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
  /** `plain` has no background (on surfaces); `soft` sits on a translucent circle (on imagery, to close a sheet). */
  variant?: 'plain' | 'soft';
  /** The target is always 44 px. `sm` draws a 32 px circle and a smaller glyph inside it. */
  size?: 'md' | 'sm';
  flip?: boolean;
  /** A small count or dot on the corner. */
  badge?: number | boolean;
  to?: string;
}

/** A 44 px round button that holds only an icon. */
export function IconButton({ icon, label, variant = 'plain', size = 'md', flip = false, badge, to, className, type, ...rest }: IconButtonProps) {
  const classes = cx(styles.iconButton, variant === 'soft' && styles.soft, size === 'sm' && styles.iconSm, className);
  const content = (
    <>
      <Icon icon={icon} flip={flip} size={size === 'sm' ? 18 : 22} strokeWidth={size === 'sm' ? 1.75 : 1.5} />
      {badge ? (
        <span className={cx(styles.badge, badge === true && styles.dot)} aria-hidden="true">
          {typeof badge === 'number' ? (badge > 9 ? '9+' : badge) : null}
        </span>
      ) : null}
    </>
  );
  if (to !== undefined) {
    return (
      <Link to={to} className={classes} aria-label={label} title={label} data-icon-button={variant} data-size={size}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type ?? 'button'} className={classes} aria-label={label} title={label} data-icon-button={variant} data-size={size} {...rest}>
      {content}
    </button>
  );
}
