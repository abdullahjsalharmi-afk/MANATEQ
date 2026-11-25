import { useCallback } from 'react';
import { useLang, useT } from '@/app/i18n';
import { peekServiceDetail } from '@/data/catalog';
import type { L10n, ServiceDetail } from '@/data/types';
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

/** A platform's name without its bracketed part: "الهيئة العامة للجمارك (النديب)" → "الهيئة العامة للجمارك". */
export const withoutBrackets = (name: string): string => name.replace(/\s*[(（][^()（）]+[)）]\s*$/, '').trim() || name;

/**
 * Who a national step is with, the same in both languages: the entity behind the platform when the state
 * names one (`holder.entity`, "Ministry of Municipality" / "the Ministry of Municipality"), else the
 * platform's own name without a bracketed system name.
 */
export function nationalHolder(holder: Pick<Holder, 'name' | 'entity'>, pick: (text: L10n) => string): { headline: string; phrase: string } {
  if (holder.entity) return { headline: pick(holder.entity.name), phrase: pick(holder.entity.inText) };
  const name = withoutBrackets(pick(holder.name));
  return { headline: name, phrase: name };
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
          const name = nationalHolder(holder, pick).phrase;
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
          return nationalHolder(holder, pick).headline || t('holderGovernment');
      }
    },
    [t, pick],
  );
  return { phrase, headline };
}
