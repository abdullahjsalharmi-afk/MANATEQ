import { Bell, CalendarCheck, Check, FileText, IdCard, Receipt, Scale, type LucideIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useLang, useT } from '@/app/i18n';
import { back } from '@/app/router';
import { useQuery } from '@/app/routes';
import type { FieldDef, ReceiveKind, ServiceDetail } from '@/data/types';
import type { Company, FormValue, Plot } from '@/domain/types';
import { Button, Card, Icon, List, Pill, Row, Section } from '@/design/core';
import { Checkbox } from '@/design/forms';
import { FetchedList } from '@/design/signature';
import { FormFields, describeValue, hasValue, prefillValues, shownFields, validateFields, type FormErrors, type FormValues } from '@/features/shared/FormFields';
import { clearDraft, getState, needsTenancy, plotsFor, saveDraft, selectDraft, selectPlots, selectPlotsFor, startRequest, useApp } from '@/state';
import { FlowPage } from './FlowPage';
import { KnownCard, useFetchedItems } from './KnownCard';
import { LeaveSheet } from './LeaveSheet';
import { buildPages, pageOfField, reviewIndex, type FlowPageDef } from './paginate';
import { ReviewList, type ReviewItem } from './ReviewList';
import styles from './Start.module.css';
import { strings } from './strings';
import { SubmittedState } from './SubmittedState';

const RECEIVE_ICON: Record<ReceiveKind, LucideIcon> = {
  document: FileText,
  decision: Scale,
  status: Bell,
  payment: Receipt,
  pass: IdCard,
  appointment: CalendarCheck,
  other: Check,
};

export interface GenericFlowProps {
  service: ServiceDetail;
  company: Company;
}

/** The key of the plot question the flow adds when a service needs a plot, has no plot field and the investor holds several. */
export const ASKED_PLOT_KEY = 'plot';

/**
 * Which plot the request is for, when the service's own fields do not ask (A8 «احجز موعد التسليم»): the plot
 * of the link when it qualifies, else the only plot that qualifies. `ask` is true when the investor must
 * choose among several. A service that needs no plot keeps the plot of the link, if it is one of theirs.
 */
export function plotOfFlow(
  service: Pick<ServiceDetail, 'audiences' | 'fields'>,
  candidates: readonly Plot[],
  allPlots: readonly Plot[],
  linked: string | undefined,
): { known?: Plot; ask: boolean } {
  const hasField = service.fields.some((field) => field.type === 'plot');
  if (!needsTenancy(service)) return { known: allPlots.find((plot) => plot.id === linked), ask: false };
  const fromLink = candidates.find((plot) => plot.id === linked || plot.number === linked);
  if (hasField) return { known: fromLink, ask: false };
  if (fromLink) return { known: fromLink, ask: false };
  if (candidates.length === 1) return { known: candidates[0], ask: false };
  return { ask: candidates.length > 1 };
}

/** The flow's fields: the service's own, with a required plot question first when the flow has to ask for the plot. */
export function flowFieldsOf(fields: FieldDef[], ask: boolean): FieldDef[] {
  if (!ask) return fields;
  const question: FieldDef = { key: ASKED_PLOT_KEY, type: 'plot', label: strings.plot, required: true, help: strings.plotHelp };
  return [question, ...fields];
}

/** Where closing the flow leads when there is no screen to go back to. */
function fallbackOf(from: string | undefined, serviceId: string): string {
  return from && from.startsWith('/') ? from : `/services/${serviceId}`;
}

/**
 * The generic "start a service" flow, driven by the service's `fields`:
 * what we already know → the details (≤ 4 inputs a page) → the documents → check and send → received.
 */
export function GenericFlow({ service, company }: GenericFlowProps) {
  const t = useT(strings);
  const { lang, pick } = useLang();
  const query = useQuery();
  const plots = useApp(selectPlots);
  const candidates = useApp(useMemo(() => selectPlotsFor(service.id), [service.id]));
  const draft = useApp(useMemo(() => selectDraft(service.id), [service.id]));
  // The plot is read once, when the flow opens: a plot that changes state meanwhile does not reshape the pages.
  const [plotPlan] = useState(() => plotOfFlow(service, candidates, plots, query.plot));
  const fields = useMemo(() => flowFieldsOf(service.fields, plotPlan.ask), [service.fields, plotPlan.ask]);
  const pages = useMemo(() => buildPages(fields), [fields]);
  const last = reviewIndex(pages);

  // The answers start from the saved draft, then the link (plot, zone, activity), then the only plot.
  const [values, setValues] = useState<FormValues>(() => {
    const saved = getState().world.drafts[service.id];
    return prefillValues(fields, { plots: plotsFor(getState().world, service.id), plotId: query.plot, zoneCode: query.zone, activity: query.activity }, saved?.form ?? {});
  });
  const [index, setIndex] = useState(() => {
    const saved = getState().world.drafts[service.id];
    return saved ? Math.min(Math.max(saved.page, 0), last) : 0;
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [tried, setTried] = useState<Set<number>>(() => new Set());
  const [fromReview, setFromReview] = useState(false);
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | undefined>();
  const [leaving, setLeaving] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [alert, setAlert] = useState('');
  const sending = useRef(false);

  const page: FlowPageDef = pages[index] ?? { kind: 'review' };
  const pageFields = page.kind === 'details' || page.kind === 'documents' ? page.fields : [];
  const fetchedItems = useFetchedItems(service.fetched);
  const contextPlot = plotPlan.known;
  const check = (list: FieldDef[], answers: FormValues) => validateFields(list, answers, lang, { plots: candidates });

  if (submittedId) return <SubmittedState requestId={submittedId} />;

  const go = (next: number) => {
    setIndex(next);
    setAlert('');
    if (draft) saveDraft(service.id, values, next);
  };

  const onChange = (key: string, value: FormValue) => {
    const next = { ...values, [key]: value };
    setValues(next);
    saveDraft(service.id, next, index);
    if (tried.has(index)) setErrors(check(pageFields, next));
  };

  const leave = () => back(fallbackOf(query.from, service.id));
  const close = () => {
    const entered = fields.some((field) => hasValue(field, values[field.key]));
    if (draft && entered) setLeaving(true);
    else {
      if (draft) clearDraft(service.id);
      leave();
    }
  };

  // Brings a field (or the consent) into the middle of the view, clear of the action bar, and moves the keyboard to it.
  const reveal = (id: string, fallback?: string) => {
    window.setTimeout(() => {
      const el = document.getElementById(id) ?? (fallback ? document.getElementById(fallback) : null);
      if (!el) return;
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      (el.closest('[data-reveal]') ?? el).scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      el.focus({ preventScroll: true });
    }, 60);
  };
  const focusField = (key: string) => reveal(`f-${key}`, `f-${key}-name`);

  const onContinue = () => {
    if (page.kind === 'details' || page.kind === 'documents') {
      const found = check(pageFields, values);
      setTried((s) => new Set(s).add(index));
      setErrors(found);
      const first = pageFields.find((field) => found[field.key]);
      if (first) {
        setAlert(t('fixErrors'));
        focusField(first.key);
        return;
      }
    }
    if (fromReview) {
      setFromReview(false);
      go(last);
      return;
    }
    go(Math.min(index + 1, last));
  };

  const edit = (key: string) => {
    const target = pageOfField(pages, key);
    if (target < 0) return;
    setFromReview(true);
    go(target);
  };

  const submit = () => {
    if (sending.current) return;
    const all = check(fields, values);
    const firstBad = fields.find((field) => all[field.key]);
    if (firstBad) {
      const target = pageOfField(pages, firstBad.key);
      setErrors(all);
      setTried((s) => new Set(s).add(target));
      setFromReview(true);
      go(target);
      focusField(firstBad.key);
      return;
    }
    if (!consent) {
      setConsentError(t('consentError'));
      reveal('start-consent');
      return;
    }
    sending.current = true;
    const form: FormValues = {};
    // Only what was asked is sent: an answer to a field that is hidden now stays behind.
    for (const field of shownFields(fields, values)) if (hasValue(field, values[field.key])) form[field.key] = values[field.key] ?? null;
    const plotField = fields.find((field) => field.type === 'plot');
    const zoneField = fields.find((field) => field.type === 'zone');
    // The plot the request is for: the answer to a plot question, else the plot the flow already knows.
    const plotId = (plotField && typeof form[plotField.key] === 'string' ? (form[plotField.key] as string) : undefined) ?? contextPlot?.id;
    const zoneCode = (zoneField && typeof form[zoneField.key] === 'string' ? (form[zoneField.key] as string) : undefined) ?? query.zone ?? plots.find((p) => p.id === plotId)?.zoneCode;
    const id = startRequest(service.id, form, { plotId, zoneCode });
    clearDraft(service.id);
    setSubmittedId(id);
    window.scrollTo({ top: 0 });
  };

  const total = pages.length;
  const title = pick(service.label);
  const draftLine = draft ? (
    <span className={styles.saved}>
      <Icon icon={Check} size={16} strokeWidth={2} />
      {t('draftSaved')}
    </span>
  ) : undefined;
  const footerContext = (
    <span role="status" aria-live="polite">
      {draftLine}
    </span>
  );

  const sheet = <LeaveSheet open={leaving} onStay={() => setLeaving(false)} onLater={() => { setLeaving(false); leave(); }} onDiscard={() => { clearDraft(service.id); setLeaving(false); leave(); }} />;

  if (page.kind === 'known') {
    return (
      <FlowPage
        title={title}
        step={index + 1}
        total={total}
        heading={t('knownTitle')}
        lead={t('knownLead')}
        onClose={close}
        pageKey={index}
        footerContext={footerContext}
        footer={
          <Button block onClick={onContinue}>
            {t('continue')}
          </Button>
        }
      >
        <KnownCard company={company} plot={contextPlot} />
        {fetchedItems.length ? (
          <Section title={t('fetchedTitle')} level={3}>
            <FetchedList items={fetchedItems} caption={false} label={t('fetchedTitle')} />
          </Section>
        ) : null}
        {sheet}
      </FlowPage>
    );
  }

  if (page.kind === 'review') {
    const items: ReviewItem[] = shownFields(fields, values).map((field: FieldDef) => ({
      key: field.key,
      label: pick(field.label),
      value: describeValue(field, values[field.key], lang),
      onEdit: () => edit(field.key),
    }));
    return (
      <FlowPage
        title={title}
        step={index + 1}
        total={total}
        heading={t('reviewTitle')}
        lead={t('reviewLead')}
        onClose={close}
        pageKey={index}
        footerContext={footerContext}
        footer={
          <Button block onClick={submit}>
            {t('submit')}
          </Button>
        }
      >
        <Section title={t('yourAnswers')} level={3}>
          {items.length ? <ReviewList items={items} /> : <Card tone="sunken"><p className={styles.cardText}>{t('noAnswers')}</p></Card>}
        </Section>
        {service.receives.length ? (
          <Section title={t('receives')} level={3}>
            <List aria-label={t('receives')}>
              {service.receives.map((item, i) => (
                <Row key={i} leading={<Icon icon={RECEIVE_ICON[item.kind] ?? Check} size={20} />} title={pick(item)} />
              ))}
            </List>
          </Section>
        ) : null}
        <Section title={t('standard')} level={3}>
          <Card>
            <p className={styles.cardText}>{pick(service.standard)}</p>
            <Pill tone="neutral" className={styles.indicative}>
              {t('indicative')}
            </Pill>
          </Card>
        </Section>
        <div className={styles.consent} data-reveal>
          <Checkbox
            id="start-consent"
            label={t('consent')}
            checked={consent}
            required
            error={consentError}
            onChange={(on) => {
              setConsent(on);
              if (on) setConsentError(undefined);
            }}
          />
        </div>
        {sheet}
      </FlowPage>
    );
  }

  return (
    <FlowPage
      title={title}
      step={index + 1}
      total={total}
      heading={page.kind === 'documents' ? t('documentsTitle') : t('detailsTitle')}
      lead={page.kind === 'documents' ? t('documentsLead') : t('detailsLead')}
      onClose={close}
      pageKey={index}
      footerContext={footerContext}
      footer={
        <Button block onClick={onContinue}>
          {fromReview ? t('backToReview') : t('continue')}
        </Button>
      }
    >
      <p className="visually-hidden" role="alert">
        {alert}
      </p>
      <FormFields fields={pageFields} values={values} onChange={onChange} errors={tried.has(index) ? errors : {}} context={{ plotId: query.plot, zoneCode: query.zone, plots: candidates }} />
      {sheet}
    </FlowPage>
  );
}
