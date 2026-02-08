/**
 * Event cache for Outside Time Tracker.
 *
 * Caches encrypted events (as received from the server) in a key-value store
 * so the client doesn't re-download the entire log on every launch.
 *
 * Events are stored individually keyed by index so that appending new events
 * from the server is O(k) for k new events, not O(n+k).
 *
 * Storage layout (per public key):
 *   ot:identity                    → base64-encoded 64-byte Ed25519 secret key
 *   ot:{pubKeyHex}:eventCount      → number of cached events
 *   ot:{pubKeyHex}:event:{index}   → JSON of a single ServerEvent
 *   ot:{pubKeyHex}:lastSeq         → highest seq number we've fetched from server
 *   ot:{pubKeyHex}:lastSyncAt      → unix timestamp of last successful sync
 *
 * The KVStore interface is injectable — web uses localStorage, iOS uses
 * a bridge to UserDefaults or Keychain.
 */

import type { ServerEvent } from './api';

// ─── Key helpers ────────────────────────────────────────────────────────

const PREFIX = 'ot';

function eventCountKey(publicKeyHex: string): string {
  return `${PREFIX}:${publicKeyHex}:eventCount`;
}

function eventItemKey(publicKeyHex: string, index: number): string {
  return `${PREFIX}:${publicKeyHex}:event:${index}`;
}

/** Old single-array key (for migration) */
function oldEventsKey(publicKeyHex: string): string {
  return `${PREFIX}:${publicKeyHex}:events`;
}

function lastSeqKey(publicKeyHex: string): string {
  return `${PREFIX}:${publicKeyHex}:lastSeq`;
}

function lastSyncAtKey(publicKeyHex: string): string {
  return `${PREFIX}:${publicKeyHex}:lastSyncAt`;
}

const IDENTITY_KEY = `${PREFIX}:identity`;

// ─── Storage interface (injectable for testing and cross-platform) ───────

/**
 * Minimal key-value storage interface.
 * Defaults to globalThis.localStorage but can be replaced for testing
 * or for native platforms (iOS UserDefaults, etc).
 */
export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// ─── EventCache ─────────────────────────────────────────────────────────

export class EventCache {
  private store: KVStore;

  constructor(store?: KVStore) {
    this.store = store ?? globalThis.localStorage;
  }

  // ── Identity persistence ──────────────────────────────────────────

  /** Save an identity's secret key (base64) to storage */
  saveIdentity(secretKeyBase64: string): void {
    this.store.setItem(IDENTITY_KEY, secretKeyBase64);
  }

  /** Load the saved identity secret key, or null if none exists */
  loadIdentity(): string | null {
    return this.store.getItem(IDENTITY_KEY);
  }

  /** Clear the saved identity */
  clearIdentity(): void {
    this.store.removeItem(IDENTITY_KEY);
  }

  // ── Event cache ───────────────────────────────────────────────────

  /** Migrate from old single-array format to per-event keys if needed. */
  private migrateIfNeeded(publicKeyHex: string): void {
    const oldKey = oldEventsKey(publicKeyHex);
    const old = this.store.getItem(oldKey);
    if (!old) return;
    try {
      const events = JSON.parse(old) as ServerEvent[];
      for (let i = 0; i < events.length; i++) {
        this.store.setItem(eventItemKey(publicKeyHex, i), JSON.stringify(events[i]));
      }
      this.store.setItem(eventCountKey(publicKeyHex), String(events.length));
    } catch {
      this.store.setItem(eventCountKey(publicKeyHex), '0');
    }
    this.store.removeItem(oldKey);
  }

  /** Get the number of cached events for a public key */
  private getEventCount(publicKeyHex: string): number {
    this.migrateIfNeeded(publicKeyHex);
    const raw = this.store.getItem(eventCountKey(publicKeyHex));
    if (!raw) return 0;
    const n = parseInt(raw, 10);
    return isNaN(n) ? 0 : n;
  }

  /** Get all cached events for a public key, ordered by seq */
  getCachedEvents(publicKeyHex: string): ServerEvent[] {
    const count = this.getEventCount(publicKeyHex);
    const events: ServerEvent[] = [];
    for (let i = 0; i < count; i++) {
      const raw = this.store.getItem(eventItemKey(publicKeyHex, i));
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

  /** Get the highest seq number we've cached (0 if nothing cached) */
  getLastSeq(publicKeyHex: string): number {
    this.migrateIfNeeded(publicKeyHex);
    const raw = this.store.getItem(lastSeqKey(publicKeyHex));
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /** Get the timestamp of the last successful sync (0 if never synced) */
  getLastSyncAt(publicKeyHex: string): number {
    const raw = this.store.getItem(lastSyncAtKey(publicKeyHex));
    if (!raw) return 0;
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Append newly fetched events to the cache and update the high-water mark.
   * Events must be in ascending seq order and have seq > current lastSeq.
   * Only writes the new events — O(k) for k new events, not O(n+k).
   */
  appendEvents(publicKeyHex: string, newEvents: ServerEvent[]): void {
    if (newEvents.length === 0) return;

    const currentLastSeq = this.getLastSeq(publicKeyHex);

    // Filter out any events we already have (defensive)
    const fresh = newEvents.filter((e) => e.seq > currentLastSeq);
    if (fresh.length === 0) return;

    const count = this.getEventCount(publicKeyHex);
    for (let i = 0; i < fresh.length; i++) {
      this.store.setItem(eventItemKey(publicKeyHex, count + i), JSON.stringify(fresh[i]));
    }
    const newLastSeq = fresh[fresh.length - 1].seq;

    this.store.setItem(eventCountKey(publicKeyHex), String(count + fresh.length));
    this.store.setItem(lastSeqKey(publicKeyHex), String(newLastSeq));
    this.store.setItem(
      lastSyncAtKey(publicKeyHex),
      String(Math.floor(Date.now() / 1000))
    );
  }

  /**
   * Add a single event we just created locally (before it round-trips through the server).
   * This is used for optimistic UI — the event gets the server-assigned seq
   * from the append response.
   */
  addLocalEvent(publicKeyHex: string, event: ServerEvent): void {
    this.appendEvents(publicKeyHex, [event]);
  }

  /** Clear all cached data for a public key */
  clearCache(publicKeyHex: string): void {
    const count = this.getEventCount(publicKeyHex);
    for (let i = 0; i < count; i++) {
      this.store.removeItem(eventItemKey(publicKeyHex, i));
    }
    this.store.removeItem(eventCountKey(publicKeyHex));
    this.store.removeItem(lastSeqKey(publicKeyHex));
    this.store.removeItem(lastSyncAtKey(publicKeyHex));
  }

  /** Clear everything — identity + all cached events */
  clearAll(): void {
    this.clearIdentity();
    // Callers should clear per-key caches explicitly using clearCache().
  }
}
