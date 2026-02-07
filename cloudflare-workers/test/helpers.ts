import {
  generateSigningKeyPair,
  signDetached,
  encodeBase64,
  randomBytes,
  bytesToHex,
} from '../src/crypto';

/**
 * Generate a test identity: Ed25519 signing keypair with hex-encoded public key.
 */
export function generateTestIdentity() {
  const keyPair = generateSigningKeyPair();
  const publicKeyHex = bytesToHex(keyPair.publicKey);
  return { keyPair, publicKeyHex };
}

/**
 * Create a valid Ed25519 signature for an append request.
 * Signs: publicKeyHex + ":" + ciphertextBase64
 */
export function signAppendRequest(
  secretKey: Uint8Array,
  publicKeyHex: string,
  ciphertextBase64: string
): string {
  const message = new TextEncoder().encode(
    `${publicKeyHex}:${ciphertextBase64}`
  );
  const signature = signDetached(message, secretKey);
  return encodeBase64(signature);
}

/**
 * Create a fake ciphertext payload (base64-encoded random bytes).
 */
export function fakeCiphertext(size = 64): string {
  const bytes = randomBytes(size);
  return encodeBase64(bytes);
}
