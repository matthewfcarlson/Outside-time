/**
 * Sync engine for Outside Time Tracker.
 *
 * Coordinates between the API client, local storage cache, and crypto layer
 * to provide a simple interface for pushing and pulling encrypted events.
 *
 * Pull flow:
 *   1. Read lastSeq from local cache
 *   2. HEAD request to check if server has new events
 *   3. If server latestSeq > lastSeq, GET events after lastSeq
 *   4. Append new events to local cache
 *   5. Decrypt all cached events and return them
 *
 * Push flow:
 *   1. Encode event as JSON bytes
 *   2. Encrypt with sealed box
 *   3. Sign and POST to server
 *   4. Add the server-confirmed event to local cache
 */

import { ApiClient, type ServerEvent } from './api';
import {
  type Identity,
  encryptEvent,
  decryptEvent,
  encodeBase64,
  decodeBase64,
} from './crypto';
import { EventCache } from './storage';
import { type OutsideEvent, encodeEvent, decodeEvent } from './events';

// ─── Decrypted event with server metadata ───────────────────────────────

export interface DecryptedServerEvent {
  seq: number;
  created_at: number;
  event: OutsideEvent;
}

// ─── Sync Engine ────────────────────────────────────────────────────────

export class SyncEngine {
  constructor(
    private api: ApiClient,
    private cache: EventCache,
    private identity: Identity
  ) {}

  /**
   * Pull new events from the server, updating the local cache.
   * Returns all decrypted events (cached + newly fetched).
   */
  async pull(): Promise<DecryptedServerEvent[]> {
    const pubKey = this.identity.publicKeyHex;
    const lastSeq = this.cache.getLastSeq(pubKey);

    // Check if server has anything new
    const head = await this.api.head(pubKey);
    if (head.latestSeq <= lastSeq) {
      // Nothing new — return what we have cached
      return this.decryptCachedEvents();
    }

    // Fetch all new events (paginated)
    let after = lastSeq;
    let hasMore = true;

    while (hasMore) {
      const response = await this.api.getEvents(pubKey, after, 1000);
      this.cache.appendEvents(pubKey, response.events);

      if (response.events.length > 0) {
        after = response.events[response.events.length - 1].seq;
      }
      hasMore = response.has_more;
    }

    return this.decryptCachedEvents();
  }

  /**
   * Push a new event to the server.
   * Encrypts, signs, and uploads the event, then adds it to the local cache.
   * Returns the decrypted event with its server-assigned seq.
   */
  async push(event: OutsideEvent): Promise<DecryptedServerEvent> {
    const plaintext = encodeEvent(event);
    const ciphertext = encryptEvent(plaintext, this.identity);
    const ciphertextBase64 = encodeBase64(ciphertext);

    const response = await this.api.append(this.identity, ciphertext);

    // Cache the event with its server-assigned metadata
    const serverEvent: ServerEvent = {
      seq: response.seq,
      ciphertext: ciphertextBase64,
      created_at: response.created_at,
    };
    this.cache.addLocalEvent(this.identity.publicKeyHex, serverEvent);

    return {
      seq: response.seq,
      created_at: response.created_at,
      event,
    };
  }

  /**
   * Decrypt all cached events and return them in order.
   * Events that fail decryption are skipped (logged but not fatal).
   */
  decryptCachedEvents(): DecryptedServerEvent[] {
    const cached = this.cache.getCachedEvents(this.identity.publicKeyHex);
    const decrypted: DecryptedServerEvent[] = [];

    for (const serverEvent of cached) {
      const sealed = decodeBase64(serverEvent.ciphertext);
      const plaintext = decryptEvent(sealed, this.identity);

      if (plaintext === null) {
        console.warn(`Failed to decrypt event seq=${serverEvent.seq}, skipping`);
        continue;
      }

      try {
        const event = decodeEvent(plaintext);
        decrypted.push({
          seq: serverEvent.seq,
          created_at: serverEvent.created_at,
          event,
        });
      } catch (err) {
        console.warn(`Failed to decode event seq=${serverEvent.seq}:`, err);
      }
    }

    return decrypted;
  }

  /** Get sync status info */
  getSyncStatus(): {
    lastSeq: number;
    lastSyncAt: number;
    cachedEventCount: number;
  } {
    const pubKey = this.identity.publicKeyHex;
    return {
      lastSeq: this.cache.getLastSeq(pubKey),
      lastSyncAt: this.cache.getLastSyncAt(pubKey),
      cachedEventCount: this.cache.getCachedEvents(pubKey).length,
    };
  }
}
