/**
 * Pieces shared by the in-zone flows (D1 maintenance, D2 gate pass, D3 emergency): the large option
 * card, the confirmation tile, the reference capsule and the loading and failure states. The head of a
 * step is the design system's `StepHead`.
 */
import { CircleAlert, CircleCheck, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useT } from '@/app/i18n';
import { back } from '@/app/router';
import { Button, Card, Icon, Screen, Tile, cx } from '@/design/core';
import { EmptyState, Skeleton } from '@/design/forms';
import styles from './Parts.module.css';
import { partsStrings } from './strings';

export interface OptionCardProps {
  icon: LucideIcon;
  label: string;
  /** One short line under the label. */
  detail?: string;
  /** Whether this option is the chosen one. */
  selected: boolean;
  /** Chooses this option (a tap, Enter or Space, or an arrow key of the group). */
  onClick: () => void;
  /** Taller card with a larger glyph (the emergency types). */
  size?: 'md' | 'lg';
}

/**
 * A large option card: a glyph and a word, one radio (`Card choice`) of a `CardChoiceGroup` around the
 * `Grid` of cards. Chosen is the 2 px focus-colour border.
 */
export function OptionCard({ icon, label, detail, selected, onClick, size = 'md' }: OptionCardProps) {
  return (
    <Card choice selected={selected} onClick={onClick} pad="sm" className={cx(styles.option, size === 'lg' && styles.optionLarge)}>
      <span className={cx(styles.optionIcon, selected && styles.optionIconOn)} aria-hidden="true">
        <Icon icon={icon} size={size === 'lg' ? 32 : 26} />
      </span>
      <span className={styles.optionText}>
        <span className={styles.optionLabel}>{label}</span>
        {detail ? <span className={styles.optionDetail}>{detail}</span> : null}
      </span>
    </Card>
  );
}

/** A reference number in a pearl capsule, always left-to-right. */
export function RefCapsule({ value }: { value: string }) {
  const t = useT(partsStrings);
  return (
    <p className={styles.ref}>
      <span className="visually-hidden">{t('reference')} </span>
      <span className={cx(styles.capsule, 'ltr num')}>{value}</span>
    </p>
  );
}

export interface ConfirmationTileProps {
  headline: string;
  tagline?: string;
  reference?: string;
  icon?: LucideIcon;
  children?: ReactNode;
}

/** The confirmation: a white tile with a 44 px accent check, the headline, one line and the reference. */
export function ConfirmationTile({ headline, tagline, reference, icon = CircleCheck, children }: ConfirmationTileProps) {
  return (
    <Tile
      tone="light"
      lead={
        <span className={styles.check} aria-hidden="true">
          <Icon icon={icon} size={44} strokeWidth={1.5} />
        </span>
      }
      headline={headline}
      tagline={tagline}
    >
      <div aria-live="polite" className={styles.tileBody}>
        {reference ? <RefCapsule value={reference} /> : null}
        {children}
      </div>
    </Tile>
  );
}

/** While the service's workflow loads: the bar and a few quiet blocks. */
export function FlowLoading({ title }: { title: string }) {
  const t = useT(partsStrings);
  return (
    <Screen title={title} nav="close" navLabel={t('close')} width="form">
      <div className={styles.loading} aria-busy="true">
        <Skeleton variant="text" count={1} height={34} label={t('loading')} />
        <Skeleton variant="block" count={3} height={96} />
      </div>
    </Screen>
  );
}

/** When the service's workflow could not be loaded. */
export function FlowFailed({ title }: { title: string }) {
  const t = useT(partsStrings);
  return (
    <Screen title={title} nav="close" navLabel={t('close')} width="form">
      <EmptyState
        icon={CircleAlert}
        title={t('failedTitle')}
        body={t('failedBody')}
        action={<Button onClick={() => window.location.reload()}>{t('retry')}</Button>}
      />
    </Screen>
  );
}

/** Leaves a flow: back to where the investor came from, or Home. */
export function leaveFlow(): void {
  back('/');
}
