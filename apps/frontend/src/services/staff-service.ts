import { apiClient } from './api-client';

/**
 * M12.2 Part D — minimum staff identity projection.
 *
 * Resolves human-readable names for staff UUIDs already present in clinical
 * payloads (record authors, enteredBy/verifiedBy). Module-level cache + in-flight
 * dedupe prevents N+1 request storms across list rows. Read-only; the backend
 * projects ONLY id/displayName/role for any authenticated user.
 */

export interface StaffIdentityItem {
  id: string;
  displayName: string;
  role: string;
}

const MAX_BATCH = 50;

const identityCache = new Map<string, StaffIdentityItem>();
const inFlightBatches = new Map<string, Promise<void>>();
const BATCH_SIZE = MAX_BATCH;

function batchKey(ids: string[]): string {
  return [...ids].sort().join(',');
}

async function fetchBatch(ids: string[]): Promise<void> {
  const key = batchKey(ids);
  const existing = inFlightBatches.get(key);
  if (existing) return existing;

  const promise = (async () => {
    const response = await apiClient<{ data: StaffIdentityItem[] }>(
      `/staff/identity?ids=${ids.join(',')}`,
      { method: 'GET' },
    );
    for (const item of response.data) identityCache.set(item.id, item);
    // Negative-cache unknown ids briefly to avoid refetch storms within a session.
    for (const id of ids) {
      if (!identityCache.has(id)) {
        identityCache.set(id, { id, displayName: 'Unknown staff', role: 'unknown' });
      }
    }
  })().finally(() => {
    inFlightBatches.delete(key);
  });

  inFlightBatches.set(key, promise);
  return promise;
}

/** Resolves identities for the given ids using bounded batches. */
export async function getStaffIdentities(ids: string[]): Promise<Map<string, StaffIdentityItem>> {
  const missing = [...new Set(ids)].filter((id) => !identityCache.has(id));
  const batches: string[][] = [];
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    batches.push(missing.slice(i, i + BATCH_SIZE));
  }
  await Promise.all(batches.map(fetchBatch));
  const result = new Map<string, StaffIdentityItem>();
  for (const id of new Set(ids)) {
    const hit = identityCache.get(id);
    if (hit) result.set(id, hit);
  }
  return result;
}

/** Synchronous cache read for rendering (use after getStaffIdentities resolves). */
export function getCachedStaffIdentity(id: string | null | undefined): StaffIdentityItem | null {
  if (!id) return null;
  return identityCache.get(id) ?? null;
}
