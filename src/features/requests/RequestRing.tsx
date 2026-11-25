import { X } from 'lucide-react';
import { useLang, useT } from '@/app/i18n';
import { Icon } from '@/design/core';
import { LANE_ICON, Ring, type RingSize } from '@/design/signature';
import type { RequestState } from '@/domain/types';
import type { RequestView } from '@/state';
import { hasDayClock } from './logic';
import { strings } from './strings';
import { useHolderWords } from './useRequestFacts';

export interface RequestRingProps {
  request: RequestState;
  view: RequestView | undefined;
  size?: RingSize;
}

const GLYPH: Record<RingSize, number> = { sm: 16, md: 22, lg: 32 };

/**
 * The service-standard clock of a request as a ring: the share of the standard used, a tick when the
 * request is done. A request without a day clock (a standard with no duration, one that promises each
 * status update, or a request waiting for the investor) keeps the same ring, idle, with the holder's
 * glyph inside: every row leads with the same mark.
 */
export function RequestRing({ request, view, size = 'sm' }: RequestRingProps) {
  const t = useT(strings);
  const { fmt } = useLang();
  const words = useHolderWords();
  const done = request.status === 'done';
  const clock = view?.clock;

  if (done) return <Ring value={1} complete size={size} label={t('ringDone')} />;
  if (request.status === 'stopped') {
    return (
      <Ring value={null} size={size} label={t('ringClosed')}>
        <Icon icon={X} size={GLYPH[size]} strokeWidth={1.75} />
      </Ring>
    );
  }
  const holder = view?.holder;
  if (!clock || !hasDayClock(clock) || holder?.lane === 'inv') {
    const lane = holder?.lane ?? (request.status === 'needs_you' ? 'inv' : undefined);
    const label = lane === 'inv' ? t('ringWithYou') : holder ? words.phrase(holder) : t('ringNone');
    return (
      <Ring value={null} size={size} label={label}>
        {lane ? <Icon icon={LANE_ICON[lane]} size={GLYPH[size]} strokeWidth={1.75} /> : undefined}
      </Ring>
    );
  }
  const day = clock.dayNumber;
  const target = clock.targetDays ?? 0;
  return (
    <Ring value={clock.ratio} size={size} label={t('ringDay', { n: fmt.num(day), m: fmt.num(target) })}>
      {(clock.ratio ?? 0) > 1 ? undefined : fmt.num(day)}
    </Ring>
  );
}
