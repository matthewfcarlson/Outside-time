/**
 * Event type definitions for Outside Time Tracker.
 *
 * These are the plaintext event structures that get encrypted into sealed boxes
 * before being sent to the server. The server never sees this plaintext.
 *
 * All events follow the append-only log pattern: corrections are new events
 * that supersede previous ones, never mutations.
 */

// ─── Event Types ────────────────────────────────────────────────────────

/** User started going outside — begins a timer session */
export interface TimerStartEvent {
  type: 'timer_start';
  id: string;
  ts: number; // Unix timestamp (seconds)
}

/** User came back inside — ends a timer session */
export interface TimerStopEvent {
  type: 'timer_stop';
  id: string;
  ts: number;
  data: {
    /** ID of the corresponding timer_start event */
    start_event_id: string;
    /** Duration in minutes (before rounding) */
    duration_minutes: number;
  };
}

/** Retroactive session entry — user manually logs a past session */
export interface ManualEntryEvent {
  type: 'manual_entry';
  id: string;
  ts: number;
  data: {
    started_at: number; // Unix timestamp (seconds)
    ended_at: number; // Unix timestamp (seconds)
    duration_minutes: number;
  };
}

/** User sets a goal for outdoor time in a given period */
export interface GoalSetEvent {
  type: 'goal_set';
  id: string;
  ts: number;
  data: {
    /** Target outdoor time in minutes */
    target_minutes: number;
    /** Time period this goal applies to */
    period: 'day' | 'week' | 'month' | 'year';
  };
}

/** User deletes a previously set goal */
export interface GoalDeleteEvent {
  type: 'goal_delete';
  id: string;
  ts: number;
  data: {
    /** ID of the goal_set event to delete */
    goal_event_id: string;
  };
}

/** Amends a prior event — references the original event ID */
export interface CorrectionEvent {
  type: 'correction';
  id: string;
  ts: number;
  data: {
    /** ID of the event being corrected */
    corrects_event_id: string;
    /** 'delete' removes the event, 'replace' substitutes with new data */
    action: 'delete' | 'replace';
    /** New data when action is 'replace' (same shape as the original event's data) */
    replacement?: {
      started_at: number;
      ended_at: number;
      duration_minutes: number;
    };
  };
}

/** Union of all event types */
export type OutsideEvent =
  | TimerStartEvent
  | TimerStopEvent
  | ManualEntryEvent
  | CorrectionEvent
  | GoalSetEvent
  | GoalDeleteEvent;

// ─── Event Constructors ─────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function createTimerStart(): TimerStartEvent {
  return {
    type: 'timer_start',
    id: generateId(),
    ts: nowSeconds(),
  };
}

export function createTimerStop(startEvent: TimerStartEvent): TimerStopEvent {
  const now = nowSeconds();
  const durationMinutes = (now - startEvent.ts) / 60;
  return {
    type: 'timer_stop',
    id: generateId(),
    ts: now,
    data: {
      start_event_id: startEvent.id,
      duration_minutes: durationMinutes,
    },
  };
}

export function createManualEntry(
  startedAt: number,
  endedAt: number
): ManualEntryEvent {
  const durationMinutes = (endedAt - startedAt) / 60;
  return {
    type: 'manual_entry',
    id: generateId(),
    ts: nowSeconds(),
    data: {
      started_at: startedAt,
      ended_at: endedAt,
      duration_minutes: durationMinutes,
    },
  };
}

export function createCorrection(
  correctsEventId: string,
  action: 'delete'
): CorrectionEvent;
export function createCorrection(
  correctsEventId: string,
  action: 'replace',
  replacement: { started_at: number; ended_at: number; duration_minutes: number }
): CorrectionEvent;
export function createCorrection(
  correctsEventId: string,
  action: 'delete' | 'replace',
  replacement?: { started_at: number; ended_at: number; duration_minutes: number }
): CorrectionEvent {
  return {
    type: 'correction',
    id: generateId(),
    ts: nowSeconds(),
    data: {
      corrects_event_id: correctsEventId,
      action,
      replacement,
    },
  };
}

export function createGoalSet(
  targetMinutes: number,
  period: 'day' | 'week' | 'month' | 'year'
): GoalSetEvent {
  return {
    type: 'goal_set',
    id: generateId(),
    ts: nowSeconds(),
    data: {
      target_minutes: targetMinutes,
      period,
    },
  };
}

export function createGoalDelete(goalEventId: string): GoalDeleteEvent {
  return {
    type: 'goal_delete',
    id: generateId(),
    ts: nowSeconds(),
    data: {
      goal_event_id: goalEventId,
    },
  };
}

// ─── Serialization ──────────────────────────────────────────────────────

/** Encode an event to bytes for encryption */
export function encodeEvent(event: OutsideEvent): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(event));
}

/** Decode bytes back to an event after decryption */
export function decodeEvent(bytes: Uint8Array): OutsideEvent {
  const json = new TextDecoder().decode(bytes);
  return JSON.parse(json) as OutsideEvent;
}
