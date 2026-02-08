/**
 * Session management for the web app.
 *
 * Re-exports platform-agnostic reconstruction/display logic from the shared
 * core package, and provides localStorage-backed local event storage that
 * is specific to the web platform.
 */

// ─── Re-exports from core (platform-agnostic) ─────────────────────────

export {
  reconstructSessions,
  reconstructGoals,
  computeGoalProgress,
  findActiveTimerStart,
  roundUpToMinute,
  formatDuration,
  formatTime,
  formatDate,
  formatElapsed,
  toDatetimeLocal,
  fromDatetimeLocal,
  computeTodaySummary,
  computeWeekSummary,
  type Session,
  type Goal,
  type Summary,
} from '@outside-time/core';

import type { OutsideEvent, TimerStartEvent } from '@outside-time/core';

// ─── Local event storage (web-only, uses localStorage) ─────────────────
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

/** Mark every local event as pending upload (used after identity switch for merge). */
export function markAllPending(): void {
  const order = loadEventOrder();
  savePendingIds([...order]);
}

/** Remove all local event data (events, order, pending, active timer). */
export function clearLocalData(): void {
  const order = loadEventOrder();
  for (const id of order) {
    localStorage.removeItem(`${LOCAL_EVENT_PREFIX}${id}`);
  }
  saveEventOrder([]);
  savePendingIds([]);
  localStorage.removeItem(ACTIVE_TIMER_KEY);
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
