import nacl from 'tweetnacl';
import { decodeBase64 } from 'tweetnacl-util';

/**
 * Verify an Ed25519 signature.
 *
 * The signed message is: publicKey (hex) || seq (string) || ciphertext (base64)
 * This ensures a signature is bound to a specific key, sequence number, and payload.
 */
export function verifySignature(
  publicKeyHex: string,
  seq: number,
  ciphertextBase64: string,
  signatureBase64: string
): boolean {
  try {
    const publicKey = hexToBytes(publicKeyHex);
    if (publicKey.length !== 32) return false;

    const message = new TextEncoder().encode(
      `${publicKeyHex}:${seq}:${ciphertextBase64}`
    );
    const signature = decodeBase64(signatureBase64);
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

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
