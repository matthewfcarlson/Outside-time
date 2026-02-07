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
// Events are stored individually keyed by index so that appending is O(1)
// instead of deserializing/re-serializing the entire array on every write.
//
//   ot:local:eventCount      → number of stored events
//   ot:local:event:{index}   → JSON of a single OutsideEvent
//   ot:local:activeTimer     → currently running timer (unchanged)
//

const LOCAL_EVENT_COUNT_KEY = 'ot:local:eventCount';
const LOCAL_EVENT_PREFIX = 'ot:local:event:';
const OLD_LOCAL_EVENTS_KEY = 'ot:local:events';
const ACTIVE_TIMER_KEY = 'ot:local:activeTimer';

/** Migrate from the old single-array format to per-event keys (runs once). */
function migrateLocalEvents(): void {
  const old = localStorage.getItem(OLD_LOCAL_EVENTS_KEY);
  if (!old) return;
  try {
    const events = JSON.parse(old) as OutsideEvent[];
    for (let i = 0; i < events.length; i++) {
      localStorage.setItem(`${LOCAL_EVENT_PREFIX}${i}`, JSON.stringify(events[i]));
    }
    localStorage.setItem(LOCAL_EVENT_COUNT_KEY, String(events.length));
  } catch {
    // Corrupt data — start fresh
    localStorage.setItem(LOCAL_EVENT_COUNT_KEY, '0');
  }
  localStorage.removeItem(OLD_LOCAL_EVENTS_KEY);
}

migrateLocalEvents();

function getLocalEventCount(): number {
  const raw = localStorage.getItem(LOCAL_EVENT_COUNT_KEY);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

export function loadEvents(): OutsideEvent[] {
  const count = getLocalEventCount();
  const events: OutsideEvent[] = [];
  for (let i = 0; i < count; i++) {
    const raw = localStorage.getItem(`${LOCAL_EVENT_PREFIX}${i}`);
    if (raw) {
      try {
        events.push(JSON.parse(raw));
      } catch {
        // skip corrupt entry
      }
    }
  }
  return events;
}

export function saveEvents(events: OutsideEvent[]): void {
  const oldCount = getLocalEventCount();
  // Clear old entries
  for (let i = 0; i < oldCount; i++) {
    localStorage.removeItem(`${LOCAL_EVENT_PREFIX}${i}`);
  }
  // Write new entries
  for (let i = 0; i < events.length; i++) {
    localStorage.setItem(`${LOCAL_EVENT_PREFIX}${i}`, JSON.stringify(events[i]));
  }
  localStorage.setItem(LOCAL_EVENT_COUNT_KEY, String(events.length));
}

export function appendEvent(event: OutsideEvent): void {
  const count = getLocalEventCount();
  localStorage.setItem(`${LOCAL_EVENT_PREFIX}${count}`, JSON.stringify(event));
  localStorage.setItem(LOCAL_EVENT_COUNT_KEY, String(count + 1));
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
