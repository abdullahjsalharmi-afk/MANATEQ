/**
 * Renders a list of catalogue field definitions (`FieldDef`) as form controls, and validates them.
 * Used by the generic "start a service" flow, by mid-request actions and by the bespoke flows.
 *
 *   <FormFields fields values onChange errors? context? />
 *   validateFields(fields, values, lang) → { [key]: message }   (empty object = valid)
 *   describeValue(field, value, lang)    → string               (for "check your answers")
 *   shownFields(fields, values)          → the fields asked now (a field with `showIf` waits for its answer)
 *
 * Values by field type: text, textarea → string · number, area, amount → number · select, zone, activity,
 * plot → the option value, zone code, activity code (or free text) and plot id · date → "YYYY-MM-DD" ·
 * file → { name, size? } · photo → { name, id? } · toggle → boolean · person → { name, id?, phone? }.
 */
import { useEffect, useMemo } from 'react';
import { interpolate, langTools, useLang, useT } from '@/app/i18n';
import { activities, getActivity, getZone, zones } from '@/data/catalog';
import type { FieldDef, FieldType, L10n, Lang } from '@/data/types';
import type { FormValue, Plot } from '@/domain/types';
import {
  Checkbox,
  Field,
  FieldStack,
  DateField,
  FilePick,
  NumberField,
  PhotoPick,
  SelectField,
  TextArea,
  TextField,
  Toggle,
  isoDateToMs,
  type SelectOption,
} from '@/design/forms';
import { getState, selectPlots, useApp } from '@/state';
import styles from './FormFields.module.css';
import { formStrings } from './FormFields.strings';

export type FormValues = Record<string, FormValue>;
export type FormErrors = Record<string, string>;

export interface FormFieldsProps {
  fields: FieldDef[];
  values: FormValues;
  onChange: (key: string, value: FormValue) => void;
  errors?: FormErrors;
  /**
   * Hints for pickers: restrict plot/zone choices or preselect values. `plots` is the investor's plots a
   * request of the service can be started for (`selectPlotsFor(serviceId)`); without it every plot is offered.
   */
  context?: { zoneCode?: string; plotId?: string; plots?: readonly Plot[] };
  /** Give every control this id prefix (avoids clashes when two forms are on screen). */
  idPrefix?: string;
}

/**
 * True when the field is asked, given the answers so far: a field with `showIf` («اليوم المفضل للموعد») waits for
 * its answer («أريد حجز موعد» on). An untouched toggle counts as off. A hidden field is not shown, checked,
 * reviewed or sent.
 */
export function isFieldShown(field: FieldDef, values: FormValues): boolean {
  const rule = field.showIf;
  if (!rule) return true;
  const value = values[rule.key];
  if (rule.equals === false) return value !== true;
  return value === rule.equals;
}

/** The fields asked, given the answers so far. */
export function shownFields<F extends FieldDef>(fields: F[], values: FormValues): F[] {
  return fields.filter((field) => isFieldShown(field, values));
}

/** A named person: the value of a `person` field. */
export interface PersonValue {
  name: string;
  id?: string;
  phone?: string;
}

/** A picked file or photo: the value of a `file` or `photo` field. */
export interface FileLike {
  name: string;
  size?: number;
  id?: string;
}

const UNITS = {
  area: { ar: 'م²', en: 'm²' },
  amount: { ar: 'ر.ق', en: 'QAR' },
} as const;

/** Upper bounds that catch a slipped finger, not a policy. */
const MAX_NUMBER: Partial<Record<FieldType, number>> = { area: 10_000_000, amount: 1_000_000_000, number: 1_000_000 };
const YEAR_MS = 365 * 86_400_000;
const MIN_DATE = Date.UTC(1990, 0, 1);

// ── Small readers ──────────────────────────────────────────────────────────

const isRecord = (value: FormValue | undefined): value is { name: string } =>
  typeof value === 'object' && value !== null && typeof (value as { name?: unknown }).name === 'string';

export function asText(value: FormValue | undefined): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return '';
}

export function asNumber(value: FormValue | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function asPerson(value: FormValue | undefined): PersonValue {
  if (isRecord(value)) {
    const v = value as PersonValue;
    return { name: v.name, id: v.id, phone: v.phone };
  }
  if (typeof value === 'string') return { name: value };
  return { name: '' };
}

export function asFile(value: FormValue | undefined): FileLike | null {
  return isRecord(value) && value.name ? (value as FileLike) : null;
}

/** True when the field holds an answer worth showing and sending. */
export function hasValue(field: FieldDef, value: FormValue | undefined): boolean {
  if (value === undefined || value === null) return false;
  switch (field.type) {
    case 'toggle':
      return value === true;
    case 'number':
    case 'area':
    case 'amount':
      return asNumber(value) !== null;
    case 'file':
    case 'photo':
      return asFile(value) !== null;
    case 'person':
      return asPerson(value).name.trim() !== '';
    default:
      return asText(value).trim() !== '';
  }
}

const KIND_CHOOSE: FieldType[] = ['select', 'zone', 'plot', 'activity', 'date'];

/** "Document type" → "document type"; "QID number" keeps its capitals. */
function lowerFirst(text: string): string {
  if (text.length > 1 && text.charAt(1) === text.charAt(1).toLowerCase()) return text.charAt(0).toLowerCase() + text.slice(1);
  return text;
}

function requiredMessage(field: FieldDef, lang: Lang): string {
  const say = (s: L10n, vars?: Record<string, string>) => interpolate(s[lang], vars);
  const raw = field.label[lang].trim();
  const question = /[?؟]$/.test(raw);
  const label = lang === 'en' ? lowerFirst(raw) : raw;
  if (field.type === 'toggle') return say(formStrings.confirmToContinue);
  if (field.type === 'person') return say(formStrings.enterName);
  if (field.type === 'file') return say(formStrings.attachLabel, { label });
  if (field.type === 'photo') return say(formStrings.addPhoto, { label });
  if (KIND_CHOOSE.includes(field.type)) return question ? say(formStrings.chooseAnswer) : say(formStrings.chooseLabel, { label });
  return question ? say(formStrings.writeAnswer) : say(formStrings.enterLabel, { label });
}

// ── Validation ─────────────────────────────────────────────────────────────

export interface ValidateContext {
  /**
   * The plots a plot answer may name (`selectPlotsFor(serviceId)`). Defaults to the plots in the store. A
   * required plot field is always required: a service that needs a plot is not offered to a company with
   * none (the start screen explains it instead), so an empty list never waives it.
   */
  plots?: readonly Plot[];
  /** "Now" for the date checks. */
  now?: number;
}

/**
 * Checks answers: required fields first ("اختر …", "أدخل …"), then sanity (numbers above zero and not absurd,
 * dates that exist and are not decades away, phone numbers of at least 8 digits). Empty object = valid.
 */
export function validateFields(fields: FieldDef[], values: FormValues, lang: Lang, context: ValidateContext = {}): FormErrors {
  const errors: FormErrors = {};
  const say = (s: L10n) => s[lang];
  const plots = context.plots ?? getState().world.plots;
  const now = context.now ?? Date.now();

  for (const field of fields) {
    if (!isFieldShown(field, values)) continue;
    const value = values[field.key];
    if (!hasValue(field, value)) {
      if (field.required) errors[field.key] = requiredMessage(field, lang);
      continue;
    }
    switch (field.type) {
      case 'plot': {
        // Only one of the plots offered: a plot from an old draft or a link that no longer qualifies is asked again.
        if (!plots.some((plot) => plot.id === asText(value))) errors[field.key] = requiredMessage(field, lang);
        break;
      }
      case 'number':
      case 'area':
      case 'amount': {
        const n = asNumber(value) ?? 0;
        if (n <= 0) errors[field.key] = say(formStrings.positive);
        else if (field.type === 'number' && !Number.isInteger(n)) errors[field.key] = say(formStrings.wholeNumber);
        else if (n > (MAX_NUMBER[field.type] ?? Infinity)) errors[field.key] = say(formStrings.tooLarge);
        break;
      }
      case 'date': {
        const ms = isoDateToMs(asText(value));
        if (ms === null || ms < MIN_DATE) errors[field.key] = say(formStrings.validDate);
        else if (ms > now + 5 * YEAR_MS) errors[field.key] = say(formStrings.dateTooFar);
        break;
      }
      case 'person': {
        const phone = (asPerson(value).phone ?? '').replace(/[^\d]/g, '');
        if (phone && phone.length < 8) errors[field.key] = say(formStrings.validPhone);
        break;
      }
      case 'textarea': {
        if (field.required && asText(value).trim().length < 3) errors[field.key] = say(formStrings.tooShort);
        break;
      }
      default:
        break;
    }
  }
  return errors;
}

// ── Review text ────────────────────────────────────────────────────────────

/** A human-readable summary of one answer, for "check your answers". Empty string when there is no answer. */
export function describeValue(field: FieldDef, value: FormValue | undefined, lang: Lang): string {
  const { pick, fmt } = langTools(lang);
  const say = (s: L10n) => s[lang];
  // A switch left untouched is off: the answer is "No", not "Not added".
  if (field.type === 'toggle') return value === true ? say(formStrings.yes) : say(formStrings.no);
  if (!hasValue(field, value)) return '';

  switch (field.type) {
    case 'number':
      return fmt.num(asNumber(value) ?? 0);
    case 'area':
      return fmt.area(asNumber(value) ?? 0);
    case 'amount':
      return fmt.money(asNumber(value) ?? 0);
    case 'select': {
      const code = asText(value);
      const option = field.options?.find((o) => o.value === code);
      return option ? pick(option) : code;
    }
    case 'zone': {
      const zone = getZone(asText(value));
      return zone ? pick(zone.name) : asText(value);
    }
    case 'activity': {
      const activity = getActivity(asText(value));
      return activity ? pick(activity.name) : asText(value);
    }
    case 'plot': {
      const id = asText(value);
      const plot = getState().world.plots.find((p) => p.id === id);
      if (!plot) return fmt.ltr(id);
      const zone = getZone(plot.zoneCode);
      return [fmt.ltr(plot.number), zone ? pick(zone.name) : null].filter(Boolean).join(' · ');
    }
    case 'date': {
      const ms = isoDateToMs(asText(value));
      return ms === null ? asText(value) : fmt.date(ms);
    }
    case 'file':
      return asFile(value)?.name ?? '';
    case 'photo': {
      const file = asFile(value);
      return file?.name || say(formStrings.photoAdded);
    }
    case 'person': {
      const person = asPerson(value);
      return [person.name.trim(), person.id ? fmt.ltr(person.id) : null, person.phone ? fmt.ltr(person.phone) : null].filter(Boolean).join(' · ');
    }
    default:
      return asText(value).trim();
  }
}

// ── Prefill ────────────────────────────────────────────────────────────────

export interface PrefillSource {
  plots?: readonly Plot[];
  plotId?: string;
  zoneCode?: string;
  activity?: string;
}

/**
 * Values the investor should not have to type: the plot, zone and activity from the link that opened the
 * flow, and the only plot when the investor has exactly one. Only fills empty fields of the matching type.
 */
export function prefillValues(fields: FieldDef[], source: PrefillSource, current: FormValues = {}): FormValues {
  const out: FormValues = { ...current };
  const plots = source.plots ?? [];
  for (const field of fields) {
    if (hasValue(field, out[field.key])) continue;
    if (field.type === 'plot') {
      const wanted = source.plotId && plots.some((p) => p.id === source.plotId) ? source.plotId : plots.length === 1 ? plots[0]?.id : undefined;
      if (wanted) out[field.key] = wanted;
    } else if (field.type === 'zone' && source.zoneCode && getZone(source.zoneCode)) {
      out[field.key] = source.zoneCode;
    } else if (field.type === 'activity' && source.activity) {
      out[field.key] = source.activity;
    }
  }
  return out;
}

// ── The renderer ───────────────────────────────────────────────────────────

export function FormFields({ fields, values, onChange, errors = {}, context, idPrefix = 'f' }: FormFieldsProps) {
  const storePlots = useApp(selectPlots);
  const allPlots = context?.plots ?? storePlots;
  const plots = useMemo(() => {
    if (!context?.zoneCode) return allPlots;
    const inZone = allPlots.filter((p) => p.zoneCode === context.zoneCode);
    return inZone.length ? inZone : allPlots;
  }, [allPlots, context?.zoneCode]);

  // The only plot, or the plot the screen is about, is chosen for the investor.
  useEffect(() => {
    for (const field of fields) {
      if (field.type !== 'plot' || hasValue(field, values[field.key])) continue;
      const wanted = context?.plotId && plots.some((p) => p.id === context.plotId) ? context.plotId : plots.length === 1 ? plots[0]?.id : undefined;
      if (wanted) onChange(field.key, wanted);
    }
    // Only when the choices change, not on every keystroke.
  }, [fields, plots, context?.plotId]);

  return (
    <FieldStack>
      {shownFields(fields, values).map((field) => (
        <FieldControl key={field.key} field={field} value={values[field.key]} error={errors[field.key]} onChange={(v) => onChange(field.key, v)} id={`${idPrefix}-${field.key}`} plots={plots} />
      ))}
    </FieldStack>
  );
}

interface ControlProps {
  field: FieldDef;
  value: FormValue | undefined;
  error?: string;
  onChange: (value: FormValue) => void;
  id: string;
  plots: readonly Plot[];
}

function FieldControl({ field, value, error, onChange, id, plots }: ControlProps) {
  const { lang, pick, fmt } = useLang();
  const t = useT(formStrings);
  const label = pick(field.label);
  const hint = field.help ? pick(field.help) || undefined : undefined;
  const base = { label, hint, error, required: field.required, id };

  switch (field.type) {
    case 'text':
      return <TextField {...base} value={asText(value)} onChange={onChange} />;
    case 'textarea':
      return <TextArea {...base} value={asText(value)} onChange={onChange} maxLength={1000} />;
    case 'number':
    case 'area':
    case 'amount':
      return (
        <NumberField
          {...base}
          value={asNumber(value)}
          onChange={(n) => onChange(n)}
          unit={field.type === 'number' ? undefined : UNITS[field.type][lang]}
        />
      );
    case 'select': {
      const options: SelectOption[] = (field.options ?? []).map((o) => ({ value: o.value, label: pick(o), keywords: lang === 'ar' ? o.en : o.ar }));
      return <SelectField {...base} options={options} value={asText(value) || null} onChange={onChange} />;
    }
    case 'date':
      return <DateField {...base} value={asText(value) || null} onChange={onChange} />;
    case 'file':
      return <FilePick {...base} value={asFile(value)} onChange={(f) => onChange(f ? { name: f.name, size: f.size } : null)} />;
    case 'photo':
      return <PhotoPick {...base} value={asFile(value)} onChange={(p) => onChange(p ? { name: p.name, id: p.id } : null)} />;
    case 'toggle':
      // A required toggle is a confirmation: a checkbox that can carry an error. An optional one is a switch.
      return field.required ? (
        <Checkbox label={label} hint={hint} error={error} required checked={value === true} onChange={onChange} id={id} />
      ) : (
        <Toggle label={label} hint={hint} checked={value === true} onChange={onChange} id={id} />
      );
    case 'zone': {
      const options: SelectOption[] = [...zones]
        .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'land' ? -1 : 1))
        .map((z) => ({
          value: z.code,
          label: pick(z.name),
          hint: z.kind === 'land' ? t('landZone', { type: pick(z.typeLabel) }) : t('warehousingPark'),
          keywords: `${z.code} ${lang === 'ar' ? z.name.en : z.name.ar}`,
        }));
      return <SelectField {...base} presentation="sheet" options={options} value={asText(value) || null} onChange={onChange} />;
    }
    case 'activity': {
      if (!activities.length) return <TextField {...base} hint={hint ?? t('activityFree')} value={asText(value)} onChange={onChange} />;
      const options: SelectOption[] = activities.map((a) => ({
        value: a.code,
        label: pick(a.name),
        hint: pick(a.sector),
        keywords: `${a.code} ${lang === 'ar' ? a.name.en : a.name.ar} ${lang === 'ar' ? a.sector.en : a.sector.ar}`,
      }));
      return <SelectField {...base} presentation="sheet" options={options} value={asText(value) || null} onChange={onChange} />;
    }
    case 'plot': {
      if (!plots.length) {
        return (
          <Field label={label} hint={hint} id={id}>
            {(control) => (
              <p id={control.id} className={styles.note}>
                {t('noPlots')}
              </p>
            )}
          </Field>
        );
      }
      const options: SelectOption[] = plots.map((p) => {
        const zone = getZone(p.zoneCode);
        return {
          value: p.id,
          label: fmt.ltr(p.number),
          hint: [zone ? pick(zone.name) : null, fmt.area(p.areaSqm)].filter(Boolean).join(' · '),
          keywords: zone ? `${zone.name.ar} ${zone.name.en}` : undefined,
        };
      });
      return <SelectField {...base} options={options} value={asText(value) || null} onChange={onChange} />;
    }
    case 'person':
      return <PersonControl {...base} value={asPerson(value)} onChange={onChange} />;
    default:
      return <TextField {...base} value={asText(value)} onChange={onChange} />;
  }
}

interface PersonControlProps {
  label: string;
  hint?: string;
  error?: string;
  required: boolean;
  id: string;
  value: PersonValue;
  onChange: (value: FormValue) => void;
}

/** A name with an optional QID and phone, as one group under one label. */
function PersonControl({ label, hint, error, required, id, value, onChange }: PersonControlProps) {
  const t = useT(formStrings);
  const set = (patch: Partial<PersonValue>) => {
    const next: PersonValue = { ...value, ...patch };
    const clean: PersonValue = { name: next.name };
    if (next.id) clean.id = next.id;
    if (next.phone) clean.phone = next.phone;
    onChange(clean.name || clean.id || clean.phone ? clean : null);
  };
  return (
    <Field as="group" label={label} hint={hint} error={error} required={required} id={id}>
      {(control) => (
        <div role="group" aria-labelledby={control.labelId} aria-describedby={control.describedBy} className={styles.person}>
          <TextField label={t('personName')} value={value.name} onChange={(name) => set({ name })} required={required} id={`${control.id}-name`} autoComplete="name" className={styles.personName} />
          <TextField label={`${t('personId')} (${t('optional')})`} value={value.id ?? ''} onChange={(qid) => set({ id: qid })} ltr inputMode="numeric" id={`${control.id}-qid`} />
          <TextField label={`${t('personPhone')} (${t('optional')})`} type="tel" value={value.phone ?? ''} onChange={(phone) => set({ phone })} ltr inputMode="tel" id={`${control.id}-phone`} autoComplete="tel" />
        </div>
      )}
    </Field>
  );
}
