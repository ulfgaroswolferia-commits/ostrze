import type { OstrzeGameState } from '../data/originTypes';

export const OSTRZE_SAVE_KEY = 'ostrze_25d_save_v1';

export const VALID_CHAPTER_IDS = ['prologue', 'chapter1'] as const;
export type ChapterId = (typeof VALID_CHAPTER_IDS)[number];

export const CHAPTER_DEV_SCENES: ReadonlyArray<{ id: ChapterId; label: string }> = [
  { id: 'prologue', label: 'Prolog — Brzezina' },
  { id: 'chapter1', label: 'Akt I — Wilczy Bród' }
];

export function isValidChapterId(value: unknown): value is ChapterId {
  return typeof value === 'string' && (VALID_CHAPTER_IDS as ReadonlyArray<string>).includes(value);
}

export interface OstrzeSavePayload {
  version: 1;
  savedAt: string;
  chapter: ChapterId;
  sceneId: string;
  prologueStep?: string;
  state: OstrzeGameState;
}

let cachedSaveRaw: string | null | undefined;
let cachedHasSave: boolean | null = null;

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveOstrzeGame(payload: Omit<OstrzeSavePayload, 'version' | 'savedAt'>): boolean {
  const storage = getStorage();
  if (!storage || !payload.state.character) return false;
  try {
    const full: OstrzeSavePayload = {
      version: 1,
      savedAt: new Date().toISOString(),
      chapter: payload.chapter,
      sceneId: payload.sceneId,
      prologueStep: payload.prologueStep,
      state: payload.state
    };
    const serialized = JSON.stringify(full);
    storage.setItem(OSTRZE_SAVE_KEY, serialized);
    cachedSaveRaw = serialized;
    cachedHasSave = true;
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates and defensively normalizes v1 save payloads so older saves
 * missing newer fields (e.g. quickBelt, visitedLocations, vars) never crash.
 */
export function normalizeSavePayload(raw: unknown): OstrzeSavePayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as Partial<OstrzeSavePayload>;
  if (
    parsed.version !== 1 ||
    !isValidChapterId(parsed.chapter) ||
    typeof parsed.sceneId !== 'string' ||
    !parsed.sceneId ||
    !parsed.state ||
    typeof parsed.state !== 'object' ||
    !parsed.state.character ||
    typeof parsed.state.character !== 'object'
  ) {
    return null;
  }

  const st = parsed.state;
  st.flags = st.flags && typeof st.flags === 'object' ? st.flags : {};
  st.vars = st.vars && typeof st.vars === 'object' ? st.vars : {};
  st.quests = st.quests && typeof st.quests === 'object' ? st.quests : {};

  st.inventory = st.inventory && typeof st.inventory === 'object'
    ? st.inventory
    : { items: [], equipped: {}, quickBelt: [null, null, null, null] };
  if (!Array.isArray(st.inventory.items)) st.inventory.items = [];
  if (!st.inventory.equipped || typeof st.inventory.equipped !== 'object') {
    st.inventory.equipped = {};
  }
  if (!Array.isArray(st.inventory.quickBelt) || st.inventory.quickBelt.length < 4) {
    const existing = Array.isArray(st.inventory.quickBelt) ? st.inventory.quickBelt : [];
    st.inventory.quickBelt = [
      existing[0] ?? null,
      existing[1] ?? null,
      existing[2] ?? null,
      existing[3] ?? null
    ];
  }

  st.world = st.world && typeof st.world === 'object'
    ? st.world
    : {
        location: 'brzezina',
        knownPlaces: ['brzezina'],
        failedChecks: [],
        activePhenomenon: null,
        eventsSeen: []
      };
  if (!Array.isArray(st.world.knownPlaces)) st.world.knownPlaces = ['brzezina'];
  if (!Array.isArray(st.world.failedChecks)) st.world.failedChecks = [];
  if (!Array.isArray(st.world.eventsSeen)) st.world.eventsSeen = [];

  const ch = st.character;
  if (!ch) return null;
  if (!Array.isArray(ch.effects)) ch.effects = [];
  if (!Array.isArray(ch.perks)) ch.perks = [];
  if (!Array.isArray(ch.tagged)) ch.tagged = [];

  return {
    version: 1,
    savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
    chapter: parsed.chapter,
    sceneId: parsed.sceneId,
    prologueStep: typeof parsed.prologueStep === 'string' ? parsed.prologueStep : undefined,
    state: st
  };
}

export function loadOstrzeGame(): OstrzeSavePayload | null {
  const storage = getStorage();
  if (!storage) {
    cachedSaveRaw = null;
    cachedHasSave = false;
    return null;
  }
  try {
    const raw = storage.getItem(OSTRZE_SAVE_KEY);
    if (!raw) {
      cachedSaveRaw = null;
      cachedHasSave = false;
      return null;
    }
    const normalized = normalizeSavePayload(JSON.parse(raw));
    cachedSaveRaw = raw;
    cachedHasSave = normalized !== null;
    return normalized;
  } catch {
    cachedSaveRaw = null;
    cachedHasSave = false;
    return null;
  }
}

export function hasOstrzeSave(): boolean {
  if (cachedHasSave !== null) {
    return cachedHasSave;
  }
  const storage = getStorage();
  if (!storage) {
    cachedSaveRaw = null;
    cachedHasSave = false;
    return false;
  }
  try {
    const raw = storage.getItem(OSTRZE_SAVE_KEY);
    if (raw === cachedSaveRaw && cachedHasSave !== null) {
      return cachedHasSave;
    }
    cachedSaveRaw = raw;
    cachedHasSave = false;
    if (raw) {
      try {
        cachedHasSave = normalizeSavePayload(JSON.parse(raw)) !== null;
      } catch {
        cachedHasSave = false;
      }
    }
    return cachedHasSave;
  } catch {
    cachedSaveRaw = null;
    cachedHasSave = false;
    return false;
  }
}

export function clearOstrzeSave(): void {
  cachedSaveRaw = null;
  cachedHasSave = false;
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(OSTRZE_SAVE_KEY);
  } catch {
    // ignore storage errors
  }
}

const KEY_PREFIX = 'OSTRZE1:';

function toBase64Utf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function fromBase64Utf8(b64: string): string {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Exports a portable save key string for transferring progress between browsers/PCs.
 */
export function exportSaveKey(payload: Omit<OstrzeSavePayload, 'version' | 'savedAt'>): string | null {
  if (!payload.state.character) return null;
  try {
    const full: OstrzeSavePayload = {
      version: 1,
      savedAt: new Date().toISOString(),
      chapter: payload.chapter,
      sceneId: payload.sceneId,
      prologueStep: payload.prologueStep,
      state: payload.state
    };
    return KEY_PREFIX + toBase64Utf8(JSON.stringify(full));
  } catch {
    return null;
  }
}

/**
 * Parses and validates a portable save key string.
 */
export function importSaveKey(rawKey: string): OstrzeSavePayload | null {
  try {
    const trimmed = rawKey.trim();
    if (!trimmed.startsWith(KEY_PREFIX)) return null;
    const json = fromBase64Utf8(trimmed.slice(KEY_PREFIX.length));
    return normalizeSavePayload(JSON.parse(json));
  } catch {
    return null;
  }
}
