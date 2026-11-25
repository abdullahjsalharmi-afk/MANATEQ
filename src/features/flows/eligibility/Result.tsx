/**
 * The result of the eligibility check: the verdict on a white tile (status, one-sentence reason, the
 * facts the rules found), the zones that fit or the alternatives as cards beside the map, and the
 * answers, each one changeable without losing the others.
 */
import type { Ref } from 'react';
import { CircleCheck, CircleMinus, Clock, Info, Check, X } from 'lucide-react';
import { useLang, useT, type LangValue } from '@/app/i18n';
import { getSolution, getZone } from '@/data/catalog';
import type { SolutionKey } from '@/data/types';
import type { Persona } from '@/domain/types';
import type { EligibilityAlternative, EligibilityInput, EligibilityMatch, EligibilityOption, EligibilityOutcome } from '@/domain/eligibility';
import { Button, Card, Chip, Container, Grid, Icon, List, Pill, Row, Section, Tile, cx, type Tone } from '@/design/core';
import { DemoPill } from '@/design/forms';
import { QatarMap } from '@/design/signature';
import { factsOf, firstZoneWithPlots, resultKind, type Fact, type ResultKind } from './model';
import { strings } from './strings';
import styles from './Flow.module.css';

type Key = keyof typeof strings;

/** The cards the investor can choose from on the result: the zones that fit, or the alternatives. */
export function choicesOf(outcome: EligibilityOutcome): (EligibilityMatch | EligibilityAlternative)[] {
  const kind = resultKind(outcome);
  if (kind === 'eligible') return outcome.matches;
  if (kind === 'elsewhere' || kind === 'noPlots') return outcome.alternatives;
  return [];
}

/** One choice by solution and zone, so an alternative in the same zone with another solution stays distinct. */
export const choiceKey = (option: Pick<EligibilityOption, 'solution' | 'zone'>): string => `${option.solution}:${option.zone.code}`;

/** The choice selected by default: the first zone with a free plot of the size, else the first choice. */
export function defaultChoice(outcome: EligibilityOutcome): string | null {
  const options = choicesOf(outcome);
  if (resultKind(outcome) === 'eligible') {
    const zone = firstZoneWithPlots(outcome);
    const match = options.find((option) => option.zone.code === zone);
    return match ? choiceKey(match) : null;
  }
  return options[0] ? choiceKey(options[0]) : null;
}

export type PrimaryKind = 'apply' | 'signIn' | 'review' | 'bsc' | 'referral' | 'follow' | 'recheck';

export interface Primary {
  kind: PrimaryKind;
  label: Key;
  /** The chosen card. */
  chosen: string | null;
  zone?: string;
  solution?: SolutionKey;
  /** The chosen option, for the running context of the action bar. */
  option?: EligibilityOption;
}

/** The one action that carries a result forward. */
export function primaryOf(outcome: EligibilityOutcome, ctx: { persona: Persona; chosen: string | null; activityCode: string; solution: SolutionKey }): Primary {
  const kind = resultKind(outcome);
  const options = choicesOf(outcome);
  const chosen = ctx.chosen && options.some((option) => choiceKey(option) === ctx.chosen) ? ctx.chosen : defaultChoice(outcome);
  const option = options.find((candidate) => choiceKey(candidate) === chosen);
  const base = { chosen, ...(option ? { option, zone: option.zone.code, solution: option.solution } : {}) };
  const guest = ctx.persona === 'guest';
  switch (kind) {
    case 'review':
      return guest ? { kind: 'signIn', label: 'signInToApply', ...base } : { kind: 'review', label: 'sendReview', ...base };
    case 'notTargeted':
      return { kind: 'bsc', label: 'askBsc', ...base };
    case 'eligible':
      if (guest) return { kind: 'signIn', label: 'signInToApply', ...base };
      return outcome.next === 'F1' ? { kind: 'referral', label: 'referral', ...base } : { kind: 'apply', label: 'apply', ...base };
    case 'noPlots':
      if (!option) return guest ? { kind: 'signIn', label: 'signInToApply', ...base } : { kind: 'follow', label: 'followPlots', ...base };
      return guest ? { kind: 'signIn', label: 'signInToApply', ...base } : { kind: 'apply', label: 'apply', ...base };
    case 'elsewhere':
      return option ? { kind: 'recheck', label: 'recheck', ...base } : { kind: 'bsc', label: 'askBsc', ...base };
  }
}

const VERDICT: Record<ResultKind, { head: Key; pill: Key; tone: Tone; icon: typeof Info }> = {
  eligible: { head: 'eligibleHead', pill: 'pillEligible', tone: 'ok', icon: CircleCheck },
  elsewhere: { head: 'elsewhereHead', pill: 'pillTargeted', tone: 'info', icon: Info },
  noPlots: { head: 'noPlotsHead', pill: 'pillTargeted', tone: 'info', icon: Info },
  review: { head: 'reviewHead', pill: 'pillReview', tone: 'warn', icon: Clock },
  notTargeted: { head: 'notTargetedHead', pill: 'pillNotTargeted', tone: 'neutral', icon: CircleMinus },
};

const FACT_TEXT: Record<Fact['key'], { yes: Key; no: Key }> = {
  activity: { yes: 'factActivity', no: 'factActivity' },
  solution: { yes: 'factSolutionOk', no: 'factSolutionNo' },
  plots: { yes: 'factPlotsOk', no: 'factPlotsNo' },
  operator: { yes: 'factOperator', no: 'factOperator' },
};

/** "3 قطع متاحة بهذه المساحة" · "3 plots of this size free". */
export function plotsText(n: number, fmt: LangValue['fmt'], none: string): string {
  if (n <= 0) return none;
  return fmt.plural(n, {
    ar: { one: 'قطعة واحدة متاحة بهذه المساحة', two: 'قطعتان متاحتان بهذه المساحة', few: '{n} قطع متاحة بهذه المساحة', many: '{n} قطعة متاحة بهذه المساحة', other: '{n} قطعة متاحة بهذه المساحة' },
    en: { one: 'One plot of this size free', other: '{n} plots of this size free' },
  });
}

/** One line under the verdict: how many zones fit, or what to do next. */
function taglineOf(kind: ResultKind, choices: number, fmt: LangValue['fmt'], t: (key: Key) => string): string {
  switch (kind) {
    case 'eligible':
      return fmt.plural(choices, {
        ar: { one: 'تناسبك منطقة واحدة.', two: 'تناسبك منطقتان.', few: '{n} مناطق تناسبك.', many: '{n} منطقة تناسبك.', other: '{n} منطقة تناسبك.' },
        en: { one: 'One zone fits.', other: '{n} zones fit.' },
      });
    case 'elsewhere':
      return choices ? t('tagElsewhere') : t('tagNotTargeted');
    case 'noPlots':
      return choices ? t('tagElsewhere') : t('tagFollow');
    case 'review':
      return t('tagReview');
    case 'notTargeted':
      return t('tagNotTargeted');
  }
}

export interface EligibilityResultViewProps {
  input: EligibilityInput;
  outcome: EligibilityOutcome;
  persona: Persona;
  chosen: string | null;
  onChoose: (key: string) => void;
  onChange: (step: 1 | 2 | 3) => void;
  activityName: string;
  headRef: Ref<HTMLHeadingElement>;
}

export function EligibilityResultView({ input, outcome, persona, chosen, onChoose, onChange, activityName, headRef }: EligibilityResultViewProps) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const kind = resultKind(outcome);
  const verdict = VERDICT[kind];
  const facts = factsOf(outcome, input.solution);
  const options = choicesOf(outcome);
  const isAlternatives = kind !== 'eligible';
  const chosenOption = options.find((option) => choiceKey(option) === chosen);
  const savedForProfile = kind === 'eligible';
  const zone = input.zoneCode ? getZone(input.zoneCode) : undefined;

  return (
    <>
      <Tile
        tone="light"
        lead={
          <Pill tone={verdict.tone} icon={verdict.icon}>
            {t(verdict.pill)}
          </Pill>
        }
        eyebrow={t('result')}
        headline={
          <span ref={headRef} tabIndex={-1} className={styles.question}>
            {t(verdict.head)}
          </span>
        }
        tagline={taglineOf(kind, options.length, fmt, t)}
      >
        <p className={cx('type-body', styles.reason)}>{pick(outcome.reason)}</p>
        {facts.length ? (
          <ul className={cx('type-callout', styles.facts)} aria-label={t('facts')}>
            {facts.map((fact) => (
              <li key={fact.key} className={styles.fact}>
                <Icon icon={fact.ok ? Check : X} size={18} className={fact.ok ? styles.factYes : styles.factNo} label={fact.ok ? t('yes') : t('no')} />
                {t(fact.ok ? FACT_TEXT[fact.key].yes : FACT_TEXT[fact.key].no)}
              </li>
            ))}
          </ul>
        ) : null}
        {outcome.note ? <p className={cx('type-body', styles.note)}>{pick(outcome.note)}</p> : null}
        {savedForProfile ? <p className={cx('type-foot', styles.saved)}>{persona === 'guest' ? t('savedGuest') : t('saved')}</p> : null}
      </Tile>

      <Container width="grid">
        {options.length ? (
          <Section title={t(isAlternatives ? 'alternatives' : 'matches')} hint={t(isAlternatives ? 'alternativesHint' : 'matchesHint')}>
            <div className={styles.matchLayout}>
              <Card className={styles.mapCard}>
                <QatarMap
                  selected={chosenOption?.zone.code}
                  highlight={[...new Set(options.map((option) => option.zone.code))]}
                  onSelect={(code) => {
                    const option = options.find((candidate) => candidate.zone.code === code);
                    if (option) onChoose(choiceKey(option));
                  }}
                  height={320}
                  label={t('map')}
                />
              </Card>
              <Grid as="ul" columns={2}>
                {options.map((option) => (
                  <OptionCard
                    key={choiceKey(option)}
                    option={option}
                    showSolution={option.solution !== input.solution}
                    why={'why' in option ? pick(option.why) : undefined}
                    selected={choiceKey(option) === chosen}
                    onChoose={() => onChoose(choiceKey(option))}
                  />
                ))}
              </Grid>
            </div>
          </Section>
        ) : null}

        <Section title={t('answers')} hint={t('answersHint')}>
          <List aria-label={t('answers')}>
            <Row eyebrow={t('s1Name')} title={activityName} trailing={<span className={styles.change}>{t('change')}</span>} onClick={() => onChange(1)} aria-label={t('changeWhat', { what: t('s1Name') })} />
            <Row
              eyebrow={t('s2Name')}
              title={pick(getSolution(input.solution)?.name)}
              trailing={<span className={styles.change}>{t('change')}</span>}
              onClick={() => onChange(2)}
              aria-label={t('changeWhat', { what: t('s2Name') })}
            />
            <Row
              eyebrow={t('s3Name')}
              title={<span className="num">{`${fmt.area(input.areaSqm)} · ${zone ? pick(zone.name) : t('anyZone')}`}</span>}
              trailing={<span className={styles.change}>{t('change')}</span>}
              onClick={() => onChange(3)}
              aria-label={t('changeWhat', { what: t('s3Name') })}
            />
          </List>
        </Section>
      </Container>
    </>
  );
}

interface OptionCardProps {
  option: EligibilityOption;
  showSolution: boolean;
  why?: string;
  selected: boolean;
  onChoose: () => void;
}

function OptionCard({ option, showSolution, why, selected, onChoose }: OptionCardProps) {
  const t = useT(strings);
  const { pick, fmt } = useLang();
  const name = pick(option.zone.name);
  return (
    <Card as="li" selected={selected}>
      <p className={cx('type-callout', styles.zoneType)}>{showSolution ? pick(getSolution(option.solution)?.name) : pick(option.zone.typeLabel)}</p>
      <h3 className={cx('type-heading', styles.zoneName)}>{name}</h3>
      {why ? <p className={cx('type-callout', styles.why)}>{why}</p> : null}
      <div className={styles.figure}>
        <p className={cx('type-callout', styles.figureLabel)}>{t('annualRent')}</p>
        <p className={cx('num', styles.figureValue)}>{option.annualRent === null ? t('operatorPrice') : fmt.money(option.annualRent)}</p>
        {option.annualRent === null ? null : <span className={cx('type-callout', styles.figureTag)}>{t('estimateTag')}</span>}
      </div>
      {option.plotHint !== null ? (
        <p className={cx('type-callout', styles.plots)}>
          <span className="num">{plotsText(option.plotHint, fmt, t('plotsNone'))}</span>
          <DemoPill kind="illustrative" />
        </p>
      ) : null}
      <div className={styles.cardActions}>
        <Chip selected={selected} onClick={onChoose} leading={selected ? <Icon icon={Check} size={16} /> : undefined}>
          <span aria-hidden="true">{selected ? t('chosen') : t('choose')}</span>
          <span className="visually-hidden">{t('chooseZone', { zone: name })}</span>
        </Chip>
        <Button variant="quiet" size="sm" to={`/zones/${option.zone.code}`}>
          {t('viewZone')}
        </Button>
      </div>
    </Card>
  );
}
