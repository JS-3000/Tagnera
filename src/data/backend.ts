// Storage-agnostic interfaces. The UI and the services only talk to these.
//
// To switch to Supabase/PostgreSQL later, write a second implementation of
// `DataBackend` (e.g. `supabaseBackend.ts`) and change one line in `src/data/index.ts`.
// Every method is async already, so no caller has to change.

import type {
  IssueReport,
  OutboxItem,
  DocumentItem,
  DocumentVersion,
  Faq,
  LogEntry,
  MaintenanceTask,
  Product,
  SparePart,
  StoredFile,
  Supplier,
  Tag,
  User,
} from './types';

export interface Repository<T extends { id: string }> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  /** Equality filter on one indexed field, e.g. findBy('tagId', id). Maps to SQL WHERE / supabase .eq(). */
  findBy<K extends keyof T & string>(field: K, value: T[K] & (string | number)): Promise<T[]>;
  save(item: T): Promise<T>;
  saveMany(items: T[]): Promise<void>;
  remove(id: string): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
}

export interface Tables {
  users: Repository<User>;
  tags: Repository<Tag>;
  products: Repository<Product>;
  suppliers: Repository<Supplier>;
  spareParts: Repository<SparePart>;
  faqs: Repository<Faq>;
  tasks: Repository<MaintenanceTask>;
  documents: Repository<DocumentItem>;
  documentVersions: Repository<DocumentVersion>;
  logEntries: Repository<LogEntry>;
  files: Repository<StoredFile>;
  issues: Repository<IssueReport>;
  outbox: Repository<OutboxItem>;
}

export type TableName = keyof Tables;

export const TABLE_NAMES: TableName[] = [
  'users',
  'tags',
  'products',
  'suppliers',
  'spareParts',
  'faqs',
  'tasks',
  'documents',
  'documentVersions',
  'logEntries',
  'files',
  'issues',
  'outbox',
];

export interface DataBackend extends Tables {
  /** Delete everything (used by "reset" and before a full JSON import). */
  clearAll(): Promise<void>;
  /** Subscribe to any write. Returns an unsubscribe function. Used to refresh the UI. */
  onChange(listener: () => void): () => void;
}
