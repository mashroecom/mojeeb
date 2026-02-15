import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

// Cache the key buffer at module level to avoid re-deriving on every call
let cachedKeyBuffer: Buffer | null = null;

/**
 * Derive the 32-byte key buffer from the hex-encoded config value.
 * Cached after first call for performance.
 */
function getKeyBuffer(): Buffer {
  if (!cachedKeyBuffer) {
    cachedKeyBuffer = Buffer.from(config.encryption.key, 'hex');
  }
  return cachedKeyBuffer;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 *
 * @returns A colon-separated string: `iv:authTag:ciphertext` (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getKeyBuffer();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Decrypt a string that was encrypted with {@link encrypt}.
 *
 * @param encrypted - The colon-separated `iv:authTag:ciphertext` string.
 * @returns The original plaintext.
 */
export function decrypt(encrypted: string): string {
  const key = getKeyBuffer();
  const parts = encrypted.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format — expected iv:authTag:ciphertext');
  }

  const ivHex = parts[0]!;
  const authTagHex = parts[1]!;
  const ciphertextHex = parts[2]!;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}
