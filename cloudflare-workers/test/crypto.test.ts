import { describe, it, expect } from 'vitest';
import {
  verifySignature,
  isValidPublicKey,
  generateSigningKeyPair,
  signDetached,
  encodeBase64,
  randomBytes,
  bytesToHex,
} from '../src/crypto';

describe('isValidPublicKey', () => {
  it('accepts a valid 64-character lowercase hex string', () => {
    expect(isValidPublicKey('a'.repeat(64))).toBe(true);
    expect(isValidPublicKey('0123456789abcdef'.repeat(4))).toBe(true);
  });

  it('rejects uppercase hex', () => {
    expect(isValidPublicKey('A'.repeat(64))).toBe(false);
  });

  it('rejects strings shorter than 64 chars', () => {
    expect(isValidPublicKey('a'.repeat(63))).toBe(false);
  });

  it('rejects strings longer than 64 chars', () => {
    expect(isValidPublicKey('a'.repeat(65))).toBe(false);
  });

  it('rejects non-hex characters', () => {
    expect(isValidPublicKey('g'.repeat(64))).toBe(false);
    expect(isValidPublicKey('z'.repeat(64))).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidPublicKey('')).toBe(false);
  });
});

describe('verifySignature', () => {
  it('verifies a valid signature', () => {
    const keyPair = generateSigningKeyPair();
    const publicKeyHex = bytesToHex(keyPair.publicKey);
    const ciphertextBase64 = encodeBase64(randomBytes(32));

    const message = new TextEncoder().encode(
      `${publicKeyHex}:${ciphertextBase64}`
    );
    const signature = signDetached(message, keyPair.secretKey);
    const signatureBase64 = encodeBase64(signature);

    expect(
      verifySignature(publicKeyHex, ciphertextBase64, signatureBase64)
    ).toBe(true);
  });

  it('rejects a signature from a different key', () => {
    const keyPair1 = generateSigningKeyPair();
    const keyPair2 = generateSigningKeyPair();
    const publicKeyHex = bytesToHex(keyPair1.publicKey);
    const ciphertextBase64 = encodeBase64(randomBytes(32));

    // Sign with key2 but claim key1
    const message = new TextEncoder().encode(
      `${publicKeyHex}:${ciphertextBase64}`
    );
    const signature = signDetached(message, keyPair2.secretKey);
    const signatureBase64 = encodeBase64(signature);

    expect(
      verifySignature(publicKeyHex, ciphertextBase64, signatureBase64)
    ).toBe(false);
  });

  it('rejects a tampered ciphertext', () => {
    const keyPair = generateSigningKeyPair();
    const publicKeyHex = bytesToHex(keyPair.publicKey);
    const originalCiphertext = encodeBase64(randomBytes(32));
    const tamperedCiphertext = encodeBase64(randomBytes(32));

    const message = new TextEncoder().encode(
      `${publicKeyHex}:${originalCiphertext}`
    );
    const signature = signDetached(message, keyPair.secretKey);
    const signatureBase64 = encodeBase64(signature);

    // Verify with tampered ciphertext
    expect(
      verifySignature(publicKeyHex, tamperedCiphertext, signatureBase64)
    ).toBe(false);
  });

  it('rejects an invalid signature format', () => {
    const keyPair = generateSigningKeyPair();
    const publicKeyHex = bytesToHex(keyPair.publicKey);

    expect(
      verifySignature(publicKeyHex, 'somedata', 'not-valid-base64!!!')
    ).toBe(false);
  });

  it('rejects a truncated signature', () => {
    const keyPair = generateSigningKeyPair();
    const publicKeyHex = bytesToHex(keyPair.publicKey);
    const ciphertextBase64 = encodeBase64(randomBytes(32));

    // Only 32 bytes instead of 64
    const shortSig = encodeBase64(randomBytes(32));

    expect(
      verifySignature(publicKeyHex, ciphertextBase64, shortSig)
    ).toBe(false);
  });

  it('rejects an invalid public key (too short)', () => {
    expect(verifySignature('abcd', 'data', 'sig')).toBe(false);
  });

  it('handles edge case of empty ciphertext', () => {
    const keyPair = generateSigningKeyPair();
    const publicKeyHex = bytesToHex(keyPair.publicKey);
    const ciphertextBase64 = '';

    const message = new TextEncoder().encode(
      `${publicKeyHex}:${ciphertextBase64}`
    );
    const signature = signDetached(message, keyPair.secretKey);
    const signatureBase64 = encodeBase64(signature);

    expect(
      verifySignature(publicKeyHex, ciphertextBase64, signatureBase64)
    ).toBe(true);
  });
});
