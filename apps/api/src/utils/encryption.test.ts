import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the config module to provide a valid 64-char hex encryption key.
// vi.mock is hoisted, so the key must be inlined (no top-level variable refs).
// ---------------------------------------------------------------------------

vi.mock('../config', () => ({
  config: {
    encryption: {
      key: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2',
    },
  },
}));

import { encrypt, decrypt } from './encryption';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('encrypt / decrypt', () => {
  // -------------------------------------------------------------------------
  // Basic roundtrip
  // -------------------------------------------------------------------------
  describe('roundtrip', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plaintext = 'Hello, world!';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should produce a colon-separated iv:authTag:ciphertext format', () => {
      const encrypted = encrypt('test');
      const parts = encrypted.split(':');

      expect(parts).toHaveLength(3);
      // IV is 16 bytes = 32 hex chars
      expect(parts[0]).toHaveLength(32);
      // Auth tag is 16 bytes = 32 hex chars
      expect(parts[1]).toHaveLength(32);
      // Ciphertext length depends on input length
      expect(parts[2]!.length).toBeGreaterThan(0);
    });

    it('should produce different ciphertext each time (random IV)', () => {
      const plaintext = 'same input';
      const encrypted1 = encrypt(plaintext);
      const encrypted2 = encrypt(plaintext);

      // The two encrypted strings should differ because of different random IVs
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same plaintext
      expect(decrypt(encrypted1)).toBe(plaintext);
      expect(decrypt(encrypted2)).toBe(plaintext);
    });
  });

  // -------------------------------------------------------------------------
  // Invalid encrypted format
  // -------------------------------------------------------------------------
  describe('invalid encrypted format', () => {
    it('should throw an error when the encrypted string has too few parts', () => {
      expect(() => decrypt('onlyonepart')).toThrow(
        'Invalid encrypted value format',
      );
    });

    it('should throw an error when the encrypted string has too many parts', () => {
      expect(() => decrypt('a:b:c:d')).toThrow(
        'Invalid encrypted value format',
      );
    });

    it('should throw an error for an empty string', () => {
      expect(() => decrypt('')).toThrow('Invalid encrypted value format');
    });

    it('should throw when the auth tag is tampered with', () => {
      const encrypted = encrypt('secret data');
      const parts = encrypted.split(':');
      // Flip a character in the auth tag
      const tamperedTag =
        parts[1]![0] === 'a'
          ? 'b' + parts[1]!.slice(1)
          : 'a' + parts[1]!.slice(1);
      const tampered = `${parts[0]}:${tamperedTag}:${parts[2]}`;

      expect(() => decrypt(tampered)).toThrow();
    });

    it('should throw when the ciphertext is tampered with', () => {
      const encrypted = encrypt('secret data');
      const parts = encrypted.split(':');
      // Flip a character in the ciphertext
      const tamperedCipher =
        parts[2]![0] === 'a'
          ? 'b' + parts[2]!.slice(1)
          : 'a' + parts[2]!.slice(1);
      const tampered = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

      expect(() => decrypt(tampered)).toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Different input strings
  // -------------------------------------------------------------------------
  describe('different input strings', () => {
    it('should handle an empty string', () => {
      const encrypted = encrypt('');
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe('');
    });

    it('should handle unicode characters', () => {
      const plaintext = 'مرحبا بالعالم 🌍 こんにちは';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle emoji-only strings', () => {
      const plaintext = '🔐🔑🛡️';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle a long string', () => {
      const plaintext = 'A'.repeat(10_000);
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(decrypted).toHaveLength(10_000);
    });

    it('should handle strings with special characters', () => {
      const plaintext = 'line1\nline2\ttab\r\n"quotes" \'single\' <html>&amp;';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle strings containing colons (the delimiter)', () => {
      const plaintext = 'iv:authTag:ciphertext';
      const encrypted = encrypt(plaintext);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });
});
