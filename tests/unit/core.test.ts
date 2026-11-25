import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { House } from 'lucide-react';
import { createElement as h, type ComponentType, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { interpolate, LangProvider, langTools } from '@/app/i18n';
import { buildTarget, matchPath, parseTarget } from '@/app/router';
import { createStore, shallowEqual } from '@/app/store';
import type { Lang } from '@/data/types';
import * as core from '@/design/core';
import { Button, Card, Chip, Container, Footer, GlobalNav, Grid, IconButton, Mark, Pill, Render, RENDER_NAMES, Screen, Segmented, TabBar, Tile } from '@/design/core';
import { markStroke } from '@/design/Mark/Mark';
import { ActionBar, ScreenBar } from '@/design/Screen/Screen';
import { buildIndex, normalise, tokens } from '@/domain/search';

describe('formatting', () => {
  const ar = langTools('ar');
  const en = langTools('en');

  it('uses Western digits in both languages', () => {
    expect(ar.fmt.num(18750)).toBe('18,750');
    expect(en.fmt.num(18750)).toBe('18,750');
  });

  it('formats money and areas', () => {
    expect(ar.fmt.money(18750)).toBe('18,750 ر.ق');
    expect(en.fmt.money(18750)).toBe('QAR 18,750');
    expect(ar.fmt.area(5000)).toBe('5,000 م²');
    expect(en.fmt.areaShort(48_627_455)).toBe('48.6M m²');
    expect(ar.fmt.areaShort(48_627_455)).toBe('48.6 مليون م²');
  });

  it('formats dates in the Gregorian calendar', () => {
    const day = Date.UTC(2026, 10, 19, 9, 0, 0);
    expect(ar.fmt.date(day)).toContain('2026');
    expect(ar.fmt.date(day)).toContain('نوفمبر');
    expect(en.fmt.date(day)).toBe('19 Nov 2026');
  });

  it('picks Arabic plural forms', () => {
    const forms = { ar: { one: 'يوم واحد', two: 'يومان', few: '{n} أيام', many: '{n} يومًا' }, en: { one: '{n} day', other: '{n} days' } };
    expect(ar.fmt.plural(1, forms)).toBe('يوم واحد');
    expect(ar.fmt.plural(2, forms)).toBe('يومان');
    expect(ar.fmt.plural(5, forms)).toBe('5 أيام');
    expect(ar.fmt.plural(14, forms)).toBe('14 يومًا');
    expect(en.fmt.plural(1, forms)).toBe('1 day');
    expect(en.fmt.plural(3, forms)).toBe('3 days');
  });

  it('interpolates and picks', () => {
    expect(interpolate('{a} of {b}', { a: 2, b: 5 })).toBe('2 of 5');
    expect(ar.pick({ ar: 'مرحبًا', en: 'Hello' })).toBe('مرحبًا');
    expect(en.pick({ ar: 'مرحبًا', en: '' })).toBe('مرحبًا');
    expect(ar.pick(null)).toBe('');
  });
});

describe('routes', () => {
  it('parses and builds targets', () => {
    expect(parseTarget('#/services/A4?plot=p1&from=home')).toEqual({ path: '/services/A4', query: { plot: 'p1', from: 'home' } });
    expect(parseTarget('')).toEqual({ path: '/', query: {} });
    expect(buildTarget('/start/A4', { plot: 'p1', empty: '' })).toBe('/start/A4?plot=p1');
  });

  it('matches patterns', () => {
    expect(matchPath('/services/:id', '/services/A4')).toEqual({ id: 'A4' });
    expect(matchPath('/services/:id', '/services')).toBeNull();
    expect(matchPath('/', '/')).toEqual({});
  });
});

describe('store', () => {
  it('notifies subscribers once per change', () => {
    const store = createStore({ n: 0 });
    let calls = 0;
    const stop = store.subscribe(() => calls++);
    store.setState((s) => ({ n: s.n + 1 }));
    store.setState((s) => s);
    stop();
    store.setState((s) => ({ n: s.n + 1 }));
    expect(calls).toBe(1);
    expect(store.getState().n).toBe(2);
  });

  it('compares shallowly', () => {
    expect(shallowEqual([1, 2], [1, 2])).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 1 })).toBe(true);
    expect(shallowEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(shallowEqual([1], { 0: 1 })).toBe(false);
  });
});

describe('search', () => {
  it('normalises Arabic spelling variants', () => {
    expect(normalise('الإيجارُ')).toBe(normalise('الايجار'));
    expect(normalise('رخصة')).toBe(normalise('رخصه'));
    expect(tokens('فاتورة الإيجار')).toEqual(['فاتوره', 'ايجار']);
  });

  it('finds items in either language and ranks titles first', () => {
    const index = buildIndex([
      { item: 'B1', fields: [{ ar: 'ادفع فاتورة الإيجار', en: 'Pay a rent invoice' }, { ar: 'فوترة الإيجار والدفع الإلكتروني', en: 'Rent invoicing' }], keys: ['B1'] },
      { item: 'B3', fields: [{ ar: 'جدّد عقدك', en: 'Renew your lease' }, { ar: 'تجديد عقد الإيجار', en: 'Lease renewal' }], keys: ['B3'] },
      { item: 'D1', fields: [{ ar: 'بلّغ عن عطل', en: 'Report a fault' }], keys: ['D1'] },
    ]);
    expect(index.search('فاتوره')[0]).toBe('B1');
    expect(index.search('renew')[0]).toBe('B3');
    expect(index.search('b3')[0]).toBe('B3');
    expect(index.search('ايجار')).toEqual(expect.arrayContaining(['B1', 'B3']));
    expect(index.search('zzz')).toEqual([]);
  });
});

/* ------------------------------------------------------------------------------------------------
   The core primitives, rendered to markup. The assertions read structure, roles and data attributes,
   never class names.
   ------------------------------------------------------------------------------------------------ */

/** `createElement` with the children passed apart from the props, as JSX would. */
function el<P>(component: ComponentType<P>, props: Omit<P, 'children'>, ...children: ReactNode[]): ReactElement {
  return h(component as ComponentType<Record<string, unknown>>, props as Record<string, unknown>, ...children);
}

const markup = (node: ReactNode, lang: Lang = 'en'): string => renderToStaticMarkup(el(LangProvider, { lang }, node));
const count = (text: string, part: string): number => text.split(part).length - 1;

describe('layout primitives', () => {
  it('renders a tile with its slots in reading order', () => {
    const out = markup(el(Tile, { eyebrow: 'Eyebrow', headline: 'Headline', tagline: 'Tagline', actions: el(Button, {}, 'Go'), media: h('i', null, 'media') }, 'More'));
    expect(out.startsWith('<section')).toBe(true);
    expect(out).toContain('data-tile="light"');
    expect(out).not.toContain('data-tone');
    expect(out).toContain('<h2');
    const order = ['Eyebrow', 'Headline', 'Tagline', 'Go', 'media', 'More'].map((part) => out.indexOf(part));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('switches the tokens inside dark and brand tiles, and only there', () => {
    expect(markup(el(Tile, { tone: 'dark', headline: 'x' }))).toContain('data-tone="dark"');
    expect(markup(el(Tile, { tone: 'brand', headline: 'x' }))).toContain('data-tone="brand"');
    expect(markup(el(Tile, { tone: 'parchment', headline: 'x' }))).not.toContain('data-tone');
  });

  it('lets a tile own the heading level and the element', () => {
    const out = markup(el(Tile, { as: 'header', level: 1, headline: 'Welcome', id: 'hero', 'aria-label': 'Hero' }));
    expect(out.startsWith('<header')).toBe(true);
    expect(out).toContain('<h1');
    expect(out).toContain('id="hero"');
    expect(out).toContain('aria-label="Hero"');
    expect(markup(el(Tile, {}))).not.toContain('<h2');
  });

  it('names the width of a container and the columns of a grid', () => {
    expect(markup(el(Container, {}, 'x'))).toContain('data-container="content"');
    expect(markup(el(Container, { width: 'grid', as: 'section' }, 'x'))).toMatch(/^<section[^>]*data-container="grid"/);
    expect(markup(el(Container, { width: 'form' }, 'x'))).toContain('data-container="form"');
    expect(markup(el(Grid, {}, 'x'))).toContain('data-columns="3"');
    expect(markup(el(Grid, { columns: 4, compact: true, as: 'ul' }, el(Card, { as: 'li' }, 'x')))).toMatch(/^<ul[^>]*data-columns="4"[^>]*><li/);
  });
});

describe('screen', () => {
  it('keeps one h1: large in the content of a tab root, hidden when the bar carries the name', () => {
    const root = markup(el(Screen, { title: 'Services', large: true, subtitle: 'Fifty services' }, 'body'));
    expect(count(root, '<h1')).toBe(1);
    expect(root).not.toContain('<h1 class="visually-hidden"');
    expect(root).toContain('Fifty services');
    const inner = markup(el(Screen, { title: 'Building permit', nav: 'back' }, 'body'));
    expect(count(inner, '<h1')).toBe(1);
    expect(inner).toContain('<h1 class="visually-hidden">Building permit</h1>');
    expect(inner).toContain('aria-label="Back"');
    expect(count(inner, '<main')).toBe(1);
  });

  it('labels back and close in the language of the screen and shows the prototype capsule', () => {
    expect(markup(el(Screen, { title: 't', nav: 'back' }, 'x'), 'ar')).toContain('aria-label="رجوع"');
    expect(markup(el(Screen, { title: 't', nav: 'close' }, 'x'), 'ar')).toContain('aria-label="إغلاق"');
    expect(markup(el(Screen, { title: 't', nav: 'close', navLabel: 'Discard' }, 'x'))).toContain('aria-label="Discard"');
    expect(markup(el(Screen, { title: 't' }, 'x'))).toContain('Prototype');
    expect(markup(el(Screen, { title: 't' }, 'x'), 'ar')).toContain('نسخة تجريبية');
  });

  it('renders the action bar only when the screen has an action', () => {
    expect(markup(el(Screen, { title: 't' }, 'x'))).not.toContain('data-action-bar');
    const out = markup(el(Screen, { title: 't', footer: el(Button, { block: true }, 'Continue'), footerContext: 'Step 2 of 4' }, 'x'));
    expect(out).toContain('data-action-bar');
    expect(out.indexOf('Step 2 of 4')).toBeLessThan(out.indexOf('Continue'));
    expect(out.indexOf('</main>')).toBeLessThan(out.indexOf('data-action-bar'));
  });

  it('makes a whole screen a brand or dark tile', () => {
    expect(markup(el(Screen, { title: 't', tone: 'brand' }, 'x'))).toMatch(/^<div[^>]*data-tone="brand"/);
    expect(markup(el(Screen, { title: 't', tone: 'dark' }, 'x'))).toMatch(/^<div[^>]*data-tone="dark"/);
    expect(markup(el(Screen, { title: 't' }, 'x'))).not.toContain('data-tone');
  });

  it('offers the bar and the action bar on their own', () => {
    expect(markup(el(ScreenBar, { title: 'Gate pass', nav: 'close', inline: true }))).toContain('aria-label="Close"');
    expect(markup(el(ActionBar, { context: 'QAR 50,000 a year', inline: true }, el(Button, { block: true }, 'Apply')))).toContain('QAR 50,000 a year');
  });
});

describe('buttons, cards and choices', () => {
  it('renders links and buttons, and a forward chevron on a quiet link', () => {
    const link = markup(el(Button, { variant: 'quiet', to: '/zones' }, 'Learn more'));
    expect(link).toMatch(/^<a [^>]*href="#\/zones"/);
    expect(count(link, '<svg')).toBe(1);
    expect(count(markup(el(Button, { variant: 'quiet', to: '/zones', chevron: false }, 'Learn more')), '<svg')).toBe(0);
    expect(count(markup(el(Button, { variant: 'quiet' }, 'Undo')), '<svg')).toBe(0);
    expect(markup(el(Button, {}, 'Go'))).toMatch(/^<button type="button"/);
  });

  it('accepts every look and keeps a busy button from being pressed', () => {
    for (const variant of ['primary', 'secondary', 'quiet', 'danger', 'utility', 'pearl'] as const) {
      expect(markup(el(Button, { variant }, 'Label'))).toContain('Label');
    }
    const busy = markup(el(Button, { loading: true, to: '/x' }, 'Sending'));
    expect(busy).toMatch(/^<button/);
    expect(busy).toContain('disabled');
    expect(busy).toContain('aria-busy="true"');
    expect(busy).toContain('Sending');
    expect(markup(el(Button, { block: true }, 'Go'))).toContain('data-block="true"');
  });

  it('names icon buttons and marks their look for the bar', () => {
    const out = markup(el(IconButton, { icon: House, label: 'Home', badge: 12 }));
    expect(out).toContain('aria-label="Home"');
    expect(out).toContain('data-icon-button="plain"');
    expect(out).toContain('9+');
    expect(markup(el(IconButton, { icon: House, label: 'Close', variant: 'soft', size: 'sm' }))).toContain('data-icon-button="soft"');
  });

  it('turns a card into a link or an option', () => {
    expect(markup(el(Card, { to: '/zones/BA' }, 'Zone'))).toMatch(/^<a [^>]*href="#\/zones\/BA"/);
    const option = markup(el(Card, { onClick: () => undefined, selected: true, media: h('i', null, 'render') }, 'Logistics'));
    expect(option).toMatch(/^<div[^>]*role="button"/);
    expect(option).toContain('tabindex="0"');
    expect(option).toContain('aria-pressed="true"');
    expect(option.indexOf('render')).toBeLessThan(option.indexOf('Logistics'));
    expect(markup(el(Card, { tone: 'accent', as: 'article' }, 'x'))).toMatch(/^<article/);
    expect(markup(el(Card, { as: 'li', to: '/zones/BA' }, 'Zone'))).toMatch(/^<li[^>]*><a [^>]*href="#\/zones\/BA"/);
  });

  it('gives status pills a dot unless they have an icon or are neutral', () => {
    expect(count(markup(el(Pill, { tone: 'ok' }, 'Done')), 'aria-hidden="true"')).toBe(1);
    expect(count(markup(el(Pill, {}, 'One working day')), 'aria-hidden="true"')).toBe(0);
    expect(count(markup(el(Pill, { tone: 'warn', icon: House }, 'Due')), '<svg')).toBe(1);
    expect(count(markup(el(Pill, { tone: 'ok', dot: false }, 'Done')), 'aria-hidden="true"')).toBe(0);
  });

  it('reports the chosen segment and the pressed chip', () => {
    const out = markup(el(Segmented<'a' | 'b'>, { label: 'View', value: 'b', onChange: () => undefined, options: [{ value: 'a', label: 'Map' }, { value: 'b', label: 'List', count: 3 }] }));
    expect(out).toContain('role="radiogroup"');
    expect(out).toContain('aria-label="View"');
    expect(out).toMatch(/aria-checked="true"[^>]*data-value="b"/);
    expect(out).toMatch(/aria-checked="false"[^>]*data-value="a"/);
    expect(markup(el(Chip, { selected: true }, 'Logistics'))).toContain('aria-pressed="true"');
    const twoLine = markup(el(Chip, { detail: 'QAR 50,000 a year', disabled: true }, '5,000 m²'));
    expect(twoLine).toContain('QAR 50,000 a year');
    expect(twoLine).toContain('disabled');
  });
});

describe('the shell and the mark', () => {
  const items = [
    { key: 'home', to: '/', label: 'Home', icon: House },
    { key: 'requests', to: '/requests', label: 'Requests', icon: House, badge: 2 },
  ];

  it('draws the mark in one colour', () => {
    const plain = markup(el(Mark, { label: 'Manateq One' }));
    expect(plain).toContain('stroke="currentColor"');
    expect(plain).toContain('role="img"');
    expect(plain).not.toMatch(/#[0-9a-f]{3,6}/i);
    expect(count(plain, '<rect')).toBe(4);
    expect(count(plain, 'fill="currentColor"')).toBe(1);
    const tile = markup(el(Mark, { variant: 'tile' }));
    expect(tile).toContain('data-tone="brand"');
    expect(tile).toContain('aria-hidden="true"');
    expect(count(tile, '<rect')).toBe(5);
    expect(markStroke(14)).toBeGreaterThan(markStroke(64));
  });

  it('renders the global bar: dark tone, the current link, the waiting count, the language switch', () => {
    const out = markup(el(GlobalNav, { label: 'Main navigation', items, activeKey: 'requests', brand: 'Manateq One', search: { to: '/search', label: 'Search' }, language: { name: 'العربية', lang: 'ar', onSwitch: () => undefined } }));
    expect(out).toMatch(/^<nav[^>]*aria-label="Main navigation"[^>]*data-tone="dark"/);
    expect(out).toContain('Manateq One');
    expect(out).toContain('Prototype');
    expect(count(out, 'aria-current="page"')).toBe(1);
    expect(out).toMatch(/aria-current="page"[^>]*href="#\/requests"|href="#\/requests"[^>]*aria-current="page"/);
    expect(out).toContain('(2)');
    expect(out).toContain('aria-label="Search"');
    expect(out).toMatch(/<button[^>]*lang="ar"[^>]*>العربية<\/button>/);
    expect(out).toContain('Skip to content');
  });

  it('renders the tab bar with the same items', () => {
    const out = markup(el(TabBar, { label: 'Main navigation', items, activeKey: 'home' }));
    expect(count(out, '<a ')).toBe(2);
    expect(count(out, 'aria-current="page"')).toBe(1);
    expect(out).toContain('(2)');
  });

  it('renders the footer: link columns, then the fine print', () => {
    const out = markup(el(Footer, { label: 'Site links', columns: [{ title: 'Zones', links: [{ label: 'Zones map', to: '/zones' }, { label: 'Solutions and prices', to: '/solutions' }] }], note: 'A prototype', edition: 'Edition 4.1' }));
    expect(out.startsWith('<footer')).toBe(true);
    expect(out).toContain('aria-label="Site links"');
    expect(out).toContain('href="#/solutions"');
    expect(out.indexOf('Zones map')).toBeLessThan(out.indexOf('A prototype'));
    expect(out).toContain('Edition 4.1');
  });

  it('exports the renders from the core, and only the navigation the shell uses', () => {
    expect(RENDER_NAMES).toHaveLength(13);
    expect(RENDER_NAMES).toContain('journey');
    expect(markup(el(Render, { name: 'plot', decorative: true }))).toContain('alt=""');
    expect(markup(el(Render, { name: 'gate' }), 'ar')).toMatch(/alt="[^"]*بوابة/);
    expect('SideNav' in core).toBe(false);
  });
});

describe('the language of the core styles', () => {
  const files = ['base.css', ...['Button', 'Card', 'Container', 'Footer', 'GlobalNav', 'Grid', 'Icon', 'List', 'Mark', 'Pill', 'Screen', 'Section', 'Segmented', 'Sheet', 'TabBar', 'Tile', 'Toast'].map((name) => `${name}/${name}.module.css`)];
  const sheets = files.map((file) => ({ file, css: readFileSync(resolve(process.cwd(), 'src/design', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '') }));

  it('uses weights 300, 400, 600 and 700 only, through the tokens', () => {
    for (const { file, css } of sheets) {
      expect(css, file).not.toMatch(/font-weight:\s*(500|800|900|bold)/);
    }
  });

  it('has no gradients and no shadows except the float shadow of sheets and toasts', () => {
    for (const { file, css } of sheets) {
      expect(css, file).not.toMatch(/gradient\(/);
      const shadows = css.match(/(box-shadow|text-shadow|drop-shadow)[^;]*;/g) ?? [];
      expect(shadows.filter((rule) => !rule.includes('var(--float-shadow)')), file).toEqual([]);
    }
    expect(sheets.filter(({ css }) => css.includes('--float-shadow')).map(({ file }) => file)).toEqual(['Sheet/Sheet.module.css', 'Toast/Toast.module.css']);
  });

  it('uses logical properties and the four radii', () => {
    for (const { file, css } of sheets) {
      expect(css, file).not.toMatch(/(^|[\s;{])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/m);
      expect(css, file).not.toMatch(/text-align:\s*(left|right)/);
      const radii = [...css.matchAll(/border-radius:\s*([^;]+);/g)].map((match) => (match[1] ?? '').trim());
      const allowed = /^((0|50%|var\(--r-(tile|control|card|pill)\))(\s|$))+$/;
      expect(radii.filter((value) => !allowed.test(value)), file).toEqual([]);
    }
  });

  it('never hard-codes a colour, and tracks text only through the tokens', () => {
    for (const { file, css } of sheets) {
      expect(css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(/g) ?? [], file).toEqual([]);
      const tracking = [...css.matchAll(/letter-spacing:\s*([^;]+);/g)].map((match) => (match[1] ?? '').trim());
      expect(tracking.filter((value) => !/^(var\(--ls-(display|heading|body|caption)\)|inherit)$/.test(value)), file).toEqual([]);
    }
  });
});
