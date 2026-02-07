/**
 * Local storage event cache for Outside Time Tracker.
 *
 * Caches encrypted events (as received from the server) in localStorage so
 * the client doesn't re-download the entire log on every page load.
 *
 * Storage layout (per public key):
 *   ot:identity                → base64-encoded 64-byte Ed25519 secret key
 *   ot:{pubKeyHex}:events      → JSON array of cached ServerEvent objects
 *   ot:{pubKeyHex}:lastSeq     → highest seq number we've fetched from server
 *   ot:{pubKeyHex}:lastSyncAt  → unix timestamp of last successful sync
 *
 * On sync, we only request events with seq > lastSeq, then append them
 * to the cached array. This means a fresh device downloads everything once,
 * and subsequent syncs are incremental.
 */

import type { ServerEvent } from './api';

// ─── Key helpers ────────────────────────────────────────────────────────

const PREFIX = 'ot';

function eventsKey(publicKeyHex: string): string {
  return `${PREFIX}:${publicKeyHex}:events`;
}

function lastSeqKey(publicKeyHex: string): string {
  return `${PREFIX}:${publicKeyHex}:lastSeq`;
}

function lastSyncAtKey(publicKeyHex: string): string {
  return `${PREFIX}:${publicKeyHex}:lastSyncAt`;
}

const IDENTITY_KEY = `${PREFIX}:identity`;

// ─── Storage interface (injectable for testing) ─────────────────────────

/**
 * Minimal key-value storage interface.
 * Defaults to window.localStorage but can be replaced for testing.
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

  /** Get all cached events for a public key, ordered by seq */
  getCachedEvents(publicKeyHex: string): ServerEvent[] {
    const raw = this.store.getItem(eventsKey(publicKeyHex));
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ServerEvent[];
    } catch {
      return [];
    }
  }

  /** Get the highest seq number we've cached (0 if nothing cached) */
  getLastSeq(publicKeyHex: string): number {
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
   */
  appendEvents(publicKeyHex: string, newEvents: ServerEvent[]): void {
    if (newEvents.length === 0) return;

    const existing = this.getCachedEvents(publicKeyHex);
    const currentLastSeq = this.getLastSeq(publicKeyHex);

    // Filter out any events we already have (defensive)
    const fresh = newEvents.filter((e) => e.seq > currentLastSeq);
    if (fresh.length === 0) return;

    const merged = [...existing, ...fresh];
    const newLastSeq = fresh[fresh.length - 1].seq;

    this.store.setItem(eventsKey(publicKeyHex), JSON.stringify(merged));
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
    this.store.removeItem(eventsKey(publicKeyHex));
    this.store.removeItem(lastSeqKey(publicKeyHex));
    this.store.removeItem(lastSyncAtKey(publicKeyHex));
  }

  /** Clear everything — identity + all cached events */
  clearAll(): void {
    this.clearIdentity();
    // We can't easily enumerate localStorage keys with the KVStore interface,
    // so callers should clear per-key caches explicitly if needed.
  }
}
