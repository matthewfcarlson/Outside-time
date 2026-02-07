import nacl from 'tweetnacl';
import {
  decodeBase64 as _decodeBase64,
  encodeBase64 as _encodeBase64,
} from 'tweetnacl-util';

// ─── Re-exports: single import point for all crypto primitives ─────────

export { nacl };
export const encodeBase64 = _encodeBase64;
export const decodeBase64 = _decodeBase64;

export function generateSigningKeyPair() {
  return nacl.sign.keyPair();
}

export function signDetached(
  message: Uint8Array,
  secretKey: Uint8Array
): Uint8Array {
  return nacl.sign.detached(message, secretKey);
}

export function randomBytes(n: number): Uint8Array {
  return nacl.randomBytes(n);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// ─── Signature verification ────────────────────────────────────────────

/**
 * Verify an Ed25519 signature.
 *
 * The signed message is: publicKey (hex) || ":" || ciphertext (base64)
 * This ensures a signature is bound to a specific key and payload.
 * Sequence numbers are assigned server-side and not included in the signature.
 */
export function verifySignature(
  publicKeyHex: string,
  ciphertextBase64: string,
  signatureBase64: string
): boolean {
  try {
    const publicKey = hexToBytes(publicKeyHex);
    if (publicKey.length !== 32) return false;

    const message = new TextEncoder().encode(
      `${publicKeyHex}:${ciphertextBase64}`
    );
    const signature = _decodeBase64(signatureBase64);
    if (signature.length !== 64) return false;

    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}

/**
 * Validate that a string is a valid hex-encoded 32-byte Ed25519 public key.
 */
export function isValidPublicKey(hex: string): boolean {
  return /^[0-9a-f]{64}$/.test(hex);
}
