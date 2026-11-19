// Domain model of ConnecTag.
//
// The shapes are deliberately "flat" (no nested objects, foreign keys as ids)
// so that each type maps 1:1 to a PostgreSQL / Supabase table later on.
// Dates are ISO strings: "2026-11-17" for calendar dates, full ISO for timestamps.

export type Role = 'reader' | 'editor' | 'admin';

export interface User {
  id: string;
  name: string;
  role: Role;
}

/** A physical component in the plant, identified by its tag number (e.g. HV-1001). */
export interface Tag {
  id: string; // random UUID – this is what the QR code contains
  tagNumber: string; // e.g. "HV-1001"
  type: string; // e.g. "Handventil"
  description: string;
  plant: string; // Anlage, e.g. "Wasseraufbereitung"
  location: string; // free text, e.g. "Halle 2, Ebene 1"
  manufacturer: string;
  articleNumber: string;
  orderNumber: string; // order number for the whole component (falls back to product)
  productId: string | null; // link to product template (catalog)
  commissionedAt: string; // Inbetriebnahme – start date for maintenance intervals
  supportName: string; // optional overrides of the product support contact
  supportEmail: string;
  supportPhone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Product template = manufacturer + article number. Tags link to it. */
export interface Product {
  id: string;
  manufacturer: string;
  articleNumber: string;
  /** further numbers that identify this product (e.g. order code, long type key) */
  aliases?: string[];
  name: string;
  type: string;
  description: string;
  supplierId: string | null;
  orderNumber: string;
  supportName: string;
  supportEmail: string;
  supportPhone: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  orderEmail: string;
  phone: string;
  contactPerson: string;
  customerNumber: string; // our customer number at the supplier
}

/**
 * Child items (documents, FAQ, spare parts, maintenance tasks) belong either to a
 * product template (then every linked tag sees them, changes propagate automatically)
 * or directly to a single tag.
 */
export type OwnerType = 'product' | 'tag';

export interface Owned {
  ownerType: OwnerType;
  ownerId: string;
}

export interface SparePart extends Owned {
  id: string;
  name: string;
  manufacturerPartNumber: string;
  supplierId: string | null;
  supplierOrderNumber: string;
  notes: string;
}

export interface Faq extends Owned {
  id: string;
  question: string;
  answer: string;
  sort: number;
}

export type IntervalUnit = 'days' | 'weeks' | 'months' | 'years';

export interface RequiredPart {
  sparePartId: string;
  quantity: number;
}

export interface MaintenanceTask extends Owned {
  id: string;
  title: string; // e.g. "Dichtung wechseln"
  description: string;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  requiredParts: RequiredPart[];
}

/** A document with a version history. The newest version is the current one. */
export interface DocumentItem extends Owned {
  id: string;
  title: string;
  category: string; // e.g. "Anleitung", "Datenblatt", "Zertifikat"
  createdAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  fileId: string; // '' when the file is served by URL (documents shipped with the app)
  url?: string;
  fileName: string;
  mimeType: string;
  size: number;
  note: string; // e.g. "Rev. C – neue Drehmomente"
  addedAt: string;
}

export type LogKind = 'inbetriebnahme' | 'wartung' | 'reparatur' | 'pruefung' | 'umbau';

export interface LogEntry {
  id: string;
  tagId: string;
  date: string; // YYYY-MM-DD
  person: string;
  kind: LogKind;
  description: string;
  photoFileId: string | null;
  completedTaskIds: string[]; // maintenance tasks completed with this entry
  /** 'scan' = created after a QR scan at the component; 'manual' = without scan. Old entries: undefined */
  source?: 'scan' | 'manual';
  createdAt: string;
}

/** Binary file (photo, PDF). Lives in its own store – later Supabase Storage. */
export interface StoredFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  reader: 'Leser',
  editor: 'Bearbeiter',
  admin: 'Administrator',
};

export const LOG_KIND_LABELS: Record<LogKind, string> = {
  inbetriebnahme: 'Inbetriebnahme',
  wartung: 'Wartung',
  reparatur: 'Reparatur',
  pruefung: 'Prüfung',
  umbau: 'Umbau',
};

export const INTERVAL_UNIT_LABELS: Record<IntervalUnit, [string, string]> = {
  days: ['Tag', 'Tage'],
  weeks: ['Woche', 'Wochen'],
  months: ['Monat', 'Monate'],
  years: ['Jahr', 'Jahre'],
};
