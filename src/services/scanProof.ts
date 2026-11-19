// "Nachweis vor Ort": was the tag page opened via a QR scan (in-app scanner or the phone
// camera opening the tag link)? The proof is valid for 30 minutes for exactly that tag.
// Kept in sessionStorage (per browser tab) – new key, existing keys stay untouched.

const KEY = 'tagnera.scan.v1';
const VALID_MS = 30 * 60 * 1000;

interface Proof {
  tagId: string;
  at: number;
}

export function markScanned(tagId: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ tagId, at: Date.now() } satisfies Proof));
  } catch {
    /* ignore */
  }
}

export function isScanned(tagId: string): boolean {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) || 'null') as Proof | null;
    return !!p && p.tagId === tagId && Date.now() - p.at < VALID_MS;
  } catch {
    return false;
  }
}

/** Called once at app start: opening a tag link directly (phone camera) counts as a scan. */
export function markScannedFromStartUrl(): void {
  const m = window.location.hash.match(/^#\/t\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:$|[/?])/i);
  if (m && !window.location.hash.includes('/eintrag')) markScanned(m[1].toLowerCase());
}
