import { describe, it, expect } from 'vitest';
import { generateId, isValidId } from '../uuid';

describe('uuid util', () => {
  it('should generate a valid uuid', () => {
    const id = generateId();
    expect(isValidId(id)).toBe(true);
  });

  it('should validate correctly', () => {
    expect(isValidId('abc')).toBe(false);
    expect(isValidId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });
});
