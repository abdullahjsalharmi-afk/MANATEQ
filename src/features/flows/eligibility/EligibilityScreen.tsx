/**
 * `#/eligibility` — the eligibility check (service A2), "does my activity fit, and where?".
 * A configurator of three steps (activity · solution · area and zone), a short beat while the rules run,
 * then the result: the verdict with its reason, the zones that fit with the estimated rent, the
 * alternatives, and the one action that carries the result forward. Query: `zone`, `activity`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { BadgeCheck, Check, SearchX } from 'lucide-react';
import { back, navigate } from '@/app/router';
import { useQuery } from '@/app/routes';
import { useLang, useT } from '@/app/i18n';
import { getActivity, getSolution, getZone, solutions } from '@/data/catalog';
import type { SolutionKey } from '@/data/types';
import { checkEligibility, estimateAnnualRent, searchActivities, toEligibilityResult, UNLISTED_ACTIVITY, type EligibilityInput } from '@/domain/eligibility';
import { Button, Chip, ChipRow, Icon, Render, Screen, Sheet, cx, toast } from '@/design/core';
import { EmptyState, NumberField, SearchField, Skeleton, Stepper } from '@/design/forms';
import { saveEligibility, selectCompany, selectPersona, startRequest, useApp } from '@/state';
import { AREA_PICKS, DEFAULT_AREA, decidedByActivity, groupBySector, isValidArea, layoutAvailability, quickActivities, SOLUTION_ORDER, SOLUTION_RENDER, zonesOffering } from './model';
import { EligibilityResultView, primaryOf, type Primary } from './Result';
import { FinePrint, revealFirstError, StepError, StepHead, useStepFocus } from './parts';
import { ChoiceCard, useChoiceGroup } from '../shared/Choice';
import { useTakenPlots } from './useTakenPlots';
import { strings } from './strings';
import styles from './Flow.module.css';

type Phase = 1 | 2 | 3 | 'checking' | 'result';

/** The rules answer at once; this short beat lets the investor see that they ran. */
export const CHECK_BEAT_MS = 600;

const STEPS = 3;

const isSolution = (value: string | undefined): value is SolutionKey => SOLUTION_ORDER.some((key) => key === value);

export function EligibilityScreen() {
  const t = useT(strings);
  const { lang, pick, fmt } = useLang();
  const query = useQuery();
  const company = useApp(selectCompany);
  const persona = useApp(selectPersona);
  const saved = useApp((state) => state.world.eligibility);
  const taken = useTakenPlots();

  // Answers: from the link first, then the last saved check, then the activity of the commercial registration.
  const [activityCode, setActivityCode] = useState<string | null>(() => {
    const asked = query.activity;
    if (asked && (getActivity(asked) || asked === UNLISTED_ACTIVITY)) return asked;
    if (saved?.activityCode) return saved.activityCode;
    return company && getActivity(company.activityCode) ? company.activityCode : null;
  });
  const [solution, setSolution] = useState<SolutionKey | null>(() => (saved && isSolution(saved.solution) ? saved.solution : null));
  const [area, setArea] = useState<number | null>(() => saved?.areaSqm ?? DEFAULT_AREA);
  const [zoneCode, setZoneCode] = useState<string | null>(() => (query.zone && getZone(query.zone) ? query.zone : null));
  const [phase, setPhase] = useState<Phase>(1);
  const [search, setSearch] = useState('');
  const [tried, setTried] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const headRef = useStepFocus(phase);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const activity = activityCode ? getActivity(activityCode) : undefined;
  const activityName = activityCode === UNLISTED_ACTIVITY ? t('unlistedName') : activity ? pick(activity.name) : '';
  const licensed = company ? getActivity(company.activityCode) : undefined;

  const input = useMemo<EligibilityInput | null>(
    () => (activityCode && solution && isValidArea(area) ? { activityCode, solution, areaSqm: area, ...(zoneCode ? { zoneCode } : {}) } : null),
    [activityCode, solution, area, zoneCode],
  );
  const outcome = useMemo(() => (input ? checkEligibility(input, layoutAvailability(taken)) : null), [input, taken]);

  const goTo = (next: Phase) => {
    setTried(false);
    setPhase(next);
  };

  const runCheck = (override?: Partial<Pick<EligibilityInput, 'solution' | 'zoneCode'>>) => {
    const nextSolution = override?.solution ?? solution;
    const nextZone = override && 'zoneCode' in override ? (override.zoneCode ?? null) : zoneCode;
    if (!activityCode || !nextSolution || !isValidArea(area)) return;
    if (override) {
      setSolution(nextSolution);
      setZoneCode(nextZone);
    }
    setChosen(null);
    setPhase('checking');
    const final: EligibilityInput = { activityCode, solution: nextSolution, areaSqm: area, ...(nextZone ? { zoneCode: nextZone } : {}) };
    const result = checkEligibility(final, layoutAvailability(taken));
    // A first choice that does not fit is not kept: only a check the investor can act on carries forward.
    if (result.verdict !== 'targeted' || result.matches.length) saveEligibility(toEligibilityResult(final, result, Date.now()));
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPhase('result'), CHECK_BEAT_MS);
  };

  const next = () => {
    if (phase === 1 && activityCode) {
      // A non-targeted activity is decided by the activity alone: no solution or area to ask for.
      if (decidedByActivity(activityCode)) {
        runCheck({ solution: solution ?? SOLUTION_ORDER[0] });
        return;
      }
      // Never carry forward a solution the activity does not list.
      if (activity && (!solution || !activity.solutions.includes(solution))) setSolution(activity.solutions[0] ?? null);
      goTo(2);
    } else if (phase === 2 && solution) {
      if (zoneCode && !getZone(zoneCode)?.solutions.includes(solution)) setZoneCode(null);
      goTo(3);
    } else if (phase === 3 && isValidArea(area)) {
      runCheck();
    } else {
      setTried(true);
      revealFirstError();
    }
  };

  const previous = () => {
    if (phase === 2) goTo(1);
    else if (phase === 3) goTo(2);
  };

  const close = () => back('/');

  // ── the result ──────────────────────────────────────────────────
  if ((phase === 'result' || phase === 'checking') && input && outcome) {
    const checking = phase === 'checking';
    const primary: Primary = primaryOf(outcome, { persona, chosen, activityCode: input.activityCode, solution: input.solution });
    const act = () => {
      switch (primary.kind) {
        case 'apply':
          navigate(`/start/A4?activity=${encodeURIComponent(input.activityCode)}&zone=${primary.zone}`);
          break;
        case 'signIn':
          navigate('/welcome');
          break;
        case 'review': {
          setBusy(true);
          const id = startRequest('A2', { activity: input.activityCode, solution: input.solution, area: input.areaSqm, zone: input.zoneCode ?? null, verdict: 'review' }, input.zoneCode ? { zoneCode: input.zoneCode } : {});
          toast(t('sentForReview'), { tone: 'ok' });
          navigate(`/requests/${id}`, { replace: true });
          break;
        }
        case 'bsc':
          navigate('/start/A1');
          break;
        case 'referral':
          navigate(`/start/F1${primary.zone ? `?zone=${primary.zone}` : ''}`);
          break;
        case 'follow':
          navigate(`/start/E4${input.zoneCode ? `?zone=${input.zoneCode}` : ''}`);
          break;
        case 'recheck':
          runCheck({ solution: primary.solution, zoneCode: primary.zone });
          break;
      }
    };
    return (
      <Screen
        title={t('title')}
        nav="close"
        navLabel={t('close')}
        onNav={close}
        bleed
        header={<Stepper current={STEPS} total={STEPS} label={t('result')} />}
        footerContext={checking || !primary.option ? undefined : primary.option.annualRent === null ? pick(primary.option.zone.name) : t('zoneAndRent', { zone: pick(primary.option.zone.name), amount: fmt.money(primary.option.annualRent) })}
        footer={
          checking ? undefined : (
            <Button block onClick={act} loading={busy}>
              {t(primary.label)}
            </Button>
          )
        }
      >
        {checking ? (
          <div className={styles.checking} aria-live="polite" aria-busy="true">
            <h2 ref={headRef} tabIndex={-1} className={cx('type-title', styles.question)}>
              {t('checking')}
            </h2>
            <p className={cx('type-body', styles.checkingBody)}>{t('checkingBody')}</p>
            <div className={styles.skeletons}>
              <Skeleton variant="block" height={96} />
              <Skeleton variant="text" count={2} />
            </div>
          </div>
        ) : (
          <EligibilityResultView
            input={input}
            outcome={outcome}
            persona={persona}
            chosen={chosen ?? primary.chosen}
            onChoose={setChosen}
            onChange={(step) => goTo(step)}
            activityName={activityName}
            headRef={headRef}
          />
        )}
      </Screen>
    );
  }

  // ── the three questions ─────────────────────────────────────────
  const step = typeof phase === 'number' ? phase : 3;
  const where = t('step', { n: step, m: STEPS });
  const price = solution ? getSolution(solution)?.price.qarPerSqmYear ?? null : null;
  const yearly = (sqm: number) => {
    const rent = solution ? estimateAnnualRent(solution, sqm) : null;
    return rent === null ? t('byOperator') : t('perYear', { amount: fmt.money(rent) });
  };
  const context =
    step === 1
      ? activityName
        ? t('activityChosen', { name: activityName })
        : undefined
      : solution && isValidArea(area)
        ? (
            <>
              {t('estimate')} <strong className="num">{yearly(area)}</strong>
            </>
          )
        : undefined;

  return (
    <Screen
      title={t('title')}
      nav="close"
      navLabel={t('close')}
      onNav={close}
      width="form"
      header={<Stepper current={step} total={STEPS} label={where} />}
      actions={
        step > 1 ? (
          <Button variant="quiet" size="sm" onClick={previous}>
            {t('previous')}
          </Button>
        ) : undefined
      }
      footerContext={context}
      footer={
        <Button block onClick={next}>
          {step === 3 || (step === 1 && decidedByActivity(activityCode)) ? t('runCheck') : t('continue')}
        </Button>
      }
    >
      {step === 1 ? (
        <>
          <StepHead ref={headRef} where={where} question={t('s1Question')} hint={t('s1Hint')} />
          {licensed && !search.trim() ? (
            <section className={styles.block} aria-labelledby="elig-register">
              <h3 id="elig-register" className={cx('type-callout', styles.groupHead)}>
                {t('fromRegister')}
              </h3>
              <ChipRow label={t('fromRegister')} wrap>
                <Chip
                  selected={activityCode === licensed.code}
                  onClick={() => setActivityCode(licensed.code)}
                  leading={<Icon icon={BadgeCheck} size={20} className={styles.verified} />}
                  detail={pick(licensed.sector)}
                >
                  {pick(licensed.name)}
                </Chip>
              </ChipRow>
            </section>
          ) : null}
          <ActivityPicker value={activityCode} onChange={setActivityCode} search={search} onSearch={setSearch} skip={licensed && !search.trim() ? licensed.code : undefined} lang={lang} />
          {tried && !activityCode ? <StepError>{t('needActivity')}</StepError> : null}
        </>
      ) : step === 2 ? (
        <>
          <StepHead ref={headRef} where={where} question={t('s2Question')} hint={t('s2Hint')} />
          <SolutionPicker value={solution} onChange={setSolution} covered={activity?.solutions ?? []} />
          {tried && !solution ? <StepError>{t('needSolution')}</StepError> : null}
        </>
      ) : (
        <>
          <StepHead ref={headRef} where={where} question={t('s3Question')} hint={t('s3Hint')} />
          <div className={styles.block}>
            <NumberField
              label={t('area')}
              value={area}
              onChange={setArea}
              unit={t('areaUnit')}
              error={tried && !isValidArea(area) ? t('areaError') : undefined}
              required
              name="area"
            />
            <ChipRow label={t('commonSizes')} wrap className={styles.picks}>
              {AREA_PICKS.map((sqm) => (
                <Chip key={sqm} selected={area === sqm} onClick={() => setArea(sqm)} detail={price === null ? undefined : yearly(sqm)}>
                  <span className="num">{fmt.area(sqm)}</span>
                </Chip>
              ))}
            </ChipRow>
          </div>
          {solution ? (
            <section className={styles.block} aria-labelledby="elig-zone">
              <h3 id="elig-zone" className={cx('type-body', styles.optionName)}>
                <strong>{t('zone')}</strong>
              </h3>
              <p className={cx('type-callout', styles.zoneHint)}>
                {t('zoneHint')}
              </p>
              <ChipRow label={t('zone')} wrap>
                <Chip selected={zoneCode === null} onClick={() => setZoneCode(null)}>
                  {t('anyZone')}
                </Chip>
                {zonesOffering(solution).map((zone) => (
                  <Chip key={zone.code} selected={zoneCode === zone.code} onClick={() => setZoneCode(zone.code)}>
                    {pick(zone.name)}
                  </Chip>
                ))}
              </ChipRow>
            </section>
          ) : null}
          <FinePrint demo="indicative">{t('sectorRules')}</FinePrint>
        </>
      )}
    </Screen>
  );
}

interface ActivityPickerProps {
  value: string | null;
  onChange: (code: string) => void;
  search: string;
  onSearch: (text: string) => void;
  /** The licensed activity, already shown above the list. */
  skip?: string;
  lang: 'ar' | 'en';
}

/**
 * The search pill, then a handful of common activities (the whole register is a search away, or in a
 * sheet grouped by sector), and the "not listed" way out. A search shows every match.
 */
function ActivityPicker({ value, onChange, search, onSearch, skip, lang }: ActivityPickerProps) {
  const t = useT(strings);
  const { pick } = useLang();
  const [browsing, setBrowsing] = useState(false);
  const searching = search.trim() !== '';
  const found = useMemo(() => (searching ? searchActivities(search, lang).filter((activity) => activity.code !== skip) : []), [search, searching, lang, skip]);
  const quick = useMemo(() => quickActivities(value === UNLISTED_ACTIVITY ? null : value, skip).flatMap((code) => getActivity(code) ?? []), [value, skip]);
  const groups = useMemo(() => groupBySector(searchActivities('', lang), lang), [lang]);
  const chip = (code: string, name: string, after?: () => void) => (
    <Chip
      key={code}
      selected={value === code}
      onClick={() => {
        onChange(code);
        after?.();
      }}
    >
      {name}
    </Chip>
  );
  return (
    <>
      <SearchField value={search} onChange={onSearch} label={t('search')} className={styles.search} />
      <div className={styles.groups} aria-live="polite">
        {searching ? (
          found.length ? (
            <section aria-label={t('results')}>
              <ChipRow label={t('results')} wrap>
                {found.map((activity) => chip(activity.code, pick(activity.name)))}
              </ChipRow>
            </section>
          ) : (
            <EmptyState compact level={3} icon={SearchX} title={t('noMatch')} body={t('noMatchBody')} />
          )
        ) : (
          <section aria-labelledby="elig-popular">
            <h3 id="elig-popular" className={cx('type-callout', styles.groupHead)}>
              {t('popular')}
            </h3>
            <ChipRow label={t('popular')} wrap>
              {quick.map((activity) => chip(activity.code, pick(activity.name)))}
            </ChipRow>
            <Button variant="quiet" size="sm" chevron onClick={() => setBrowsing(true)} className={styles.all}>
              {t('allActivities')}
            </Button>
          </section>
        )}
        <section aria-label={t('notListed')}>
          <ChipRow label={t('notListed')} wrap>
            <Chip selected={value === UNLISTED_ACTIVITY} onClick={() => onChange(UNLISTED_ACTIVITY)} detail={t('notListedDetail')}>
              {t('notListed')}
            </Chip>
          </ChipRow>
        </section>
      </div>
      <FinePrint demo="illustrative">{t('listNote')}</FinePrint>

      <Sheet open={browsing} onClose={() => setBrowsing(false)} title={t('allActivities')} description={t('allActivitiesHint')}>
        <div className={styles.groups}>
          {groups.map((group) => {
            const name = pick(group.sector);
            return (
              <section key={name} aria-label={name}>
                <h3 className={cx('type-callout', styles.groupHead)}>{name}</h3>
                <ChipRow label={name} wrap>
                  {group.activities.map((activity) => chip(activity.code, pick(activity.name), () => setBrowsing(false)))}
                </ChipRow>
              </section>
            );
          })}
        </div>
      </Sheet>
    </>
  );
}

/** The five solutions as large option cards, one radio group: the render at the inline start, then the name, the price and whether it covers the activity. */
function SolutionPicker({ value, onChange, covered }: { value: SolutionKey | null; onChange: (key: SolutionKey) => void; covered: readonly SolutionKey[] }) {
  const t = useT(strings);
  const { pick } = useLang();
  const choice = useChoiceGroup({ keys: SOLUTION_ORDER, value, onPick: onChange, label: t('s2Name') });
  return (
    <div className={styles.options} {...choice.group}>
      {solutions.map((option) => (
        <ChoiceCard key={option.key} item={choice.item(option.key)} layout="row" className={styles.option}>
          <span className={styles.optionMedia}>
            <Render name={SOLUTION_RENDER[option.key]} decorative />
          </span>
          <span className={styles.optionBody}>
            <span className={cx('type-body', styles.optionName)}>
              <strong>{pick(option.name)}</strong>
            </span>
            <span className={cx('type-callout num', styles.optionPrice)}>{option.price.qarPerSqmYear === null ? t('byOperator') : pick(option.price.text)}</span>
            {covered.includes(option.key) ? (
              <span className={cx('type-callout', styles.covers)}>
                <Icon icon={Check} size={16} />
                {t('coversActivity')}
              </span>
            ) : null}
          </span>
        </ChoiceCard>
      ))}
    </div>
  );
}
