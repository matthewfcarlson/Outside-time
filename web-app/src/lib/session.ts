/**
 * Session reconstruction and local event storage for Outside Time Tracker.
 *
 * Processes the append-only event log into a list of completed sessions,
 * applying corrections (deletes and replacements) as they appear.
 *
 * Also provides local storage helpers for persisting plaintext events
 * and active timer state across page reloads.
 */

import type {
  OutsideEvent,
  TimerStartEvent,
  GoalSetEvent,
} from './events';

// ─── Session types ─────────────────────────────────────────────────────

export interface Session {
  /** ID of the originating event (timer_start ID or manual_entry ID) */
  id: string;
  startedAt: number; // Unix timestamp (seconds)
  endedAt: number; // Unix timestamp (seconds)
  durationMinutes: number; // Rounded up to nearest minute
  source: 'timer' | 'manual';
}

/** Round minutes up to the nearest whole minute (minimum 1 minute) */
export function roundUpToMinute(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.max(1, Math.ceil(minutes));
}

// ─── Local event storage ───────────────────────────────────────────────
//
// Events are stored individually keyed by their UUID so that:
//   - Appending is O(1) (no deserializing the whole log)
//   - Any event can be looked up by ID
//   - A lightweight pending queue tracks events awaiting upload
//
// Storage layout:
//   ot:local:event:{uuid}    → JSON of a single OutsideEvent
//   ot:local:eventOrder      → JSON array of event UUIDs (preserves ordering)
//   ot:local:pending         → JSON array of event UUIDs not yet synced
//   ot:local:activeTimer     → currently running timer (unchanged)
//

const LOCAL_EVENT_PREFIX = 'ot:local:event:';
const LOCAL_EVENT_ORDER_KEY = 'ot:local:eventOrder';
const LOCAL_PENDING_KEY = 'ot:local:pending';
const ACTIVE_TIMER_KEY = 'ot:local:activeTimer';

// Legacy keys (for migration)
const LEGACY_ARRAY_KEY = 'ot:local:events';
const LEGACY_COUNT_KEY = 'ot:local:eventCount';

/** One-time migration from older storage formats. */
function migrateLocalEvents(): void {
  // Format A: original single JSON array
  const oldArray = localStorage.getItem(LEGACY_ARRAY_KEY);
  if (oldArray) {
    try {
      const events = JSON.parse(oldArray) as OutsideEvent[];
      const order: string[] = [];
      for (const event of events) {
        localStorage.setItem(`${LOCAL_EVENT_PREFIX}${event.id}`, JSON.stringify(event));
        order.push(event.id);
      }
      localStorage.setItem(LOCAL_EVENT_ORDER_KEY, JSON.stringify(order));
    } catch {
      localStorage.setItem(LOCAL_EVENT_ORDER_KEY, '[]');
    }
    localStorage.setItem(LOCAL_PENDING_KEY, '[]');
    localStorage.removeItem(LEGACY_ARRAY_KEY);
    return;
  }

  // Format B: per-index keys (ot:local:event:0, ot:local:event:1, …)
  const countRaw = localStorage.getItem(LEGACY_COUNT_KEY);
  if (countRaw) {
    const count = parseInt(countRaw, 10) || 0;
    const order: string[] = [];
    for (let i = 0; i < count; i++) {
      const key = `${LOCAL_EVENT_PREFIX}${i}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const event = JSON.parse(raw) as OutsideEvent;
          localStorage.removeItem(key);
          localStorage.setItem(`${LOCAL_EVENT_PREFIX}${event.id}`, JSON.stringify(event));
          order.push(event.id);
        } catch {
          localStorage.removeItem(key);
        }
      }
    }
    localStorage.setItem(LOCAL_EVENT_ORDER_KEY, JSON.stringify(order));
    localStorage.setItem(LOCAL_PENDING_KEY, '[]');
    localStorage.removeItem(LEGACY_COUNT_KEY);
  }
}

migrateLocalEvents();

// ─── Internal helpers ──────────────────────────────────────────────────

function loadEventOrder(): string[] {
  const raw = localStorage.getItem(LOCAL_EVENT_ORDER_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function saveEventOrder(ids: string[]): void {
  localStorage.setItem(LOCAL_EVENT_ORDER_KEY, JSON.stringify(ids));
}

function loadPendingIds(): string[] {
  const raw = localStorage.getItem(LOCAL_PENDING_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function savePendingIds(ids: string[]): void {
  localStorage.setItem(LOCAL_PENDING_KEY, JSON.stringify(ids));
}

// ─── Public API ────────────────────────────────────────────────────────

/** Load all events in log order. */
export function loadEvents(): OutsideEvent[] {
  const order = loadEventOrder();
  const events: OutsideEvent[] = [];
  for (const id of order) {
    const raw = localStorage.getItem(`${LOCAL_EVENT_PREFIX}${id}`);
    if (raw) {
      try { events.push(JSON.parse(raw)); } catch { /* skip corrupt */ }
    }
  }
  return events;
}

/** Full overwrite — clears existing events and writes the given list. */
export function saveEvents(events: OutsideEvent[]): void {
  // Remove old event data
  const oldOrder = loadEventOrder();
  for (const id of oldOrder) {
    localStorage.removeItem(`${LOCAL_EVENT_PREFIX}${id}`);
  }
  // Write new events
  const order: string[] = [];
  for (const event of events) {
    localStorage.setItem(`${LOCAL_EVENT_PREFIX}${event.id}`, JSON.stringify(event));
    order.push(event.id);
  }
  saveEventOrder(order);
}

/** Append a locally-created event. Marks it as pending sync. */
export function appendEvent(event: OutsideEvent): void {
  localStorage.setItem(`${LOCAL_EVENT_PREFIX}${event.id}`, JSON.stringify(event));
  const order = loadEventOrder();
  order.push(event.id);
  saveEventOrder(order);
  // Mark as needing upload
  const pending = loadPendingIds();
  pending.push(event.id);
  savePendingIds(pending);
}

/** Append events that came from the server (NOT marked as pending). */
export function appendPulledEvents(events: OutsideEvent[]): void {
  if (events.length === 0) return;
  const order = loadEventOrder();
  for (const event of events) {
    localStorage.setItem(`${LOCAL_EVENT_PREFIX}${event.id}`, JSON.stringify(event));
    order.push(event.id);
  }
  saveEventOrder(order);
}

/** Load only events that haven't been uploaded to the server yet. */
export function loadPendingEvents(): OutsideEvent[] {
  const pendingIds = loadPendingIds();
  const events: OutsideEvent[] = [];
  for (const id of pendingIds) {
    const raw = localStorage.getItem(`${LOCAL_EVENT_PREFIX}${id}`);
    if (raw) {
      try { events.push(JSON.parse(raw)); } catch { /* skip */ }
    }
  }
  return events;
}

/** Remove a single event from the pending queue (after successful push). */
export function markEventSynced(eventId: string): void {
  const pending = loadPendingIds();
  savePendingIds(pending.filter((id) => id !== eventId));
}

/** Clear the entire pending queue (after a successful full sync). */
export function clearPending(): void {
  savePendingIds([]);
}

export function loadActiveTimer(): TimerStartEvent | null {
  const raw = localStorage.getItem(ACTIVE_TIMER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TimerStartEvent;
  } catch {
    return null;
  }
}

export function saveActiveTimer(event: TimerStartEvent | null): void {
  if (event === null) {
    localStorage.removeItem(ACTIVE_TIMER_KEY);
  } else {
    localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(event));
  }
}

// ─── Session reconstruction ────────────────────────────────────────────

/**
 * Process an event log into a list of sessions, applying corrections.
 * Returns sessions sorted by startedAt descending (most recent first).
 */
export function reconstructSessions(events: OutsideEvent[]): Session[] {
  const sessions = new Map<string, Session>();
  const deletedIds = new Set<string>();
  const pendingStarts = new Map<string, TimerStartEvent>();

  for (const event of events) {
    switch (event.type) {
      case 'timer_start':
        pendingStarts.set(event.id, event);
        break;

      case 'timer_stop': {
        const start = pendingStarts.get(event.data.start_event_id);
        if (start) {
          sessions.set(start.id, {
            id: start.id,
            startedAt: start.ts,
            endedAt: event.ts,
            durationMinutes: roundUpToMinute(event.data.duration_minutes),
            source: 'timer',
          });
          pendingStarts.delete(start.id);
        }
        break;
      }

      case 'manual_entry':
        sessions.set(event.id, {
          id: event.id,
          startedAt: event.data.started_at,
          endedAt: event.data.ended_at,
          durationMinutes: roundUpToMinute(event.data.duration_minutes),
          source: 'manual',
        });
        break;

      case 'correction':
        if (event.data.action === 'delete') {
          deletedIds.add(event.data.corrects_event_id);
          sessions.delete(event.data.corrects_event_id);
        } else if (event.data.action === 'replace' && event.data.replacement) {
          const existing = sessions.get(event.data.corrects_event_id);
          if (existing) {
            sessions.set(event.data.corrects_event_id, {
              ...existing,
              startedAt: event.data.replacement.started_at,
              endedAt: event.data.replacement.ended_at,
              durationMinutes: roundUpToMinute(event.data.replacement.duration_minutes),
            });
          }
        }
        break;
    }
  }

  return Array.from(sessions.values())
    .filter((s) => !deletedIds.has(s.id))
    .sort((a, b) => b.startedAt - a.startedAt);
}

/** Find an active (unmatched) timer_start event — one with no corresponding timer_stop or deletion. */
export function findActiveTimerStart(events: OutsideEvent[]): TimerStartEvent | null {
  const matchedStartIds = new Set<string>();
  const deletedIds = new Set<string>();

  for (const event of events) {
    if (event.type === 'timer_stop') {
      matchedStartIds.add(event.data.start_event_id);
    }
    if (event.type === 'correction' && event.data.action === 'delete') {
      deletedIds.add(event.data.corrects_event_id);
    }
  }

  let latest: TimerStartEvent | null = null;
  for (const event of events) {
    if (
      event.type === 'timer_start' &&
      !matchedStartIds.has(event.id) &&
      !deletedIds.has(event.id)
    ) {
      if (!latest || event.ts > latest.ts) {
        latest = event;
      }
    }
  }

  return latest;
}

// ─── Goal reconstruction ──────────────────────────────────────────────

export interface Goal {
  /** ID of the goal_set event */
  id: string;
  /** Target outdoor time in minutes */
  targetMinutes: number;
  /** Time period this goal applies to */
  period: 'day' | 'week' | 'month' | 'year';
  /** When the goal was created (unix seconds) */
  createdAt: number;
}

/**
 * Process an event log into a list of active goals.
 * Applies goal_delete events to remove previously set goals.
 * Returns goals sorted by creation time (newest first).
 */
export function reconstructGoals(events: OutsideEvent[]): Goal[] {
  const goals = new Map<string, Goal>();
  const deletedIds = new Set<string>();

  for (const event of events) {
    if (event.type === 'goal_set') {
      goals.set(event.id, {
        id: event.id,
        targetMinutes: event.data.target_minutes,
        period: event.data.period,
        createdAt: event.ts,
      });
    } else if (event.type === 'goal_delete') {
      deletedIds.add(event.data.goal_event_id);
      goals.delete(event.data.goal_event_id);
    }
  }

  return Array.from(goals.values())
    .filter((g) => !deletedIds.has(g.id))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Compute progress towards a goal based on sessions in the relevant time period. */
export function computeGoalProgress(
  goal: Goal,
  sessions: Session[]
): { currentMinutes: number; percentage: number } {
  const now = new Date();
  let periodStart: number;
  let periodEnd: number;

  switch (goal.period) {
    case 'day': {
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
      periodEnd = periodStart + 86400;
      break;
    }
    case 'week': {
      const dayOfWeek = now.getDay();
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek).getTime() / 1000;
      periodEnd = periodStart + 7 * 86400;
      break;
    }
    case 'month': {
      periodStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000;
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() / 1000;
      break;
    }
    case 'year': {
      periodStart = new Date(now.getFullYear(), 0, 1).getTime() / 1000;
      periodEnd = new Date(now.getFullYear() + 1, 0, 1).getTime() / 1000;
      break;
    }
  }

  const periodSessions = sessions.filter(
    (s) => s.startedAt >= periodStart && s.startedAt < periodEnd
  );

  const currentMinutes = periodSessions.reduce((sum, s) => sum + s.durationMinutes, 0);
  const percentage = goal.targetMinutes > 0
    ? Math.min(100, Math.round((currentMinutes / goal.targetMinutes) * 100))
    : 0;

  return { currentMinutes, percentage };
}

// ─── Display helpers ───────────────────────────────────────────────────

export function formatDuration(minutes: number): string {
  if (minutes <= 0) return '0m';
  const rounded = Math.ceil(minutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Convert a unix timestamp (seconds) to datetime-local input format */
export function toDatetimeLocal(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Convert a datetime-local input value to unix timestamp (seconds) */
export function fromDatetimeLocal(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

// ─── Summary ───────────────────────────────────────────────────────────

export interface Summary {
  sessionCount: number;
  totalMinutes: number;
}

export function computeTodaySummary(sessions: Session[]): Summary {
  const now = new Date();
  const todayStart =
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  const todayEnd = todayStart + 86400;

  const todaySessions = sessions.filter(
    (s) => s.startedAt >= todayStart && s.startedAt < todayEnd
  );

  return {
    sessionCount: todaySessions.length,
    totalMinutes: todaySessions.reduce((sum, s) => sum + s.durationMinutes, 0),
  };
}

export function computeWeekSummary(sessions: Session[]): Summary {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - dayOfWeek
    ).getTime() / 1000;
  const weekEnd = weekStart + 7 * 86400;

  const weekSessions = sessions.filter(
    (s) => s.startedAt >= weekStart && s.startedAt < weekEnd
  );

  return {
    sessionCount: weekSessions.length,
    totalMinutes: weekSessions.reduce((sum, s) => sum + s.durationMinutes, 0),
  };
}
