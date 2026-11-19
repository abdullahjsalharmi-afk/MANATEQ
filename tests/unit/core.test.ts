import { describe, expect, it } from 'vitest';
import { interpolate, langTools } from '@/app/i18n';
import { buildTarget, matchPath, parseTarget } from '@/app/router';
import { createStore, shallowEqual } from '@/app/store';
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
