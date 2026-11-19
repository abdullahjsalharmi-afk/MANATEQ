/**
 * Renders a list of catalogue field definitions (`FieldDef`) as form controls, and validates them.
 * Used by the generic "start a service" flow, by mid-request actions and by the bespoke flows.
 *
 * CONTRACT (the implementation replaces the bodies, not the signatures):
 *   <FormFields fields values onChange errors? context? />
 *   validateFields(fields, values, lang) → { [key]: message }   (empty object = valid)
 *   describeValue(field, value, lang)    → string               (for "check your answers")
 */
import type { FieldDef, Lang } from '@/data/types';
import type { FormValue } from '@/domain/types';

export type FormValues = Record<string, FormValue>;
export type FormErrors = Record<string, string>;

export interface FormFieldsProps {
  fields: FieldDef[];
  values: FormValues;
  onChange: (key: string, value: FormValue) => void;
  errors?: FormErrors;
  /** Hints for pickers: restrict plot/zone choices or preselect values. */
  context?: { zoneCode?: string; plotId?: string };
  /** Give every control this id prefix (avoids clashes when two forms are on screen). */
  idPrefix?: string;
}

export function FormFields(_props: FormFieldsProps) {
  return null;
}

export function validateFields(_fields: FieldDef[], _values: FormValues, _lang: Lang): FormErrors {
  return {};
}

export function describeValue(_field: FieldDef, value: FormValue | undefined, _lang: Lang): string {
  return value === undefined || value === null ? '' : String(value);
}
