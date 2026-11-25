import { useLang, useT } from '@/app/i18n';
import { getService } from '@/data/catalog';
import { Pill, Row } from '@/design/core';
import type { RequestState } from '@/domain/types';
import type { RequestView } from '@/state';
import { RequestRing } from './RequestRing';
import { strings } from './strings';
import { useHolderWords, useRequestView } from './useRequestFacts';

export interface RequestRowProps {
  request: RequestState;
  /** The current time (pass the value of useNow()). */
  now: number;
}

/** The second line of a request row: who has it and how far along the standard it is, or when it ended. */
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
    if (clock.ratio === null || clock.targetDays === null) return where;
    return `${where} · ${t('dayOf', { n: fmt.num(clock.dayNumber), m: fmt.num(clock.targetDays) })}`;
  };
}

/** One request in a list: plain label, who holds it now, the service-standard ring, a link to its page. */
export function RequestRow({ request, now }: RequestRowProps) {
  const t = useT(strings);
  const { pick } = useLang();
  const view = useRequestView(request, now);
  const subtitle = useRowSubtitle();
  const summary = getService(request.serviceId);
  return (
    <Row
      to={`/requests/${request.id}`}
      title={summary ? pick(summary.label) : request.ref}
      subtitle={subtitle(request, view, now)}
      leading={<RequestRing request={request} view={view} size="sm" />}
      eyebrow={request.status === 'needs_you' ? <Pill tone="accent">{t('needsYou')}</Pill> : undefined}
      wrap
    />
  );
}
