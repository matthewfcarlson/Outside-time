import {
  env,
  createExecutionContext,
  waitOnExecutionContext,
  SELF,
} from 'cloudflare:test';
import { describe, it, expect, beforeEach } from 'vitest';
import worker from '../src/index';
import {
  generateTestIdentity,
  signAppendRequest,
  fakeCiphertext,
} from './helpers';

// Initialize DB schema before each test
beforeEach(async () => {
  await env.DB.prepare('DROP TABLE IF EXISTS events').run();
  await env.DB.prepare('DROP INDEX IF EXISTS idx_events_sync').run();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS events (
      public_key TEXT NOT NULL,
      seq INTEGER NOT NULL,
      ciphertext BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (public_key, seq)
    )`
  ).run();
  await env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_events_sync ON events(public_key, seq)'
  ).run();
});

// ─── Helper to call the worker directly ────────────────────────────────

async function workerFetch(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const request = new Request(`http://localhost${path}`, init);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

/** Append an event and return the response */
async function appendEvent(
  publicKeyHex: string,
  secretKey: Uint8Array,
  ciphertext?: string
): Promise<Response> {
  const ct = ciphertext ?? fakeCiphertext();
  const signature = signAppendRequest(secretKey, publicKeyHex, ct);
  return workerFetch(`/api/log/${publicKeyHex}`, {
    method: 'POST',
    headers: {
      'X-Signature': signature,
    },
    body: ct,
  });
}

// ─── Health Check ──────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await workerFetch('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  it('includes CORS headers', async () => {
    const res = await workerFetch('/health');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
});

// ─── 404 Handling ──────────────────────────────────────────────────────

describe('404 Not Found', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await workerFetch('/unknown');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Not found' });
  });

  it('returns 404 for /api/log without a key', async () => {
    const res = await workerFetch('/api/log/');
    expect(res.status).toBe(404);
  });

  it('returns 404 for invalid public key format in URL', async () => {
    const res = await workerFetch('/api/log/not-a-hex-key');
    expect(res.status).toBe(404);
  });

  it('returns 404 for too-short public key in URL', async () => {
    const res = await workerFetch('/api/log/abcdef1234');
    expect(res.status).toBe(404);
  });
});

// ─── CORS Preflight ────────────────────────────────────────────────────

describe('OPTIONS (CORS preflight)', () => {
  it('returns 204 with correct CORS headers', async () => {
    const res = await workerFetch('/api/log/abc', { method: 'OPTIONS' });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('HEAD');
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain(
      'X-Signature'
    );
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain(
      'X-Event-Count'
    );
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain(
      'X-Latest-Seq'
    );
  });
});

// ─── POST /api/log/:publicKey (Append) ─────────────────────────────────

describe('POST /api/log/:publicKey', () => {
  it('appends an event with valid signature and returns 201', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();
    const res = await appendEvent(publicKeyHex, keyPair.secretKey);
    expect(res.status).toBe(201);
    const body = (await res.json()) as { seq: number; created_at: number };
    expect(body.seq).toBe(1);
    expect(body.created_at).toBeTypeOf('number');
  });

  it('auto-increments sequence numbers', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();

    const res1 = await appendEvent(publicKeyHex, keyPair.secretKey);
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as { seq: number };
    expect(body1.seq).toBe(1);

    const res2 = await appendEvent(publicKeyHex, keyPair.secretKey);
    expect(res2.status).toBe(201);
    const body2 = (await res2.json()) as { seq: number };
    expect(body2.seq).toBe(2);

    const res3 = await appendEvent(publicKeyHex, keyPair.secretKey);
    expect(res3.status).toBe(201);
    const body3 = (await res3.json()) as { seq: number };
    expect(body3.seq).toBe(3);
  });

  it('rejects missing X-Signature header', async () => {
    const { publicKeyHex } = generateTestIdentity();
    const res = await workerFetch(`/api/log/${publicKeyHex}`, {
      method: 'POST',
      body: fakeCiphertext(),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('X-Signature');
  });

  it('rejects empty body', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();
    const sig = signAppendRequest(keyPair.secretKey, publicKeyHex, '');
    const res = await workerFetch(`/api/log/${publicKeyHex}`, {
      method: 'POST',
      headers: { 'X-Signature': sig },
      body: '',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('ciphertext');
  });

  it('rejects oversized body (>10KB)', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();
    const bigPayload = 'A'.repeat(10241);
    const sig = signAppendRequest(keyPair.secretKey, publicKeyHex, bigPayload);
    const res = await workerFetch(`/api/log/${publicKeyHex}`, {
      method: 'POST',
      headers: { 'X-Signature': sig },
      body: bigPayload,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('too large');
  });

  it('rejects invalid signature (wrong key)', async () => {
    const { publicKeyHex } = generateTestIdentity();
    // Use a different key to sign — should fail verification
    const other = generateTestIdentity();
    const ct = fakeCiphertext();
    const badSig = signAppendRequest(
      other.keyPair.secretKey,
      publicKeyHex,
      ct
    );
    const res = await workerFetch(`/api/log/${publicKeyHex}`, {
      method: 'POST',
      headers: { 'X-Signature': badSig },
      body: ct,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Invalid signature');
  });

  it('rejects tampered body (signature mismatch)', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();
    const ct = fakeCiphertext();
    const sig = signAppendRequest(keyPair.secretKey, publicKeyHex, ct);
    // Send a different body than what was signed
    const tamperedCt = fakeCiphertext();
    const res = await workerFetch(`/api/log/${publicKeyHex}`, {
      method: 'POST',
      headers: { 'X-Signature': sig },
      body: tamperedCt,
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('Invalid signature');
  });

  it('includes CORS headers on success', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();
    const res = await appendEvent(publicKeyHex, keyPair.secretKey);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('includes CORS headers on error', async () => {
    const { publicKeyHex } = generateTestIdentity();
    const res = await workerFetch(`/api/log/${publicKeyHex}`, {
      method: 'POST',
      body: 'test',
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('different users get independent sequence numbers', async () => {
    const user1 = generateTestIdentity();
    const user2 = generateTestIdentity();

    const res1 = await appendEvent(
      user1.publicKeyHex,
      user1.keyPair.secretKey
    );
    expect(res1.status).toBe(201);
    const body1 = (await res1.json()) as { seq: number };
    expect(body1.seq).toBe(1);

    const res2 = await appendEvent(
      user2.publicKeyHex,
      user2.keyPair.secretKey
    );
    expect(res2.status).toBe(201);
    const body2 = (await res2.json()) as { seq: number };
    expect(body2.seq).toBe(1);
  });
});

// ─── GET /api/log/:publicKey (Read) ────────────────────────────────────

describe('GET /api/log/:publicKey', () => {
  it('returns empty events for a new user', async () => {
    const { publicKeyHex } = generateTestIdentity();
    const res = await workerFetch(`/api/log/${publicKeyHex}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { events: unknown[]; has_more: boolean };
    expect(body.events).toEqual([]);
    expect(body.has_more).toBe(false);
  });

  it('returns appended events in order', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();
    const ct1 = fakeCiphertext();
    const ct2 = fakeCiphertext();

    await appendEvent(publicKeyHex, keyPair.secretKey, ct1);
    await appendEvent(publicKeyHex, keyPair.secretKey, ct2);

    const res = await workerFetch(`/api/log/${publicKeyHex}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      events: Array<{ seq: number; ciphertext: string; created_at: number }>;
      has_more: boolean;
    };
    expect(body.events).toHaveLength(2);
    expect(body.events[0].seq).toBe(1);
    expect(body.events[0].ciphertext).toBe(ct1);
    expect(body.events[1].seq).toBe(2);
    expect(body.events[1].ciphertext).toBe(ct2);
    expect(body.has_more).toBe(false);
  });

  it('supports ?after= parameter for pagination', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();
    await appendEvent(publicKeyHex, keyPair.secretKey);
    await appendEvent(publicKeyHex, keyPair.secretKey);
    await appendEvent(publicKeyHex, keyPair.secretKey);

    const res = await workerFetch(`/api/log/${publicKeyHex}?after=1`);
    const body = (await res.json()) as {
      events: Array<{ seq: number }>;
      has_more: boolean;
    };
    expect(body.events).toHaveLength(2);
    expect(body.events[0].seq).toBe(2);
    expect(body.events[1].seq).toBe(3);
  });

  it('supports ?limit= parameter', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();
    await appendEvent(publicKeyHex, keyPair.secretKey);
    await appendEvent(publicKeyHex, keyPair.secretKey);
    await appendEvent(publicKeyHex, keyPair.secretKey);

    const res = await workerFetch(`/api/log/${publicKeyHex}?limit=2`);
    const body = (await res.json()) as {
      events: Array<{ seq: number }>;
      has_more: boolean;
    };
    expect(body.events).toHaveLength(2);
    expect(body.has_more).toBe(true);
  });

  it('has_more is false when all events fit in limit', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();
    await appendEvent(publicKeyHex, keyPair.secretKey);
    await appendEvent(publicKeyHex, keyPair.secretKey);

    const res = await workerFetch(`/api/log/${publicKeyHex}?limit=10`);
    const body = (await res.json()) as {
      events: Array<{ seq: number }>;
      has_more: boolean;
    };
    expect(body.events).toHaveLength(2);
    expect(body.has_more).toBe(false);
  });

  it('combines after and limit parameters', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();
    for (let i = 0; i < 5; i++) {
      await appendEvent(publicKeyHex, keyPair.secretKey);
    }

    const res = await workerFetch(`/api/log/${publicKeyHex}?after=2&limit=2`);
    const body = (await res.json()) as {
      events: Array<{ seq: number }>;
      has_more: boolean;
    };
    expect(body.events).toHaveLength(2);
    expect(body.events[0].seq).toBe(3);
    expect(body.events[1].seq).toBe(4);
    expect(body.has_more).toBe(true);
  });

  it('clamps limit to max 5000', async () => {
    const { publicKeyHex } = generateTestIdentity();
    // Just verify the request doesn't error with a large limit
    const res = await workerFetch(`/api/log/${publicKeyHex}?limit=99999`);
    expect(res.status).toBe(200);
  });

  it('clamps limit minimum to 1', async () => {
    const { publicKeyHex } = generateTestIdentity();
    const res = await workerFetch(`/api/log/${publicKeyHex}?limit=0`);
    expect(res.status).toBe(200);
  });

  it('does not return events from other users', async () => {
    const user1 = generateTestIdentity();
    const user2 = generateTestIdentity();

    await appendEvent(user1.publicKeyHex, user1.keyPair.secretKey);

    const res = await workerFetch(`/api/log/${user2.publicKeyHex}`);
    const body = (await res.json()) as { events: unknown[] };
    expect(body.events).toEqual([]);
  });

  it('includes CORS headers', async () => {
    const { publicKeyHex } = generateTestIdentity();
    const res = await workerFetch(`/api/log/${publicKeyHex}`);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('returns each event with seq, ciphertext, and created_at fields', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();
    await appendEvent(publicKeyHex, keyPair.secretKey);

    const res = await workerFetch(`/api/log/${publicKeyHex}`);
    const body = (await res.json()) as {
      events: Array<{ seq: number; ciphertext: string; created_at: number }>;
    };
    const event = body.events[0];
    expect(event).toHaveProperty('seq');
    expect(event).toHaveProperty('ciphertext');
    expect(event).toHaveProperty('created_at');
    // Should NOT include public_key in the response (it's implicit from the URL)
    expect(event).not.toHaveProperty('public_key');
  });
});

// ─── HEAD /api/log/:publicKey ──────────────────────────────────────────

describe('HEAD /api/log/:publicKey', () => {
  it('returns 200 with zero counts for new user', async () => {
    const { publicKeyHex } = generateTestIdentity();
    const res = await workerFetch(`/api/log/${publicKeyHex}`, {
      method: 'HEAD',
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Event-Count')).toBe('0');
    expect(res.headers.get('X-Latest-Seq')).toBe('0');
  });

  it('returns correct count and latest seq after appends', async () => {
    const { keyPair, publicKeyHex } = generateTestIdentity();
    await appendEvent(publicKeyHex, keyPair.secretKey);
    await appendEvent(publicKeyHex, keyPair.secretKey);
    await appendEvent(publicKeyHex, keyPair.secretKey);

    const res = await workerFetch(`/api/log/${publicKeyHex}`, {
      method: 'HEAD',
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Event-Count')).toBe('3');
    expect(res.headers.get('X-Latest-Seq')).toBe('3');
  });

  it('has no response body', async () => {
    const { publicKeyHex } = generateTestIdentity();
    const res = await workerFetch(`/api/log/${publicKeyHex}`, {
      method: 'HEAD',
    });
    const body = await res.text();
    expect(body).toBe('');
  });

  it('includes CORS headers', async () => {
    const { publicKeyHex } = generateTestIdentity();
    const res = await workerFetch(`/api/log/${publicKeyHex}`, {
      method: 'HEAD',
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain(
      'X-Event-Count'
    );
  });

  it('does not count events from other users', async () => {
    const user1 = generateTestIdentity();
    const user2 = generateTestIdentity();

    await appendEvent(user1.publicKeyHex, user1.keyPair.secretKey);
    await appendEvent(user1.publicKeyHex, user1.keyPair.secretKey);

    const res = await workerFetch(`/api/log/${user2.publicKeyHex}`, {
      method: 'HEAD',
    });
    expect(res.headers.get('X-Event-Count')).toBe('0');
    expect(res.headers.get('X-Latest-Seq')).toBe('0');
  });
});
