/**
 * Client-side cryptography for Outside Time Tracker.
 *
 * Identity model:
 *   - A single Ed25519 signing keypair is the user's identity.
 *   - The Ed25519 public key (hex) is the user's address on the server.
 *   - For encryption we convert Ed25519 keys to X25519 (Curve25519) keys.
 *   - Events are encrypted using the sealed box construction.
 *
 * Sealed box construction (compatible with libsodium crypto_box_seal):
 *   encrypt(message, recipientPubKey):
 *     1. Generate ephemeral X25519 keypair
 *     2. Compute nonce = Blake2b(ephemeralPK || recipientPK) — but since
 *        tweetnacl doesn't have Blake2b, we use SHA-512 truncated to 24 bytes
 *        (same as tweetnacl-sealedbox convention)
 *     3. Encrypt with crypto_box(message, nonce, recipientPK, ephemeralSK)
 *     4. Output = ephemeralPK (32 bytes) || ciphertext
 *
 *   decrypt(sealed, recipientPK, recipientSK):
 *     1. Split: ephemeralPK = sealed[0:32], ciphertext = sealed[32:]
 *     2. Compute same nonce
 *     3. Decrypt with crypto_box_open(ciphertext, nonce, ephemeralPK, recipientSK)
 */

import nacl from 'tweetnacl';
import {
  encodeBase64,
  decodeBase64,
} from 'tweetnacl-util';

export { encodeBase64, decodeBase64 };

// ─── Key conversion (Ed25519 <-> X25519) ────────────────────────────────

/**
 * Convert an Ed25519 signing keypair's secret key to an X25519 secret key.
 * Ed25519 secret keys are 64 bytes (seed + public). The X25519 secret key
 * is derived from the first 32 bytes (the seed) via SHA-512 + clamping.
 */
function ed25519SecretKeyToX25519(edSecretKey: Uint8Array): Uint8Array {
  // Hash the 32-byte seed (first half of the 64-byte Ed25519 secret key)
  const seed = edSecretKey.slice(0, 32);
  const hash = nacl.hash(seed); // SHA-512 -> 64 bytes
  // Clamp for X25519
  hash[0] &= 248;
  hash[31] &= 127;
  hash[31] |= 64;
  return hash.slice(0, 32);
}

/**
 * Convert an Ed25519 public key to an X25519 public key.
 * This uses the nacl.scalarMult.base function after converting the point.
 *
 * Unfortunately, tweetnacl doesn't expose a direct ed25519-to-curve25519
 * conversion for public keys. We work around this by deriving the X25519
 * keypair from the secret key instead (which we always have on the client).
 */
function ed25519KeyPairToX25519(edKeyPair: nacl.SignKeyPair): {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
} {
  const x25519SecretKey = ed25519SecretKeyToX25519(edKeyPair.secretKey);
  const x25519PublicKey = nacl.scalarMult.base(x25519SecretKey);
  return { publicKey: x25519PublicKey, secretKey: x25519SecretKey };
}

// ─── Sealed box ─────────────────────────────────────────────────────────

/**
 * Compute the nonce for a sealed box from the ephemeral and recipient public keys.
 * Uses SHA-512 of (ephemeralPK || recipientPK), truncated to 24 bytes.
 */
function sealedBoxNonce(
  ephemeralPK: Uint8Array,
  recipientPK: Uint8Array
): Uint8Array {
  const combined = new Uint8Array(64);
  combined.set(ephemeralPK, 0);
  combined.set(recipientPK, 32);
  const hash = nacl.hash(combined); // SHA-512 -> 64 bytes
  return hash.slice(0, 24); // nacl.box nonce is 24 bytes
}

/**
 * Encrypt a message using the sealed box construction.
 * Only the recipient (who holds the private key) can decrypt.
 */
export function sealedBoxSeal(
  message: Uint8Array,
  recipientX25519PK: Uint8Array
): Uint8Array {
  const ephemeral = nacl.box.keyPair();
  const nonce = sealedBoxNonce(ephemeral.publicKey, recipientX25519PK);
  const ciphertext = nacl.box(message, nonce, recipientX25519PK, ephemeral.secretKey);
  // Output: ephemeral public key (32) || ciphertext (message.length + 16 MAC)
  const sealed = new Uint8Array(32 + ciphertext.length);
  sealed.set(ephemeral.publicKey, 0);
  sealed.set(ciphertext, 32);
  return sealed;
}

/**
 * Decrypt a sealed box.
 * Returns null if decryption fails (wrong key or tampered data).
 */
export function sealedBoxOpen(
  sealed: Uint8Array,
  recipientX25519PK: Uint8Array,
  recipientX25519SK: Uint8Array
): Uint8Array | null {
  if (sealed.length < 48) return null; // 32 (ephemeral PK) + 16 (MAC minimum)
  const ephemeralPK = sealed.slice(0, 32);
  const ciphertext = sealed.slice(32);
  const nonce = sealedBoxNonce(ephemeralPK, recipientX25519PK);
  return nacl.box.open(ciphertext, nonce, ephemeralPK, recipientX25519SK);
}

// ─── Identity management ────────────────────────────────────────────────

export interface Identity {
  /** Ed25519 signing keypair (64-byte secret, 32-byte public) */
  signingKeyPair: nacl.SignKeyPair;
  /** X25519 encryption keypair derived from the signing keypair */
  encryptionKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array };
  /** Hex-encoded Ed25519 public key — this is the user's server address */
  publicKeyHex: string;
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

/** Generate a brand new identity (signing + encryption keypairs) */
export function generateIdentity(): Identity {
  const signingKeyPair = nacl.sign.keyPair();
  const encryptionKeyPair = ed25519KeyPairToX25519(signingKeyPair);
  const publicKeyHex = bytesToHex(signingKeyPair.publicKey);
  return { signingKeyPair, encryptionKeyPair, publicKeyHex };
}

/** Restore an identity from a 64-byte Ed25519 secret key */
export function identityFromSecretKey(secretKey: Uint8Array): Identity {
  const signingKeyPair = nacl.sign.keyPair.fromSecretKey(secretKey);
  const encryptionKeyPair = ed25519KeyPairToX25519(signingKeyPair);
  const publicKeyHex = bytesToHex(signingKeyPair.publicKey);
  return { signingKeyPair, encryptionKeyPair, publicKeyHex };
}

// ─── Signing ────────────────────────────────────────────────────────────

/**
 * Sign a ciphertext for the append endpoint.
 * Signature message format: publicKeyHex + ":" + ciphertextBase64
 * (matches server-side verification in cloudflare-workers/src/crypto.ts)
 */
export function signForAppend(
  publicKeyHex: string,
  ciphertextBase64: string,
  signingSecretKey: Uint8Array
): string {
  const message = new TextEncoder().encode(`${publicKeyHex}:${ciphertextBase64}`);
  const signature = nacl.sign.detached(message, signingSecretKey);
  return encodeBase64(signature);
}

// ─── High-level encrypt / decrypt ───────────────────────────────────────

/** Encrypt an event's plaintext bytes for storage on the server */
export function encryptEvent(
  plaintext: Uint8Array,
  identity: Identity
): Uint8Array {
  return sealedBoxSeal(plaintext, identity.encryptionKeyPair.publicKey);
}

/** Decrypt a sealed box event from the server */
export function decryptEvent(
  sealed: Uint8Array,
  identity: Identity
): Uint8Array | null {
  return sealedBoxOpen(
    sealed,
    identity.encryptionKeyPair.publicKey,
    identity.encryptionKeyPair.secretKey
  );
}

// ─── Key serialization for localStorage ─────────────────────────────────

/** Export an identity's secret key as base64 (for localStorage or backup) */
export function exportSecretKey(identity: Identity): string {
  return encodeBase64(identity.signingKeyPair.secretKey);
}

/** Import an identity from a base64-encoded secret key */
export function importSecretKey(base64: string): Identity {
  const secretKey = decodeBase64(base64);
  return identityFromSecretKey(secretKey);
}
