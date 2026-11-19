/**
 * Eligibility check (service A2) — "does my activity fit a zone, and which plots fit?"
 *
 * The Service Guide describes the check but publishes neither the activity list nor the zone rules, so
 * both are ILLUSTRATIVE. The list is data/source/activities.json; the rules below follow the Guide's
 * own description: heavy industry at Mesaieed, light manufacturing in the Small and Medium Industries
 * Zone, warehousing and workshops in the logistics parks, open yards at Al Khor and Al Karaana,
 * commercial plots at Aba Saleel, Al Wakra and Birkat Al Awamer, and ready-built warehouses through
 * the operators of the five warehousing parks (service F1).
 *
 * The rules, in order:
 *  1. The activity's own verdict comes first. An activity that is not on the list, or is borderline,
 *     goes to a planning review instead of an instant answer; a non-targeted activity stops here.
 *  2. A targeted activity fits a zone when the solution covers the activity, the zone offers that
 *     solution, the activity is targeted in the zone, and the zone accepts its hazard class.
 *  3. Without a requested zone the check answers for every zone that fits. With one, it answers for
 *     that zone only; when it does not fit, the outcome says why and offers the zones and solutions
 *     that do.
 *  4. Where availability is known, a zone only counts when it has a free plot of the requested size.
 *  5. Rent is the requested area × the published price of the solution. Warehousing has no published
 *     price: the park operators set it, and Manateq refers the investor to them.
 */
import { activities, getActivity, getSolution, getZone } from '@/data/catalog';
import type { Activity, L10n, Lang, SolutionKey, Zone } from '@/data/types';
import { buildIndex, tokens, type SearchIndex } from './search';
import type { EligibilityResult } from './types';

export type Verdict = Activity['verdict'];

/** Pass this as the activity when the investor's activity is not on the list: it goes to a planning review. */
export const UNLISTED_ACTIVITY = 'ACT-000';

export interface EligibilityInput {
  activityCode: string;
  solution: SolutionKey;
  /** The area the investor needs, in m². */
  areaSqm: number;
  /** The zone the investor asked for, if any (an unknown code is ignored). Without it, every zone is checked. */
  zoneCode?: string;
}

/**
 * How many plots of at least `areaSqm` are free in a zone right now. In the target state this is the
 * land register (GIS); the prototype passes its illustrative plot layout. Asked for land zones only:
 * warehouse space is the operators' to report.
 */
export type Availability = (zoneCode: string, areaSqm: number) => number;

/** One way to fit: a zone with a solution. */
export interface EligibilityOption {
  zone: Zone;
  solution: SolutionKey;
  /** Area × the published price, in QAR a year. Null where the park operators set the price. */
  annualRent: number | null;
  /** Free plots of at least the requested area. Null when availability is not known here. */
  plotHint: number | null;
}

export interface EligibilityMatch extends EligibilityOption {
  fit: 'targeted';
}

export interface EligibilityAlternative extends EligibilityOption {
  /** Why this is offered, in one sentence. */
  why: L10n;
}

/**
 * What stands in the way when a targeted activity does not fit as asked:
 * the solution (it does not cover the activity, or the requested zone does not offer it), the zone
 * (the activity is not targeted there), the hazard class, or the lack of a free plot of that size.
 */
export type Obstacle = 'solution' | 'zone' | 'hazard' | 'plots';

export interface EligibilityOutcome {
  /** The answer for the activity itself. A targeted activity may still not fit as asked: see `eligible`. */
  verdict: Verdict;
  /**
   * One plain sentence: why the activity is targeted, needs a review or is not targeted — or, when it
   * is targeted but the first choice does not fit, why not.
   */
  reason: L10n;
  /**
   * The Guide's "eligible": the activity is targeted, it fits as asked and — where availability is
   * known — a plot of the requested size is free.
   */
  eligible: boolean;
  /** Set when the activity is targeted but not `eligible`. */
  obstacle: Obstacle | null;
  /**
   * Where the request fits as asked: the requested zone alone, or every zone that fits when none was
   * requested (zones with a free plot of that size first). Empty unless the verdict is 'targeted'.
   */
  matches: EligibilityMatch[];
  /**
   * Other ways to fit when the first choice does not: another solution in the same zone, the same
   * solution in another zone, or — failing both — another solution elsewhere. Each one can be checked
   * again as it is. Never repeats a match.
   */
  alternatives: EligibilityAlternative[];
  /** Something to know before going on: ready-built warehouses are leased through the park operators. */
  note: L10n | null;
  /**
   * The service that carries the result forward: the land application (A4), the operator referral (F1),
   * or availability alerts (E4) when the activity is targeted but no plot of that size is free.
   */
  next: 'A4' | 'E4' | 'F1' | null;
}

/**
 * Zones built for heavy industry. A high hazard class is accepted only there; it rules out the
 * lighter-industry zones (illustrative rule, after the Guide's own example).
 */
const HEAVY_INDUSTRY_ZONES: ReadonlySet<string> = new Set(['MIZ']);

/** The sentences of an outcome. `{zone}`, `{solution}` and `{area}` are filled in by `say`. */
const TEXT = {
  unlisted: {
    ar: 'هذا النشاط غير مدرج في القائمة بعد، فيراجعه فريق التخطيط بدلًا من القواعد.',
    en: 'This activity is not on the list yet, so the planning team reviews it instead of the rules.',
  },
  targeted: { ar: 'هذا النشاط من الأنشطة المستهدفة.', en: 'This is a targeted activity.' },
  review: { ar: 'هذا النشاط حالة حدّية، فيراجعه فريق التخطيط.', en: 'This activity is a borderline case, so the planning team reviews it.' },
  not_targeted: { ar: 'هذا النشاط ليس من الأنشطة المستهدفة.', en: 'This is not a targeted activity.' },
  solutionDoesNotCover: { ar: '{solution} لا تشمل هذا النشاط.', en: '{solution} do not cover this activity.' },
  solutionNotOffered: { ar: 'لا تتوفر {solution} في {zone}.', en: '{solution} are not offered in {zone}.' },
  hazardRulesOut: {
    ar: 'فئة خطورة النشاط تستبعد مناطق الصناعات الخفيفة، ومنها {zone}.',
    en: 'The hazard class of the activity rules out the lighter-industry zones, including {zone}.',
  },
  notTargetedHere: { ar: 'هذا النشاط غير مستهدف في {zone}.', en: 'This activity is not targeted in {zone}.' },
  noPlotHere: {
    ar: 'لا تتوفر الآن في {zone} قطعة بمساحة {area} أو أكثر.',
    en: 'No plot of {area} or more is free in {zone} right now.',
  },
  noPlotAnywhere: {
    ar: 'لا تتوفر الآن قطعة بمساحة {area} أو أكثر في المناطق المستهدفة لهذا النشاط.',
    en: 'No plot of {area} or more is free right now in the zones that target this activity.',
  },
  targetedIn: { ar: 'النشاط مستهدف في {zone}.', en: 'The activity is targeted in {zone}.' },
  coveredBy: { ar: 'تشمل {solution} هذا النشاط في {zone}.', en: '{solution} cover this activity in {zone}.' },
  plotsIn: { ar: 'تتوفر في {zone} قطع بمساحة {area} أو أكثر.', en: 'Plots of {area} or more are free in {zone}.' },
  referral: {
    ar: 'المستودعات الجاهزة يؤجّرها مشغّلو المجمّعات وهم من يحدّدون السعر، ونحيلك إلى المشغّل الذي تختاره.',
    en: 'Ready-built warehouses are leased by the park operators, who set the price; we refer you to the operator you choose.',
  },
} as const satisfies Record<string, L10n>;

function say(template: L10n, parts: Record<string, L10n>): L10n {
  const fill = (lang: Lang): string => template[lang].replace(/\{(\w+)\}/g, (whole, key: string) => parts[key]?.[lang] ?? whole);
  return { ar: fill('ar'), en: fill('en') };
}

/**
 * A zone's name inside a sentence. In English a zone named by a description takes the article
 * ("in the Small and Medium Industries Zone"); one named after a place does not ("in Al Wakra Logistics Park").
 */
function zoneName(zone: Zone): L10n {
  return { ar: zone.name.ar, en: /^(Small|Medium|Large)\b/.test(zone.name.en) ? `the ${zone.name.en}` : zone.name.en };
}

function solutionName(solution: SolutionKey): L10n {
  return getSolution(solution)?.name ?? { ar: solution, en: solution };
}

/** 20,000 م² · 20,000 m² (Western digits in both languages). */
function areaText(areaSqm: number): L10n {
  const n = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(areaSqm);
  return { ar: `${n} م²`, en: `${n} m²` };
}

/** The annual rent of an area under a solution, in QAR: area × the published price. Null where no price is published. */
export function estimateAnnualRent(solution: SolutionKey, areaSqm: number): number | null {
  const price = getSolution(solution)?.price.qarPerSqmYear ?? null;
  if (price === null || !Number.isFinite(areaSqm) || areaSqm <= 0) return null;
  return Math.round(areaSqm * price);
}

function acceptsHazard(zone: Zone, activity: Activity): boolean {
  return activity.hazard !== 'high' || HEAVY_INDUSTRY_ZONES.has(zone.code);
}

function fits(activity: Activity, zone: Zone, solution: SolutionKey): boolean {
  return activity.solutions.includes(solution) && zone.solutions.includes(solution) && activity.zones.includes(zone.code) && acceptsHazard(zone, activity);
}

/** The zones where an activity is targeted with one solution, in the activity's own order. */
function targetedZones(activity: Activity, solution: SolutionKey): Zone[] {
  return activity.zones.map((code) => getZone(code)).filter((zone): zone is Zone => zone !== undefined && fits(activity, zone, solution));
}

function freePlots(zone: Zone, areaSqm: number, availability: Availability | undefined): number | null {
  if (!availability || zone.kind !== 'land' || !Number.isFinite(areaSqm) || areaSqm <= 0) return null;
  const count = availability(zone.code, areaSqm);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : null;
}

/** Zones with a free plot of the requested size come first; the rest keep their order. */
function plotsFirst<T extends EligibilityOption>(options: T[]): T[] {
  return [...options].sort((a, b) => Number(a.plotHint === 0) - Number(b.plotHint === 0));
}

function closed(verdict: Verdict, reason: L10n): EligibilityOutcome {
  return { verdict, reason, eligible: false, obstacle: null, matches: [], alternatives: [], note: null, next: null };
}

/** Why a targeted activity fits nowhere as asked. */
function whyNot(activity: Activity, solution: SolutionKey, asked: Zone | undefined): { obstacle: Obstacle; reason: L10n } {
  const parts = { solution: solutionName(solution), ...(asked ? { zone: zoneName(asked) } : {}) };
  if (!asked || !activity.solutions.includes(solution)) return { obstacle: 'solution', reason: say(TEXT.solutionDoesNotCover, parts) };
  if (!asked.solutions.includes(solution)) return { obstacle: 'solution', reason: say(TEXT.solutionNotOffered, parts) };
  if (!acceptsHazard(asked, activity)) return { obstacle: 'hazard', reason: say(TEXT.hazardRulesOut, parts) };
  return { obstacle: 'zone', reason: say(TEXT.notTargetedHere, parts) };
}

/**
 * Runs the check. Give `availability` to learn which zones have a free plot of the requested size;
 * without it the check answers on targeting alone and every `plotHint` is null.
 */
export function checkEligibility(input: EligibilityInput, availability?: Availability): EligibilityOutcome {
  const activity = getActivity(input.activityCode);
  if (!activity) return closed('review', TEXT.unlisted);
  if (activity.verdict !== 'targeted') return closed(activity.verdict, activity.reason ?? TEXT[activity.verdict]);

  const { solution, areaSqm } = input;
  const asked = input.zoneCode ? getZone(input.zoneCode) : undefined;
  const area = areaText(areaSqm);
  const option = (zone: Zone, key: SolutionKey): EligibilityOption => ({
    zone,
    solution: key,
    annualRent: estimateAnnualRent(key, areaSqm),
    plotHint: freePlots(zone, areaSqm, availability),
  });
  const offer = (zone: Zone, key: SolutionKey, why: L10n): EligibilityAlternative => ({
    ...option(zone, key),
    why: say(why, { zone: zoneName(zone), solution: solutionName(key), area }),
  });

  const fitting = targetedZones(activity, solution);
  const matches = plotsFirst((asked ? fitting.filter((zone) => zone === asked) : fitting).map((zone): EligibilityMatch => ({ ...option(zone, solution), fit: 'targeted' })));

  if (!matches.length) {
    // Targeted, but not as asked: keep as much of the first choice as possible.
    const others = activity.solutions.filter((key) => key !== solution);
    const sameZone = asked ? others.filter((key) => fits(activity, asked, key)).map((key) => offer(asked, key, TEXT.coveredBy)) : [];
    const sameSolution = plotsFirst(fitting.map((zone) => offer(zone, solution, TEXT.targetedIn)));
    const alternatives =
      sameZone.length || sameSolution.length
        ? [...sameZone, ...sameSolution]
        : plotsFirst(others.flatMap((key) => targetedZones(activity, key).map((zone) => offer(zone, key, TEXT.coveredBy))));
    return { verdict: 'targeted', ...whyNot(activity, solution, asked), eligible: false, matches, alternatives, note: null, next: null };
  }

  if (matches.every((match) => match.plotHint === 0)) {
    // Targeted here, but nothing of that size is free: point to the zones that have it, and to the alerts.
    const elsewhere = asked ? fitting.filter((zone) => zone !== asked).map((zone) => offer(zone, solution, TEXT.plotsIn)) : [];
    return {
      verdict: 'targeted',
      reason: asked ? say(TEXT.noPlotHere, { zone: zoneName(asked), area }) : say(TEXT.noPlotAnywhere, { area }),
      eligible: false,
      obstacle: 'plots',
      matches,
      alternatives: elsewhere.filter((alternative) => (alternative.plotHint ?? 0) > 0),
      note: null,
      next: 'E4',
    };
  }

  const referred = solution === 'warehousing';
  return {
    verdict: 'targeted',
    reason: activity.reason ?? TEXT.targeted,
    eligible: true,
    obstacle: null,
    matches,
    alternatives: [],
    note: referred ? TEXT.referral : null,
    next: referred ? 'F1' : 'A4',
  };
}

/**
 * The compact record of a check, kept on the investor's profile and used to pre-fill the land
 * application (A4). `zoneCodes` are the zones where the request fits as asked.
 */
export function toEligibilityResult(input: EligibilityInput, outcome: EligibilityOutcome, at: number): EligibilityResult {
  return {
    at,
    activityCode: input.activityCode,
    solution: input.solution,
    areaSqm: input.areaSqm,
    verdict: outcome.verdict,
    zoneCodes: outcome.matches.map((match) => match.zone.code),
  };
}

// ----------------------------------------------------------------------------- activity search

/** The data keeps everyday search words beside each activity ("مصنع", "garage"…); the shared type does not list them yet. */
type Searchable = Activity & { keywords?: L10n };

/** Words that carry no meaning in a search (already normalised, as `tokens` returns them). */
const PARTICLES: ReadonlySet<string> = new Set(['و', 'او', 'في', 'من', 'مع', 'عن', 'علي', 'الي', 'a', 'an', 'and', 'for', 'in', 'of', 'or', 'the', 'to', 'with']);

/** Words any company could use about itself; they are dropped only when a search finds nothing with them. */
const GENERIC: ReadonlySet<string> = new Set(['شركه', 'موسسه', 'نشاط', 'مشروع', 'company', 'firm', 'business', 'activity', 'project']);

const isOnly = (word: string, words: ReadonlySet<string>): boolean => tokens(word).every((token) => words.has(token));

const indexes = new Map<Lang, SearchIndex<Activity>>();

/** One index per language: the name in the reader's language counts most, then the other name, the search words and the sector. */
function indexFor(lang: Lang): SearchIndex<Activity> {
  let index = indexes.get(lang);
  if (!index) {
    const other: Lang = lang === 'ar' ? 'en' : 'ar';
    index = buildIndex(
      activities.map((activity) => ({
        item: activity,
        fields: [activity.name[lang], activity.name[other], (activity as Searchable).keywords, activity.sector],
        keys: [activity.code],
      })),
    );
    indexes.set(lang, index);
  }
  return index;
}

/**
 * Finds activities by name, sector, everyday words or code, in Arabic and English at once, best match
 * first. An empty query returns the whole list in catalogue order. Non-targeted activities are found
 * too: the answer "not targeted, and why" is part of the service.
 */
export function searchActivities(query: string, lang: Lang, limit = Number.POSITIVE_INFINITY): Activity[] {
  if (!tokens(query).length) return activities.slice(0, limit);
  const index = indexFor(lang);
  const words = query.split(/\s+/).filter((word) => !isOnly(word, PARTICLES));
  const found = index.search(words.join(' '), limit);
  if (found.length) return found;
  const specific = words.filter((word) => !isOnly(word, GENERIC));
  return specific.length < words.length ? index.search(specific.join(' '), limit) : [];
}
