import type { OstrzeGameState } from '../data/originTypes';

export const OSTRZE_SAVE_KEY = 'ostrze_25d_save_v1';
export const OSTRZE_DEV_SAVE_KEY = `${OSTRZE_SAVE_KEY}_dev`;

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

const saveCache = new Map<string, { raw: string | null; hasSave: boolean }>();
let storageEventWindow: Window | null = null;

function rememberSave(key: string, raw: string | null, hasSave: boolean): void {
  saveCache.set(key, { raw, hasSave });
}

function subscribeToStorageChanges(): void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function' || storageEventWindow === window) {
    return;
  }
  storageEventWindow = window;
  window.addEventListener('storage', (event) => {
    if (event.key === null) {
      saveCache.clear();
    } else {
      saveCache.delete(event.key);
    }
  });
}

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

export function saveOstrzeGame(
  payload: Omit<OstrzeSavePayload, 'version' | 'savedAt'>,
  key = OSTRZE_SAVE_KEY
): boolean {
  subscribeToStorageChanges();
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
    storage.setItem(key, serialized);
    rememberSave(key, serialized, true);
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
    Array.isArray(parsed.state) ||
    !parsed.state.character ||
    typeof parsed.state.character !== 'object' ||
    Array.isArray(parsed.state.character)
  ) {
    return null;
  }

  const st = parsed.state;
  const ch = st.character;
  if (!ch) return null;
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  const isFiniteNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  const attributeIds = ['sila', 'zrecznosc', 'krzepa', 'bystrosc', 'rozum', 'oglada', 'fart'] as const;
  if (
    typeof ch.name !== 'string' ||
    !ch.name.trim() ||
    (ch.classId !== 'miecz' && ch.classId !== 'wlocznia') ||
    !isFiniteNumber(ch.level) || ch.level < 1 ||
    !isFiniteNumber(ch.xp) ||
    !isFiniteNumber(ch.hp) ||
    !isFiniteNumber(ch.money) ||
    !isRecord(ch.attributes) ||
    !attributeIds.every((id) => isFiniteNumber(ch.attributes[id]))
  ) {
    return null;
  }
  if (!isRecord(ch.skillPoints)) ch.skillPoints = {};
  if (!isRecord(ch.mastery)) ch.mastery = {};
  if (!isFiniteNumber(ch.freeSkillPoints)) ch.freeSkillPoints = 0;
  if (!isFiniteNumber(ch.freeAttributePoints)) ch.freeAttributePoints = 0;
  if (!isFiniteNumber(ch.freePerkPicks)) ch.freePerkPicks = 0;
  if (!isRecord(st.flags)) st.flags = {};
  if (!isRecord(st.vars)) st.vars = {};
  if (!isRecord(st.quests)) st.quests = {};

  st.inventory = st.inventory && typeof st.inventory === 'object' && !Array.isArray(st.inventory)
    ? st.inventory
    : { items: [], equipped: {}, quickBelt: [null, null, null, null] };
  if (!Array.isArray(st.inventory.items)) st.inventory.items = [];
  else st.inventory.items = st.inventory.items.filter(
    (item) => isRecord(item) && typeof item.id === 'string' && isFiniteNumber(item.qty) && item.qty > 0
  );
  if (!isRecord(st.inventory.equipped)) {
    st.inventory.equipped = {};
  }
  if (!isFiniteNumber(st.time?.minutes)) return null;
  if (!isFiniteNumber(st.rngState)) st.rngState = 1;
  if (!Array.isArray(st.inventory.quickBelt) || st.inventory.quickBelt.length < 4) {
    const existing = Array.isArray(st.inventory.quickBelt) ? st.inventory.quickBelt : [];
    st.inventory.quickBelt = [
      existing[0] ?? null,
      existing[1] ?? null,
      existing[2] ?? null,
      existing[3] ?? null
    ];
  }

  st.world = st.world && typeof st.world === 'object' && !Array.isArray(st.world)
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
  if (typeof st.world.location !== 'string' || !st.world.location) st.world.location = 'brzezina';
  if (st.world.activePhenomenon === undefined) st.world.activePhenomenon = null;

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

export function loadOstrzeGame(key = OSTRZE_SAVE_KEY): OstrzeSavePayload | null {
  subscribeToStorageChanges();
  const storage = getStorage();
  if (!storage) {
    rememberSave(key, null, false);
    return null;
  }
  try {
    const raw = storage.getItem(key);
    if (!raw) {
      rememberSave(key, null, false);
      return null;
    }
    const normalized = normalizeSavePayload(JSON.parse(raw));
    rememberSave(key, raw, normalized !== null);
    return normalized;
  } catch {
    rememberSave(key, null, false);
    return null;
  }
}

export function hasOstrzeSave(): boolean {
  return hasOstrzeSaveForKey(OSTRZE_SAVE_KEY);
}

export function hasOstrzeSaveForKey(key: string): boolean {
  subscribeToStorageChanges();
  const cached = saveCache.get(key);
  if (cached) return cached.hasSave;

  const storage = getStorage();
  if (!storage) {
    rememberSave(key, null, false);
    return false;
  }
  try {
    const raw = storage.getItem(key);
    let hasSave = false;
    if (raw) {
      try {
        hasSave = normalizeSavePayload(JSON.parse(raw)) !== null;
      } catch {
        hasSave = false;
      }
    }
    rememberSave(key, raw, hasSave);
    return hasSave;
  } catch {
    rememberSave(key, null, false);
    return false;
  }
}

export function clearOstrzeSave(key = OSTRZE_SAVE_KEY): void {
  subscribeToStorageChanges();
  const storage = getStorage();
  if (!storage) {
    rememberSave(key, null, false);
    return;
  }
  try {
    storage.removeItem(key);
    rememberSave(key, null, false);
  } catch {
    saveCache.delete(key);
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
