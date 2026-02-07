import type { Env, AppendResponse, ErrorResponse } from '../types';
import { verifySignature, isValidPublicKey } from '../crypto';
import { corsHeaders } from '../middleware/cors';

/**
 * POST /api/log/:publicKey
 *
 * Append an encrypted event to a user's log.
 * Requires a valid Ed25519 signature in the X-Signature header.
 * The server assigns the next sequence number automatically.
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

  if (!signatureBase64) {
    return jsonResponse<ErrorResponse>(
      { error: 'Missing required header: X-Signature' },
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
  if (!verifySignature(publicKey, ciphertextBase64, signatureBase64)) {
    return jsonResponse<ErrorResponse>(
      { error: 'Invalid signature' },
      400
    );
  }

  // Atomically determine next sequence number and insert in one statement.
  // This avoids a race where two concurrent requests both read the same
  // MAX(seq) and then collide on INSERT.
  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    `INSERT INTO events (public_key, seq, ciphertext, created_at)
     VALUES (?1, (SELECT COALESCE(MAX(seq), 0) + 1 FROM events WHERE public_key = ?1), ?2, ?3)
     RETURNING seq`
  )
    .bind(publicKey, ciphertextBase64, now)
    .first<{ seq: number }>();

  const seq = result!.seq;
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
