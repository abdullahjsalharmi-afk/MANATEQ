/**
 * `#/start/A4` — the land application (service A4), rendered by the start screen through the bespoke
 * flow registry. Five steps: we know you already · the plot · the project · the documents · review and
 * submit, then the confirmation with the reference and what happens next. Query: `zone`, `plot`,
 * `activity`. The answers are kept as a draft on every change and restored on return.
 */
import { useEffect, useMemo, useRef, useState, type Ref } from 'react';
import { back, navigate } from '@/app/router';
import { useQuery } from '@/app/routes';
import { useLang, useT } from '@/app/i18n';
import { activities, getActivity, getSolution, getZone } from '@/data/catalog';
import type { SolutionKey } from '@/data/types';
import { Button, Card, Chip, ChipRow, List, Row, Screen, Section, Sheet, cx, toast } from '@/design/core';
import { Banner, Checkbox, EmptyState, FilePick, NumberField, SelectField, StepHead, Stepper, useStepLabel } from '@/design/forms';
import { FetchedList, PlotGrid, type FetchedItem } from '@/design/signature';
import { clearDraft, saveDraft, selectCompany, selectDraft, selectPersona, startRequest, useApp } from '@/state';
import { fitsArea, freePlots, isValidArea, LAND_SOLUTIONS, layoutForArea, zonesOffering } from '../eligibility/model';
import { KnownCard } from '@/features/start/KnownCard';
import { FinePrint, revealFirstError, StepError, useStepFocus } from '../eligibility/parts';
import { useOwnPlots, useTakenPlots } from '../eligibility/useTakenPlots';
import {
  chosenPlot,
  firstIncompletePage,
  fromDraft,
  initialForm,
  isDirty,
  LAND_PAGES,
  pageErrors,
  plotRent,
  REQUIRED_DOCS,
  toDraft,
  toggleAlternative,
  toRequestForm,
  validAlternatives,
  type LandError,
  type LandForm,
} from './model';
import { Submitted } from './Submitted';
import { docsCount, strings } from './strings';
import flow from '../eligibility/Flow.module.css';
import styles from './Land.module.css';

type Key = keyof typeof strings;

const ERROR_TEXT: Record<LandError, Key> = {
  confirm: 'errConfirm',
  area: 'errArea',
  zone: 'errZone',
  plot: 'errPlot',
  activity: 'errActivity',
  businessPlan: 'errBusinessPlan',
  financials: 'errFinancials',
  consent: 'errConsent',
};

export function LandFlow() {
  const t = useT(strings);
  const { fmt } = useLang();
  const query = useQuery();
  const company = useApp(selectCompany);
  const persona = useApp(selectPersona);
  const eligibility = useApp((state) => state.world.eligibility);
  const draft = useApp(selectDraft('A4'));
  const taken = useTakenPlots();
  const own = useOwnPlots();

  // The fresh form and the draft are read once, when the flow opens.
  const [fresh] = useState<LandForm>(() => initialForm({ query, eligibility, company }));
  const [restoredFrom] = useState(() => draft);
  const [form, setForm] = useState<LandForm>(() => (restoredFrom ? fromDraft(restoredFrom.form, fresh) : fresh));
  const [page, setPage] = useState<number>(() => Math.min(Math.max(restoredFrom?.page ?? 1, 1), LAND_PAGES));
  const [tried, setTried] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const headRef = useStepFocus(page);
  const stepLabel = useStepLabel();
  const announced = useRef(false);

  useEffect(() => {
    if (restoredFrom && !announced.current) {
      announced.current = true;
      toast(t('restored'), { tone: 'info' });
    }
  }, [restoredFrom, t]);

  // Keep a draft of every change (not once the request is submitted).
  const dirty = isDirty(form, fresh);
  useEffect(() => {
    if (submittedId || !company || (!dirty && !restoredFrom)) return;
    saveDraft('A4', toDraft(form), page);
  }, [form, page, dirty, submittedId, company, restoredFrom]);

  const update = (patch: Partial<LandForm>) => setForm((current) => ({ ...current, ...patch }));
  const errors = tried ? pageErrors(page, form, taken) : [];
  const errorOf = (error: LandError) => (errors.includes(error) ? t(ERROR_TEXT[error]) : undefined);

  const close = () => {
    if (submittedId) navigate('/');
    else if (dirty) setLeaving(true);
    else back('/');
  };

  if (submittedId) return <Submitted requestId={submittedId} />;

  // A guest has no verified profile to apply with.
  if (persona === 'guest' || !company) {
    return (
      <Screen title={t('title')} nav="close" navLabel={t('close')} onNav={() => back('/')} width="form">
        <EmptyState
          render="plot"
          title={t('guestTitle')}
          body={t('guestBody')}
          action={
            <Button to="/welcome" block>
              {t('signIn')}
            </Button>
          }
        />
      </Screen>
    );
  }

  const go = (next: number) => {
    setTried(false);
    setPage(next);
  };

  const plot = chosenPlot(form, taken);
  const rent = plotRent(form, taken);

  const onContinue = () => {
    if (page < LAND_PAGES) {
      if (pageErrors(page, form, taken).length) {
        setTried(true);
        revealFirstError();
        return;
      }
      go(page + 1);
      return;
    }
    const missing = firstIncompletePage(form, taken);
    if (missing !== null) {
      go(missing);
      setTried(true);
      revealFirstError();
      return;
    }
    if (!form.consent) {
      setTried(true);
      revealFirstError();
      return;
    }
    setSending(true);
    const id = startRequest('A4', toRequestForm(form, taken), { ...(form.zone ? { zoneCode: form.zone } : {}), ...(plot ? { plotId: plot.id } : {}) });
    setSubmittedId(id);
  };

  const docsDone = REQUIRED_DOCS.filter((doc) => form[doc] !== null).length;
  const context =
    page === 2
      ? plot
        ? t('plotContext', { id: fmt.ltr(plot.id), area: fmt.area(plot.areaSqm) })
        : t('pickPlot')
      : page === 4
        ? t('docsContext', { n: docsDone, m: REQUIRED_DOCS.length })
        : page === 5 && rent !== null
          ? t('submitContext', { amount: fmt.money(rent) })
          : undefined;

  return (
    <Screen
      title={t('title')}
      nav="close"
      navLabel={t('close')}
      onNav={close}
      width="form"
      header={<Stepper current={page} total={LAND_PAGES} label={stepLabel(page, LAND_PAGES)} />}
      actions={
        page > 1 ? (
          <Button variant="quiet" size="sm" onClick={() => go(page - 1)}>
            {t('previous')}
          </Button>
        ) : undefined
      }
      footerContext={context}
      footer={
        <Button block onClick={onContinue} loading={sending}>
          {page === LAND_PAGES ? t('submit') : t('continue')}
        </Button>
      }
    >
      {page === 1 ? <KnowYou form={form} update={update} headRef={headRef} error={errorOf('confirm')} /> : null}
      {page === 2 ? <PlotPage form={form} update={update} headRef={headRef} errors={errors} taken={taken} own={own} rent={rent} /> : null}
      {page === 3 ? <ProjectPage form={form} update={update} headRef={headRef} error={errorOf('activity')} taken={taken} /> : null}
      {page === 4 ? <DocsPage form={form} update={update} headRef={headRef} errorOf={errorOf} /> : null}
      {page === 5 ? <ReviewPage form={form} update={update} headRef={headRef} error={errorOf('consent')} taken={taken} rent={rent} onEdit={go} /> : null}

      <Sheet
        open={leaving}
        onClose={() => setLeaving(false)}
        title={t('leaveTitle')}
        description={t('leaveBody')}
        footer={
          <div className={styles.sheetActions}>
            <Button block onClick={() => back('/')}>
              {t('keep')}
            </Button>
            <Button
              variant="quiet"
              tone="danger"
              onClick={() => {
                clearDraft('A4');
                setSubmittedId(null);
                back('/');
              }}
            >
              {t('discard')}
            </Button>
          </div>
        }
      >
        <Button variant="secondary" block onClick={() => setLeaving(false)}>
          {t('stay')}
        </Button>
      </Sheet>
    </Screen>
  );

}

interface PageProps {
  form: LandForm;
  update: (patch: Partial<LandForm>) => void;
  headRef: Ref<HTMLHeadingElement>;
}

/* ── 1 · We know you already ─────────────────────────────────────── */

function KnowYou({ form, update, headRef, error }: PageProps & { error?: string }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const company = useApp(selectCompany);
  const eligibility = useApp((state) => state.world.eligibility);
  if (!company) return null;
  // The card shows the company as the start flow does; the list says where each fact comes from.
  const items: FetchedItem[] = [
    { text: t('fIdentity', { name: pick(company.signatory.name) }), source: { name: t('srcNas'), live: true } },
    { text: t('fCompany', { company: pick(company.name), cr: fmt.ltr(company.cr) }), source: { name: t('srcGdx'), live: true } },
  ];
  if (eligibility) {
    const verdict = t(eligibility.verdict === 'targeted' ? 'vTargeted' : eligibility.verdict === 'review' ? 'vReview' : 'vNot');
    items.push({
      // A non-targeted activity was checked on the activity alone: no solution or area to repeat.
      text:
        eligibility.verdict === 'not_targeted'
          ? t('fEligibilityShort', { verdict })
          : t('fEligibility', { verdict, solution: pick(getSolution(eligibility.solution)?.name), area: fmt.area(eligibility.areaSqm) }),
      source: { name: t('srcCheck'), live: true },
    });
  }
  const checkLink = `/eligibility${form.activity ? `?activity=${encodeURIComponent(form.activity)}${form.zone ? `&zone=${form.zone}` : ''}` : ''}`;
  return (
    <>
      <StepHead ref={headRef} current={1} total={LAND_PAGES} question={t('p1Question')} hint={t('p1Hint')} />
      <KnownCard company={company} />
      <Section title={t('fetched')} level={3}>
        <FetchedList items={items} caption={false} label={t('fetched')} />
      </Section>
      {!eligibility ? (
        <Banner tone="info" title={t('noCheckTitle')} action={{ label: t('runCheck'), to: checkLink }} className={styles.banner}>
          {t('noCheckBody')}
        </Banner>
      ) : null}
      <div className={styles.confirm}>
        <Checkbox label={t('confirm')} hint={t('confirmHint')} checked={form.detailsConfirmed} onChange={(checked) => update({ detailsConfirmed: checked })} error={error} required />
      </div>
    </>
  );
}

/* ── 2 · The plot ────────────────────────────────────────────────── */

function PlotPage({ form, update, headRef, errors, taken, own, rent }: PageProps & { errors: LandError[]; taken: ReadonlySet<string>; own: ReadonlySet<string>; rent: number | null }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const zones = useMemo(() => zonesOffering(form.solution).filter((zone) => zone.kind === 'land'), [form.solution]);
  const zone = form.zone ? getZone(form.zone) : undefined;
  const area = isValidArea(form.area) ? form.area : null;
  const free = form.zone && area !== null ? freePlots(form.zone, area, taken) : [];
  const layout = useMemo(() => (form.zone ? layoutForArea(form.zone, taken, own) : []), [form.zone, taken, own]);
  const plot = chosenPlot(form, taken);

  const chooseSolution = (solution: SolutionKey) => {
    const keep = form.zone && getZone(form.zone)?.solutions.includes(solution);
    const nextZone = keep ? form.zone : (zonesOffering(solution).find((candidate) => candidate.kind === 'land')?.code ?? null);
    update({ solution, zone: nextZone, ...(keep ? {} : { preferredPlot: null, alternativePlots: [] }) });
  };

  return (
    <>
      <StepHead ref={headRef} current={2} total={LAND_PAGES} question={t('p2Question')} hint={t('p2Hint')} />
      <div className={flow.block}>
        <ChipRow label={t('solution')} wrap>
          {LAND_SOLUTIONS.map((key) => {
            const solution = getSolution(key);
            return (
              <Chip key={key} selected={form.solution === key} onClick={() => chooseSolution(key)} detail={solution ? <span className="num">{pick(solution.price.text)}</span> : undefined}>
                {pick(solution?.name)}
              </Chip>
            );
          })}
        </ChipRow>
      </div>
      <section className={flow.block} aria-labelledby="land-zone">
        <h3 id="land-zone" className={cx('type-callout', flow.groupHead)}>
          {t('zone')}
        </h3>
        <ChipRow label={t('zone')} wrap>
          {zones.map((candidate) => (
            <Chip key={candidate.code} selected={form.zone === candidate.code} onClick={() => update({ zone: candidate.code, preferredPlot: null, alternativePlots: [] })}>
              {pick(candidate.name)}
            </Chip>
          ))}
        </ChipRow>
        {errors.includes('zone') ? <StepError>{t('errZone')}</StepError> : null}
      </section>
      <div className={flow.block}>
        <NumberField label={t('area')} value={form.area} onChange={(value) => update({ area: value })} unit={t('areaUnit')} hint={t('areaHint')} error={errors.includes('area') ? t('errArea') : undefined} required name="area" />
      </div>

      {zone && area !== null ? (
        free.length ? (
          <Card className={styles.layout}>
            <PlotGrid
              plots={layout}
              selected={plot?.id}
              onSelect={(cell) => update({ preferredPlot: cell.id, alternativePlots: form.alternativePlots.filter((id) => id !== cell.id) })}
              own={[...own]}
              isSelectable={(cell) => fitsArea(cell, area)}
              unfitLabel={t('tooSmall')}
              label={t('layout', { zone: pick(zone.name) })}
            />
          </Card>
        ) : (
          <Card>
            <EmptyState compact level={3} render="plot" title={t('noPlots')} body={t('noPlotsBody')} />
          </Card>
        )
      ) : null}
      {errors.includes('plot') ? <StepError>{t('errPlot')}</StepError> : null}
      <FinePrint demo="illustrative">{t('layoutNote')}</FinePrint>

      {plot ? (
        <Section title={t('yourPlot')} level={3}>
          <List aria-label={t('yourPlot')}>
            <Row title={t('plotNumber')} trailing={<span className="ltr num">{plot.id}</span>} />
            <Row title={t('plotArea')} trailing={<span className="num">{fmt.area(plot.areaSqm)}</span>} />
            <Row title={t('plotRent')} subtitle={t('estimate')} trailing={<span className="num">{rent === null ? '' : fmt.money(rent)}</span>} />
          </List>
        </Section>
      ) : null}
    </>
  );
}

/* ── 3 · The project ─────────────────────────────────────────────── */

function ProjectPage({ form, update, headRef, error, taken }: PageProps & { error?: string; taken: ReadonlySet<string> }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const options = useMemo(
    () =>
      activities
        .filter((activity) => activity.code === form.activity || (activity.verdict !== 'not_targeted' && activity.solutions.includes(form.solution)))
        .map((activity) => ({ value: activity.code, label: pick(activity.name), hint: pick(activity.sector), keywords: `${activity.name.ar} ${activity.name.en} ${activity.code}` })),
    [form.activity, form.solution, pick],
  );
  const others = form.zone && isValidArea(form.area) ? freePlots(form.zone, form.area, taken).filter((plot) => plot.id !== form.preferredPlot) : [];
  const chosen = validAlternatives(form, taken);
  return (
    <>
      <StepHead ref={headRef} current={3} total={LAND_PAGES} question={t('p3Question')} hint={t('p3Hint')} />
      <div className={flow.block}>
        <SelectField label={t('activity')} options={options} value={form.activity} onChange={(code) => update({ activity: code })} placeholder={t('activityPlaceholder')} error={error} required presentation="sheet" />
      </div>
      <section className={flow.block} aria-labelledby="land-alternatives">
        <h3 id="land-alternatives" className={cx('type-body', flow.optionName)}>
          <strong>{t('alternatives')}</strong>
        </h3>
        <p className={cx('type-callout', flow.zoneHint)}>{t('alternativesHint')}</p>
        {others.length ? (
          <ChipRow label={t('alternatives')} wrap>
            {others.map((plot) => {
              const rank = chosen.indexOf(plot.id);
              return (
                <Chip
                  key={plot.id}
                  selected={rank >= 0}
                  onClick={() => update({ alternativePlots: toggleAlternative(chosen, plot.id) })}
                  leading={rank >= 0 ? <span className={cx('num', styles.rank)} aria-label={t('rank', { n: rank + 1 })}>{rank + 1}</span> : undefined}
                  detail={<span className="num">{fmt.area(plot.areaSqm)}</span>}
                >
                  <span className="ltr num">{plot.id}</span>
                </Chip>
              );
            })}
          </ChipRow>
        ) : (
          <p className={cx('type-callout', flow.hint)}>{t('noAlternatives')}</p>
        )}
      </section>
      <FinePrint demo="illustrative">{t('layoutNote')}</FinePrint>
    </>
  );
}

/* ── 4 · Documents ───────────────────────────────────────────────── */

function DocsPage({ form, update, headRef, errorOf }: PageProps & { errorOf: (error: LandError) => string | undefined }) {
  const t = useT(strings);
  return (
    <>
      <StepHead ref={headRef} current={4} total={LAND_PAGES} question={t('p4Question')} hint={t('p4Hint')} />
      <div className={styles.files}>
        <FilePick id="land-business-plan" label={t('businessPlan')} hint={t('docHint')} value={form.businessPlan} onChange={(value) => update({ businessPlan: value })} error={errorOf('businessPlan')} required />
        <FilePick id="land-financials" label={t('financials')} hint={t('docHint')} value={form.financials} onChange={(value) => update({ financials: value })} error={errorOf('financials')} required />
        <FilePick id="land-solution-docs" label={t('solutionDocs')} hint={t('solutionDocsHint')} value={form.solutionDocs} onChange={(value) => update({ solutionDocs: value })} />
      </div>
      <FinePrint demo="simulation">{t('checkSimulated')}</FinePrint>
    </>
  );
}

/* ── 5 · Review and submit ───────────────────────────────────────── */

function ReviewPage({ form, update, headRef, error, taken, rent, onEdit }: PageProps & { error?: string; taken: ReadonlySet<string>; rent: number | null; onEdit: (page: number) => void }) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const company = useApp(selectCompany);
  const solution = getSolution(form.solution);
  const zone = form.zone ? getZone(form.zone) : undefined;
  const plot = chosenPlot(form, taken);
  const alternatives = validAlternatives(form, taken);
  const docs = [form.businessPlan, form.financials, form.solutionDocs].filter(Boolean).length;
  const edit = (what: string, page: number) => ({
    trailing: <span className={flow.change}>{t('edit')}</span>,
    onClick: () => onEdit(page),
    'aria-label': t('editWhat', { what }),
  });
  return (
    <>
      <StepHead ref={headRef} current={5} total={LAND_PAGES} question={t('p5Question')} hint={t('p5Hint')} />
      <List aria-label={t('answers')}>
        <Row eyebrow={t('company')} title={pick(company?.name)} {...edit(t('company'), 1)} />
        <Row eyebrow={t('solution')} title={pick(solution?.name)} {...edit(t('solution'), 2)} />
        <Row eyebrow={t('zone')} title={pick(zone?.name)} {...edit(t('zone'), 2)} />
        <Row eyebrow={t('preferredPlot')} title={plot ? <span className="num">{`${fmt.ltr(plot.id)} · ${fmt.area(plot.areaSqm)}`}</span> : t('none')} {...edit(t('preferredPlot'), 2)} />
        <Row eyebrow={t('activity')} title={pick(form.activity ? getActivity(form.activity)?.name : undefined)} wrap {...edit(t('activity'), 3)} />
        <Row eyebrow={t('alternatives')} title={alternatives.length ? <span className="num">{alternatives.map((id) => fmt.ltr(id)).join(' · ')}</span> : t('none')} {...edit(t('alternatives'), 3)} />
        <Row eyebrow={t('documents')} title={fmt.plural(docs, docsCount)} {...edit(t('documents'), 4)} />
      </List>

      {solution ? (
        <Section title={t('terms')} level={3}>
          <List aria-label={t('terms')}>
            <Row title={t('price')} trailing={<span className="num">{pick(solution.price.text)}</span>} />
            <Row title={t('term')} subtitle={pick(solution.term)} wrap />
            {pick(solution.notes) ? <Row title={t('notes')} subtitle={pick(solution.notes)} wrap /> : null}
            {rent !== null ? <Row title={t('rentEstimate')} subtitle={t('estimate')} trailing={<span className="num">{fmt.money(rent)}</span>} /> : null}
          </List>
        </Section>
      ) : null}

      <div className={styles.confirm}>
        <Checkbox label={t('consent')} hint={t('consentHint')} checked={form.consent} onChange={(checked) => update({ consent: checked })} error={error} required />
      </div>
    </>
  );
}
