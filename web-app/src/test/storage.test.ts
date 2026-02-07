import { describe, it, expect, beforeEach } from 'vitest';
import { EventCache, type KVStore } from '../lib/storage';
import type { ServerEvent } from '../lib/api';

/** In-memory KVStore for testing (no real localStorage needed) */
class MemoryStore implements KVStore {
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

  // Test helper: inspect raw storage
  _dump(): Record<string, string> {
    return Object.fromEntries(this.data);
  }
}

function makeEvent(seq: number, ciphertext = 'ct'): ServerEvent {
  return { seq, ciphertext: `${ciphertext}_${seq}`, created_at: 1700000000 + seq };
}

describe('EventCache', () => {
  let store: MemoryStore;
  let cache: EventCache;
  const pubKey = 'a'.repeat(64);

  beforeEach(() => {
    store = new MemoryStore();
    cache = new EventCache(store);
  });

  // ── Identity ──────────────────────────────────────────────────────

  describe('identity persistence', () => {
    it('returns null when no identity saved', () => {
      expect(cache.loadIdentity()).toBeNull();
    });

    it('saves and loads identity', () => {
      cache.saveIdentity('base64secretkey==');
      expect(cache.loadIdentity()).toBe('base64secretkey==');
    });

    it('clears identity', () => {
      cache.saveIdentity('secret');
      cache.clearIdentity();
      expect(cache.loadIdentity()).toBeNull();
    });
  });

  // ── Events ────────────────────────────────────────────────────────

  describe('event caching', () => {
    it('returns empty array when no events cached', () => {
      expect(cache.getCachedEvents(pubKey)).toEqual([]);
    });

    it('returns 0 for lastSeq when nothing cached', () => {
      expect(cache.getLastSeq(pubKey)).toBe(0);
    });

    it('returns 0 for lastSyncAt when never synced', () => {
      expect(cache.getLastSyncAt(pubKey)).toBe(0);
    });

    it('appends events and updates lastSeq', () => {
      const events = [makeEvent(1), makeEvent(2), makeEvent(3)];
      cache.appendEvents(pubKey, events);

      expect(cache.getCachedEvents(pubKey)).toEqual(events);
      expect(cache.getLastSeq(pubKey)).toBe(3);
      expect(cache.getLastSyncAt(pubKey)).toBeGreaterThan(0);
    });

    it('incrementally appends more events', () => {
      cache.appendEvents(pubKey, [makeEvent(1), makeEvent(2)]);
      cache.appendEvents(pubKey, [makeEvent(3), makeEvent(4)]);

      const all = cache.getCachedEvents(pubKey);
      expect(all).toHaveLength(4);
      expect(all.map((e) => e.seq)).toEqual([1, 2, 3, 4]);
      expect(cache.getLastSeq(pubKey)).toBe(4);
    });

    it('skips events already cached (dedup by seq)', () => {
      cache.appendEvents(pubKey, [makeEvent(1), makeEvent(2)]);
      // Try to append overlapping range
      cache.appendEvents(pubKey, [makeEvent(2), makeEvent(3)]);

      const all = cache.getCachedEvents(pubKey);
      expect(all).toHaveLength(3);
      expect(all.map((e) => e.seq)).toEqual([1, 2, 3]);
    });

    it('ignores empty append', () => {
      cache.appendEvents(pubKey, []);
      expect(cache.getCachedEvents(pubKey)).toEqual([]);
      expect(cache.getLastSeq(pubKey)).toBe(0);
    });

    it('adds a local event', () => {
      cache.addLocalEvent(pubKey, makeEvent(1));
      expect(cache.getCachedEvents(pubKey)).toEqual([makeEvent(1)]);
      expect(cache.getLastSeq(pubKey)).toBe(1);
    });
  });

  // ── Clear ─────────────────────────────────────────────────────────

  describe('clearing', () => {
    it('clears cache for a specific key', () => {
      cache.appendEvents(pubKey, [makeEvent(1)]);
      cache.clearCache(pubKey);

      expect(cache.getCachedEvents(pubKey)).toEqual([]);
      expect(cache.getLastSeq(pubKey)).toBe(0);
      expect(cache.getLastSyncAt(pubKey)).toBe(0);
    });

    it('clearAll removes identity', () => {
      cache.saveIdentity('secret');
      cache.clearAll();
      expect(cache.loadIdentity()).toBeNull();
    });
  });

  // ── Isolation ─────────────────────────────────────────────────────

  describe('key isolation', () => {
    it('different public keys have separate caches', () => {
      const key1 = 'a'.repeat(64);
      const key2 = 'b'.repeat(64);

      cache.appendEvents(key1, [makeEvent(1), makeEvent(2)]);
      cache.appendEvents(key2, [makeEvent(1)]);

      expect(cache.getCachedEvents(key1)).toHaveLength(2);
      expect(cache.getCachedEvents(key2)).toHaveLength(1);
      expect(cache.getLastSeq(key1)).toBe(2);
      expect(cache.getLastSeq(key2)).toBe(1);
    });
  });

  // ── Robustness ────────────────────────────────────────────────────

  describe('corrupted data handling', () => {
    it('handles invalid JSON in individual event gracefully', () => {
      store.setItem(`ot:${pubKey}:eventCount`, '2');
      store.setItem(`ot:${pubKey}:event:0`, JSON.stringify(makeEvent(1)));
      store.setItem(`ot:${pubKey}:event:1`, 'not valid json');
      // Should skip the corrupt entry and return only the valid one
      expect(cache.getCachedEvents(pubKey)).toEqual([makeEvent(1)]);
    });

    it('handles non-numeric lastSeq gracefully', () => {
      store.setItem(`ot:${pubKey}:lastSeq`, 'garbage');
      expect(cache.getLastSeq(pubKey)).toBe(0);
    });

    it('handles non-numeric lastSyncAt gracefully', () => {
      store.setItem(`ot:${pubKey}:lastSyncAt`, 'garbage');
      expect(cache.getLastSyncAt(pubKey)).toBe(0);
    });

    it('handles non-numeric eventCount gracefully', () => {
      store.setItem(`ot:${pubKey}:eventCount`, 'garbage');
      expect(cache.getCachedEvents(pubKey)).toEqual([]);
    });
  });

  // ── Migration ──────────────────────────────────────────────────────

  describe('migration from old single-array format', () => {
    it('migrates old events array to per-event keys', () => {
      const events = [makeEvent(1), makeEvent(2), makeEvent(3)];
      store.setItem(`ot:${pubKey}:events`, JSON.stringify(events));
      store.setItem(`ot:${pubKey}:lastSeq`, '3');

      expect(cache.getCachedEvents(pubKey)).toEqual(events);
      // Old key should be removed after migration
      expect(store.getItem(`ot:${pubKey}:events`)).toBeNull();
    });

    it('handles corrupt old format gracefully', () => {
      store.setItem(`ot:${pubKey}:events`, 'not valid json');
      expect(cache.getCachedEvents(pubKey)).toEqual([]);
      expect(store.getItem(`ot:${pubKey}:events`)).toBeNull();
    });
  });
});
