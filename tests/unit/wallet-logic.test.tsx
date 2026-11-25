import { describe, expect, it } from 'vitest';
import type { Doc, Pass } from '@/domain/types';
import { countByFilter, filterDocs, findByCode, holderName, isCodeShape, normalizeCode, passValidity, verifyRoute, verifyUrl } from '@/features/wallet/logic';

const doc = (id: string, kind: Doc['kind'], issuedAt: number, verifyCode = `TSD-${id.padEnd(4, 'X').slice(0, 4).toUpperCase()}-AAAA`): Doc => ({
  id,
  ref: `REF-${id}`,
  kind,
  title: { ar: id, en: id },
  issuedAt,
  issuer: { ar: 'مناطق', en: 'Manateq' },
  verifyCode,
  signed: kind === 'contract',
  lines: [],
});

const DOCS = [doc('a', 'receipt', 1), doc('b', 'contract', 3), doc('c', 'noc', 2), doc('d', 'permit', 4), doc('e', 'offer', 5)];

describe('wallet filters', () => {
  it('shows everything newest first', () => {
    expect(filterDocs(DOCS, 'all').map((d) => d.id)).toEqual(['e', 'd', 'b', 'c', 'a']);
  });
  it('groups kinds into the five filters', () => {
    expect(filterDocs(DOCS, 'contracts').map((d) => d.id)).toEqual(['e', 'b']);
    expect(filterDocs(DOCS, 'certificates').map((d) => d.id)).toEqual(['c']);
    expect(filterDocs(DOCS, 'receipts').map((d) => d.id)).toEqual(['a']);
    expect(filterDocs(DOCS, 'approvals').map((d) => d.id)).toEqual(['d']);
    expect(countByFilter(DOCS)).toEqual({ all: 5, contracts: 2, certificates: 1, receipts: 1, approvals: 1 });
  });
  it('does not mutate the input', () => {
    const before = DOCS.map((d) => d.id);
    filterDocs(DOCS, 'all');
    expect(DOCS.map((d) => d.id)).toEqual(before);
  });
});

describe('verification codes', () => {
  it('reads codes however they are typed', () => {
    expect(normalizeCode(' tsd-27nf-pkvy ')).toBe('TSD-27NF-PKVY');
    expect(normalizeCode('TSD 27NF PKVY')).toBe('TSD-27NF-PKVY');
    expect(normalizeCode('27nfpkvy')).toBe('TSD-27NF-PKVY');
    expect(isCodeShape('tsd27nfpkvy')).toBe(true);
    expect(isCodeShape('TSD-12')).toBe(false);
    expect(isCodeShape('')).toBe(false);
  });
  it('finds the document of a code and nothing for an unknown one', () => {
    const docs = [doc('x', 'contract', 1, 'TSD-27NF-PKVY')];
    expect(findByCode(docs, 'tsd 27nf pkvy')?.id).toBe('x');
    expect(findByCode(docs, 'TSD-0000-0000')).toBeUndefined();
    expect(findByCode(docs, '')).toBeUndefined();
  });
  it('builds the verification address and route', () => {
    expect(verifyUrl('TSD-27NF-PKVY')).toContain('TSD-27NF-PKVY');
    expect(verifyRoute('TSD-27NF-PKVY')).toBe('/verify?code=TSD-27NF-PKVY');
  });
});

describe('passes', () => {
  const pass = (over: Partial<Pass>): Pass => ({ id: 'p', kind: 'visitor', holder: 'H', plotId: 'BA-121', from: 100, to: 200, status: 'active', code: 'GP-AAAAAA', ...over });
  it('tells valid, upcoming, expired and revoked apart', () => {
    expect(passValidity(pass({}), 150)).toEqual({ state: 'valid', until: 200 });
    expect(passValidity(pass({}), 50)).toEqual({ state: 'upcoming', from: 100 });
    expect(passValidity(pass({}), 250)).toEqual({ state: 'expired', at: 200 });
    expect(passValidity(pass({ status: 'expired' }), 150).state).toBe('expired');
    expect(passValidity(pass({ status: 'revoked' }), 150).state).toBe('revoked');
  });
  it('shows a bilingual demo holder in the reading language', () => {
    expect(holderName('زائر تجريبي · Demo visitor', 'ar')).toBe('زائر تجريبي');
    expect(holderName('زائر تجريبي · Demo visitor', 'en')).toBe('Demo visitor');
    expect(holderName('Ahmed Ali', 'ar')).toBe('Ahmed Ali');
    expect(holderName('A · B', 'en')).toBe('A · B');
  });
});
