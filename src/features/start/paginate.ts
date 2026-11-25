/**
 * How the generic flow cuts a service's fields into pages: what we already know, the details in pages of at
 * most four inputs, the documents on their own pages, then the review.
 */
import type { FieldDef } from '@/data/types';

export const MAX_PER_PAGE = 4;

export type FlowPageDef =
  | { kind: 'known' }
  | { kind: 'details'; fields: FieldDef[] }
  | { kind: 'documents'; fields: FieldDef[] }
  | { kind: 'review' };

/** A person is a name with a QID and a phone: it counts for two inputs. */
export function fieldWeight(field: FieldDef): number {
  return field.type === 'person' ? 2 : 1;
}

/**
 * Splits fields into pages of at most `max` weight, keeping their order and balancing the pages
 * (five fields give 3 + 2, not 4 + 1). A field heavier than `max` gets a page of its own.
 */
export function chunkFields(fields: FieldDef[], max = MAX_PER_PAGE): FieldDef[][] {
  if (!fields.length) return [];
  const total = fields.reduce((sum, field) => sum + fieldWeight(field), 0);
  const count = Math.ceil(total / max);
  const target = Math.ceil(total / count);
  const pages: FieldDef[][] = [];
  let page: FieldDef[] = [];
  let weight = 0;
  for (const field of fields) {
    const w = fieldWeight(field);
    if (page.length && (weight + w > max || weight >= target)) {
      pages.push(page);
      page = [];
      weight = 0;
    }
    page.push(field);
    weight += w;
  }
  if (page.length) pages.push(page);
  return pages;
}

/** The whole flow, first page to review. Documents (file fields) come after the other details. */
export function buildPages(fields: FieldDef[], max = MAX_PER_PAGE): FlowPageDef[] {
  const details = fields.filter((field) => field.type !== 'file');
  const documents = fields.filter((field) => field.type === 'file');
  return [
    { kind: 'known' },
    ...chunkFields(details, max).map((page): FlowPageDef => ({ kind: 'details', fields: page })),
    ...chunkFields(documents, max).map((page): FlowPageDef => ({ kind: 'documents', fields: page })),
    { kind: 'review' },
  ];
}

/** The page that asks for a field, or -1. */
export function pageOfField(pages: FlowPageDef[], key: string): number {
  return pages.findIndex((page) => (page.kind === 'details' || page.kind === 'documents') && page.fields.some((field) => field.key === key));
}

/** The index of the review page. */
export function reviewIndex(pages: FlowPageDef[]): number {
  return pages.length - 1;
}
