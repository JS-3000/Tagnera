// Per-device settings in localStorage (who am I, recently scanned tags, label calibration).
// These are not part of the shared data and therefore not part of the JSON export.

const KEY = 'tagnera.settings.v1';

export interface DeviceSettings {
  currentUserId: string | null;
  /** simulated logout: 'Öffentlich (ohne Account)' – only fault reports */
  loggedOut?: boolean;
  recentTagIds: string[];
  /** Base URL written into QR codes. Empty = URL the app is currently running at. */
  qrBaseUrl: string;
  labelOffsetXmm: number;
  labelOffsetYmm: number;
}

const defaults: DeviceSettings = {
  currentUserId: null,
  recentTagIds: [],
  qrBaseUrl: '',
  labelOffsetXmm: 0,
  labelOffsetYmm: 0,
};

export function loadSettings(): DeviceSettings {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...defaults };
  }
}

export function saveSettings(patch: Partial<DeviceSettings>): DeviceSettings {
  const next = { ...loadSettings(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode – ignore */
  }
  window.dispatchEvent(new Event('tagnera-settings'));
  return next;
}

export function rememberScan(tagId: string): void {
  const recent = loadSettings().recentTagIds.filter((id) => id !== tagId);
  saveSettings({ recentTagIds: [tagId, ...recent].slice(0, 8) });
}

/** The URL of the running app without hash, e.g. https://js-3000.github.io/Tagnera/ */
export function currentAppUrl(): string {
  return window.location.origin + window.location.pathname;
}

export function appBaseUrl(): string {
  const s = loadSettings().qrBaseUrl.trim();
  const base = s || currentAppUrl();
  return base.endsWith('/') ? base : base + '/';
}

// Tags whose QR codes are already printed (demo cards) always point to a fixed address.
const fixedQr = new Map<string, string>();
export function registerFixedQrTags(ids: Iterable<string>, baseUrl: string): void {
  for (const id of ids) fixedQr.set(id, baseUrl);
}

/** Content of the QR code of a tag. A normal phone camera opens exactly this page. */
export function tagUrl(tagId: string): string {
  const fixed = fixedQr.get(tagId);
  return `${fixed ?? appBaseUrl()}#/t/${tagId}`;
}

/** Extract the tag UUID from a scanned text (URL or bare UUID). */
export function parseScannedText(text: string): string | null {
  const m = text.match(/#\/t\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (m) return m[1].toLowerCase();
  const bare = text.trim().match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  return bare ? bare[0].toLowerCase() : null;
}
