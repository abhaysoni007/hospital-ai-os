import pino from 'pino';
import { config } from '../config';

const redactedPaths = [
  // Authentication/Security
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'authorization',

  // Potential PHI
  'firstName',
  'lastName',
  'dateOfBirth',
  'phonePrimary',
  'phoneEmergency',
  'addressLine1',
  'addressCity',
  'addressState',
  'addressPostalCode',

  // Clinical data / Content
  'content',
  'vitals',
  'notes',
  'resultValues',
];

export const loggerOptions = {
  level: config.NODE_ENV === 'test' ? 'silent' : 'info',
  base: {
    service: 'backend',
    environment: config.NODE_ENV,
  },
  redact: {
    paths: redactedPaths
      .map((p) => `*.${p}`)
      .concat(redactedPaths.map((p) => `*.*.${p}`))
      .concat(redactedPaths.map((p) => `*.*.*.${p}`))
      .concat(redactedPaths),
    censor: '[REDACTED]',
  },
  formatters: {
    level: (label: string) => {
      return { level: label };
    },
  },
};

export const logger = pino(loggerOptions);
