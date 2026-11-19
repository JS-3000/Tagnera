// Offline outbox: prepared for a later server (e.g. Supabase).
//
// Every write in the data layer is reported here (see data/index.ts). As soon as a
// `RemoteSync` is configured, each write is stored in the `outbox` table first and sent
// to the server when there is a connection – in order, with retries. Without a server
// (this prototype) nothing is queued: the browser database is the only storage.
import { data } from '../data';
import type { OutboxItem } from '../data/types';
import { nowIso, uuid } from '../lib/util';

/** Implemented later by the server connection. Must be idempotent (same item may arrive twice). */
export interface RemoteSync {
  push(item: OutboxItem): Promise<void>;
}

let remote: RemoteSync | null = null;
let flushing = false;

/** Enable synchronisation with a server, e.g. configureRemote(new SupabaseSync(client)). */
export function configureRemote(r: RemoteSync | null): void {
  remote = r;
  if (r) void flushOutbox();
}

export const syncEnabled = () => remote !== null;

/** Called by the data layer after each write. */
export async function recordWrite(table: string, op: 'save' | 'remove', recordId: string, payload: unknown): Promise<void> {
  if (!remote || table === 'outbox' || table === 'files') return; // files go to object storage separately
  await data.outbox.save({ id: uuid(), table, op, recordId, payload, createdAt: nowIso(), attempts: 0 });
  if (navigator.onLine) void flushOutbox();
}

/** Send queued writes in order; stops at the first failure and retries later. */
export async function flushOutbox(): Promise<void> {
  if (!remote || flushing || !navigator.onLine) return;
  flushing = true;
  try {
    const items = (await data.outbox.list()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const item of items) {
      try {
        await remote.push(item);
        await data.outbox.remove(item.id);
      } catch {
        await data.outbox.save({ ...item, attempts: item.attempts + 1 });
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

export async function pendingCount(): Promise<number> {
  return (await data.outbox.list()).length;
}

// every write of the data layer passes through here
data.setWriteHook((table, op, id, payload) => void recordWrite(table, op, id, payload));

// send again as soon as the connection is back
window.addEventListener('online', () => void flushOutbox());
