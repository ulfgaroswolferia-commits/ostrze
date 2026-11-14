import type { OstrzeGameState } from '../data/originTypes';

export const OSTRZE_SAVE_KEY = 'ostrze_25d_save_v1';

export interface OstrzeSavePayload {
  version: 1;
  savedAt: string;
  chapter: 'prologue' | 'chapter1';
  sceneId: string;
  prologueStep?: string;
  state: OstrzeGameState;
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
    storage.setItem(OSTRZE_SAVE_KEY, JSON.stringify(full));
    return true;
  } catch {
    return false;
  }
}

export function loadOstrzeGame(): OstrzeSavePayload | null {
  const storage = getStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(OSTRZE_SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OstrzeSavePayload;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.state ||
      !parsed.state.character ||
      typeof parsed.sceneId !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hasOstrzeSave(): boolean {
  return loadOstrzeGame() !== null;
}

export function clearOstrzeSave(): void {
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
    const parsed = JSON.parse(json) as OstrzeSavePayload;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.state ||
      !parsed.state.character ||
      typeof parsed.sceneId !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
