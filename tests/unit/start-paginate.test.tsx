import { describe, expect, it } from 'vitest';
import type { FieldDef, FieldType } from '@/data/types';
import { buildPages, chunkFields, pageOfField, reviewIndex } from '@/features/start/paginate';

const f = (key: string, type: FieldType = 'text'): FieldDef => ({ key, type, label: { ar: key, en: key }, required: false });
const keys = (pages: FieldDef[][]) => pages.map((page) => page.map((field) => field.key));

describe('chunkFields', () => {
  it('keeps up to four inputs on one page', () => {
    expect(keys(chunkFields([f('a'), f('b'), f('c'), f('d')]))).toEqual([['a', 'b', 'c', 'd']]);
    expect(chunkFields([])).toEqual([]);
  });
  it('balances the pages and keeps the order', () => {
    expect(keys(chunkFields([f('a'), f('b'), f('c'), f('d'), f('e')]))).toEqual([['a', 'b', 'c'], ['d', 'e']]);
    expect(keys(chunkFields(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((k) => f(k))))).toEqual([['a', 'b', 'c'], ['d', 'e', 'f'], ['g', 'h', 'i']]);
  });
  it('counts a person as two inputs', () => {
    const pages = chunkFields([f('a'), f('b'), f('p', 'person'), f('c')]);
    expect(pages.every((page) => page.reduce((w, x) => w + (x.type === 'person' ? 2 : 1), 0) <= 4)).toBe(true);
    expect(keys(pages).flat()).toEqual(['a', 'b', 'p', 'c']);
  });
});

describe('buildPages', () => {
  const fields = [f('docType', 'select'), f('drawings', 'file'), f('plot', 'plot'), f('calc', 'file'), f('purpose')];
  const pages = buildPages(fields);
  it('starts with what we know, puts documents on their own page and ends with the review', () => {
    expect(pages.map((p) => p.kind)).toEqual(['known', 'details', 'documents', 'review']);
    const docs = pages[2];
    expect(docs && docs.kind === 'documents' ? docs.fields.map((x) => x.key) : []).toEqual(['drawings', 'calc']);
    expect(reviewIndex(pages)).toBe(3);
  });
  it('finds the page of a field for the edit links', () => {
    expect(pageOfField(pages, 'purpose')).toBe(1);
    expect(pageOfField(pages, 'calc')).toBe(2);
    expect(pageOfField(pages, 'nope')).toBe(-1);
  });
  it('goes straight to the review when a service asks nothing', () => {
    expect(buildPages([]).map((p) => p.kind)).toEqual(['known', 'review']);
  });
});
