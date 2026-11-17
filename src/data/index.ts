// The single place that decides which storage is used.
// Later: `export const data = createSupabaseBackend(url, key);`
import { createDexieBackend } from './dexieBackend';

export const data = createDexieBackend();
export * from './types';
