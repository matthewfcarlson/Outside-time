import type { Env } from '../types';
import { isValidPublicKey } from '../crypto';
import { corsHeaders } from '../middleware/cors';

/**
 * HEAD /api/log/:publicKey
 *
 * Get log metadata without downloading content.
 * Returns event count and latest sequence number in headers.
 */
export async function handleHead(
  env: Env,
  publicKey: string
): Promise<Response> {
  if (!isValidPublicKey(publicKey)) {
    return new Response(null, {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const result = await env.DB.prepare(
    'SELECT COUNT(*) as count, MAX(seq) as max_seq FROM events WHERE public_key = ?'
  )
    .bind(publicKey)
    .first<{ count: number; max_seq: number | null }>();

  const count = result?.count ?? 0;
  const maxSeq = result?.max_seq ?? 0;

  return new Response(null, {
    status: 200,
    headers: {
      ...corsHeaders(),
      'X-Event-Count': String(count),
      'X-Latest-Seq': String(maxSeq),
    },
  });
}
