import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SyncEngine, type DecryptedServerEvent } from '../lib/sync';
import { ApiClient, type ServerEvent, type LogResponse, type HeadResponse } from '../lib/api';
import { EventCache, type KVStore } from '../lib/storage';
import {
  generateIdentity,
  encryptEvent,
  encodeBase64,
  type Identity,
} from '../lib/crypto';
import { encodeEvent, type OutsideEvent, type TimerStartEvent } from '../lib/events';

// ─── In-memory KVStore ──────────────────────────────────────────────────

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
}

// ─── Helpers ────────────────────────────────────────────────────────────

function encryptTestEvent(event: OutsideEvent, identity: Identity): string {
  const plaintext = encodeEvent(event);
  const ciphertext = encryptEvent(plaintext, identity);
  return encodeBase64(ciphertext);
}

function makeTimerStart(id: string, ts: number): TimerStartEvent {
  return { type: 'timer_start', id, ts };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('SyncEngine', () => {
  let identity: Identity;
  let cache: EventCache;
  let api: ApiClient;
  let engine: SyncEngine;

  beforeEach(() => {
    identity = generateIdentity();
    cache = new EventCache(new MemoryStore());
    api = new ApiClient('https://example.com');
    engine = new SyncEngine(api, cache, identity);
  });

  describe('pull', () => {
    it('fetches all events on first sync', async () => {
      const event1 = makeTimerStart('e1', 1000);
      const event2 = makeTimerStart('e2', 2000);

      const serverEvents: ServerEvent[] = [
        { seq: 1, ciphertext: encryptTestEvent(event1, identity), created_at: 1000 },
        { seq: 2, ciphertext: encryptTestEvent(event2, identity), created_at: 2000 },
      ];

      vi.spyOn(api, 'head').mockResolvedValue({ eventCount: 2, latestSeq: 2 });
      vi.spyOn(api, 'getEvents').mockResolvedValue({
        events: serverEvents,
        has_more: false,
      });

      const result = await engine.pull();

      expect(result).toHaveLength(2);
      expect(result[0].event.id).toBe('e1');
      expect(result[1].event.id).toBe('e2');
      expect(result[0].seq).toBe(1);
      expect(result[1].seq).toBe(2);

      // Verify cache was updated
      expect(cache.getLastSeq(identity.publicKeyHex)).toBe(2);
    });

    it('only fetches new events on incremental sync', async () => {
      const event1 = makeTimerStart('e1', 1000);
      const event2 = makeTimerStart('e2', 2000);
      const event3 = makeTimerStart('e3', 3000);

      // Simulate first sync with 2 events
      cache.appendEvents(identity.publicKeyHex, [
        { seq: 1, ciphertext: encryptTestEvent(event1, identity), created_at: 1000 },
        { seq: 2, ciphertext: encryptTestEvent(event2, identity), created_at: 2000 },
      ]);

      // Server now has 3 events
      vi.spyOn(api, 'head').mockResolvedValue({ eventCount: 3, latestSeq: 3 });
      vi.spyOn(api, 'getEvents').mockResolvedValue({
        events: [
          { seq: 3, ciphertext: encryptTestEvent(event3, identity), created_at: 3000 },
        ],
        has_more: false,
      });

      const result = await engine.pull();

      // Should have all 3 events
      expect(result).toHaveLength(3);
      expect(result[2].event.id).toBe('e3');

      // getEvents should have been called with after=2
      expect(api.getEvents).toHaveBeenCalledWith(identity.publicKeyHex, 2, 1000);
    });

    it('returns cached events when nothing new on server', async () => {
      const event1 = makeTimerStart('e1', 1000);
      cache.appendEvents(identity.publicKeyHex, [
        { seq: 1, ciphertext: encryptTestEvent(event1, identity), created_at: 1000 },
      ]);

      vi.spyOn(api, 'head').mockResolvedValue({ eventCount: 1, latestSeq: 1 });
      const getEventsSpy = vi.spyOn(api, 'getEvents');

      const result = await engine.pull();

      expect(result).toHaveLength(1);
      expect(result[0].event.id).toBe('e1');
      // Should NOT have called getEvents since nothing new
      expect(getEventsSpy).not.toHaveBeenCalled();
    });

    it('handles paginated fetch', async () => {
      const events1: ServerEvent[] = [
        { seq: 1, ciphertext: encryptTestEvent(makeTimerStart('e1', 1000), identity), created_at: 1000 },
      ];
      const events2: ServerEvent[] = [
        { seq: 2, ciphertext: encryptTestEvent(makeTimerStart('e2', 2000), identity), created_at: 2000 },
      ];

      vi.spyOn(api, 'head').mockResolvedValue({ eventCount: 2, latestSeq: 2 });
      vi.spyOn(api, 'getEvents')
        .mockResolvedValueOnce({ events: events1, has_more: true })
        .mockResolvedValueOnce({ events: events2, has_more: false });

      const result = await engine.pull();

      expect(result).toHaveLength(2);
      expect(api.getEvents).toHaveBeenCalledTimes(2);
      expect(api.getEvents).toHaveBeenNthCalledWith(1, identity.publicKeyHex, 0, 1000);
      expect(api.getEvents).toHaveBeenNthCalledWith(2, identity.publicKeyHex, 1, 1000);
    });
  });

  describe('push', () => {
    it('encrypts, sends, and caches an event', async () => {
      const event = makeTimerStart('push-test', 5000);

      vi.spyOn(api, 'append').mockResolvedValue({ seq: 1, created_at: 5000 });

      const result = await engine.push(event);

      expect(result.seq).toBe(1);
      expect(result.created_at).toBe(5000);
      expect(result.event.id).toBe('push-test');

      // Verify it was cached
      expect(cache.getLastSeq(identity.publicKeyHex)).toBe(1);
      expect(cache.getCachedEvents(identity.publicKeyHex)).toHaveLength(1);
    });

    it('the cached event is decryptable', async () => {
      const event = makeTimerStart('decrypt-test', 6000);

      vi.spyOn(api, 'append').mockResolvedValue({ seq: 1, created_at: 6000 });

      await engine.push(event);

      // Decrypt the cached events
      const decrypted = engine.decryptCachedEvents();
      expect(decrypted).toHaveLength(1);
      expect(decrypted[0].event).toEqual(event);
    });
  });

  describe('getSyncStatus', () => {
    it('reports correct status', () => {
      const status = engine.getSyncStatus();
      expect(status.lastSeq).toBe(0);
      expect(status.lastSyncAt).toBe(0);
      expect(status.cachedEventCount).toBe(0);
    });

    it('updates after caching events', () => {
      const event = makeTimerStart('e1', 1000);
      cache.appendEvents(identity.publicKeyHex, [
        { seq: 5, ciphertext: encryptTestEvent(event, identity), created_at: 1000 },
      ]);

      const status = engine.getSyncStatus();
      expect(status.lastSeq).toBe(5);
      expect(status.cachedEventCount).toBe(1);
      expect(status.lastSyncAt).toBeGreaterThan(0);
    });
  });
});
