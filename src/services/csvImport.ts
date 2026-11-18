// CSV import of tags: read file, guess column mapping, import with product recognition.
import Papa from 'papaparse';
import { data } from '../data';
import type { Tag } from '../data/types';
import { normalizeKey, nowIso } from '../lib/util';
import { applyProduct, emptyTag, productKeys } from './tags';

export type TargetField =
  | 'tagNumber'
  | 'type'
  | 'description'
  | 'plant'
  | 'location'
  | 'manufacturer'
  | 'articleNumber'
  | 'orderNumber'
  | 'commissionedAt'
  | 'notes';

export const TARGET_FIELDS: { key: TargetField; label: string; required?: boolean; synonyms: string[] }[] = [
  {
    key: 'tagNumber',
    label: 'Tag-Nummer',
    required: true,
    synonyms: ['tag', 'tagnummer', 'tagnr', 'kennzeichen', 'kks', 'aks', 'tagno', 'messstelle', 'bmk'],
  },
  { key: 'type', label: 'Typ', synonyms: ['typ', 'type', 'art', 'bauteil', 'komponente', 'kategorie'] },
  {
    key: 'description',
    label: 'Bezeichnung / Funktion',
    synonyms: ['bezeichnung', 'beschreibung', 'funktion', 'description', 'name', 'text'],
  },
  { key: 'plant', label: 'Anlage', synonyms: ['anlage', 'plant', 'teilanlage', 'bereich', 'system'] },
  { key: 'location', label: 'Standort', synonyms: ['standort', 'ort', 'location', 'raum', 'halle', 'ebene'] },
  { key: 'manufacturer', label: 'Hersteller', synonyms: ['hersteller', 'manufacturer', 'fabrikat', 'lieferant'] },
  {
    key: 'articleNumber',
    label: 'Artikelnummer',
    synonyms: ['artikelnummer', 'artnr', 'artikel', 'typnummer', 'article', 'articlenumber', 'modell', 'model'],
  },
  {
    key: 'orderNumber',
    label: 'Bestellnummer',
    synonyms: ['bestellnummer', 'bestellnr', 'ordernumber', 'materialnummer', 'matnr'],
  },
  {
    key: 'commissionedAt',
    label: 'Inbetriebnahme',
    synonyms: ['inbetriebnahme', 'ibn', 'baujahr', 'datum', 'commissioned'],
  },
  { key: 'notes', label: 'Notizen', synonyms: ['notiz', 'notizen', 'bemerkung', 'kommentar', 'notes', 'hinweis'] },
];

export type Mapping = Partial<Record<TargetField, number>>; // field -> column index

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** Excel in Germany often saves CSV as Windows-1252 – detect and decode accordingly. */
export async function readCsv(file: File, hasHeader: boolean): Promise<ParsedCsv> {
  const buf = await file.arrayBuffer();
  let text = new TextDecoder('utf-8').decode(buf);
  if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf);
  text = text.replace(/^﻿/, '');
  const res = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy', delimitersToGuess: [';', ',', '\t', '|'] });
  const all = res.data.map((r) => r.map((c) => (c ?? '').trim()));
  const width = Math.max(0, ...all.map((r) => r.length));
  const headers = hasHeader && all.length ? all[0] : Array.from({ length: width }, (_, i) => `Spalte ${i + 1}`);
  return { headers: headers.map((h, i) => h || `Spalte ${i + 1}`), rows: hasHeader ? all.slice(1) : all };
}

export function guessMapping(headers: string[]): Mapping {
  const m: Mapping = {};
  const used = new Set<number>();
  for (const f of TARGET_FIELDS) {
    const idx = headers.findIndex((h, i) => {
      if (used.has(i)) return false;
      const k = normalizeKey(h);
      return f.synonyms.some((s) => k === s || k.startsWith(s));
    });
    if (idx >= 0) {
      m[f.key] = idx;
      used.add(idx);
    }
  }
  return m;
}

function parseDate(s: string): string {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  if (/^\d{4}$/.test(t)) return `${t}-01-01`; // Baujahr
  return '';
}

export function rowToValues(row: string[], mapping: Mapping): Partial<Record<TargetField, string>> {
  const v: Partial<Record<TargetField, string>> = {};
  for (const f of TARGET_FIELDS) {
    const i = mapping[f.key];
    if (i !== undefined && i >= 0) v[f.key] = (row[i] ?? '').trim();
  }
  return v;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  linkedToProduct: number;
}

export async function importTags(
  parsed: ParsedCsv,
  mapping: Mapping,
  opts: { updateExisting: boolean; defaultPlant: string },
): Promise<ImportResult> {
  const [existing, products] = await Promise.all([data.tags.list(), data.products.list()]);
  const byNumber = new Map(existing.map((t) => [normalizeKey(t.tagNumber), t]));
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, linkedToProduct: 0 };
  const toSave: Tag[] = [];

  for (const row of parsed.rows) {
    const v = rowToValues(row, mapping);
    const number = (v.tagNumber ?? '').toUpperCase();
    if (!number) {
      result.skipped++;
      continue;
    }
    const key = normalizeKey(number);
    const old = byNumber.get(key);
    if (old && !opts.updateExisting) {
      result.skipped++;
      continue;
    }
    let tag: Tag = old ? { ...old } : emptyTag();
    tag.tagNumber = number;
    for (const k of [
      'type',
      'description',
      'plant',
      'location',
      'manufacturer',
      'articleNumber',
      'orderNumber',
      'notes',
    ] as const) {
      if (v[k] !== undefined && v[k] !== '') tag[k] = v[k]!;
    }
    if (v.commissionedAt) tag.commissionedAt = parseDate(v.commissionedAt) || tag.commissionedAt;
    if (!tag.plant && opts.defaultPlant) tag.plant = opts.defaultPlant;

    // product recognition by article number (+ manufacturer)
    const ak = normalizeKey(tag.articleNumber);
    if (ak) {
      const hits = products.filter((p) => productKeys(p).includes(ak));
      const p = hits.find((h) => normalizeKey(h.manufacturer) === normalizeKey(tag.manufacturer)) ?? hits[0];
      if (p) {
        tag = applyProduct(tag, p);
        result.linkedToProduct++;
      }
    }
    tag.updatedAt = nowIso();
    toSave.push(tag);
    byNumber.set(key, tag);
    if (old) result.updated++;
    else result.created++;
  }
  await data.tags.saveMany(toSave);
  return result;
}
