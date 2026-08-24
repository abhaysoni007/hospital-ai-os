import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

/**
 * Field-level encryption for sensitive PII (identity document numbers).
 *
 * Mechanism: AES-256-GCM (architecture-approved, authenticated encryption).
 * Key derivation: ENCRYPTION_KEY is hashed with SHA-256 to produce the 256-bit key.
 *
 * KEY MANAGEMENT POLICY:
 * - PRODUCTION: ENCRYPTION_KEY is REQUIRED and must be >= 32 characters.
 *   Missing or weak keys FAIL CLOSED (throw) — encryption never silently degrades.
 * - LOCAL DEVELOPMENT / TEST: if NODE_ENV is 'development' or 'test' and no
 *   key is configured, a documented insecure fallback is used so contributors
 *   can run the stack locally. This fallback is NOT suitable for any real data
 *   and must never reach a deployed environment.
 *
 * The key value itself must never be logged. Configure it via the ENCRYPTION_KEY
 * environment variable (see .env.example).
 */

const DEV_FALLBACK_KEY_MATERIAL = 'hospital-ai-os-local-development-only-insecure-key';
const MIN_PRODUCTION_KEY_LENGTH = 32;

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY;
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (!secret || secret.length < MIN_PRODUCTION_KEY_LENGTH) {
    if (nodeEnv === 'production') {
      // Fail closed: refuse to encrypt with an absent/weak key in production.
      throw new Error(
        `ENCRYPTION_KEY must be set to at least ${MIN_PRODUCTION_KEY_LENGTH} characters in production`,
      );
    }
    return createHash('sha256').update(DEV_FALLBACK_KEY_MATERIAL).digest();
  }

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
