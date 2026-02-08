/**
 * Session reconstruction and display helpers for Outside Time Tracker.
 *
 * Processes the append-only event log into a list of completed sessions,
 * applying corrections (deletes and replacements) as they appear.
 *
 * This module is platform-agnostic — no DOM, no localStorage, no Node.js APIs.
 * It works in browsers, JavaScriptCore (iOS), and any JS runtime.
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
