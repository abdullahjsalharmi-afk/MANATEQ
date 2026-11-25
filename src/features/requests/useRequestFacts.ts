import { useCallback } from 'react';
import { useLang, useT } from '@/app/i18n';
import { peekServiceDetail } from '@/data/catalog';
import type { L10n, ServiceDetail, ServiceId } from '@/data/types';
import type { Holder, RequestState } from '@/domain/types';
import { requestView, selectSpeed, useApp, useCatalogueReady, type RequestView } from '@/state';
import { entityNamesEn, requestNames, strings } from './strings';

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

/** A name without its bracketed part: "الهيئة العامة للجمارك (النديب)" → "الهيئة العامة للجمارك". */
const withoutBrackets = (name: string): string => name.replace(/\s*[(（][^()（）]+[)）]\s*$/, '').trim() || name;

/**
 * Who a national step is with, the same in both languages. The Arabic platform names carry their
 * entity in brackets; the English ones do not, so a known entity is named from `entityNamesEn`, and a
 * bracket that is not an entity (a system's own name) is dropped.
 */
export function nationalHolder(name: L10n, lang: 'ar' | 'en'): { headline: string; phrase: string } {
  const bracket = entityOf(name.ar);
  const known = bracket !== name.ar ? entityNamesEn[bracket] : undefined;
  if (lang === 'ar') {
    const entity = known ? bracket : withoutBrackets(name.ar);
    return { headline: entity, phrase: entity };
  }
  if (known) return known;
  const entity = withoutBrackets(name.en);
  return { headline: entity, phrase: entity };
}

/** The name of a request: a noun («طلب أرض»), not the call to action that starts one («قدّم طلب أرض»). */
export function useRequestName(): (serviceId: ServiceId, label: L10n | undefined) => string {
  const { pick } = useLang();
  return useCallback((serviceId, label) => {
    const named = requestNames[serviceId];
    return named ? pick(named) : label ? pick(label) : '';
  }, [pick]);
}

/** Words for whoever holds a request now, in the voice of the requests feature. */
export function useHolderWords(): HolderWords {
  const t = useT(strings);
  const { lang } = useLang();
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
          const name = nationalHolder(holder.name, lang).phrase;
          return name ? t('withEntity', { name }) : t('withGovernment');
        }
      }
    },
    [t, lang],
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
          return nationalHolder(holder.name, lang).headline || t('holderGovernment');
      }
    },
    [t, lang],
  );
  return { phrase, headline };
}
