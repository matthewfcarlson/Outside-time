import type { Env, AppendResponse, ErrorResponse } from '../types';
import { verifySignature, isValidPublicKey } from '../crypto';
import { corsHeaders } from '../middleware/cors';

/**
 * POST /api/log/:publicKey
 *
 * Append an encrypted event to a user's log.
 * Requires a valid Ed25519 signature in the X-Signature header.
 */
export async function handleAppend(
  request: Request,
  env: Env,
  publicKey: string
): Promise<Response> {
  // Validate public key format
  if (!isValidPublicKey(publicKey)) {
    return jsonResponse<ErrorResponse>(
      { error: 'Invalid public key format. Expected 64 hex characters.' },
      400
    );
  }

  // Read required headers
  const signatureBase64 = request.headers.get('X-Signature');
  const seqStr = request.headers.get('X-Sequence');

  if (!signatureBase64 || !seqStr) {
    return jsonResponse<ErrorResponse>(
      { error: 'Missing required headers: X-Signature, X-Sequence' },
      400
    );
  }

  const seq = parseInt(seqStr, 10);
  if (!Number.isInteger(seq) || seq < 1) {
    return jsonResponse<ErrorResponse>(
      { error: 'X-Sequence must be a positive integer' },
      400
    );
  }

  // Read body as base64 ciphertext
  const ciphertextBase64 = await request.text();
  if (!ciphertextBase64 || ciphertextBase64.length === 0) {
    return jsonResponse<ErrorResponse>(
      { error: 'Request body must contain base64-encoded ciphertext' },
      400
    );
  }

  // Enforce a reasonable max size (10KB per event — way more than needed)
  if (ciphertextBase64.length > 10240) {
    return jsonResponse<ErrorResponse>(
      { error: 'Event too large. Maximum 10KB per event.' },
      400
    );
  }

  // Verify Ed25519 signature
  if (!verifySignature(publicKey, seq, ciphertextBase64, signatureBase64)) {
    return jsonResponse<ErrorResponse>(
      { error: 'Invalid signature' },
      400
    );
  }

  // Check for sequence conflict
  const existing = await env.DB.prepare(
    'SELECT seq FROM events WHERE public_key = ? AND seq = ?'
  )
    .bind(publicKey, seq)
    .first();

  if (existing) {
    return jsonResponse<ErrorResponse>(
      { error: `Sequence number ${seq} already exists` },
      409
    );
  }

  // Verify sequence is contiguous (next expected seq)
  const latest = await env.DB.prepare(
    'SELECT MAX(seq) as max_seq FROM events WHERE public_key = ?'
  )
    .bind(publicKey)
    .first<{ max_seq: number | null }>();

  const expectedSeq = (latest?.max_seq ?? 0) + 1;
  if (seq !== expectedSeq) {
    return jsonResponse<ErrorResponse>(
      {
        error: `Sequence gap: expected ${expectedSeq}, got ${seq}`,
      },
      400
    );
  }

  // Insert the event
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    'INSERT INTO events (public_key, seq, ciphertext, created_at) VALUES (?, ?, ?, ?)'
  )
    .bind(publicKey, seq, ciphertextBase64, now)
    .run();

  return jsonResponse<AppendResponse>({ seq, created_at: now }, 201);
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
