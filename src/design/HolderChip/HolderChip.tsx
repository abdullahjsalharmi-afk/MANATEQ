import { HardHat, Landmark, Smartphone, UserRound, UsersRound, Zap, type LucideIcon } from 'lucide-react';
import { useCallback } from 'react';
import { useLang, useT } from '@/app/i18n';
import { reference } from '@/data/catalog';
import type { Lane } from '@/data/types';
import { cx } from '../cx';
import { Icon } from '../Icon/Icon';
import styles from './HolderChip.module.css';
import { strings } from './strings';

export const LANE_ICON: Record<Lane, LucideIcon> = {
  inv: UserRound,
  one: Smartphone,
  eng: Zap,
  staff: UsersRound,
  nat: Landmark,
  field: HardHat,
};

/**
 * Returns `label(lane, name?)`: the words for whoever holds a step.
 * `voice: 'now'` answers "who has it now?" ("عندك"); `voice: 'by'` names who does a step ("أنت").
 */
export function useHolderLabel(): (lane: Lane, name?: string, voice?: 'now' | 'by') => string {
  const t = useT(strings);
  const { pick } = useLang();
  return useCallback(
    (lane: Lane, name?: string, voice: 'now' | 'by' = 'now') => {
      switch (lane) {
        case 'inv':
          return voice === 'now' ? t('you') : t('youShort');
        case 'one':
          return pick(reference.lanes.one.short);
        case 'eng':
          return t('automatic');
        case 'staff':
          return name || pick(reference.lanes.staff.short);
        case 'nat':
          return name || t('government');
        case 'field':
          return name || t('field');
      }
    },
    [t, pick],
  );
}

export interface HolderChipProps {
  /** Who holds the request. */
  lane: Lane;
  /** The entity's own name when the step names one, e.g. "وزارة البلدية". */
  name?: string;
  /** `sm` for list rows, `md` for headers and the current step. */
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * "Who has it now?" — an icon and a few words. Only "with you" is loud; every other holder is quiet,
 * because nothing is being asked of the investor.
 */
export function HolderChip({ lane, name, size = 'md', className }: HolderChipProps) {
  const t = useT(strings);
  const label = useHolderLabel();
  return (
    <span className={cx(styles.chip, styles[size], lane === 'inv' && styles.you, className)} data-lane={lane}>
      <Icon icon={LANE_ICON[lane]} size={size === 'sm' ? 13 : 15} strokeWidth={2} />
      <span className="visually-hidden">{t('question')} </span>
      <span className={styles.label}>{label(lane, name)}</span>
    </span>
  );
}
