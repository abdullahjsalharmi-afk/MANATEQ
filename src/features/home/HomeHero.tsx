import { useState } from 'react';
import { useLang, useT, type PluralForms } from '@/app/i18n';
import { navigate } from '@/app/router';
import { Button, List, Render, Row, Sheet, Tile } from '@/design/core';
import { NextStepCard } from '@/design/signature';
import type { NextStep, Persona } from '@/domain/types';
import type { StationKey } from '@/state';
import { invoiceOfStep, STATION_RENDER, suggestedService } from './logic';
import { strings } from './strings';

export interface HomeHeroProps {
  persona: Persona;
  /** Everything waiting for the investor, the most urgent first. */
  steps: NextStep[];
  station: StationKey;
  now: number;
  /** Whether the investor has a saved eligibility check. A prospect without one is sent to the check first. */
  checked: boolean;
  /** Pays an invoice here, in the payment sheet, when the next step is an invoice. */
  onPay: (invoiceId: string) => void;
}

/**
 * The top of Home: the one thing to do next, on the maroon brand tile. More than one step: a quiet link
 * opens them all. Nothing waiting: a calm white tile. A guest is welcomed and sent to the eligibility check.
 */
export function HomeHero({ persona, steps, station, now, checked, onPay }: HomeHeroProps) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const [listOpen, setListOpen] = useState(false);
  const next = steps[0];

  if (persona === 'guest') {
    return (
      <NextStepCard
        tone="hero"
        eyebrow={t('guestEyebrow')}
        title={t('guestTitle')}
        context={t('guestContext')}
        cta={{ label: t('guestCta'), to: '/eligibility' }}
        more={{ label: t('guestDemo'), onClick: () => navigate('/welcome') }}
        render="plot"
      />
    );
  }

  // A prospect with nothing under way and no saved check starts where every journey starts: the eligibility check.
  if (persona === 'prospect' && !checked && (!next || suggestedService(next) !== null)) {
    return <NextStepCard tone="hero" eyebrow={t('nextEyebrow')} title={t('guestCta')} context={t('guestContext')} cta={{ label: t('checkCta'), to: '/eligibility' }} render="plot" />;
  }

  if (!next) {
    return (
      <Tile
        tone="light"
        eyebrow={t('clearEyebrow')}
        headline={t('clearTitle')}
        tagline={t('clearTagline')}
        actions={<Button to="/services">{t('clearCta')}</Button>}
        media={<Render name="warehouse" eager decorative />}
      />
    );
  }

  const others = steps.length - 1;
  const moreForms: PluralForms = {
    ar: { one: t('moreOne'), two: t('moreTwo'), few: t('moreFew'), many: t('moreMany') },
    en: { one: t('moreFew'), other: t('moreFew') },
  };

  // An invoice is paid here, in the same sheet as the dues card; a suggestion gets one short line, not the catalogue summary.
  const invoiceId = invoiceOfStep(next);
  const suggestion = suggestedService(next);
  const context = suggestion === null ? pick(next.context) : t(suggestion === 'A4' && checked ? 'suggestLand' : 'suggestNext');

  return (
    <>
      <NextStepCard
        tone="hero"
        eyebrow={t('nextEyebrow')}
        title={pick(next.title)}
        context={context}
        due={next.dueAt !== undefined ? fmt.relative(next.dueAt, now) : undefined}
        cta={invoiceId ? { label: t('pay'), onClick: () => onPay(invoiceId) } : { label: pick(next.cta), to: next.route }}
        more={others > 0 ? { label: fmt.plural(others, moreForms), onClick: () => setListOpen(true) } : undefined}
        render={persona === 'prospect' ? 'plot' : STATION_RENDER[station]}
      />
      {others > 0 ? (
        <Sheet open={listOpen} onClose={() => setListOpen(false)} title={t('allStepsTitle')} description={t('allStepsBody')}>
          <List variant="plain">
            {steps.map((step) => (
              <Row
                key={step.id}
                to={step.route}
                title={pick(step.title)}
                subtitle={pick(step.context)}
                trailing={step.dueAt !== undefined ? fmt.relative(step.dueAt, now) : undefined}
                wrap
              />
            ))}
          </List>
        </Sheet>
      ) : null}
    </>
  );
}
