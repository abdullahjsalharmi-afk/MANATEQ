/**
 * Demo time. The prototype has no back end, so the app plays the part of Manateq, the rules engine
 * and the national platforms: each non-investor step of a workflow takes a short, believable time.
 *
 * One working day of the story lasts `DAY_MS` of real time. Step durations come from the step-level
 * standard published with the workflow ("Instant", "2 working days", "Same day" …) and are then scaled
 * so that the usual path fits inside the service's published standard.
 */
import type { ServiceDetail, Standard, WorkflowStep } from '@/data/types';
import { findStep, mainPath, waitsForInvestor, type Timing } from './workflow';

/** One working day of the story, in ms of real time, at speed 1. */
export const DAY_MS = 7000;
/** An "instant" automatic step: long enough to be seen happening. */
export const INSTANT_MS = 1300;
const MIN_STEP_MS = 900;
const MAX_STEP_MS = 16000;
/** The usual path may use at most this share of the published standard. */
const STANDARD_SHARE = 0.8;

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/** The unscaled duration of a step, in working days of the story (0 = instant). */
export function stepDays(step: WorkflowStep): number {
  if (step.kind === 'gate') return 0;
  const text = step.std.en.trim().toLowerCase();
  if (!text) return step.kind === 'human' ? 1 : 0;
  if (text === 'instant') return 0;
  const match = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(working\s+)?(day|hour|minute|week|month)/.exec(text);
  if (match) {
    const raw = match[1] as string;
    const n = WORD_NUMBERS[raw] ?? Number(raw);
    const unit = match[3];
    if (unit === 'minute') return n / 480;
    if (unit === 'hour') return n / 8;
    if (unit === 'week') return n * 5;
    if (unit === 'month') return n * 22;
    return n;
  }
  if (text.includes('hour')) return 0.15;
  if (text.includes('same day') || text.includes('on the day')) return 0.5;
  return 1;
}

/** The published service standard in working days of the story, or null when it has no headline duration. */
export function standardDays(standard: Standard): number | null {
  if (standard.value === null || standard.unit === null) return standard.unit === 'instant' ? 0 : null;
  switch (standard.unit) {
    case 'instant':
      return 0;
    case 'minute':
      return standard.value / 480;
    case 'hour':
      return standard.value / 8;
    case 'working_day':
    case 'day':
      return standard.value;
    case 'month':
      return standard.value * 22;
  }
}

/** Scale applied to step durations so the usual path fits inside the published standard. */
export function pathScale(service: Pick<ServiceDetail, 'standard' | 'workflow'>): number {
  const target = standardDays(service.standard);
  if (target === null || target <= 0) return 1;
  let total = 0;
  for (const id of mainPath(service.workflow)) {
    const step = findStep(service.workflow, id);
    if (step && !waitsForInvestor(step) && !(step.kind === 'start' && step.lane === 'inv')) total += stepDays(step);
  }
  if (total <= target * STANDARD_SHARE) return 1;
  return (target * STANDARD_SHARE) / total;
}

/** Builds the timing for one service at a given demo speed (1 = normal; larger = faster). */
export function timingFor(service: Pick<ServiceDetail, 'standard' | 'workflow'>, speed = 1): Timing {
  const scale = pathScale(service);
  const pace = speed > 0 ? speed : 1;
  return {
    duration(step: WorkflowStep): number {
      if (step.kind === 'gate') return Math.round(MIN_STEP_MS / pace);
      const days = stepDays(step) * scale;
      const ms = days <= 0 ? INSTANT_MS : Math.min(MAX_STEP_MS, Math.max(INSTANT_MS, days * DAY_MS));
      return Math.round(ms / pace);
    },
  };
}

export interface StandardClock {
  /** Working days of the story used so far (never counting time spent waiting for the investor). */
  usedDays: number;
  /** The published standard in working days, or null when it has no headline duration. */
  targetDays: number | null;
  /** 0–1+, null when there is no headline duration. Above 1 means the standard was exceeded. */
  ratio: number | null;
  /** "Day 2 of 5": the current day number, starting at 1. */
  dayNumber: number;
}

/** Converts the service clock of a request (ms of real time) into the story's working days. */
export function standardClock(serviceClockMs: number, standard: Standard, speed = 1): StandardClock {
  const pace = speed > 0 ? speed : 1;
  const usedDays = (serviceClockMs * pace) / DAY_MS;
  const targetDays = standardDays(standard);
  const ratio = targetDays === null ? null : targetDays <= 0 ? 1 : usedDays / targetDays;
  return { usedDays, targetDays, ratio, dayNumber: Math.max(1, Math.ceil(usedDays)) };
}
