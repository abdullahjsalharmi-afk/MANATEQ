import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LangProvider } from '@/app/i18n';
import { getService, getZone, loadServiceDetail, zones } from '@/data/catalog';
import type { ServiceSummary } from '@/data/types';
import { buildIndex, tokens } from '@/domain/search';
import { makeZoneNamer, namedPlot } from '@/features/search/rank';
import { makeServiceSearch, serviceSearch } from '@/features/services/catalogue';
import { plotGate, PLOT_GATE_ACTION, type PlotGateInput } from '@/features/services/plotGate';
import { ServiceRow } from '@/features/services/ServiceRow';
import { strings } from '@/features/services/strings';

const service = (id: string): ServiceSummary => {
  const found = getService(id);
  if (!found) throw new Error(`no service ${id}`);
  return found;
};

describe('search: English transliterations (gate n=20)', () => {
  it('reads a final h after a vowel and the article al- / el- / as- as the same name', () => {
    expect(tokens('Al Wakrah')).toEqual(tokens('Wakra'));
    expect(tokens('al-wakrah')).toEqual(tokens('Al Wakra'));
    expect(tokens('El Khor')).toEqual(tokens('Al Khor'));
    expect(tokens('As Salwa')).toEqual(['salwa']);
    // The article alone still searches, and other words keep their h.
    expect(tokens('Al')).toEqual(['al']);
    expect(tokens('cash')).toEqual(['cash']);
  });

  it('finds the Al Wakra park by its common spellings', () => {
    const index = buildIndex(zones.map((zone) => ({ item: zone.code, fields: [zone.name, zone.typeLabel, zone.operator], keys: [zone.code] })));
    for (const query of ['Al Wakrah', 'al-wakrah', 'Wakrah', 'Al Wakra', 'الوكرة']) expect(index.search(query)[0]).toBe('AW');
  });

  it('finds a plot of the park by the zone spelled with an h', () => {
    const zone = getZone('AW');
    const index = buildIndex([{ item: 'AW-116', fields: ['AW-116', zone?.name], keys: ['aw-116'] }]);
    expect(index.search('Al Wakrah')).toEqual(['AW-116']);
  });
});

describe('search: a query that names a zone (gate n=20)', () => {
  const namer = makeZoneNamer(zones);
  const codes = (query: string) => namer.named(query).map((zone) => zone.code);

  it('names the zone in Arabic and English, with or without the article and the final h', () => {
    expect(codes('أبا صليل')).toEqual(['AS']);
    expect(codes('ابا صليل')).toEqual(['AS']);
    expect(codes('Aba Saleel')).toEqual(['AS']);
    expect(codes('Al Wakrah')).toEqual(['AW']);
    expect(codes('الوكرة')).toEqual(['AW']);
    expect(codes('Umm Shaharaine')).toEqual(['US1', 'US2']);
    expect(codes('AW')).toEqual(['AW']);
  });

  it('does not take a kind of zone or a service word for a name', () => {
    expect(codes('Logistics Park')).toEqual([]);
    expect(codes('مجمّع لوجستي')).toEqual([]);
    expect(codes('gate pass')).toEqual([]);
    expect(codes('')).toEqual([]);
  });

  it('keeps only the services that match every word when the query names a zone', () => {
    // «أبا صليل»: a few services share one word with the name; they are not results for the place.
    expect(serviceSearch().search('أبا صليل', { forgive: false })).toEqual([]);
    // The forgiving pass is unchanged for everything else.
    expect(serviceSearch().search('ادفع فاتورة').map((s) => s.id)).toContain('B1');
    expect(makeServiceSearch().search('ادفع فاتورة', { forgive: false })).toEqual([]);
  });
});

describe('search: a query that names one of the investor’s plots (second look)', () => {
  const plots = [
    { id: 'BA-121', number: 'BA-121' },
    { id: 'AW-116', number: 'AW-116' },
    { id: 'AK-113', number: 'AK-113' },
  ];

  it('finds the plot by its number in any case, with or without the hyphen or a space', () => {
    for (const query of ['BA-121', 'ba-121', ' Ba 121 ', 'BA121', 'BA‑121', 'BA–121']) expect([query, namedPlot(plots, query)?.id]).toEqual([query, 'BA-121']);
    expect(namedPlot(plots, 'aw-116')?.id).toBe('AW-116');
  });

  it('does not take a zone code, a part of a number or other words for a plot', () => {
    for (const query of ['BA', '121', 'BA-12', 'BA-1211', 'rent', 'إيجار', '', '  ']) expect([query, namedPlot(plots, query)]).toEqual([query, undefined]);
  });

  it('puts the plot and its requests before the invoices on the results page', () => {
    const page = readFileSync(resolve(__dirname, '../../src/features/search/SearchScreen.tsx'), 'utf8');
    const named = page.slice(page.indexOf('{plotNamed ? ('), page.indexOf('{foundDocs.length || foundPasses.length ? ('));
    const [first, second] = named.split(') : (');
    expect(first?.indexOf('plotsSection')).toBeLessThan(first?.indexOf('paymentsSection') ?? -1);
    expect(first?.indexOf('requestsSection')).toBeLessThan(first?.indexOf('paymentsSection') ?? -1);
    expect(second?.indexOf('paymentsSection')).toBeLessThan(second?.indexOf('plotsSection') ?? -1);
    expect(page).toMatch(/request\.plotId === plotNamed\.id/);
  });
});

describe('search: an English word matches from its start, not inside another word (last look)', () => {
  const search = makeServiceSearch();

  it('"rent" finds the rent services and not "current" or "transparent"', () => {
    const found = search.search('rent');
    expect(found.map((service) => service.id)).toContain('B1');
    for (const service of found) {
      const text = `${service.label.en} ${service.name.en} ${service.summary.en} ${service.promise?.en ?? ''}`.toLowerCase();
      expect(/\brent/.test(text), `${service.id}: ${text.slice(0, 80)}`).toBe(true);
    }
  });

  it('still matches the start of a word, a whole word and Arabic inside a word', () => {
    expect(search.search('perm').length).toBeGreaterThan(0);
    expect(search.search('permit').length).toBeGreaterThan(0);
    // «إيجار» with the article and an attached preposition.
    const index = buildIndex([{ item: 'x', fields: ['سداد فواتير بالإيجار السنوي'] }]);
    expect(index.search('ايجار')).toEqual(['x']);
    // A number inside a reference.
    const refs = buildIndex([{ item: 'inv', fields: ['INV-2026-0051'] }]);
    expect(refs.search('0051')).toEqual(['inv']);
    expect(refs.search('005')).toEqual(['inv']);
  });
});

describe('plot services without a plot (gate n=21)', () => {
  const prospect: PlotGateInput = { persona: 'prospect', candidates: 0, hasPlots: false, active: [], hasCheck: true };

  it('does not offer Start for a plot service to a company with no plot it could be for', () => {
    for (const id of ['A8', 'B7', 'B8', 'C1', 'C6', 'D1', 'D7']) expect(plotGate(service(id), prospect)).toEqual({ kind: 'apply' });
    expect(plotGate(service('B7'), { ...prospect, hasCheck: false })).toEqual({ kind: 'check' });
    expect(plotGate(service('B7'), { ...prospect, active: [{ id: 'r1', serviceId: 'A5' }] })).toEqual({ kind: 'track', requestId: 'r1' });
    // A8 once every plot is handed over: the company holds plots, none of them for this service.
    expect(plotGate(service('A8'), { ...prospect, persona: 'tenant', hasPlots: true })).toEqual({ kind: 'plots' });
  });

  it('offers Start as before when a plot qualifies, to a guest, and for services open to prospects', () => {
    expect(plotGate(service('B7'), { ...prospect, persona: 'tenant', candidates: 2, hasPlots: true })).toBeNull();
    expect(plotGate(service('B7'), { ...prospect, persona: 'guest' })).toBeNull();
    expect(plotGate(service('A2'), prospect)).toBeNull();
    expect(plotGate(service('A4'), prospect)).toBeNull();
    // Automatic services have no Start to replace.
    expect(plotGate(service('B1'), prospect)).toBeNull();
  });

  it('counts a required plot field, once the detail is known (B6)', async () => {
    expect(plotGate(service('B6'), prospect)).toBeNull();
    const detail = await loadServiceDetail('B6');
    expect(plotGate(detail, prospect)).toEqual({ kind: 'apply' });
  });

  it('leads each way forward to its screen, with words in both languages', () => {
    expect(PLOT_GATE_ACTION.apply.to({ kind: 'apply' })).toBe('/start/A4');
    expect(PLOT_GATE_ACTION.check.to({ kind: 'check' })).toBe('/eligibility');
    expect(PLOT_GATE_ACTION.track.to({ kind: 'track', requestId: 'r9' })).toBe('/requests/r9');
    expect(PLOT_GATE_ACTION.plots.to({ kind: 'plots' })).toBe('/account/plots');
    for (const key of ['needsPlotContext', 'needsPlotNoneContext', 'needsPlotTag', 'needsPlotNoneTag', 'gateTrackLand', 'gateApplyLand', 'gateCheckFirst', 'gateViewPlots'] as const) {
      expect(strings[key].ar).toMatch(/\p{Script=Arabic}/u);
      expect(strings[key].en).toMatch(/[a-z]/);
      expect(`${strings[key].ar} ${strings[key].en}`).not.toMatch(/—|\bcase\b|\bticket\b/i);
    }
  });
});

describe('services list row (gate n=24, n=25)', () => {
  const render = (id: string, lang: 'ar' | 'en') =>
    renderToStaticMarkup(
      <LangProvider lang={lang}>
        <ul>
          <ServiceRow service={service(id)} />
        </ul>
      </LangProvider>,
    );

  it('puts the standard chip on its own line under the words, never beside them', () => {
    const html = render('A1', 'en');
    expect(html).toContain('Ask about land or warehouses');
    expect(html).toContain('Enquiry &amp; lead management');
    // Nothing in the trailing slot: the chips are part of the words' column, after the official name.
    expect(html).not.toMatch(/class="[^"]*trailing/);
    expect(html.indexOf('Enquiry')).toBeLessThan(html.indexOf('working day'));
  });

  it('lets the official name wrap in full instead of ending in an ellipsis', () => {
    // The Row's `wrap` subtitle: never clamped to one line.
    const html = render('A3', 'ar');
    expect(html).toMatch(/class="[^"]*subtitle[^"]*wrap/);
  });

  it('keeps the automatic tag with the chips', () => {
    const html = render('A5', 'en');
    expect(html.indexOf('working days')).toBeLessThan(html.indexOf('Automatic'));
  });
});
