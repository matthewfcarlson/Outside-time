import nacl from 'tweetnacl';
import { encodeBase64 } from 'tweetnacl-util';

/**
 * Generate a test identity: Ed25519 signing keypair with hex-encoded public key.
 */
export function generateTestIdentity() {
  const keyPair = nacl.sign.keyPair();
  const publicKeyHex = bytesToHex(keyPair.publicKey);
  return { keyPair, publicKeyHex };
}

/**
 * Create a valid Ed25519 signature for an append request.
 * Signs: publicKeyHex + ":" + seq + ":" + ciphertextBase64
 */
export function signAppendRequest(
  secretKey: Uint8Array,
  publicKeyHex: string,
  seq: number,
  ciphertextBase64: string
): string {
  const message = new TextEncoder().encode(
    `${publicKeyHex}:${seq}:${ciphertextBase64}`
  );
  const signature = nacl.sign.detached(message, secretKey);
  return encodeBase64(signature);
}

/**
 * Create a fake ciphertext payload (base64-encoded random bytes).
 */
export function fakeCiphertext(size = 64): string {
  const bytes = nacl.randomBytes(size);
  return encodeBase64(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
