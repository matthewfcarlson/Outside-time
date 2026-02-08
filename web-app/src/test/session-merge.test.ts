import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TimerStartEvent, ManualEntryEvent } from '../lib/events';

// ─── localStorage mock ────────────────────────────────────────────────

class MockLocalStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
  get length(): number {
    return this.data.size;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  _dump(): Record<string, string> {
    return Object.fromEntries(this.data);
  }
}

let mockStorage: MockLocalStorage;

beforeEach(() => {
  mockStorage = new MockLocalStorage();
  vi.stubGlobal('localStorage', mockStorage);
});

afterEach(() => {
  vi.unstubAllGlobals();
  // Force re-import so module-level migration re-runs with fresh localStorage
  vi.resetModules();
});

// ─── Helpers ──────────────────────────────────────────────────────────

function makeTimerStart(id: string, ts: number): TimerStartEvent {
  return { type: 'timer_start', id, ts };
}

function makeManualEntry(id: string, ts: number): ManualEntryEvent {
  return {
    type: 'manual_entry',
    id,
    ts,
    data: { started_at: ts - 1800, ended_at: ts, duration_minutes: 30 },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('markAllPending', () => {
  it('marks all local events as pending', async () => {
    const { appendEvent, loadPendingEvents, markEventSynced, markAllPending } =
      await import('../lib/session');

    const e1 = makeTimerStart('e1', 1000);
    const e2 = makeManualEntry('e2', 2000);
    appendEvent(e1);
    appendEvent(e2);

    // Simulate that e1 was already synced
    markEventSynced('e1');

    // Only e2 should be pending
    expect(loadPendingEvents().map((e) => e.id)).toEqual(['e2']);

    // After markAllPending, both should be pending
    markAllPending();
    const pending = loadPendingEvents();
    expect(pending.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('works when no events exist', async () => {
    const { markAllPending, loadPendingEvents } = await import('../lib/session');
    markAllPending();
    expect(loadPendingEvents()).toEqual([]);
  });
});

describe('clearLocalData', () => {
  it('removes all local events and pending queue', async () => {
    const { appendEvent, loadEvents, loadPendingEvents, clearLocalData } =
      await import('../lib/session');

    appendEvent(makeTimerStart('e1', 1000));
    appendEvent(makeManualEntry('e2', 2000));

    expect(loadEvents()).toHaveLength(2);
    expect(loadPendingEvents()).toHaveLength(2);

    clearLocalData();

    expect(loadEvents()).toEqual([]);
    expect(loadPendingEvents()).toEqual([]);
  });

  it('clears active timer', async () => {
    const { saveActiveTimer, loadActiveTimer, clearLocalData } =
      await import('../lib/session');

    const timer = makeTimerStart('active', 5000);
    saveActiveTimer(timer);
    expect(loadActiveTimer()).toEqual(timer);

    clearLocalData();
    expect(loadActiveTimer()).toBeNull();
  });

  it('works when already empty', async () => {
    const { clearLocalData, loadEvents } = await import('../lib/session');
    clearLocalData();
    expect(loadEvents()).toEqual([]);
  });
});

describe('merge flow integration', () => {
  it('markAllPending after appendEvent makes all events pushable', async () => {
    const { appendEvent, markEventSynced, clearPending, loadPendingEvents, markAllPending } =
      await import('../lib/session');

    // Simulate a typical flow: user has 3 events, 2 already synced
    appendEvent(makeTimerStart('e1', 1000));
    appendEvent(makeTimerStart('e2', 2000));
    appendEvent(makeManualEntry('e3', 3000));

    markEventSynced('e1');
    markEventSynced('e2');

    // After sync, clear the pending queue (simulating clearPending after syncAll)
    clearPending();
    expect(loadPendingEvents()).toEqual([]);

    // Now simulate the merge: mark all events as pending for re-push under new key
    markAllPending();
    const pending = loadPendingEvents();
    expect(pending).toHaveLength(3);
    expect(pending.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
  });
});
