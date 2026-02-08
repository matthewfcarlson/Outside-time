/**
 * HTTP client for the Outside Time Tracker Cloudflare Worker API.
 *
 * All communication is opaque ciphertext — the server never sees plaintext.
 */

import { encodeBase64, signForAppend, type Identity } from './crypto';

// ─── Types matching the server responses ────────────────────────────────

export interface ServerEvent {
  seq: number;
  ciphertext: string; // base64-encoded sealed box
  created_at: number; // server-assigned unix timestamp
}

export interface LogResponse {
  events: ServerEvent[];
  has_more: boolean;
}

export interface AppendResponse {
  seq: number;
  created_at: number;
}

export interface HeadResponse {
  eventCount: number;
  latestSeq: number;
}

// ─── API Client ─────────────────────────────────────────────────────────

export class ApiClient {
  constructor(private baseUrl: string) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Append an encrypted event to the user's log.
   * Signs the ciphertext with the identity's signing key.
   */
  async append(
    identity: Identity,
    ciphertext: Uint8Array
  ): Promise<AppendResponse> {
    const ciphertextBase64 = encodeBase64(ciphertext);
    const signature = signForAppend(
      identity.publicKeyHex,
      ciphertextBase64,
      identity.signingKeyPair.secretKey
    );

    const res = await fetch(
      `${this.baseUrl}/api/log/${identity.publicKeyHex}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
        },
        body: JSON.stringify({ ciphertext: ciphertextBase64 }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Append failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<AppendResponse>;
  }

  /**
   * Fetch events from the user's log, optionally starting after a given seq.
   * Used for incremental sync — pass the last known seq to get only new events.
   */
  async getEvents(
    publicKeyHex: string,
    after: number = 0,
    limit: number = 1000
  ): Promise<LogResponse> {
    const params = new URLSearchParams({
      after: String(after),
      limit: String(limit),
    });

    const res = await fetch(
      `${this.baseUrl}/api/log/${publicKeyHex}?${params}`,
      { method: 'GET' }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Get events failed (${res.status}): ${body}`);
    }

    return res.json() as Promise<LogResponse>;
  }

  /**
   * Get log metadata (event count and latest seq) without downloading events.
   * Useful for checking if new events exist before fetching.
   */
  async head(publicKeyHex: string): Promise<HeadResponse> {
    const res = await fetch(
      `${this.baseUrl}/api/log/${publicKeyHex}`,
      { method: 'HEAD' }
    );

    if (!res.ok) {
      throw new Error(`Head failed (${res.status})`);
    }

    return {
      eventCount: parseInt(res.headers.get('X-Event-Count') ?? '0', 10),
      latestSeq: parseInt(res.headers.get('X-Latest-Seq') ?? '0', 10),
    };
  }
}
