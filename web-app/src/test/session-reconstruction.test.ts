import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted runs before static imports so localStorage is available
// when session.ts module initialisation calls migrateLocalEvents()
vi.hoisted(() => {
  const _data = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem(key: string) { return _data.get(key) ?? null; },
    setItem(key: string, value: string) { _data.set(key, value); },
    removeItem(key: string) { _data.delete(key); },
    clear() { _data.clear(); },
    get length() { return _data.size; },
    key(index: number) { return [..._data.keys()][index] ?? null; },
  };
});

import {
  reconstructSessions,
  findActiveTimerStart,
  roundUpToMinute,
  formatDuration,
  formatElapsed,
  toDatetimeLocal,
  fromDatetimeLocal,
  computeTodaySummary,
  computeWeekSummary,
  type Session,
} from '../lib/session';
import type { OutsideEvent } from '../lib/events';

// ─── Event factory helpers ────────────────────────────────────────────

function timerStart(id: string, ts: number): OutsideEvent {
  return { type: 'timer_start', id, ts };
}

function timerStop(id: string, ts: number, startId: string, durationMinutes: number): OutsideEvent {
  return { type: 'timer_stop', id, ts, data: { start_event_id: startId, duration_minutes: durationMinutes } };
}

function manualEntry(id: string, ts: number, startedAt: number, endedAt: number, durationMinutes: number): OutsideEvent {
  return { type: 'manual_entry', id, ts, data: { started_at: startedAt, ended_at: endedAt, duration_minutes: durationMinutes } };
}

function correctionDelete(id: string, ts: number, correctsId: string): OutsideEvent {
  return { type: 'correction', id, ts, data: { action: 'delete', corrects_event_id: correctsId } };
}

function correctionReplace(
  id: string,
  ts: number,
  correctsId: string,
  replacement: { started_at: number; ended_at: number; duration_minutes: number }
): OutsideEvent {
  return { type: 'correction', id, ts, data: { action: 'replace', corrects_event_id: correctsId, replacement } };
}

// ─── reconstructSessions ──────────────────────────────────────────────

describe('reconstructSessions', () => {
  it('returns empty array for no events', () => {
    expect(reconstructSessions([])).toEqual([]);
  });

  it('ignores a timer_start with no matching timer_stop', () => {
    const events: OutsideEvent[] = [timerStart('ts1', 1000)];
    expect(reconstructSessions(events)).toEqual([]);
  });

  it('creates a session from timer_start + timer_stop', () => {
    const events: OutsideEvent[] = [
      timerStart('ts1', 1000),
      timerStop('stop1', 1000 + 1800, 'ts1', 30),
    ];
    const sessions = reconstructSessions(events);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('ts1');
    expect(sessions[0].startedAt).toBe(1000);
    expect(sessions[0].endedAt).toBe(1000 + 1800);
    expect(sessions[0].durationMinutes).toBe(30);
    expect(sessions[0].source).toBe('timer');
  });

  it('creates a session from a manual_entry', () => {
    const events: OutsideEvent[] = [
      manualEntry('me1', 5000, 1000, 4600, 60),
    ];
    const sessions = reconstructSessions(events);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('me1');
    expect(sessions[0].startedAt).toBe(1000);
    expect(sessions[0].endedAt).toBe(4600);
    expect(sessions[0].durationMinutes).toBe(60);
    expect(sessions[0].source).toBe('manual');
  });

  it('handles multiple sessions and returns them most-recent first', () => {
    const events: OutsideEvent[] = [
      timerStart('ts1', 1000),
      timerStop('stop1', 2800, 'ts1', 30),
      manualEntry('me1', 5000, 3000, 6600, 60),
    ];
    const sessions = reconstructSessions(events);
    expect(sessions).toHaveLength(2);
    // manual_entry started at 3000, timer started at 1000 → manual is more recent
    expect(sessions[0].id).toBe('me1');
    expect(sessions[1].id).toBe('ts1');
  });

  it('applies a delete correction to remove a session', () => {
    const events: OutsideEvent[] = [
      manualEntry('me1', 1000, 500, 1000, 8),
      correctionDelete('del1', 2000, 'me1'),
    ];
    expect(reconstructSessions(events)).toEqual([]);
  });

  it('applies a delete correction to a timer session', () => {
    const events: OutsideEvent[] = [
      timerStart('ts1', 1000),
      timerStop('stop1', 2800, 'ts1', 30),
      correctionDelete('del1', 3000, 'ts1'),
    ];
    expect(reconstructSessions(events)).toEqual([]);
  });

  it('applies a replace correction to update a session', () => {
    const events: OutsideEvent[] = [
      manualEntry('me1', 1000, 500, 1000, 8),
      correctionReplace('corr1', 2000, 'me1', {
        started_at: 100,
        ended_at: 4600,
        duration_minutes: 60,
      }),
    ];
    const sessions = reconstructSessions(events);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('me1');
    expect(sessions[0].startedAt).toBe(100);
    expect(sessions[0].endedAt).toBe(4600);
    expect(sessions[0].durationMinutes).toBe(60);
    expect(sessions[0].source).toBe('manual'); // source preserved
  });

  it('ignores a correction delete for a non-existent session', () => {
    const events: OutsideEvent[] = [
      correctionDelete('del1', 1000, 'nonexistent'),
    ];
    expect(reconstructSessions(events)).toEqual([]);
  });

  it('ignores a correction replace for a non-existent session', () => {
    const events: OutsideEvent[] = [
      correctionReplace('corr1', 1000, 'nonexistent', {
        started_at: 0,
        ended_at: 3600,
        duration_minutes: 60,
      }),
    ];
    expect(reconstructSessions(events)).toEqual([]);
  });

  it('rounds up sub-minute timer durations to at least 1 minute', () => {
    const events: OutsideEvent[] = [
      timerStart('ts1', 1000),
      timerStop('stop1', 1030, 'ts1', 0.3), // 18 seconds
    ];
    const sessions = reconstructSessions(events);
    expect(sessions[0].durationMinutes).toBe(1);
  });

  it('ignores a timer_stop with no matching timer_start', () => {
    const events: OutsideEvent[] = [
      timerStop('stop1', 2000, 'nonexistent-start', 30),
    ];
    expect(reconstructSessions(events)).toEqual([]);
  });

  it('handles multiple timer sessions independently', () => {
    const events: OutsideEvent[] = [
      timerStart('ts1', 1000),
      timerStop('stop1', 2800, 'ts1', 30),
      timerStart('ts2', 5000),
      timerStop('stop2', 8600, 'ts2', 60),
    ];
    const sessions = reconstructSessions(events);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe('ts2'); // most recent first
    expect(sessions[1].id).toBe('ts1');
  });

  it('does not include a session that is corrected before it appears (delete)', () => {
    // Deletion arrives before the session in the log — edge case
    const events: OutsideEvent[] = [
      manualEntry('me1', 1000, 500, 1000, 8),
      correctionDelete('del1', 2000, 'me1'),
      // another manual entry that should still be present
      manualEntry('me2', 3000, 2000, 3000, 16),
    ];
    const sessions = reconstructSessions(events);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('me2');
  });
});

// ─── findActiveTimerStart ─────────────────────────────────────────────

describe('findActiveTimerStart', () => {
  it('returns null for empty events', () => {
    expect(findActiveTimerStart([])).toBeNull();
  });

  it('returns a timer_start with no matching stop', () => {
    const start = timerStart('ts1', 1000);
    const result = findActiveTimerStart([start]);
    expect(result).toEqual(start);
  });

  it('returns null when timer_start has a matching timer_stop', () => {
    const events: OutsideEvent[] = [
      timerStart('ts1', 1000),
      timerStop('stop1', 2800, 'ts1', 30),
    ];
    expect(findActiveTimerStart(events)).toBeNull();
  });

  it('returns null when timer_start has been deleted', () => {
    const events: OutsideEvent[] = [
      timerStart('ts1', 1000),
      correctionDelete('del1', 2000, 'ts1'),
    ];
    expect(findActiveTimerStart(events)).toBeNull();
  });

  it('returns the latest unmatched timer_start when there are multiple', () => {
    // Both are unmatched but we expect the latest one
    const events: OutsideEvent[] = [
      timerStart('ts1', 1000),
      timerStart('ts2', 2000),
    ];
    const result = findActiveTimerStart(events);
    expect(result?.id).toBe('ts2');
  });

  it('returns the one unmatched timer when another is stopped', () => {
    const events: OutsideEvent[] = [
      timerStart('ts1', 1000),
      timerStop('stop1', 2800, 'ts1', 30),
      timerStart('ts2', 5000),
    ];
    const result = findActiveTimerStart(events);
    expect(result?.id).toBe('ts2');
  });

  it('ignores non-timer events', () => {
    const events: OutsideEvent[] = [
      manualEntry('me1', 1000, 500, 1000, 8),
      timerStart('ts1', 2000),
    ];
    const result = findActiveTimerStart(events);
    expect(result?.id).toBe('ts1');
  });
});

// ─── roundUpToMinute ──────────────────────────────────────────────────

describe('roundUpToMinute', () => {
  it('returns 0 for 0 minutes', () => {
    expect(roundUpToMinute(0)).toBe(0);
  });

  it('returns 0 for negative minutes', () => {
    expect(roundUpToMinute(-1)).toBe(0);
    expect(roundUpToMinute(-0.5)).toBe(0);
  });

  it('rounds up fractional minutes to at least 1', () => {
    expect(roundUpToMinute(0.1)).toBe(1);
    expect(roundUpToMinute(0.5)).toBe(1);
    expect(roundUpToMinute(0.9)).toBe(1);
  });

  it('returns exact whole minutes unchanged', () => {
    expect(roundUpToMinute(1)).toBe(1);
    expect(roundUpToMinute(30)).toBe(30);
    expect(roundUpToMinute(60)).toBe(60);
  });

  it('rounds up fractional minutes above 1', () => {
    expect(roundUpToMinute(1.1)).toBe(2);
    expect(roundUpToMinute(29.5)).toBe(30);
    expect(roundUpToMinute(59.9)).toBe(60);
  });
});

// ─── formatDuration ───────────────────────────────────────────────────

describe('formatDuration', () => {
  it('returns "0m" for 0 minutes', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('returns "0m" for negative minutes', () => {
    expect(formatDuration(-5)).toBe('0m');
  });

  it('formats sub-hour durations as Xm', () => {
    expect(formatDuration(1)).toBe('1m');
    expect(formatDuration(30)).toBe('30m');
    expect(formatDuration(59)).toBe('59m');
  });

  it('formats exact hours as Xh', () => {
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(120)).toBe('2h');
  });

  it('formats hours and minutes as Xh Ym', () => {
    expect(formatDuration(90)).toBe('1h 30m');
    expect(formatDuration(61)).toBe('1h 1m');
    expect(formatDuration(125)).toBe('2h 5m');
  });

  it('rounds up fractional minutes', () => {
    expect(formatDuration(1.5)).toBe('2m');
    // 59.9 rounds up to 60 minutes, which renders as 1h
    expect(formatDuration(59.9)).toBe('1h');
  });
});

// ─── formatElapsed ────────────────────────────────────────────────────

describe('formatElapsed', () => {
  it('formats zero seconds', () => {
    expect(formatElapsed(0)).toBe('00:00:00');
  });

  it('formats seconds only', () => {
    expect(formatElapsed(5)).toBe('00:00:05');
    expect(formatElapsed(59)).toBe('00:00:59');
  });

  it('formats minutes and seconds', () => {
    expect(formatElapsed(60)).toBe('00:01:00');
    expect(formatElapsed(90)).toBe('00:01:30');
    expect(formatElapsed(3599)).toBe('00:59:59');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatElapsed(3600)).toBe('01:00:00');
    expect(formatElapsed(3661)).toBe('01:01:01');
    expect(formatElapsed(7322)).toBe('02:02:02');
  });
});

// ─── toDatetimeLocal / fromDatetimeLocal ─────────────────────────────

describe('toDatetimeLocal / fromDatetimeLocal', () => {
  it('round-trips a unix timestamp through datetime-local format', () => {
    // Use a round minute to avoid sub-second precision issues
    const ts = Math.floor(new Date('2025-06-15T10:30:00').getTime() / 1000);
    const formatted = toDatetimeLocal(ts);
    // Should look like "2025-06-15T10:30"
    expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    const roundTripped = fromDatetimeLocal(formatted);
    expect(roundTripped).toBe(ts);
  });

  it('fromDatetimeLocal converts string to unix seconds', () => {
    const result = fromDatetimeLocal('2025-01-15T12:00');
    // Should be a reasonable unix timestamp in seconds
    expect(result).toBeGreaterThan(1_700_000_000);
    expect(result).toBeLessThan(2_000_000_000);
  });
});

// ─── computeTodaySummary ─────────────────────────────────────────────

describe('computeTodaySummary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-03-13T15:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zero counts when no sessions', () => {
    expect(computeTodaySummary([])).toEqual({ sessionCount: 0, totalMinutes: 0 });
  });

  it('counts sessions that started today', () => {
    const todayNoon = new Date('2025-03-13T12:00:00').getTime() / 1000;
    const sessions: Session[] = [
      { id: 's1', startedAt: todayNoon, endedAt: todayNoon + 3600, durationMinutes: 60, source: 'timer' },
      { id: 's2', startedAt: todayNoon + 7200, endedAt: todayNoon + 9000, durationMinutes: 30, source: 'manual' },
    ];
    const summary = computeTodaySummary(sessions);
    expect(summary.sessionCount).toBe(2);
    expect(summary.totalMinutes).toBe(90);
  });

  it('excludes sessions from yesterday', () => {
    const yesterdayNoon = new Date('2025-03-12T12:00:00').getTime() / 1000;
    const sessions: Session[] = [
      { id: 's1', startedAt: yesterdayNoon, endedAt: yesterdayNoon + 3600, durationMinutes: 60, source: 'timer' },
    ];
    expect(computeTodaySummary(sessions)).toEqual({ sessionCount: 0, totalMinutes: 0 });
  });

  it('excludes sessions from tomorrow', () => {
    const tomorrowNoon = new Date('2025-03-14T12:00:00').getTime() / 1000;
    const sessions: Session[] = [
      { id: 's1', startedAt: tomorrowNoon, endedAt: tomorrowNoon + 3600, durationMinutes: 60, source: 'timer' },
    ];
    expect(computeTodaySummary(sessions)).toEqual({ sessionCount: 0, totalMinutes: 0 });
  });
});

// ─── computeWeekSummary ───────────────────────────────────────────────

describe('computeWeekSummary', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Wednesday March 12, 2025 — week runs Sun Mar 9 → Sat Mar 15
    vi.setSystemTime(new Date('2025-03-12T15:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns zero counts when no sessions', () => {
    expect(computeWeekSummary([])).toEqual({ sessionCount: 0, totalMinutes: 0 });
  });

  it('counts sessions from this week', () => {
    const monday = new Date('2025-03-10T10:00:00').getTime() / 1000;
    const tuesday = new Date('2025-03-11T10:00:00').getTime() / 1000;
    const sessions: Session[] = [
      { id: 's1', startedAt: monday, endedAt: monday + 3600, durationMinutes: 60, source: 'timer' },
      { id: 's2', startedAt: tuesday, endedAt: tuesday + 1800, durationMinutes: 30, source: 'manual' },
    ];
    const summary = computeWeekSummary(sessions);
    expect(summary.sessionCount).toBe(2);
    expect(summary.totalMinutes).toBe(90);
  });

  it('excludes sessions from last week', () => {
    const lastSaturday = new Date('2025-03-08T10:00:00').getTime() / 1000;
    const sessions: Session[] = [
      { id: 's1', startedAt: lastSaturday, endedAt: lastSaturday + 3600, durationMinutes: 60, source: 'timer' },
    ];
    expect(computeWeekSummary(sessions)).toEqual({ sessionCount: 0, totalMinutes: 0 });
  });

  it('excludes sessions from next week', () => {
    const nextSunday = new Date('2025-03-16T10:00:00').getTime() / 1000;
    const sessions: Session[] = [
      { id: 's1', startedAt: nextSunday, endedAt: nextSunday + 3600, durationMinutes: 60, source: 'timer' },
    ];
    expect(computeWeekSummary(sessions)).toEqual({ sessionCount: 0, totalMinutes: 0 });
  });
});
