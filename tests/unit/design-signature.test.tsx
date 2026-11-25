import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { LangProvider } from '@/app/i18n';
import { services, zones } from '@/data/catalog';
import type { Lang, Standard } from '@/data/types';
import { neighbourMarker, nearestMarker, placeLabel, spreadMarkers } from '@/design/QatarMap/layout';
import { DocCard, FetchedList, HolderChip, JourneyRibbon, LevelMeter, NextStepCard, PassCard, PlotGrid, QatarMap, Ring, ringTone, StandardBadge, Timeline, type TimelineItem } from '@/design/signature';
import { plotsFor } from '@/domain/plots';
import { arabicCount, clockTone, dayOf, durationText, isInstant, standardFigure, standardHeadline, timeLeft } from '@/domain/standard';

const std = (value: number | null, unit: Standard['unit']): Standard => ({ ar: '', en: '', value, unit });

describe('standard headlines', () => {
  it('sorts whole numbers into the Arabic plural categories', () => {
    expect(arabicCount(1)).toBe('one');
    expect(arabicCount(2)).toBe('two');
    expect([3, 7, 10, 103, 110].map(arabicCount)).toEqual(['few', 'few', 'few', 'few', 'few']);
    expect([11, 15, 24, 99, 111].map(arabicCount)).toEqual(['many', 'many', 'many', 'many', 'many']);
    expect([0, 100, 101, 102, 200, 2.5].map(arabicCount)).toEqual(['other', 'other', 'other', 'other', 'other', 'other']);
  });

  it('says "instant" for instant standards', () => {
    expect(standardHeadline(std(null, 'instant'), 'ar')).toBe('فوري');
    expect(standardHeadline(std(null, 'instant'), 'en')).toBe('Instant');
    expect(standardHeadline(std(0, 'working_day'), 'en')).toBe('Instant');
    expect(isInstant(std(null, 'instant'))).toBe(true);
    expect(isInstant(std(1, 'hour'))).toBe(false);
    expect(isInstant(std(null, null))).toBe(false);
  });

  it('counts working days in Arabic: 1, 2, 3–10, 11+', () => {
    expect(standardHeadline(std(1, 'working_day'), 'ar')).toBe('يوم عمل واحد');
    expect(standardHeadline(std(2, 'working_day'), 'ar')).toBe('يوما عمل');
    expect(standardHeadline(std(3, 'working_day'), 'ar')).toBe('3 أيام عمل');
    expect(standardHeadline(std(5, 'working_day'), 'ar')).toBe('5 أيام عمل');
    expect(standardHeadline(std(10, 'working_day'), 'ar')).toBe('10 أيام عمل');
    expect(standardHeadline(std(11, 'working_day'), 'ar')).toBe('11 يوم عمل');
    expect(standardHeadline(std(15, 'working_day'), 'ar')).toBe('15 يوم عمل');
    expect(standardHeadline(std(20, 'working_day'), 'ar')).toBe('20 يوم عمل');
    expect(standardHeadline(std(100, 'working_day'), 'ar')).toBe('100 يوم عمل');
  });

  it('counts the other units in Arabic', () => {
    expect(standardHeadline(std(1, 'hour'), 'ar')).toBe('ساعة واحدة');
    expect(standardHeadline(std(2, 'hour'), 'ar')).toBe('ساعتان');
    expect(standardHeadline(std(3, 'hour'), 'ar')).toBe('3 ساعات');
    expect(standardHeadline(std(24, 'hour'), 'ar')).toBe('24 ساعة');
    expect(standardHeadline(std(1, 'minute'), 'ar')).toBe('دقيقة واحدة');
    expect(standardHeadline(std(2, 'minute'), 'ar')).toBe('دقيقتان');
    expect(standardHeadline(std(5, 'minute'), 'ar')).toBe('5 دقائق');
    expect(standardHeadline(std(15, 'minute'), 'ar')).toBe('15 دقيقة');
    expect(standardHeadline(std(1, 'day'), 'ar')).toBe('يوم واحد');
    expect(standardHeadline(std(2, 'day'), 'ar')).toBe('يومان');
    expect(standardHeadline(std(7, 'day'), 'ar')).toBe('7 أيام');
    expect(standardHeadline(std(14, 'day'), 'ar')).toBe('14 يومًا');
    expect(standardHeadline(std(1, 'month'), 'ar')).toBe('شهر واحد');
    expect(standardHeadline(std(2, 'month'), 'ar')).toBe('شهران');
    expect(standardHeadline(std(6, 'month'), 'ar')).toBe('6 أشهر');
    expect(standardHeadline(std(12, 'month'), 'ar')).toBe('12 شهرًا');
  });

  it('counts in English: one and other', () => {
    expect(standardHeadline(std(1, 'working_day'), 'en')).toBe('1 working day');
    expect(standardHeadline(std(5, 'working_day'), 'en')).toBe('5 working days');
    expect(standardHeadline(std(1, 'hour'), 'en')).toBe('1 hour');
    expect(standardHeadline(std(2, 'hour'), 'en')).toBe('2 hours');
    expect(standardHeadline(std(1, 'minute'), 'en')).toBe('1 minute');
    expect(standardHeadline(std(3, 'month'), 'en')).toBe('3 months');
    expect(durationText(2, 'day', 'en')).toBe('2 days');
  });

  it('has no headline when the standard states no duration', () => {
    expect(standardHeadline(std(null, null), 'ar')).toBeNull();
    expect(standardHeadline(std(null, 'working_day'), 'en')).toBeNull();
    expect(standardHeadline(std(5, null), 'en')).toBeNull();
    expect(standardFigure(std(null, null), 'ar')).toBeNull();
  });

  it('splits the headline into its number and its words', () => {
    expect(standardFigure(std(5, 'working_day'), 'ar')).toEqual({ value: '5', words: 'أيام عمل' });
    expect(standardFigure(std(1, 'working_day'), 'ar')).toEqual({ value: null, words: 'يوم عمل واحد' });
    expect(standardFigure(std(2, 'hour'), 'ar')).toEqual({ value: null, words: 'ساعتان' });
    expect(standardFigure(std(1, 'working_day'), 'en')).toEqual({ value: '1', words: 'working day' });
    expect(standardFigure(std(null, 'instant'), 'en')).toEqual({ value: null, words: 'Instant' });
  });

  it('gives every service of the catalogue a headline or none, in both languages', () => {
    expect(services.length).toBeGreaterThan(0);
    for (const service of services) {
      for (const lang of ['ar', 'en'] as Lang[]) {
        const headline = standardHeadline(service.standard, lang);
        if (service.standard.unit === 'instant') expect(headline, service.id).toBe(lang === 'ar' ? 'فوري' : 'Instant');
        else if (service.standard.value === null || service.standard.unit === null) expect(headline, service.id).toBeNull();
        else expect(headline, service.id).toMatch(/\S/);
        // Western digits only.
        if (headline) expect(headline).not.toMatch(/[٠-٩۰-۹]/);
      }
    }
  });
});

describe('the standard clock in words', () => {
  it('says which day of the standard a request is on', () => {
    expect(dayOf({ dayNumber: 2, targetDays: 5 }, 'ar')).toBe('اليوم 2 من 5');
    expect(dayOf({ dayNumber: 2, targetDays: 5 }, 'en')).toBe('Day 2 of 5');
    expect(dayOf({ dayNumber: 6, targetDays: 5 }, 'en')).toBe('Day 6 of 5');
    expect(dayOf({ dayNumber: 0, targetDays: 1 }, 'en')).toBe('Day 1 of 1');
  });

  it('counts days without a total when the standard has no duration, and stays silent for standards under a day', () => {
    expect(dayOf({ dayNumber: 3, targetDays: null }, 'ar')).toBe('اليوم 3');
    expect(dayOf({ dayNumber: 3, targetDays: null }, 'en')).toBe('Day 3');
    expect(dayOf({ dayNumber: 1, targetDays: 0.125 }, 'en')).toBeNull();
    expect(dayOf({ dayNumber: 1, targetDays: 0 }, 'ar')).toBeNull();
  });

  it('says how much time is left, or how far past the standard a request is', () => {
    // day 2 of 5: three whole days after today
    expect(timeLeft({ usedDays: 1.4, targetDays: 5 }, 'ar')).toBe('بقيت 3 أيام');
    expect(timeLeft({ usedDays: 1.4, targetDays: 5 }, 'en')).toBe('3 days left');
    expect(timeLeft({ usedDays: 2.2, targetDays: 5 }, 'ar')).toBe('بقي يومان');
    expect(timeLeft({ usedDays: 3.2, targetDays: 5 }, 'ar')).toBe('بقي يوم واحد');
    expect(timeLeft({ usedDays: 3.2, targetDays: 5 }, 'en')).toBe('1 day left');
    expect(timeLeft({ usedDays: 4.2, targetDays: 5 }, 'ar')).toBe('اليوم الأخير ضمن المعيار');
    expect(timeLeft({ usedDays: 4.2, targetDays: 5 }, 'en')).toBe('Last day within the standard');
    expect(timeLeft({ usedDays: 5, targetDays: 5 }, 'en')).toBe('Last day within the standard');
    expect(timeLeft({ usedDays: 0.5, targetDays: 1 }, 'ar')).toBe('اليوم الأخير ضمن المعيار');
    // a request that has just started is on day 1
    expect(timeLeft({ usedDays: 0, targetDays: 5 }, 'en')).toBe('4 days left');
    expect(timeLeft({ usedDays: 2, targetDays: 5 }, 'en')).toBe('3 days left');
    expect(timeLeft({ usedDays: 2, targetDays: 20 }, 'ar')).toBe('بقي 18 يومًا');
    expect(timeLeft({ usedDays: 5.5, targetDays: 5 }, 'ar')).toBe('متأخر يومًا واحدًا عن المعيار');
    expect(timeLeft({ usedDays: 6.5, targetDays: 5 }, 'ar')).toBe('متأخر يومين عن المعيار');
    expect(timeLeft({ usedDays: 8, targetDays: 5 }, 'en')).toBe('3 days over the standard');
    expect(timeLeft({ usedDays: 1, targetDays: null }, 'en')).toBeNull();
    expect(timeLeft({ usedDays: 0.01, targetDays: 0.125 }, 'en')).toBeNull();
  });

  it('turns calm, then warns above 0.8, then marks the standard as exceeded above 1', () => {
    expect(clockTone(0)).toBe('accent');
    expect(clockTone(0.8)).toBe('accent');
    expect(clockTone(0.81)).toBe('warn');
    expect(clockTone(1)).toBe('warn');
    expect(clockTone(1.01)).toBe('bad');
  });
});

/* ───────────────────────────── rendering helpers ───────────────────────────── */

let root: Root | null = null;
let host: HTMLElement | null = null;

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  if (root) act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

/** Mounts a component in the document, in Arabic unless told otherwise. */
function mount(node: ReactNode, lang: Lang = 'ar'): HTMLElement {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root?.render(<LangProvider lang={lang}>{node}</LangProvider>));
  return host;
}

/** Renders to static markup and parses it, for components that need no interaction. */
function still(node: ReactNode, lang: Lang = 'ar'): HTMLElement {
  const box = document.createElement('div');
  box.innerHTML = renderToStaticMarkup(<LangProvider lang={lang}>{node}</LangProvider>);
  return box;
}

const click = (element: Element | null | undefined) => {
  if (!element) throw new Error('nothing to click');
  act(() => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

describe('Ring', () => {
  it('is an image with the label it is given', () => {
    const ring = still(<Ring value={0.4} label="اليوم 2 من 5">2/5</Ring>).querySelector('[role="img"]');
    expect(ring?.getAttribute('aria-label')).toBe('اليوم 2 من 5');
    expect(ring?.textContent).toBe('2/5');
    // The centre repeats the label visually, so it is hidden from screen readers.
    expect(ring?.querySelector('[aria-hidden="true"]:not(svg)')?.textContent).toBe('2/5');
  });

  it('changes tone at the thresholds: warn above 0.8, bad above 1', () => {
    const tone = (value: number | null, complete = false) => still(<Ring value={value} complete={complete} label="x" />).querySelector('[role="img"]')?.getAttribute('data-tone');
    expect(tone(0)).toBe('accent');
    expect(tone(0.4)).toBe('accent');
    expect(tone(0.8)).toBe('accent');
    expect(tone(0.81)).toBe('warn');
    expect(tone(1)).toBe('warn');
    expect(tone(1.01)).toBe('bad');
    expect(tone(3)).toBe('bad');
    expect(tone(null)).toBe('idle');
    expect(tone(0.2, true)).toBe('ok');
    expect(ringTone(0.9)).toBe('warn');
    expect(ringTone(1.2, true)).toBe('ok');
  });

  it('draws the arc for the share used and never more than a full circle', () => {
    const offset = (value: number | null) => still(<Ring value={value} label="x" />).querySelectorAll('circle')[1]?.getAttribute('stroke-dashoffset');
    expect(offset(0.4)).toBe('60');
    expect(offset(1)).toBe('0');
    expect(offset(1.7)).toBe('0');
    expect(offset(0)).toBeUndefined();
    expect(offset(null)).toBeUndefined();
  });

  it('shows a tick when complete, in three sizes', () => {
    const done = still(<Ring value={0.5} complete size="lg" label="اكتمل" />);
    expect(done.querySelectorAll('circle')[1]?.getAttribute('stroke-dashoffset')).toBe('0');
    expect(done.querySelectorAll('svg')).toHaveLength(2);
    for (const [size, px] of [['sm', '36'], ['md', '52'], ['lg', '84']] as const) {
      expect(still(<Ring value={0.5} size={size} label="x" />).querySelector('svg')?.getAttribute('width')).toBe(px);
    }
  });
});

const steps: TimelineItem[] = [
  { id: 1, title: 'قدّم الاستشاري طلب الرخصة', lane: 'inv', state: 'done', time: '17 نوفمبر' },
  { id: 2, title: 'طلب نظام الوزارة موافقة مناطق', lane: 'nat', holderName: 'وزارة البلدية', state: 'done', auto: true },
  { id: 3, title: 'سُجّل مرجع الرخصة على قطعتك', lane: 'eng', state: 'done', auto: true },
  { id: 4, title: 'هل الشهادة سارية؟', lane: 'eng', state: 'done', outcome: 'نعم · الشهادة سارية' },
  { id: 5, title: 'أُرسلت الشهادة إلى الوزارة', lane: 'nat', state: 'done', auto: true },
  { id: 6, title: 'الوزارة تراجع طلب الرخصة', text: 'لا يلزمك شيء الآن.', lane: 'nat', holderName: 'وزارة البلدية', state: 'current', time: 'متوقع خلال 3 أيام عمل' },
  { id: 7, title: 'تحديثات الدفاع المدني وكهرماء', lane: 'nat', state: 'upcoming', auto: true },
  { id: 8, title: 'إصدار الرخصة يحدّث سجل قطعتك', lane: 'eng', state: 'upcoming', auto: true, standard: 'فوري' },
  { id: 9, title: 'اطلب تصريح تحضير الموقع', lane: 'inv', state: 'upcoming' },
  { id: 10, title: 'تبدأ مدة الإنشاء', lane: 'one', state: 'upcoming' },
];

describe('Timeline', () => {
  it('is an ordered list with exactly one current step', () => {
    const box = mount(<Timeline items={steps} />);
    const list = box.querySelector('ol');
    expect(list).not.toBeNull();
    expect(list?.querySelectorAll(':scope > li')).toHaveLength(10);
    const current = box.querySelectorAll('[aria-current="step"]');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain('الوزارة تراجع طلب الرخصة');
    expect(current[0]?.textContent).toContain('وزارة البلدية');
    expect(current[0]?.textContent).toContain('متوقع خلال 3 أيام عمل');
    expect(current[0]?.textContent).toContain('لا يلزمك شيء الآن.');
    expect(box.querySelectorAll('button')).toHaveLength(0);
  });

  it('marks automatic steps and shows the outcome of decisions', () => {
    const box = mount(<Timeline items={steps} />);
    const items = [...box.querySelectorAll('ol > li')];
    expect(items[1]?.textContent).toContain('آلي');
    expect(items[1]?.textContent).toContain('وزارة البلدية');
    expect(items[0]?.textContent).toContain('أنت');
    expect(items[0]?.textContent).not.toContain('آلي');
    expect(items[3]?.textContent).toContain('نعم · الشهادة سارية');
    expect(items[7]?.textContent).toContain('فوري');
    // every step says its state to screen readers
    expect(items[0]?.textContent).toContain('مكتملة');
    expect(items[9]?.textContent).toContain('قادمة');
  });

  it('folds earlier steps and limits upcoming ones when collapsed', () => {
    const box = mount(<Timeline items={steps} collapsedCount={2} />);
    const shown = () => box.querySelectorAll('ol > li').length;
    const [past, more] = [...box.querySelectorAll('button')];
    // 5 earlier steps folded, the current step, 2 of 4 upcoming
    expect(shown()).toBe(3);
    expect(box.querySelector('ol')?.getAttribute('start')).toBe('6');
    expect(past?.textContent).toContain('عرض الخطوات السابقة (5)');
    expect(past?.getAttribute('aria-expanded')).toBe('false');
    expect(more?.textContent).toContain('عرض كل الخطوات');
    expect(box.querySelectorAll('[aria-current="step"]')).toHaveLength(1);

    click(past);
    expect(shown()).toBe(8);
    expect(past?.getAttribute('aria-expanded')).toBe('true');
    expect(past?.textContent).toContain('إخفاء الخطوات السابقة');
    expect(box.querySelector('ol')?.getAttribute('start')).toBe('1');

    click(past);
    expect(shown()).toBe(3);

    click(more);
    expect(shown()).toBe(10);
    expect(more?.textContent).toContain('عرض أقل');
    expect(more?.getAttribute('aria-expanded')).toBe('true');

    click(more);
    expect(shown()).toBe(3);
  });

  it('does not fold a single step, and keeps the last steps of a finished request', () => {
    const short = mount(<Timeline items={steps.slice(4, 8)} collapsedCount={2} />);
    // one earlier step and two upcoming: nothing worth folding
    expect(short.querySelectorAll('ol > li')).toHaveLength(4);
    expect(short.querySelectorAll('button')).toHaveLength(0);
    act(() => root?.unmount());
    short.remove();

    const finished = steps.map((step) => ({ ...step, state: 'done' as const }));
    const box = mount(<Timeline items={finished} collapsedCount={3} />);
    expect(box.querySelectorAll('ol > li')).toHaveLength(3);
    expect(box.querySelector('button')?.textContent).toContain('(7)');
    expect(box.querySelectorAll('[aria-current="step"]')).toHaveLength(0);
  });

  it('speaks English', () => {
    const box = mount(<Timeline items={steps} collapsedCount={2} />, 'en');
    const [past, more] = [...box.querySelectorAll('button')];
    expect(past?.textContent).toContain('Show earlier steps (5)');
    expect(more?.textContent).toContain('Show all steps');
    expect(box.querySelector('ol')?.getAttribute('aria-label')).toBe('Request steps');
  });
});

describe('the map layout', () => {
  const width = 215;
  const height = 440;
  const anchors = zones.map((zone) => ({ id: zone.code, x: (zone.map.x / 100) * width, y: (zone.map.y / 100) * height }));

  it('moves crowded markers apart and leaves the others where they are', () => {
    const placed = spreadMarkers(anchors, 28);
    expect(placed.map((p) => p.id)).toEqual(anchors.map((a) => a.id));
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.id}–${b.id}`).toBeGreaterThanOrEqual(27.9);
      }
    }
    for (const point of placed) {
      expect(point.room).toBeGreaterThanOrEqual(27.9);
      // nobody travels far: the map stays recognisable
      expect(Math.hypot(point.x - point.ax, point.y - point.ay), point.id).toBeLessThan(30);
    }
    const lone = placed.find((p) => p.id === 'KH')!;
    expect(Math.hypot(lone.x - lone.ax, lone.y - lone.ay)).toBeLessThan(0.5);
  });

  it('is deterministic and does not depend on the order of the input', () => {
    const once = spreadMarkers(anchors, 28);
    const again = spreadMarkers(anchors, 28);
    expect(again).toEqual(once);
    const reversed = spreadMarkers([...anchors].reverse(), 28);
    for (const point of once) {
      const twin = reversed.find((p) => p.id === point.id)!;
      expect(twin.x).toBeCloseTo(point.x, 6);
      expect(twin.y).toBeCloseTo(point.y, 6);
    }
  });

  it('separates markers that share a spot', () => {
    const placed = spreadMarkers([{ id: 'a', x: 10, y: 10 }, { id: 'b', x: 10, y: 10 }, { id: 'c', x: 10, y: 10 }], 20);
    expect(Math.hypot(placed[0]!.x - placed[1]!.x, placed[0]!.y - placed[1]!.y)).toBeGreaterThanOrEqual(19.9);
    expect(Math.hypot(placed[1]!.x - placed[2]!.x, placed[1]!.y - placed[2]!.y)).toBeGreaterThanOrEqual(19.9);
  });

  it('finds the marker near a tap and the neighbour for an arrow key', () => {
    const markers = [{ id: 'n', x: 50, y: 10 }, { id: 'c', x: 50, y: 50 }, { id: 'e', x: 90, y: 55 }, { id: 's', x: 45, y: 95 }];
    expect(nearestMarker(markers, { x: 56, y: 44 }, 30)?.id).toBe('c');
    expect(nearestMarker(markers, { x: 200, y: 200 }, 30)).toBeUndefined();
    expect(neighbourMarker(markers, 'c', 'up')?.id).toBe('n');
    expect(neighbourMarker(markers, 'c', 'right')?.id).toBe('e');
    expect(neighbourMarker(markers, 'c', 'down')?.id).toBe('s');
    expect(neighbourMarker(markers, 'n', 'up')).toBeUndefined();
    expect(neighbourMarker(markers, 'missing', 'up')).toBeUndefined();
  });

  it('keeps the name tag inside the map, off its own marker and off the neighbours when it can', () => {
    const bounds = { minX: -40, maxX: width + 40, minY: 0, maxY: height };
    const size = { width: 170, height: 26 };
    const placed = spreadMarkers(anchors, 28);
    for (const marker of placed) {
      const others = placed.filter((p) => p.id !== marker.id);
      const place = placeLabel(marker, size, others, bounds, 18, 10);
      expect(place.left, marker.id).toBeGreaterThanOrEqual(bounds.minX);
      expect(place.left + size.width, marker.id).toBeLessThanOrEqual(bounds.maxX);
      expect(place.top, marker.id).toBeGreaterThanOrEqual(bounds.minY);
      expect(place.top + size.height, marker.id).toBeLessThanOrEqual(bounds.maxY);
      // the tag never sits on the marker it names
      const nearX = Math.max(place.left, Math.min(place.left + size.width, marker.x));
      const nearY = Math.max(place.top, Math.min(place.top + size.height, marker.y));
      expect(Math.hypot(marker.x - nearX, marker.y - nearY), marker.id).toBeGreaterThanOrEqual(17);
      // and covers none of the others
      for (const other of others) {
        const x = Math.max(place.left, Math.min(place.left + size.width, other.x));
        const y = Math.max(place.top, Math.min(place.top + size.height, other.y));
        expect(Math.hypot(other.x - x, other.y - y), `${marker.id} over ${other.id}`).toBeGreaterThanOrEqual(10);
      }
    }
    // an isolated marker gets the simplest place: centred above
    const lone = placed.find((p) => p.id === 'KH')!;
    const simple = placeLabel(lone, size, placed.filter((p) => p.id !== 'KH'), bounds, 18, 10);
    expect(simple.side).toBe('above');
    expect(simple.left).toBeCloseTo(lone.x - size.width / 2, 6);
  });
});

describe('signature components', () => {
  it('names who has it now', () => {
    const text = (node: ReactNode, lang: Lang = 'ar') => still(node, lang).textContent ?? '';
    expect(text(<HolderChip lane="inv" />)).toContain('عندك');
    expect(text(<HolderChip lane="inv" />, 'en')).toContain('With you');
    expect(text(<HolderChip lane="one" />)).toContain('مناطق ون');
    expect(text(<HolderChip lane="eng" />)).toContain('آلي');
    expect(text(<HolderChip lane="staff" />)).toContain('موظفو مناطق');
    expect(text(<HolderChip lane="nat" />)).toContain('جهة حكومية');
    expect(text(<HolderChip lane="nat" name="وزارة البلدية" />)).toContain('وزارة البلدية');
    expect(text(<HolderChip lane="nat" name="وزارة البلدية" />)).not.toContain('جهة حكومية');
    expect(text(<HolderChip lane="field" />, 'en')).toContain('Field team');
    expect(text(<HolderChip lane="eng" />, 'en')).toContain('Who has it now?');
  });

  it('marks sources that are not connected yet', () => {
    const box = still(
      <FetchedList
        items={[
          { text: 'اسم الشركة', source: { name: 'منصة تبادل البيانات الحكومية', live: true } },
          { text: 'حدود القطعة', source: { name: 'نظام المعلومات الجغرافية', live: false } },
          { text: 'رقم الهاتف' },
        ]}
      />,
    );
    const items = [...box.querySelectorAll('li')];
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toContain('منصة تبادل البيانات الحكومية');
    expect(items[0]?.textContent).not.toContain('قيد الربط');
    expect(items[1]?.textContent).toContain('قيد الربط');
    expect(box.textContent).toContain('مرة واحدة فقط');
    expect(still(<FetchedList items={[]} caption={false} />).textContent).toBe('');
  });

  it('shows a standard large, and as a chip only when it has a headline', () => {
    const five: Standard = { ar: 'إصدار العقد خلال خمسة أيام عمل.', en: 'Contract issued within five working days.', value: 5, unit: 'working_day' };
    const none: Standard = { ar: 'توثيق الملف في الجلسة نفسها.', en: 'Profile verified in the same session.', value: null, unit: null };
    const full = still(<StandardBadge standard={five} />);
    expect(full.textContent).toContain('5');
    expect(full.textContent).toContain('أيام عمل');
    expect(full.textContent).toContain('استرشادي');
    expect(full.textContent).toContain('إصدار العقد خلال خمسة أيام عمل.');
    expect(still(<StandardBadge standard={five} variant="compact" />, 'en').textContent).toContain('5 working days');
    expect(still(<StandardBadge standard={none} variant="compact" />).innerHTML).toBe('');
    const plain = still(<StandardBadge standard={none} />, 'en');
    expect(plain.textContent).toContain('Profile verified in the same session.');
    expect(plain.textContent).toContain('Indicative');
  });

  it('lets only available plots be chosen', () => {
    const plots = plotsFor('BA');
    const chosen: string[] = [];
    const box = mount(<PlotGrid plots={plots} selected="BA-117" onSelect={(plot) => chosen.push(plot.id)} />);
    const cells = [...box.querySelectorAll<HTMLButtonElement>('button[data-plot]')];
    expect(cells).toHaveLength(40);
    for (const cell of cells) {
      const plot = plots.find((p) => p.id === cell.dataset.plot)!;
      expect(cell.disabled, plot.id).toBe(plot.status !== 'available');
    }
    expect(box.querySelector('[data-plot="BA-117"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(box.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    // one plot is in the tab order: the chosen one
    expect(cells.filter((cell) => !cell.disabled && cell.tabIndex === 0).map((cell) => cell.dataset.plot)).toEqual(['BA-117']);
    expect(box.textContent).toContain('BA-117');
    expect(box.textContent?.replace(/\s/g, ' ')).toContain('5,000 م²');
    expect(box.textContent).toContain('مخطط توضيحي');
    click(box.querySelector('[data-plot="BA-102"]'));
    expect(chosen).toEqual(['BA-102']);
  });

  it('shows the plots the investor already holds as taken', () => {
    const plots = plotsFor('BA');
    expect(plots.find((plot) => plot.id === 'BA-117')?.status).toBe('available');
    const box = mount(<PlotGrid plots={plots} selected="BA-117" onSelect={() => undefined} own={['BA-117']} />);
    const mine = box.querySelector<HTMLButtonElement>('[data-plot="BA-117"]');
    expect(mine?.disabled).toBe(true);
    expect(mine?.getAttribute('aria-label')).toContain('قطعتك');
    // a plot that is no longer available cannot stay chosen
    expect(box.querySelectorAll('[aria-pressed="true"]')).toHaveLength(0);
    expect(box.textContent).toContain('اختر قطعة متاحة');
    expect(box.querySelector('ul')?.textContent).toContain('قطعتك');
  });

  it('dims the available plots this request cannot use, and keeps the legend honest', () => {
    const plots = plotsFor('BA');
    const free = plots.filter((plot) => plot.status === 'available');
    const big = Math.max(...free.map((plot) => plot.areaSqm));
    const box = mount(<PlotGrid plots={plots} onSelect={() => undefined} isSelectable={(plot) => plot.areaSqm >= big} unfitLabel="أصغر من المساحة المطلوبة" />);
    const unfit = free.filter((plot) => plot.areaSqm < big);
    expect(unfit.length).toBeGreaterThan(0);
    for (const plot of unfit) {
      const cell = box.querySelector<HTMLButtonElement>(`[data-plot="${plot.id}"]`);
      expect(cell?.disabled, plot.id).toBe(true);
      expect(cell?.getAttribute('aria-label')).toContain('أصغر من المساحة المطلوبة');
      expect(cell?.getAttribute('title')).toBe('أصغر من المساحة المطلوبة');
    }
    const tabbable = [...box.querySelectorAll<HTMLButtonElement>('button[data-plot]')].filter((cell) => !cell.disabled && cell.tabIndex === 0);
    expect(tabbable).toHaveLength(1);
    expect(plots.find((plot) => plot.id === tabbable[0]?.dataset.plot)?.areaSqm).toBe(big);
    expect(box.querySelector('ul')?.textContent).toContain('أصغر من المساحة المطلوبة');
    // Without the rule nothing is dimmed and the legend has no such key.
    const plain = mount(<PlotGrid plots={plots} onSelect={() => undefined} />);
    expect(plain.querySelector('ul')?.textContent).not.toContain('لا تناسب طلبك');
  });

  it('puts every zone on the map as a button and reports the chosen one', () => {
    const chosen: string[] = [];
    const box = mount(<QatarMap selected="BA" onSelect={(code) => chosen.push(code)} />);
    const markers = [...box.querySelectorAll<HTMLButtonElement>('button[data-zone]')];
    expect(markers).toHaveLength(zones.length);
    expect(box.querySelector('[data-zone="BA"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(box.querySelectorAll('[aria-pressed="true"]')).toHaveLength(1);
    expect(markers.filter((marker) => marker.tabIndex === 0)).toHaveLength(1);
    expect(box.querySelector('[data-zone="BA"]')?.getAttribute('aria-label')).toContain('مجمّع بركة العوامر اللوجستي');
    expect(box.textContent).toContain('خريطة تخطيطية');
    click(box.querySelector('[data-zone="KH"]'));
    expect(chosen).toEqual(['KH']);
  });

  it('keeps only highlighted zones selectable on the map', () => {
    const box = mount(<QatarMap selected="MIZ" onSelect={() => undefined} highlight={['BA', 'AW']} />, 'en');
    const codes = [...box.querySelectorAll<HTMLButtonElement>('button[data-zone]')].map((marker) => marker.dataset.zone);
    // the selected zone stays, even outside the filter
    expect(codes.sort()).toEqual(['AW', 'BA', 'MIZ']);
    expect(box.textContent).toContain('Schematic map');
  });

  it('shows the next step as a dark hero tile with its building render', () => {
    const box = still(
      <NextStepCard
        tone="hero"
        eyebrow="خطوتك التالية"
        title="قدّم طلب رخصة البناء"
        context="شهادة عدم الممانعة جاهزة."
        due="خلال 5 أيام"
        cta={{ label: 'ابدأ الطلب', to: '/start/C1' }}
        secondary={{ label: 'ما المطلوب', to: '/services/C1' }}
        render="construction"
      />,
    );
    const tile = box.querySelector('section');
    expect(tile?.getAttribute('data-tone')).toBe('brand');
    expect(tile?.querySelector('h2')?.textContent).toBe('قدّم طلب رخصة البناء');
    expect(box.querySelector('a[href="#/start/C1"]')?.textContent).toContain('ابدأ الطلب');
    expect(box.querySelector('a[href="#/services/C1"]')?.textContent).toContain('ما المطلوب');
    expect(box.textContent).toContain('خلال 5 أيام');
    // the render rests below the words and is decorative: the headline already says it
    const image = box.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('alt')).toBe('');
    expect(tile?.lastElementChild?.contains(image ?? null)).toBe(true);
    // quiet tones are not dark tiles; the calm card without a render shows no image
    const calm = still(<NextStepCard tone="clear" title="كل شيء على ما يرام" />);
    expect(calm.querySelector('section')?.hasAttribute('data-tone')).toBe(false);
    expect(calm.querySelector('img')).toBeNull();
    expect(still(<NextStepCard tone="clear" title="منشأتك تعمل" render="warehouse" />).querySelector('img')).not.toBeNull();
  });

  it('renders the cards without crashing, in both languages', () => {
    for (const lang of ['ar', 'en'] as Lang[]) {
      const box = still(
        <>
          <NextStepCard eyebrow="الخطوة التالية" title="وقّع عقد الإيجار" context="القطعة محجوزة لك." due="خلال 5 أيام" cta={{ label: 'راجِع ووقّع', to: '/requests/r1' }} more={{ label: 'و3 إجراءات أخرى', onClick: () => undefined }} />
          <NextStepCard tone="clear" title="كل شيء على ما يرام" />
          <JourneyRibbon
            label="رحلتك"
            stations={[
              { key: 'join', label: 'الانضمام', state: 'done' },
              { key: 'contract', label: 'العقد', state: 'current' },
              { key: 'build', label: 'البناء', state: 'upcoming' },
              { key: 'operate', label: 'التشغيل', state: 'upcoming' },
            ]}
            onSelect={() => undefined}
          />
          <LevelMeter now={1} target={4} />
          <ul>
            <DocCard kind="contract" title="عقد إيجار" reference="MQ-LC-1" date="19 نوفمبر 2026" signed to="/account/wallet/d1" />
          </ul>
          <DocCard variant="paper" kind="contract" issuer="مناطق" title="عقد إيجار" reference="MQ-LC-1" date="19 نوفمبر 2026" signed verifyCode="7KQ2-9XTM" lines={[{ label: 'المستأجر', value: 'شركة المثال' }]} />
          <PassCard kind="vehicle" holder="سائق (تجريبي)" idOrPlate="123456" zone="بركة العوامر" plot="BA-117" validFrom="19 نوفمبر" validTo="21 نوفمبر" status="active" code="MQP-1" />
        </>,
        lang,
      );
      expect(box.querySelector('a[href="#/requests/r1"]')?.textContent).toContain('راجِع ووقّع');
      expect(box.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
      expect(box.querySelectorAll('ol > li button')).toHaveLength(4);
      expect(box.querySelector('article dl')).not.toBeNull();
      expect(box.textContent).toContain('7KQ2-9XTM');
      expect(box.textContent).toContain(lang === 'ar' ? 'موثّق' : 'Verified');
      expect(box.textContent).toContain(lang === 'ar' ? 'نسخة تجريبية' : 'Prototype');
      expect(box.textContent).toContain(lang === 'ar' ? 'رقم اللوحة' : 'Plate number');
      expect(box.textContent).toContain(lang === 'ar' ? 'سارٍ' : 'Active');
      expect(box.querySelector('[role="img"][aria-label*="1"]')).not.toBeNull();
    }
  });
});
