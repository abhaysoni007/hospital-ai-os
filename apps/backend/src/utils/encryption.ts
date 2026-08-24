import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const FALLBACK_KEY = 'dev-only-insecure-encryption-key-do-not-use-in-production';

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || FALLBACK_KEY;
  return createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a field value using AES-256-GCM.
 * Output format: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptField(encrypted: string): string {
  const [ivB64, tagB64, dataB64] = encrypted.split(':');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted field format');
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
