// Documents shipped with the app (public/docs/, listed in public/docs/manifest.json).
// They are not copied into the browser database: every device loads the same files
// by URL, and the service worker keeps opened files for offline use.

import type { Product, Tag } from '../data/types';
import { normalizeKey } from '../lib/util';
import type { DocWithVersions } from './tags';

interface ManifestDoc {
  id: string;
  file: string;
  title: string;
  type: string;
  language: string;
  sourceUrl: string;
  retrievedAt: string;
  articleNumbers?: string[];
  tags?: string[];
  size?: number;
  startPage?: number;
}
interface ManifestRequest {
  id: string;
  title: string;
  type: string;
  manufacturer: string;
  email: string;
  articleNumbers?: string[];
  tags?: string[];
}
interface Manifest {
  documents: ManifestDoc[];
  requests: ManifestRequest[];
}

let cache: Promise<Manifest> | null = null;

export function loadManifest(): Promise<Manifest> {
  if (!cache) {
    cache = fetch(`${import.meta.env.BASE_URL}docs/manifest.json`, { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : { documents: [], requests: [] }))
      .then((m: Partial<Manifest>) => ({ documents: m.documents ?? [], requests: m.requests ?? [] }))
      .catch(() => {
        cache = null; // try again next time (e.g. offline at first start)
        return { documents: [], requests: [] };
      });
  }
  return cache;
}

export const docUrl = (file: string) =>
  `${import.meta.env.BASE_URL}docs/${file.split('/').map(encodeURIComponent).join('/')}`;

function matches(entry: { articleNumbers?: string[]; tags?: string[] }, keys: Set<string>, tagNo: string | null) {
  if (tagNo && (entry.tags ?? []).some((t) => normalizeKey(t) === normalizeKey(tagNo))) return true;
  return (entry.articleNumbers ?? []).some((a) => keys.has(normalizeKey(a)));
}

const langLabel = (l: string) =>
  l
    .split('/')
    .map((x) => ({ de: 'Deutsch', en: 'Englisch', fr: 'Französisch' })[x] ?? x)
    .join('/');

/** Shipped documents + "beim Hersteller anfragen" entries for a tag or a product template. */
export async function staticDocsFor(product: Product | null, tag: Tag | null): Promise<DocWithVersions[]> {
  const m = await loadManifest();
  const keys = new Set(
    [product?.articleNumber, ...(product?.aliases ?? []), tag?.articleNumber].filter(Boolean).map((x) => normalizeKey(x!)),
  );
  const tagNo = tag?.tagNumber ?? null;
  const result: DocWithVersions[] = [];

  for (const d of m.documents.filter((x) => matches(x, keys, tagNo))) {
    const addedAt = d.retrievedAt + 'T00:00:00.000Z';
    result.push({
      doc: { id: `static:${d.id}`, ownerType: 'product', ownerId: product?.id ?? '', title: d.title, category: d.type, createdAt: addedAt },
      current: {
        id: `static:${d.id}`,
        documentId: `static:${d.id}`,
        fileId: '',
        url: docUrl(d.file) + (d.startPage ? `#page=${d.startPage}` : ''),
        fileName: d.file.split('/').pop() ?? d.file,
        mimeType: 'application/pdf',
        size: d.size ?? 0,
        note: `${langLabel(d.language)} · Quelle: Hersteller`,
        addedAt,
      },
      older: [],
      inherited: true,
      shipped: true,
    });
  }

  for (const r of m.requests.filter((x) => matches(x, keys, tagNo))) {
    const article = product?.articleNumber ?? tag?.articleNumber ?? '';
    const subject = `Anfrage ${r.type}: ${r.manufacturer} ${article}`;
    const body = [
      'Guten Tag,',
      '',
      `wir betreiben folgendes Produkt und bitten um die aktuelle ${r.type} (bevorzugt auf Deutsch, gern als PDF):`,
      '',
      `Hersteller: ${r.manufacturer}`,
      `Artikel/Typ: ${article}`,
      ...(product?.name ? [`Bezeichnung: ${product.name}`] : []),
      ...(tag ? [`Unsere Kennzeichnung (Tag): ${tag.tagNumber}${tag.plant ? `, Anlage ${tag.plant}` : ''}`] : []),
      '',
      'Vielen Dank und freundliche Grüße',
    ].join('\n');
    result.push({
      doc: { id: `request:${r.id}`, ownerType: 'product', ownerId: product?.id ?? '', title: r.title, category: r.type, createdAt: '' },
      current: { id: `request:${r.id}`, documentId: `request:${r.id}`, fileId: '', fileName: '', mimeType: '', size: 0, note: '', addedAt: '' },
      older: [],
      inherited: true,
      shipped: true,
      request: {
        manufacturer: r.manufacturer,
        mailto: `mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      },
    });
  }
  return result;
}
