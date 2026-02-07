import { describe, it, expect } from 'vitest';
import {
  generateIdentity,
  identityFromSecretKey,
  exportSecretKey,
  importSecretKey,
  encryptEvent,
  decryptEvent,
  sealedBoxSeal,
  sealedBoxOpen,
  signForAppend,
  encodeBase64,
  decodeBase64,
  bytesToHex,
  hexToBytes,
} from '../lib/crypto';
import nacl from 'tweetnacl';

describe('Identity', () => {
  it('generates an identity with all required fields', () => {
    const identity = generateIdentity();

    expect(identity.signingKeyPair.publicKey).toHaveLength(32);
    expect(identity.signingKeyPair.secretKey).toHaveLength(64);
    expect(identity.encryptionKeyPair.publicKey).toHaveLength(32);
    expect(identity.encryptionKeyPair.secretKey).toHaveLength(32);
    expect(identity.publicKeyHex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('restores the same identity from a secret key', () => {
    const original = generateIdentity();
    const restored = identityFromSecretKey(original.signingKeyPair.secretKey);

    expect(restored.publicKeyHex).toBe(original.publicKeyHex);
    expect(restored.signingKeyPair.publicKey).toEqual(original.signingKeyPair.publicKey);
    expect(restored.encryptionKeyPair.publicKey).toEqual(original.encryptionKeyPair.publicKey);
  });

  it('round-trips through export/import', () => {
    const original = generateIdentity();
    const exported = exportSecretKey(original);
    const imported = importSecretKey(exported);

    expect(imported.publicKeyHex).toBe(original.publicKeyHex);
  });
});

describe('Sealed Box', () => {
  it('encrypts and decrypts a message', () => {
    const keyPair = nacl.box.keyPair();
    const message = new TextEncoder().encode('hello, outside world');

    const sealed = sealedBoxSeal(message, keyPair.publicKey);

    // Sealed box = 32 (ephemeral PK) + message.length + 16 (MAC)
    expect(sealed.length).toBe(32 + message.length + 16);

    const opened = sealedBoxOpen(sealed, keyPair.publicKey, keyPair.secretKey);
    expect(opened).not.toBeNull();
    expect(new TextDecoder().decode(opened!)).toBe('hello, outside world');
  });

  it('fails to decrypt with wrong key', () => {
    const keyPair1 = nacl.box.keyPair();
    const keyPair2 = nacl.box.keyPair();
    const message = new TextEncoder().encode('secret');

    const sealed = sealedBoxSeal(message, keyPair1.publicKey);
    const opened = sealedBoxOpen(sealed, keyPair2.publicKey, keyPair2.secretKey);
    expect(opened).toBeNull();
  });

  it('fails on truncated ciphertext', () => {
    const keyPair = nacl.box.keyPair();
    const sealed = new Uint8Array(30); // too short
    const opened = sealedBoxOpen(sealed, keyPair.publicKey, keyPair.secretKey);
    expect(opened).toBeNull();
  });

  it('fails on tampered ciphertext', () => {
    const keyPair = nacl.box.keyPair();
    const message = new TextEncoder().encode('tamper test');
    const sealed = sealedBoxSeal(message, keyPair.publicKey);

    // Flip a byte in the ciphertext portion
    sealed[40] ^= 0xff;

    const opened = sealedBoxOpen(sealed, keyPair.publicKey, keyPair.secretKey);
    expect(opened).toBeNull();
  });
});

describe('Event Encryption', () => {
  it('encrypts and decrypts an event through identity', () => {
    const identity = generateIdentity();
    const plaintext = new TextEncoder().encode(
      JSON.stringify({ type: 'timer_start', id: 'test', ts: 123 })
    );

    const encrypted = encryptEvent(plaintext, identity);
    const decrypted = decryptEvent(encrypted, identity);

    expect(decrypted).not.toBeNull();
    expect(new TextDecoder().decode(decrypted!)).toBe(
      JSON.stringify({ type: 'timer_start', id: 'test', ts: 123 })
    );
  });

  it('different identities cannot decrypt each other\'s events', () => {
    const identity1 = generateIdentity();
    const identity2 = generateIdentity();
    const plaintext = new TextEncoder().encode('private data');

    const encrypted = encryptEvent(plaintext, identity1);
    const decrypted = decryptEvent(encrypted, identity2);
    expect(decrypted).toBeNull();
  });
});

describe('Signing', () => {
  it('produces a valid signature for append', () => {
    const identity = generateIdentity();
    const ciphertextBase64 = encodeBase64(new Uint8Array([1, 2, 3]));

    const signatureBase64 = signForAppend(
      identity.publicKeyHex,
      ciphertextBase64,
      identity.signingKeyPair.secretKey
    );

    // Verify using nacl directly (same logic as server)
    const message = new TextEncoder().encode(
      `${identity.publicKeyHex}:${ciphertextBase64}`
    );
    const signature = decodeBase64(signatureBase64);

    const valid = nacl.sign.detached.verify(
      message,
      signature,
      identity.signingKeyPair.publicKey
    );
    expect(valid).toBe(true);
  });
});

describe('Hex Utilities', () => {
  it('round-trips bytes through hex', () => {
    const original = new Uint8Array([0, 1, 127, 128, 255]);
    const hex = bytesToHex(original);
    expect(hex).toBe('00017f80ff');
    const restored = hexToBytes(hex);
    expect(restored).toEqual(original);
  });
});
