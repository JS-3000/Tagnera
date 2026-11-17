// Use-cases around tags, products and their child items.
import { data } from '../data';
import type {
  DocumentItem,
  DocumentVersion,
  Faq,
  LogEntry,
  OwnerType,
  Product,
  SparePart,
  StoredFile,
  Supplier,
  Tag,
} from '../data/types';
import { byString, compressImage, normalizeKey, nowIso, today, uuid } from '../lib/util';
import { computeTaskStatus, tasksForTag, type TaskStatus } from './maintenance';

// ---------------------------------------------------------------- files

export async function saveFile(blob: Blob, name: string, mimeType = blob.type): Promise<StoredFile> {
  const file: StoredFile = {
    id: uuid(),
    name,
    mimeType: mimeType || 'application/octet-stream',
    size: blob.size,
    blob,
    createdAt: nowIso(),
  };
  await data.files.save(file);
  return file;
}

export async function savePhoto(file: File): Promise<StoredFile> {
  const blob = await compressImage(file);
  const name = blob === file ? file.name : file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return saveFile(blob, name, blob.type || file.type);
}

// ---------------------------------------------------------------- tags

export function emptyTag(id: string = uuid()): Tag {
  const now = nowIso();
  return {
    id,
    tagNumber: '',
    type: '',
    description: '',
    plant: '',
    location: '',
    manufacturer: '',
    articleNumber: '',
    orderNumber: '',
    productId: null,
    commissionedAt: today(),
    supportName: '',
    supportEmail: '',
    supportPhone: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveTag(tag: Tag): Promise<Tag> {
  return data.tags.save({ ...tag, tagNumber: tag.tagNumber.trim(), updatedAt: nowIso() });
}

export async function findTagByNumber(tagNumber: string): Promise<Tag | undefined> {
  const key = normalizeKey(tagNumber);
  const all = await data.tags.list();
  return all.find((t) => normalizeKey(t.tagNumber) === key);
}

/** Free text search over tag number, type, plant, manufacturer, article number. */
export async function searchTags(query: string): Promise<Tag[]> {
  const q = query.trim().toLowerCase();
  const all = (await data.tags.list()).sort(byString((t) => t.tagNumber));
  if (!q) return all;
  return all.filter((t) =>
    [t.tagNumber, t.type, t.plant, t.manufacturer, t.articleNumber, t.description, t.location]
      .join(' ')
      .toLowerCase()
      .includes(q),
  );
}

async function removeOwnedItems(ownerType: OwnerType, ownerId: string) {
  const own = <T extends { ownerType: OwnerType }>(list: T[]) => list.filter((x) => x.ownerType === ownerType);
  const [parts, faqs, tasks, docs] = await Promise.all([
    data.spareParts.findBy('ownerId', ownerId),
    data.faqs.findBy('ownerId', ownerId),
    data.tasks.findBy('ownerId', ownerId),
    data.documents.findBy('ownerId', ownerId),
  ]);
  await data.spareParts.removeMany(own(parts).map((x) => x.id));
  await data.faqs.removeMany(own(faqs).map((x) => x.id));
  await data.tasks.removeMany(own(tasks).map((x) => x.id));
  for (const d of own(docs)) await removeDocument(d.id);
}

export async function deleteTag(tagId: string): Promise<void> {
  const entries = await data.logEntries.findBy('tagId', tagId);
  await data.files.removeMany(entries.map((e) => e.photoFileId).filter((x): x is string => !!x));
  await data.logEntries.removeMany(entries.map((e) => e.id));
  await removeOwnedItems('tag', tagId);
  await data.tags.remove(tagId);
}

// ---------------------------------------------------------------- products / catalog

export function emptyProduct(): Product {
  const now = nowIso();
  return {
    id: uuid(),
    manufacturer: '',
    articleNumber: '',
    name: '',
    type: '',
    description: '',
    supplierId: null,
    orderNumber: '',
    supportName: '',
    supportEmail: '',
    supportPhone: '',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * "Produkt erkannt": find a product template by article number
 * (manufacturer is used to decide between several hits).
 */
export async function findProduct(articleNumber: string, manufacturer = ''): Promise<Product | undefined> {
  const key = normalizeKey(articleNumber);
  if (!key) return undefined;
  const hits = (await data.products.list()).filter((p) => normalizeKey(p.articleNumber) === key);
  if (hits.length <= 1) return hits[0];
  const m = normalizeKey(manufacturer);
  return hits.find((p) => normalizeKey(p.manufacturer) === m) ?? hits[0];
}

/** Take over the master data of a product. Docs/FAQ/parts/tasks are linked, not copied. */
export function applyProduct(tag: Tag, p: Product): Tag {
  return {
    ...tag,
    productId: p.id,
    manufacturer: p.manufacturer,
    articleNumber: p.articleNumber,
    type: tag.type || p.type,
    description: tag.description || p.name,
  };
}

export async function deleteProduct(productId: string): Promise<void> {
  const tags = await data.tags.findBy('productId', productId);
  await data.tags.saveMany(tags.map((t) => ({ ...t, productId: null, updatedAt: nowIso() })));
  await removeOwnedItems('product', productId);
  await data.products.remove(productId);
}

// ---------------------------------------------------------------- documents with versions

export interface DocWithVersions {
  doc: DocumentItem;
  current: DocumentVersion;
  older: DocumentVersion[];
  inherited: boolean; // comes from the product template
}

export async function addDocument(
  ownerType: OwnerType,
  ownerId: string,
  meta: { title: string; category: string; note: string },
  file: File,
): Promise<void> {
  const blob = file.type.startsWith('image/') ? await compressImage(file) : file;
  const stored = await saveFile(blob, file.name, blob.type || file.type);
  const doc: DocumentItem = {
    id: uuid(),
    ownerType,
    ownerId,
    title: meta.title || file.name,
    category: meta.category,
    createdAt: nowIso(),
  };
  await data.documents.save(doc);
  await data.documentVersions.save(versionFor(doc.id, stored, meta.note));
}

export async function addDocumentVersion(documentId: string, file: File, note: string): Promise<void> {
  const blob = file.type.startsWith('image/') ? await compressImage(file) : file;
  const stored = await saveFile(blob, file.name, blob.type || file.type);
  await data.documentVersions.save(versionFor(documentId, stored, note));
}

function versionFor(documentId: string, f: StoredFile, note: string): DocumentVersion {
  return {
    id: uuid(),
    documentId,
    fileId: f.id,
    fileName: f.name,
    mimeType: f.mimeType,
    size: f.size,
    note,
    addedAt: nowIso(),
  };
}

export async function removeDocument(documentId: string): Promise<void> {
  const versions = await data.documentVersions.findBy('documentId', documentId);
  await data.files.removeMany(versions.map((v) => v.fileId));
  await data.documentVersions.removeMany(versions.map((v) => v.id));
  await data.documents.remove(documentId);
}

export async function loadDocuments(owners: { ownerType: OwnerType; ownerId: string | null }[]): Promise<DocWithVersions[]> {
  const result: DocWithVersions[] = [];
  for (const o of owners) {
    if (!o.ownerId) continue;
    const docs = (await data.documents.findBy('ownerId', o.ownerId)).filter((d) => d.ownerType === o.ownerType);
    for (const doc of docs) {
      const versions = (await data.documentVersions.findBy('documentId', doc.id)).sort((a, b) =>
        b.addedAt.localeCompare(a.addedAt),
      );
      if (versions.length === 0) continue;
      result.push({ doc, current: versions[0], older: versions.slice(1), inherited: o.ownerType === 'product' });
    }
  }
  return result.sort(byString((d) => d.doc.category + d.doc.title));
}

// ---------------------------------------------------------------- owned lists (product + tag)

async function ownedFor<T extends { ownerType: OwnerType; ownerId: string }>(
  repo: { findBy(field: 'ownerId', v: string): Promise<T[]> },
  tag: Tag,
): Promise<(T & { inherited: boolean })[]> {
  const own = (await repo.findBy('ownerId', tag.id)).filter((x) => x.ownerType === 'tag');
  const fromProduct = tag.productId
    ? (await repo.findBy('ownerId', tag.productId)).filter((x) => x.ownerType === 'product')
    : [];
  return [...fromProduct.map((x) => ({ ...x, inherited: true })), ...own.map((x) => ({ ...x, inherited: false }))];
}

export async function loadOwned<T extends { ownerType: OwnerType; ownerId: string }>(
  repo: { findBy(field: 'ownerId', v: string): Promise<T[]> },
  ownerType: OwnerType,
  ownerId: string,
): Promise<T[]> {
  return (await repo.findBy('ownerId', ownerId)).filter((x) => x.ownerType === ownerType);
}

// ---------------------------------------------------------------- the complete tag page

export interface SupportContact {
  name: string;
  email: string;
  phone: string;
  source: 'tag' | 'product';
}

export interface TagDetail {
  tag: Tag;
  product: Product | null;
  orderNumber: string;
  documents: DocWithVersions[];
  faqs: (Faq & { inherited: boolean })[];
  spareParts: (SparePart & { inherited: boolean; supplier: Supplier | null })[];
  tasks: TaskStatus[];
  entries: LogEntry[];
  support: SupportContact | null;
}

export async function loadTagDetail(tagId: string): Promise<TagDetail | null> {
  const tag = await data.tags.get(tagId);
  if (!tag) return null;
  const product = tag.productId ? ((await data.products.get(tag.productId)) ?? null) : null;
  const [documents, faqs, parts, allTasks, entries, suppliers] = await Promise.all([
    loadDocuments([
      { ownerType: 'product', ownerId: tag.productId },
      { ownerType: 'tag', ownerId: tag.id },
    ]),
    ownedFor(data.faqs, tag),
    ownedFor(data.spareParts, tag),
    ownedFor(data.tasks, tag),
    data.logEntries.findBy('tagId', tag.id),
    data.suppliers.list(),
  ]);
  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const tasks = tasksForTag(tag, allTasks)
    .map((t) => computeTaskStatus(t, tag, entries))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  let support: SupportContact | null = null;
  if (tag.supportEmail || tag.supportPhone) {
    support = { name: tag.supportName, email: tag.supportEmail, phone: tag.supportPhone, source: 'tag' };
  } else if (product && (product.supportEmail || product.supportPhone)) {
    support = { name: product.supportName, email: product.supportEmail, phone: product.supportPhone, source: 'product' };
  }

  return {
    tag,
    product,
    orderNumber: tag.orderNumber || product?.orderNumber || '',
    documents,
    faqs: faqs.sort((a, b) => a.sort - b.sort),
    spareParts: parts.map((p) => ({ ...p, supplier: p.supplierId ? (supplierById.get(p.supplierId) ?? null) : null })),
    tasks,
    entries: entries.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    support,
  };
}

// ---------------------------------------------------------------- diary

export async function addLogEntry(entry: Omit<LogEntry, 'id' | 'createdAt'>): Promise<LogEntry> {
  return data.logEntries.save({ ...entry, id: uuid(), createdAt: nowIso() });
}

export async function deleteLogEntry(entry: LogEntry): Promise<void> {
  if (entry.photoFileId) await data.files.remove(entry.photoFileId);
  await data.logEntries.remove(entry.id);
}
