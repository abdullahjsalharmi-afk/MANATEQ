import { CircleAlert } from 'lucide-react';
import { useLang, useT } from '@/app/i18n';
import { getService, requestLabelOf } from '@/data/catalog';
import { Pill, Row } from '@/design/core';
import type { RequestState } from '@/domain/types';
import type { RequestView } from '@/state';
import { hasDayClock } from './logic';
import { RequestRing } from './RequestRing';
import { strings } from './strings';
import { useHolderWords, useRequestView } from './useRequestFacts';

export interface RequestRowProps {
  request: RequestState;
  /** The current time (pass the value of useNow()). */
  now: number;
}

const HOUR = 3_600_000;

/** The second line of a request row: who has it and how far along the standard it is (or when to expect it), or when it ended. */
export function useRowSubtitle(): (request: RequestState, view: RequestView | undefined, now: number) => string {
  const t = useT(strings);
  const { fmt } = useLang();
  const words = useHolderWords();
  return (request, view, now) => {
    if (request.status === 'done') return t('completedOn', { date: fmt.date(view?.finishedAt ?? request.updatedAt) });
    if (request.status === 'stopped') return t('closedOn', { date: fmt.date(view?.finishedAt ?? request.updatedAt) });
    if (!view?.holder) return request.status === 'needs_you' ? t('needsYou') : t('statusActive');
    if (view.holder.lane === 'inv') return t('withYouAgo', { ago: fmt.relative(view.heldSince ?? request.updatedAt, now) });
    const where = words.phrase(view.holder);
    const { clock } = view;
    if (hasDayClock(clock)) return `${where} · ${t('dayOf', { n: fmt.num(clock.dayNumber), m: fmt.num(clock.targetDays ?? 0) })}`;
    if (view.expectedAt !== undefined && view.expectedAt - now > HOUR) return `${where} · ${t('expectedShort', { when: fmt.relative(view.expectedAt, now) })}`;
    return where;
  };
}

/** One request in a list: its name, who holds it now, the service-standard ring, a link to its page. */
export function RequestRow({ request, now }: RequestRowProps) {
  const t = useT(strings);
  const { pick } = useLang();
  const view = useRequestView(request, now);
  const subtitle = useRowSubtitle();
  const summary = getService(request.serviceId);
  return (
    <Row
      to={`/requests/${request.id}`}
      title={(summary ? pick(requestLabelOf(summary)) : '') || request.ref}
      subtitle={subtitle(request, view, now)}
      leading={<RequestRing request={request} view={view} size="sm" />}
      eyebrow={
        request.status === 'needs_you' ? (
          <Pill tone="warn" icon={CircleAlert}>
            {t('needsYou')}
          </Pill>
        ) : undefined
      }
      wrap
    />
  );
}
