/**
 * Types of the state layer that are not part of the persisted contract in `src/domain/types.ts`:
 * what actions accept, and what the simulation keeps next to the engine's own request state.
 */
import type { L10n, ServiceDetail, ServiceId } from '@/data/types';
import type { Appointment, FormValue, Pass, RequestState } from '@/domain/types';
import type { Timing } from '@/domain/workflow';

/**
 * A request as the simulation keeps it: the engine's state plus one piece of demo bookkeeping.
 * `World.requests` holds these; read the extra field with `holdOf()`.
 */
export interface SimRequest extends RequestState {
  /**
   * The open step stays open until this time (ms since epoch). Set on seeded requests that are part-way
   * through, so the story holds still while it is being shown ("now with the Ministry of Municipality").
   * "Fast-forward" clears it; so does the step finishing when the time comes.
   */
  holdUntil?: number;
}

/** The time until which the open step of a request is held, if any. */
export function holdOf(request: RequestState): number | undefined {
  return (request as SimRequest).holdUntil;
}

/**
 * What the pure reducers need from the outside world: the catalogue (a service's full record may still
 * be loading) and how long steps take. The app runs on demo time; the seed runs on calendar time.
 */
export interface Env {
  detail(id: ServiceId): ServiceDetail | undefined;
  timing(service: ServiceDetail): Timing;
}

export interface StartOptions {
  /** One of the investor's plots, or — for a land application — an available plot of a zone ("AW-117"). */
  plotId?: string;
  zoneCode?: string;
  /** Join an existing thread (the chain of requests of one intent). */
  threadId?: string;
  /** The request that led to this one. */
  parentId?: string;
}

export interface FileValue {
  name: string;
  size?: number;
}

/** What the investor hands over when completing a step. Every part is optional; send what the step asked for. */
export interface ActPayload {
  /** Stars (1–5), or stars with a comment. */
  rating?: number | { stars: number; comment?: string };
  /** The value of the option picked in a `choose` step. */
  choice?: string;
  /** Answers to a `form`, `reference`, `schedule` or `declare` step, by field key. */
  form?: Record<string, FormValue>;
  /** Documents added in an `upload` step. */
  files?: FileValue[];
}

export type PassInput = Omit<Pass, 'id' | 'status' | 'code'>;

export interface AppointmentInput {
  at: number;
  topic: L10n;
  channel: Appointment['channel'];
}
