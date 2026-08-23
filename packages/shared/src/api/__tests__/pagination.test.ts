import { describe, it, expect } from 'vitest';
import { offsetPaginationSchema, cursorPaginationSchema } from '../pagination';

describe('pagination schemas', () => {
  it('offsetPaginationSchema defaults and validation', () => {
    const parsed = offsetPaginationSchema.parse({});
    expect(parsed).toEqual({ page: 1, pageSize: 20 });

    const custom = offsetPaginationSchema.parse({ page: 2, pageSize: 50 });
    expect(custom).toEqual({ page: 2, pageSize: 50 });
  });

  it('cursorPaginationSchema defaults and validation', () => {
    const parsed = cursorPaginationSchema.parse({});
    expect(parsed).toEqual({ limit: 20 });
  });
});
