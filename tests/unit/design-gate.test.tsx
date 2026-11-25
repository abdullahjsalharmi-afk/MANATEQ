// Regression tests for the release-gate findings of the design packet: relative time (n=9), the stopped
// timeline step (n=7), list rows that never crush their words (n=25-28, 30), the hero context (n=29),
// the search placeholder (n=33), the scroll padding that clears the pinned bars (n=22) and the pass card
// of a pass that starts later (n=16).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { LangProvider, makeFormatters } from '@/app/i18n';
import type { Lang } from '@/data/types';
import { List, Row } from '@/design/core';
import { hasWhole, keepWhole } from '@/design/List/keepWhole';
import { PassCard, Timeline, type TimelineItem } from '@/design/signature';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 25, 9, 0);
const css = (path: string) => readFileSync(resolve(__dirname, '../../src/design', path), 'utf8');
/** The declarations of the first rule whose selector is exactly `selector` (inside `scope` when given). */
function rule(source: string, selector: string, scope = ''): string {
  const from = scope ? source.indexOf(scope) : 0;
  expect(from).toBeGreaterThanOrEqual(0);
  const at = source.indexOf(`${selector} {`, from);
  expect(at).toBeGreaterThanOrEqual(0);
  return source.slice(at, source.indexOf('}', at));
}

function still(node: ReactNode, lang: Lang = 'ar'): HTMLElement {
  const box = document.createElement('div');
  box.innerHTML = renderToStaticMarkup(<LangProvider lang={lang}>{node}</LangProvider>);
  return box;
}

describe('relative time (n=9)', () => {
  const en = makeFormatters('en');
  const ar = makeFormatters('ar');

  it('uses words only for one day either way', () => {
    expect(en.relative(NOW + DAY, NOW)).toBe('tomorrow');
    expect(en.relative(NOW - DAY, NOW)).toBe('yesterday');
    expect(ar.relative(NOW + DAY, NOW)).toBe('غدًا');
    expect(ar.relative(NOW - DAY, NOW)).toBe('أمس');
  });

  it('counts days up to 60 days', () => {
    expect(en.relative(NOW + 5 * DAY, NOW)).toBe('in 5 days');
    expect(en.relative(NOW + 45 * DAY, NOW)).toBe('in 45 days');
    expect(en.relative(NOW + 60 * DAY, NOW)).toBe('in 60 days');
    expect(en.relative(NOW - 60 * DAY, NOW)).toBe('60 days ago');
    expect(ar.relative(NOW + 45 * DAY, NOW)).toBe('خلال 45 يومًا');
  });

  it('counts months from 61 days up to 24 months, never "next month" or "next year"', () => {
    expect(en.relative(NOW + 61 * DAY, NOW)).toBe('in 2 months');
    expect(en.relative(NOW + 300 * DAY, NOW)).toBe('in 10 months');
    // 5 Mar 2028 seen from 25 Nov 2026: the renewed AK-113 lease of the finding.
    expect(en.relative(Date.UTC(2028, 2, 5), NOW)).toBe('in 15 months');
    expect(ar.relative(Date.UTC(2028, 2, 5), NOW)).toBe('خلال 15 شهرًا');
    expect(en.relative(NOW - 400 * DAY, NOW)).toBe('13 months ago');
    expect(ar.relative(NOW - 400 * DAY, NOW)).toBe('قبل 13 شهرًا');
    expect(en.relative(NOW + 24 * 30.44 * DAY, NOW)).toBe('in 24 months');
    for (const days of [61, 90, 200, 365, 466, 700]) {
      for (const sign of [1, -1]) {
        const text = en.relative(NOW + sign * days * DAY, NOW);
        expect(text).not.toMatch(/next|last|this/);
        expect(text).toMatch(/\d/);
      }
    }
  });

  it('counts years beyond 24 months', () => {
    expect(en.relative(NOW + 25 * 30.44 * DAY, NOW)).toBe('in 2 years');
    expect(en.relative(NOW + 1100 * DAY, NOW)).toBe('in 3 years');
    expect(en.relative(NOW - 1100 * DAY, NOW)).toBe('3 years ago');
    expect(ar.relative(NOW + 1100 * DAY, NOW)).toBe('خلال 3 سنوات');
    expect(ar.relative(NOW - 7300 * DAY, NOW)).toBe('قبل 20 سنة');
  });

  it('keeps hours and minutes as they were', () => {
    expect(en.relative(NOW + 3 * 3_600_000, NOW)).toBe('in 3 hours');
    expect(en.relative(NOW - 5 * 60_000, NOW)).toBe('5 minutes ago');
  });
});

const withdrawn: TimelineItem[] = [
  { id: 1, title: 'You reported the fault', lane: 'inv', state: 'done', time: '20 Nov, 9:00 am' },
  { id: 2, title: 'Assigned to the field team', lane: 'staff', state: 'done', time: '20 Nov, 9:10 am' },
  { id: 3, title: 'Crew fixes; closes with photo and checklist', lane: 'field', state: 'stopped', time: '20 Nov, 10:21 am' },
];

describe('Timeline: the stopped step (n=7)', () => {
  it('never reads as done and shows no completion time', () => {
    const box = still(<Timeline items={withdrawn} />, 'en');
    const last = [...box.querySelectorAll('ol > li')][2];
    expect(last?.getAttribute('data-state')).toBe('stopped');
    expect(last?.querySelector('.visually-hidden')?.textContent).toBe('Stopped: ');
    expect(last?.textContent).not.toContain('Done');
    expect(last?.textContent).not.toContain('10:21');
    expect(last?.textContent).toContain('The request stopped at this step');
    expect(box.querySelectorAll('[aria-current="step"]')).toHaveLength(0);
  });

  it('speaks Arabic', () => {
    const box = still(<Timeline items={withdrawn} />, 'ar');
    const last = [...box.querySelectorAll('ol > li')][2];
    expect(last?.querySelector('.visually-hidden')?.textContent).toBe('متوقفة: ');
    expect(last?.textContent).not.toContain('مكتملة');
  });

  it('counts a stopped step as past when folding a closed request', () => {
    const steps: TimelineItem[] = [
      ...[1, 2, 3, 4, 5].map((id) => ({ id, title: `Step ${id}`, lane: 'eng' as const, state: 'done' as const })),
      { id: 6, title: 'Step 6', lane: 'field', state: 'stopped' },
    ];
    const box = still(<Timeline items={steps} collapsedCount={2} />, 'en');
    // a finished request keeps its last two steps; the stopped one is among them
    expect(box.querySelectorAll('ol > li')).toHaveLength(2);
    expect(box.querySelector('button')?.textContent).toContain('(4)');
  });

  it('draws a neutral hollow marker and muted words', () => {
    const source = css('Timeline/Timeline.module.css');
    expect(rule(source, '.stopped .dot')).toMatch(/border: 1\.5px solid var\(--ink-3\)/);
    expect(rule(source, '.stopped .title')).toMatch(/color: var\(--ink-3\)/);
  });
});

describe('List rows (n=25-28, 30)', () => {
  it('keeps the words and the trailing value in one wrapping group, the chevron outside it', () => {
    const box = still(
      <List>
        <Row title="Payments" trailing="QAR 37,500" onClick={() => undefined} chevron />
      </List>,
      'en',
    );
    const body = box.querySelector('button > span');
    const [main, chevron] = [...(body?.children ?? [])];
    expect(main?.children).toHaveLength(2);
    expect(main?.children[0]?.textContent).toBe('Payments');
    expect(main?.children[1]?.textContent).toBe('QAR 37,500');
    expect(chevron?.tagName.toLowerCase()).toBe('svg');
  });

  it('lets the trailing value wrap under the words instead of crushing them', () => {
    const source = css('List/List.module.css');
    expect(rule(source, '.main')).toMatch(/flex-wrap: wrap/);
    const text = rule(source, '.text');
    // never below a readable measure, nor below its longest word (break-word keeps that as the minimum)
    expect(text).toMatch(/flex: 1 1 var\(--row-measure\)/);
    expect(text).toMatch(/overflow-wrap: break-word/);
    expect(text).not.toMatch(/min-width: 0/);
    expect(rule(source, '.subtitle')).toMatch(/contain: inline-size/);
    const trailing = rule(source, '.trailing');
    expect(trailing).toMatch(/max-width: 100%/);
    expect(trailing).toMatch(/margin-inline-start: auto/);
    expect(trailing).not.toMatch(/max-width: 60%/);
  });

  it('wraps a subtitle in full, never clamped', () => {
    const source = css('List/List.module.css');
    expect(rule(source, '.wrap')).not.toMatch(/line-clamp/);
  });

  it('wraps a subtitle with a date or a reference by default', () => {
    expect(hasWhole('Paid on 27 Aug 2026')).toBe(true);
    expect(hasWhole('RCP-2026-0047')).toBe(true);
    expect(hasWhole('Enquiry & lead management')).toBe(false);
    expect(hasWhole(42)).toBe(false);
    const box = still(
      <List>
        <Row title="Rent" subtitle="Paid on 27 Aug 2026 · RCP-2026-0049" />
        <Row title="Ask about land" subtitle="Enquiry & lead management" />
        <Row title="Ask about land" subtitle="Enquiry & lead management" wrap />
      </List>,
      'en',
    );
    const subtitles = [...box.querySelectorAll('li')].map((li) => li.querySelector('span > span > span:nth-child(2)')?.className ?? '');
    expect(subtitles[0]).toMatch(/wrap/);
    expect(subtitles[1]).not.toMatch(/wrap/);
    expect(subtitles[2]).toMatch(/wrap/);
  });
});

describe('the hero context (n=29)', () => {
  it('wraps up to three lines on phones and keeps one line from 834 px', () => {
    const source = css('NextStepCard/NextStepCard.module.css');
    expect(rule(source, '.heroContext')).toMatch(/-webkit-line-clamp: 3/);
    expect(rule(source, '.heroContext', '@media (min-width: 834px)')).toMatch(/-webkit-line-clamp: 1/);
  });
});

describe('the search placeholder (n=33)', () => {
  it('ends in an ellipsis when it does not fit', () => {
    const source = css('SearchField/SearchField.module.css');
    expect(rule(source, '.input')).toMatch(/text-overflow: ellipsis/);
    expect(rule(source, '.input::placeholder')).toMatch(/text-overflow: ellipsis/);
  });
});

describe('scroll padding (n=22)', () => {
  it('clears the action bar and the tab bar at the end, the bars on top at the start', () => {
    const source = css('base.css');
    const html = rule(source, 'html');
    expect(html).toMatch(/scroll-padding-block-end: calc\(var\(--chrome-bottom\) \+ var\(--actionbar-h, 0px\)/);
    expect(html).toMatch(/scroll-padding-block-start: calc\(var\(--chrome-top\)/);
  });
});

describe('the pass card of a pass that starts later (n=16)', () => {
  const card = (status: 'active' | 'upcoming' | 'expired' | 'revoked', lang: Lang) =>
    still(<PassCard kind="worker" holder="Demo Worker" zone="Birkat Al Awamer" plot="BA-121" validFrom="1 Dec 2026, 12:00 am" validTo="10 Dec 2026, 11:59 pm" status={status} code="MQP-1" />, lang);

  it('says upcoming in its badge, never active, and when the code starts to open the gate', () => {
    const en = card('upcoming', 'en');
    expect(en.querySelector('article')?.getAttribute('data-status')).toBe('upcoming');
    expect(en.textContent).toContain('Upcoming');
    expect(en.textContent).not.toContain('Active');
    expect(en.textContent?.replace(/\u00a0/g, ' ')).toContain('Show this code at the gate from 1 Dec 2026, 12:00 am');
    expect(en.textContent).not.toContain('no longer opens the gate');
    const ar = card('upcoming', 'ar');
    expect(ar.textContent).toContain('قادم');
    expect(ar.textContent).not.toContain('سارٍ');
  });

  it('is not drawn as spent: only a pass that is over is muted', () => {
    const spent = (status: 'active' | 'upcoming' | 'expired' | 'revoked') => /spent/.test(card(status, 'en').querySelector('article')?.className ?? '');
    expect(spent('upcoming')).toBe(false);
    expect(spent('active')).toBe(false);
    expect(spent('expired')).toBe(true);
    expect(spent('revoked')).toBe(true);
  });

  it('keeps the wording of the other states', () => {
    expect(card('active', 'en').textContent).toContain('Show this code at the gate');
    expect(card('active', 'en').textContent).not.toContain('gate from');
    expect(card('expired', 'en').textContent).toContain('This pass no longer opens the gate');
  });
});

describe('a range of numbers stays whole (second look)', () => {
  const wholes = (text: string) => [...still(<p>{keepWhole(text)}</p>, 'en').querySelectorAll('p > span')].map((span) => span.textContent);

  it('keeps «4–9» and "10-18" on one line, with the codes, dates and times as before', () => {
    expect(wholes('Digitisation and integration, months 4–9.')).toEqual(['4–9']);
    expect(wholes('الخطوات 10–18 بعد الترخيص')).toEqual(['10–18']);
    expect(wholes('Plot BA-121, due 30 Nov 2026 at 6:00 pm, steps 2-5')).toEqual(['BA-121', '30 Nov 2026', '6:00 pm', '2-5']);
    expect(wholes('RCP-2026-0051')).toEqual(['RCP-2026-0051']);
  });

  it('does not make a row subtitle wrap by default', () => {
    expect(hasWhole('months 4–9')).toBe(false);
    expect(hasWhole('due 30 Nov 2026')).toBe(true);
  });
});
