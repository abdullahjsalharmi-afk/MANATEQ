import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LangProvider } from '@/app/i18n';
import { Pill, type Tone } from '@/design/core';
import { StandardBadge } from '@/design/StandardBadge/StandardBadge';
import { NextStepCard } from '@/design/signature';

const html = (node: React.ReactNode) => renderToStaticMarkup(<LangProvider lang="en">{node}</LangProvider>);

describe('StandardBadge compact chip', () => {
  const perEvent = { ar: 'تأكيد عند التقديم', en: 'Confirmed on submission', value: null, unit: null };

  it('renders nothing without a headline duration or a fallback', () => {
    expect(html(<StandardBadge standard={perEvent} variant="compact" />)).toBe('');
  });

  it('shows the fallback, still marked indicative, so every card ends the same way', () => {
    const markup = html(<StandardBadge standard={perEvent} variant="compact" fallback="On submission" />);
    expect(markup).toContain('On submission');
    expect(markup).toContain('indicative');
  });
});

describe('Pill', () => {
  it('has no accent tone: a status is never drawn like something to press', () => {
    const tones: Tone[] = ['neutral', 'ok', 'warn', 'bad', 'info', 'gold'];
    // @ts-expect-error the accent is not a status tone (checked by tsc)
    const accent: Tone = 'accent';
    expect(tones).not.toContain(accent);
    expect(html(<Pill tone="warn">Needs you</Pill>)).toContain('Needs you');
  });
});

describe('NextStepCard hero', () => {
  it('keeps a code in the context whole and marks a hero with a render for the side-by-side layout', () => {
    const markup = html(<NextStepCard tone="hero" title="Pay your rent invoice" context="Rent, Q4 2026 · BA-121 · QAR 37,500" render="plot" />);
    expect(markup).toMatch(/<span class="[^"]*">BA-121<\/span>/);
    expect(markup).toMatch(/class="[^"]*withRender/);
  });
});
