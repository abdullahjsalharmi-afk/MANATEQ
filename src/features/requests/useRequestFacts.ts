import { useCallback } from 'react';
import { useLang, useT } from '@/app/i18n';
import { peekServiceDetail } from '@/data/catalog';
import type { ServiceDetail } from '@/data/types';
import type { Holder, RequestState } from '@/domain/types';
import { requestView, selectSpeed, useApp, useCatalogueReady, type RequestView } from '@/state';
import { strings } from './strings';

/**
 * The live view of one request (holder, clock, timeline, pending action), or undefined while the
 * service's workflow is still loading. Pass the value of `useNow()` so it follows the simulation.
 */
export function useRequestView(request: RequestState | undefined, now: number, detail?: ServiceDetail): RequestView | undefined {
  useCatalogueReady();
  const speed = useApp(selectSpeed);
  if (!request) return undefined;
  const service = detail ?? peekServiceDetail(request.serviceId);
  return service ? requestView(request, service, now, speed) : undefined;
}

export interface HolderWords {
  /** "عند وزارة البلدية" · "With the Ministry of Municipality": for rows. */
  phrase: (holder: Holder) => string;
  /** The holder as a headline: "وزارة البلدية" · "بانتظار إجرائك". */
  headline: (holder: Holder) => string;
}

/**
 * The entity behind a national platform's name: "نظام رخص البناء (وزارة البلدية)" → "وزارة البلدية".
 * Names without an entity in brackets are kept whole.
 */
export function entityOf(name: string): string {
  const match = /[(（]([^()（）]+)[)）]\s*$/.exec(name);
  return match?.[1]?.trim() || name;
}

/** Words for whoever holds a request now, in the voice of the requests feature. */
export function useHolderWords(): HolderWords {
  const t = useT(strings);
  const { pick } = useLang();
  const phrase = useCallback(
    (holder: Holder): string => {
      switch (holder.lane) {
        case 'inv':
          return t('holderYou');
        case 'one':
          return t('withOne');
        case 'eng':
          return t('withEngine');
        case 'staff':
          return t('withStaff');
        case 'field':
          return t('withField');
        case 'nat': {
          const name = entityOf(pick(holder.name));
          return name ? t('withEntity', { name }) : t('withGovernment');
        }
      }
    },
    [t, pick],
  );
  const headline = useCallback(
    (holder: Holder): string => {
      switch (holder.lane) {
        case 'inv':
          return t('holderYou');
        case 'one':
          return t('holderOne');
        case 'eng':
          return t('holderEngine');
        case 'staff':
          return t('holderStaff');
        case 'field':
          return t('holderField');
        case 'nat':
          return entityOf(pick(holder.name)) || t('holderGovernment');
      }
    },
    [t, pick],
  );
  return { phrase, headline };
}
