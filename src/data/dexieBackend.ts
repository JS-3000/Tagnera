// IndexedDB implementation of the DataBackend, using Dexie.
// All data stays in the browser of this device.

import Dexie, { type Table } from 'dexie';
import type { DataBackend, Repository, TableName, WriteHook } from './backend';
import { TABLE_NAMES } from './backend';

class TagneraDb extends Dexie {
  constructor() {
    super('tagnera');
    // Only indexed fields are listed here; all other fields are stored anyway.
    this.version(1).stores({
      users: 'id',
      tags: 'id, tagNumber, productId, plant',
      products: 'id, articleNumber',
      suppliers: 'id',
      spareParts: 'id, ownerId',
      faqs: 'id, ownerId',
      tasks: 'id, ownerId',
      documents: 'id, ownerId',
      documentVersions: 'id, documentId',
      logEntries: 'id, tagId, date',
      files: 'id',
    });
    // v2 (additive, existing data stays): fault reports + offline outbox
    this.version(2).stores({
      issues: 'id, tagId, status, createdAt',
      outbox: 'id, createdAt',
    });
  }
}

type Listener = () => void;

export function createDexieBackend(): DataBackend {
  const db = new TagneraDb();
  const listeners = new Set<Listener>();
  let writeHook: WriteHook | null = null;
  let scheduled = false;

  // Batch many writes into one UI refresh.
  const notify = () => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      listeners.forEach((l) => l());
    });
  };

  function repo<T extends { id: string }>(name: TableName): Repository<T> {
    // `Table` without generics keeps TypeScript fast; the Repository<T> type guards callers.
    const table: Table = db.table(name);
    return {
      list: () => table.toArray(),
      get: (id) => table.get(id),
      findBy: (field, value) => table.where(field).equals(value).toArray(),
      save: async (item) => {
        await table.put(item);
        writeHook?.(name, 'save', item.id, item);
        notify();
        return item;
      },
      saveMany: async (items) => {
        await table.bulkPut(items);
        items.forEach((i) => writeHook?.(name, 'save', i.id, i));
        notify();
      },
      remove: async (id) => {
        await table.delete(id);
        writeHook?.(name, 'remove', id, null);
        notify();
      },
      removeMany: async (ids) => {
        await table.bulkDelete(ids);
        ids.forEach((id) => writeHook?.(name, 'remove', id, null));
        notify();
      },
    };
  }

  return {
    users: repo('users'),
    tags: repo('tags'),
    products: repo('products'),
    suppliers: repo('suppliers'),
    spareParts: repo('spareParts'),
    faqs: repo('faqs'),
    tasks: repo('tasks'),
    documents: repo('documents'),
    documentVersions: repo('documentVersions'),
    logEntries: repo('logEntries'),
    files: repo('files'),
    issues: repo('issues'),
    outbox: repo('outbox'),
    clearAll: async () => {
      for (const name of TABLE_NAMES) await db.table(name).clear();
      notify();
    },
    setWriteHook: (h) => {
      writeHook = h;
    },
    onChange: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
