import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTimerStart,
  createTimerStop,
  createManualEntry,
  createCorrection,
  encodeEvent,
  decodeEvent,
  type TimerStartEvent,
} from '../lib/events';

describe('Event Constructors', () => {
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

  it('creates a timer_start event', () => {
    const event = createTimerStart();
    expect(event.type).toBe('timer_start');
    expect(event.id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(event.ts).toBe(Math.floor(new Date('2025-01-15T12:00:00Z').getTime() / 1000));
  });

  it('creates a timer_stop event referencing a start', () => {
    const start: TimerStartEvent = {
      type: 'timer_start',
      id: 'start-id-123',
      ts: Math.floor(new Date('2025-01-15T12:00:00Z').getTime() / 1000) - 1800,
    };

    const stop = createTimerStop(start);
    expect(stop.type).toBe('timer_stop');
    expect(stop.data.start_event_id).toBe('start-id-123');
    expect(stop.data.duration_minutes).toBe(30); // 1800s = 30min
  });

  it('creates a manual_entry event', () => {
    const startedAt = 1705315200; // some past time
    const endedAt = startedAt + 3600; // 1 hour later

    const event = createManualEntry(startedAt, endedAt);
    expect(event.type).toBe('manual_entry');
    expect(event.data.started_at).toBe(startedAt);
    expect(event.data.ended_at).toBe(endedAt);
    expect(event.data.duration_minutes).toBe(60);
  });

  it('creates a delete correction', () => {
    const event = createCorrection('bad-event-id', 'delete');
    expect(event.type).toBe('correction');
    expect(event.data.corrects_event_id).toBe('bad-event-id');
    expect(event.data.action).toBe('delete');
    expect(event.data.replacement).toBeUndefined();
  });

  it('creates a replace correction', () => {
    const replacement = {
      started_at: 1705315200,
      ended_at: 1705318800,
      duration_minutes: 60,
    };
    const event = createCorrection('old-event-id', 'replace', replacement);
    expect(event.type).toBe('correction');
    expect(event.data.action).toBe('replace');
    expect(event.data.replacement).toEqual(replacement);
  });
});

describe('Event Serialization', () => {
  it('round-trips an event through encode/decode', () => {
    const original: TimerStartEvent = {
      type: 'timer_start',
      id: 'test-id',
      ts: 1705315200,
    };

    const encoded = encodeEvent(original);
    expect(encoded).toBeInstanceOf(Uint8Array);

    const decoded = decodeEvent(encoded);
    expect(decoded).toEqual(original);
  });

  it('round-trips a complex event', () => {
    const original = {
      type: 'manual_entry' as const,
      id: 'manual-id',
      ts: 1705315200,
      data: {
        started_at: 1705311600,
        ended_at: 1705315200,
        duration_minutes: 60,
      },
    };

    const encoded = encodeEvent(original);
    const decoded = decodeEvent(encoded);
    expect(decoded).toEqual(original);
  });
});
