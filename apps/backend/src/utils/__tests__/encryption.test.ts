import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { encryptField, decryptField, resetEncryptionKeyCache } from '../encryption';

describe('Field-Level Encryption & Key Caching', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetEncryptionKeyCache();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    resetEncryptionKeyCache();
  });

  it('correctly encrypts and decrypts sensitive values round-trip', () => {
    const sensitive = 'A12345678';
    const encrypted = encryptField(sensitive);
    expect(encrypted).not.toBe(sensitive);
    expect(encrypted.split(':')).toHaveLength(3); // iv:tag:ciphertext

    const decrypted = decryptField(encrypted);
    expect(decrypted).toBe(sensitive);
  });

  it('produces different ciphertexts (unique IV) for identical plaintexts', () => {
    const sensitive = 'A12345678';
    const enc1 = encryptField(sensitive);
    const enc2 = encryptField(sensitive);
    expect(enc1).not.toBe(enc2);
    expect(decryptField(enc1)).toBe(sensitive);
    expect(decryptField(enc2)).toBe(sensitive);
  });

  it('fails closed in production if ENCRYPTION_KEY is weak or missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ENCRYPTION_KEY;
    resetEncryptionKeyCache();

    expect(() => encryptField('test')).toThrow(/ENCRYPTION_KEY must be set to at least 32 characters/);
  });

  it('encrypts successfully in production with a valid 32+ character key', () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_KEY = 'a-very-strong-production-encryption-key-with-32-chars!';
    resetEncryptionKeyCache();

    const encrypted = encryptField('prod-secret');
    expect(decryptField(encrypted)).toBe('prod-secret');
  });

  it('throws on tampered ciphertext or auth tag (AES-GCM authentication verification)', () => {
    const encrypted = encryptField('authentic-data');
    const [iv, tag, data] = encrypted.split(':');
    // Tamper with data
    const tamperedData = Buffer.from(data, 'base64');
    tamperedData[0] ^= 0xff;
    const tampered = `${iv}:${tag}:${tamperedData.toString('base64')}`;

    expect(() => decryptField(tampered)).toThrow();
  });
});
