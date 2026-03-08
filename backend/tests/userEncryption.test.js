'use strict';

const { encrypt, decrypt } = require('../src/models/User');

describe('User token encryption (AES-256-GCM)', () => {
  const plaintext = 'EAABexample_threads_access_token_abc123xyz';

  test('encrypt returns a string with three colon-separated hex segments (iv:authTag:ciphertext)', () => {
    const encrypted = encrypt(plaintext);
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    // iv = 12 bytes → 24 hex chars
    expect(parts[0]).toHaveLength(24);
    // authTag = 16 bytes → 32 hex chars
    expect(parts[1]).toHaveLength(32);
  });

  test('decrypt reverses encrypt correctly', () => {
    const encrypted = encrypt(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  test('each encrypt call produces a unique ciphertext (random IV)', () => {
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2);
    // But both should decrypt to the same value
    expect(decrypt(enc1)).toBe(plaintext);
    expect(decrypt(enc2)).toBe(plaintext);
  });

  test('decrypt throws if the ciphertext is tampered (auth tag mismatch)', () => {
    const encrypted = encrypt(plaintext);
    const parts = encrypted.split(':');
    // Flip a byte in the ciphertext segment
    const tamperedCiphertext = parts[2].slice(0, -2) + 'ff';
    const tampered = [parts[0], parts[1], tamperedCiphertext].join(':');
    expect(() => decrypt(tampered)).toThrow();
  });

  test('decrypt throws on malformed input (not 3 parts)', () => {
    expect(() => decrypt('invalid')).toThrow('Invalid encrypted token format');
    expect(() => decrypt('a:b')).toThrow('Invalid encrypted token format');
  });
});
