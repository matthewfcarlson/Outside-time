import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// vi.hoisted runs before static imports, so localStorage is available
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
  createGoalSet,
  createGoalDelete,
} from '../lib/events';
import {
  reconstructGoals,
  computeGoalProgress,
  type Session,
} from '../lib/session';
import type { OutsideEvent } from '../lib/events';

describe('Goal Event Constructors', () => {
  beforeEach(() => {
    vi.stubGlobal('crypto', {
      randomUUID: () => '550e8400-e29b-41d4-a716-446655440000',
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates a goal_set event', () => {
    const event = createGoalSet(120, 'week');
    expect(event.type).toBe('goal_set');
    expect(event.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(event.data.target_minutes).toBe(120);
    expect(event.data.period).toBe('week');
  });

  it('creates a goal_set event for each period type', () => {
    for (const period of ['day', 'week', 'month', 'year'] as const) {
      const event = createGoalSet(60, period);
      expect(event.data.period).toBe(period);
    }
  });

  it('creates a goal_delete event', () => {
    const event = createGoalDelete('goal-id-123');
    expect(event.type).toBe('goal_delete');
    expect(event.data.goal_event_id).toBe('goal-id-123');
  });
});

describe('reconstructGoals', () => {
  it('returns empty array when no goal events exist', () => {
    const events: OutsideEvent[] = [
      { type: 'timer_start', id: 'ts1', ts: 1000 },
    ];
    expect(reconstructGoals(events)).toEqual([]);
  });

  it('reconstructs a single goal', () => {
    const events: OutsideEvent[] = [
      {
        type: 'goal_set',
        id: 'g1',
        ts: 1000,
        data: { target_minutes: 120, period: 'week' },
      },
    ];
    const goals = reconstructGoals(events);
    expect(goals).toHaveLength(1);
    expect(goals[0].id).toBe('g1');
    expect(goals[0].targetMinutes).toBe(120);
    expect(goals[0].period).toBe('week');
    expect(goals[0].createdAt).toBe(1000);
  });

  it('reconstructs multiple goals', () => {
    const events: OutsideEvent[] = [
      {
        type: 'goal_set',
        id: 'g1',
        ts: 1000,
        data: { target_minutes: 60, period: 'day' },
      },
      {
        type: 'goal_set',
        id: 'g2',
        ts: 2000,
        data: { target_minutes: 300, period: 'week' },
      },
    ];
    const goals = reconstructGoals(events);
    expect(goals).toHaveLength(2);
    // Newest first
    expect(goals[0].id).toBe('g2');
    expect(goals[1].id).toBe('g1');
  });

  it('removes deleted goals', () => {
    const events: OutsideEvent[] = [
      {
        type: 'goal_set',
        id: 'g1',
        ts: 1000,
        data: { target_minutes: 60, period: 'day' },
      },
      {
        type: 'goal_set',
        id: 'g2',
        ts: 2000,
        data: { target_minutes: 300, period: 'week' },
      },
      {
        type: 'goal_delete',
        id: 'gd1',
        ts: 3000,
        data: { goal_event_id: 'g1' },
      },
    ];
    const goals = reconstructGoals(events);
    expect(goals).toHaveLength(1);
    expect(goals[0].id).toBe('g2');
  });

  it('handles deleting a non-existent goal gracefully', () => {
    const events: OutsideEvent[] = [
      {
        type: 'goal_delete',
        id: 'gd1',
        ts: 1000,
        data: { goal_event_id: 'nonexistent' },
      },
    ];
    expect(reconstructGoals(events)).toEqual([]);
  });

  it('ignores non-goal events', () => {
    const events: OutsideEvent[] = [
      { type: 'timer_start', id: 'ts1', ts: 500 },
      {
        type: 'goal_set',
        id: 'g1',
        ts: 1000,
        data: { target_minutes: 60, period: 'day' },
      },
      {
        type: 'manual_entry',
        id: 'me1',
        ts: 1500,
        data: { started_at: 1000, ended_at: 2000, duration_minutes: 16.67 },
      },
    ];
    const goals = reconstructGoals(events);
    expect(goals).toHaveLength(1);
    expect(goals[0].id).toBe('g1');
  });
});

describe('computeGoalProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set to Wednesday, Jan 15 2025, 12:00:00 UTC
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('computes daily progress', () => {
    const goal = {
      id: 'g1',
      targetMinutes: 60,
      period: 'day' as const,
      createdAt: 1000,
    };

    // Session today (Jan 15 2025 at 10:00 UTC)
    const todayStart = new Date('2025-01-15T10:00:00Z').getTime() / 1000;
    const sessions: Session[] = [
      {
        id: 's1',
        startedAt: todayStart,
        endedAt: todayStart + 1800,
        durationMinutes: 30,
        source: 'timer',
      },
    ];

    const progress = computeGoalProgress(goal, sessions);
    expect(progress.currentMinutes).toBe(30);
    expect(progress.percentage).toBe(50);
  });

  it('computes weekly progress', () => {
    const goal = {
      id: 'g1',
      targetMinutes: 300,
      period: 'week' as const,
      createdAt: 1000,
    };

    // Jan 15 2025 is a Wednesday; week starts Sunday Jan 12
    const mondayStart = new Date('2025-01-13T10:00:00Z').getTime() / 1000;
    const tuesdayStart = new Date('2025-01-14T10:00:00Z').getTime() / 1000;
    const sessions: Session[] = [
      {
        id: 's1',
        startedAt: mondayStart,
        endedAt: mondayStart + 3600,
        durationMinutes: 60,
        source: 'timer',
      },
      {
        id: 's2',
        startedAt: tuesdayStart,
        endedAt: tuesdayStart + 5400,
        durationMinutes: 90,
        source: 'manual',
      },
    ];

    const progress = computeGoalProgress(goal, sessions);
    expect(progress.currentMinutes).toBe(150);
    expect(progress.percentage).toBe(50);
  });

  it('caps percentage at 100', () => {
    const goal = {
      id: 'g1',
      targetMinutes: 30,
      period: 'day' as const,
      createdAt: 1000,
    };

    const todayStart = new Date('2025-01-15T10:00:00Z').getTime() / 1000;
    const sessions: Session[] = [
      {
        id: 's1',
        startedAt: todayStart,
        endedAt: todayStart + 3600,
        durationMinutes: 60,
        source: 'timer',
      },
    ];

    const progress = computeGoalProgress(goal, sessions);
    expect(progress.currentMinutes).toBe(60);
    expect(progress.percentage).toBe(100);
  });

  it('returns 0 when no sessions in period', () => {
    const goal = {
      id: 'g1',
      targetMinutes: 60,
      period: 'day' as const,
      createdAt: 1000,
    };

    // Session from yesterday
    const yesterdayStart = new Date('2025-01-14T10:00:00Z').getTime() / 1000;
    const sessions: Session[] = [
      {
        id: 's1',
        startedAt: yesterdayStart,
        endedAt: yesterdayStart + 3600,
        durationMinutes: 60,
        source: 'timer',
      },
    ];

    const progress = computeGoalProgress(goal, sessions);
    expect(progress.currentMinutes).toBe(0);
    expect(progress.percentage).toBe(0);
  });

  it('handles zero target minutes', () => {
    const goal = {
      id: 'g1',
      targetMinutes: 0,
      period: 'day' as const,
      createdAt: 1000,
    };

    const progress = computeGoalProgress(goal, []);
    expect(progress.percentage).toBe(0);
  });
});
