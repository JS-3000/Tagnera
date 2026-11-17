// Small helpers without dependencies.

export const uuid = (): string => crypto.randomUUID();

export const nowIso = (): string => new Date().toISOString();

// ---------- calendar dates as "YYYY-MM-DD" (no time zone trouble) ----------

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const today = (): string => toDateStr(new Date());

/** Parse "YYYY-MM-DD" into a UTC timestamp (ms), used only for arithmetic. */
function parseUtc(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

function fromUtc(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(s: string, days: number): string {
  const d = parseUtc(s);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function addMonths(s: string, months: number): string {
  const d = parseUtc(s);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  // clamp 31.01. + 1 month -> 28./29.02.
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return fromUtc(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseUtc(b).getTime() - parseUtc(a).getTime()) / 86_400_000);
}

/** "2026-11-17" -> "17.11.2026" */
export function fmtDate(s: string | null | undefined): string {
  if (!s) return '–';
  const [y, m, d] = s.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${fmtDate(toDateStr(d))} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Normalise article numbers for matching: "567-01 / a" == "56701A" */
export const normalizeKey = (s: string): string => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '');

export function byString<T>(get: (t: T) => string) {
  return (a: T, b: T) => get(a).localeCompare(get(b), 'de', { numeric: true });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Shrink a photo to max. 1600 px on the long side (JPEG, quality 0.82).
 * Typical phone photos go from 4–8 MB to ~300 KB and stay perfectly readable.
 */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file; // unsupported format (e.g. HEIC on some browsers) -> keep original
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export const isUuid = (s: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
