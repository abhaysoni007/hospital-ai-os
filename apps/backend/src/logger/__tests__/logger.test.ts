import { describe, it, expect } from 'vitest';
import { loggerOptions } from '../index';
import pino from 'pino';
import { Writable } from 'stream';

describe('Structured Logger', () => {
  it('should redact sensitive information from logs', () => {
    let logOutput = '';
    const stream = new Writable({
      write(chunk, encoding, callback) {
        logOutput += chunk.toString();
        callback();
      },
    });

    const testLogger = pino({ ...loggerOptions, level: 'info' }, stream);

    const testPayload = {
      user: 'test-user',
      patientData: {
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: '1990-01-01',
        phonePrimary: '555-1234',
        bloodPressure: '120/80',
        content: {
          notes: 'Patient feels fine',
          diagnosis: 'Healthy',
        },
      },
      auth: {
        password: 'super-secret-password',
        token: 'jwt.token.here',
      },
    };

    testLogger.info({ data: testPayload }, 'Test event');

    const parsedLog = JSON.parse(logOutput);

    // Verify normal fields exist
    expect(parsedLog.data.user).toBe('test-user');
    expect(parsedLog.data.patientData.bloodPressure).toBe('120/80');

    // Verify redactions
    expect(parsedLog.data.patientData.firstName).toBe('[REDACTED]');
    expect(parsedLog.data.patientData.lastName).toBe('[REDACTED]');
    expect(parsedLog.data.patientData.dateOfBirth).toBe('[REDACTED]');
    expect(parsedLog.data.patientData.phonePrimary).toBe('[REDACTED]');
    expect(parsedLog.data.patientData.content).toBe('[REDACTED]');

    expect(parsedLog.data.auth.password).toBe('[REDACTED]');
    expect(parsedLog.data.auth.token).toBe('[REDACTED]');

    // Original payload should not be mutated
    expect(testPayload.patientData.firstName).toBe('John');
  });
});
