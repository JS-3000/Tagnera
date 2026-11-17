// Export / import of all data as one JSON file (to move data between devices).
// Files (photos, PDFs) are embedded as base64 data URLs.

import { data } from '../data';
import { TABLE_NAMES, type TableName } from '../data/backend';
import type { StoredFile } from '../data/types';
import { blobToDataUrl, dataUrlToBlob, downloadBlob, nowIso, toDateStr } from '../lib/util';

const FORMAT = 'tagnera-backup';
const VERSION = 1;

type SerializedFile = Omit<StoredFile, 'blob'> & { dataUrl: string };

export async function exportAll(): Promise<void> {
  const tables: Record<string, unknown[]> = {};
  for (const name of TABLE_NAMES) {
    if (name === 'files') continue;
    tables[name] = await data[name].list();
  }
  const files: SerializedFile[] = [];
  for (const f of await data.files.list()) {
    const { blob, ...meta } = f;
    files.push({ ...meta, dataUrl: await blobToDataUrl(blob) });
  }
  tables.files = files;
  const json = JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: nowIso(), tables });
  downloadBlob(new Blob([json], { type: 'application/json' }), `tagnera-export-${toDateStr(new Date())}.json`);
}

/** Replaces ALL local data with the content of the file. */
export async function importAll(file: File): Promise<{ tags: number; files: number }> {
  const parsed = JSON.parse(await file.text());
  if (parsed?.format !== FORMAT || !parsed.tables) {
    throw new Error('Das ist keine Tagnera-Exportdatei.');
  }
  const tables = parsed.tables as Record<TableName, unknown[]>;
  // Convert files first, so a broken file does not leave us with half-deleted data.
  const files: StoredFile[] = [];
  for (const f of (tables.files ?? []) as SerializedFile[]) {
    const { dataUrl, ...meta } = f;
    files.push({ ...meta, blob: await dataUrlToBlob(dataUrl) });
  }
  await data.clearAll();
  for (const name of TABLE_NAMES) {
    if (name === 'files') continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await data[name].saveMany((tables[name] ?? []) as any[]);
  }
  await data.files.saveMany(files);
  return { tags: (tables.tags ?? []).length, files: files.length };
}
