import { useLang, useT } from '@/app/i18n';
import { Ring, type RingSize } from '@/design/signature';
import type { RequestState } from '@/domain/types';
import type { RequestView } from '@/state';
import styles from './RequestRing.module.css';
import { strings } from './strings';

export interface RequestRingProps {
  request: RequestState;
  view: RequestView | undefined;
  size?: RingSize;
}

/**
 * The service-standard clock of a request as a ring: the share of the standard used, a tick when the
 * request is done. A standard with no duration in days has no ring: a neutral dot stands in its place.
 */
export function RequestRing({ request, view, size = 'sm' }: RequestRingProps) {
  const t = useT(strings);
  const { fmt } = useLang();
  const done = request.status === 'done';
  const clock = view?.clock;

  if (done) return <Ring value={1} complete size={size} label={t('ringDone')} />;
  if (!clock || clock.ratio === null || clock.targetDays === null || request.status === 'stopped') {
    return (
      <span className={styles.slot} data-size={size}>
        <span className={styles.dot} role="img" aria-label={t('ringNone')} />
      </span>
    );
  }
  const day = clock.dayNumber;
  return (
    <Ring value={clock.ratio} size={size} label={t('ringDay', { n: fmt.num(day), m: fmt.num(clock.targetDays) })}>
      {clock.ratio > 1 ? undefined : fmt.num(day)}
    </Ring>
  );
}
