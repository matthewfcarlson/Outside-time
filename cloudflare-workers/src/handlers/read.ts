import type { Env, LogResponse, ErrorResponse } from '../types';
import { isValidPublicKey } from '../crypto';
import { corsHeaders } from '../middleware/cors';

const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 5000;

/**
 * GET /api/log/:publicKey?after=0&limit=1000
 *
 * Download a user's encrypted event log (or a slice of it).
 * This is a public endpoint — anyone with the public key can download the log.
 * They just can't decrypt it without the private key.
 */
export async function handleRead(
  request: Request,
  env: Env,
  publicKey: string
): Promise<Response> {
  if (!isValidPublicKey(publicKey)) {
    return jsonResponse<ErrorResponse>(
      { error: 'Invalid public key format. Expected 64 hex characters.' },
      400
    );
  }

  const url = new URL(request.url);
  let after = parseInt(url.searchParams.get('after') ?? '0', 10);
  if (isNaN(after) || after < 0) after = 0;
  let limit = parseInt(
    url.searchParams.get('limit') ?? String(DEFAULT_LIMIT),
    10
  );
  if (isNaN(limit)) limit = DEFAULT_LIMIT;
  limit = Math.min(Math.max(1, limit), MAX_LIMIT);

  // Fetch one extra to determine if there are more
  const rows = await env.DB.prepare(
    'SELECT seq, ciphertext, created_at FROM events WHERE public_key = ? AND seq > ? ORDER BY seq ASC LIMIT ?'
  )
    .bind(publicKey, after, limit + 1)
    .all<{ seq: number; ciphertext: string; created_at: number }>();

  const events = rows.results ?? [];
  const hasMore = events.length > limit;
  const returnedEvents = hasMore ? events.slice(0, limit) : events;

  return jsonResponse<LogResponse>(
    {
      events: returnedEvents.map((e) => ({
        seq: e.seq,
        ciphertext: e.ciphertext,
        created_at: e.created_at,
      })),
      has_more: hasMore,
    },
    200
  );
}

function jsonResponse<T>(data: T, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}
