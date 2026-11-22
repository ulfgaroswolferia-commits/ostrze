import { hasPixArt } from '../assets/pixArt';
import type { OriginGameData } from '../data/originTypes';

export interface EnemyResistanceTag {
  damageType: string;
  label: string;
  kind: 'resist' | 'weak';
}

const DAMAGE_TYPE_LABELS: Record<string, string> = {
  sieczne: 'cięte',
  ciete: 'cięte',
  klute: 'kłute',
  obuchowe: 'obuchowe',
  ogien: 'ogień',
  magia: 'magia',
  proch: 'proch'
};

/**
 * Resolves the canonical enemy ID from origin/data/enemies.json for a 2.5D actor.
 */
export function resolveEnemyOriginId(actorId: string, actorName: string): string | null {
  const key = `${actorId} ${actorName}`.toLowerCase();
  if (key.includes('radogost') || key.includes('instruktor')) return 'instruktor';
  if (key.includes('upior') || key.includes('upiór') || key.includes('zmora')) return 'upior_nocy';
  if (key.includes('herszt')) return 'herszt_zbojcow';
  if (key.includes('lucznik') || key.includes('łucznik')) return 'rabus_lucznik';
  if (key.includes('rabus') || key.includes('rabuś') || key.includes('rozbój') || key.includes('zbój')) return 'rabus';
  if (key.includes('bandyt') || key.includes('zbir') || key.includes('łupież')) return 'bandyta';
  if (key.includes('wilk') || key.includes('basior')) return 'wilk';
  if (key.includes('dzik')) return 'dzik';
  if (key.includes('zmija') || key.includes('żmija')) return 'zmija_lesna';
  if (key.includes('klusownik') || key.includes('kłusownik')) return 'klusownik';
  if (key.includes('maruder')) return 'maruder';
  if (key.includes('kieszonk')) return 'kieszonkowiec';
  return null;
}

const ORIGIN_ENEMY_TO_PIX: Record<string, string> = {
  instruktor: 'instruktor',
  bandyta: 'bandyta',
  rabus: 'bandyta',
  rabus_lucznik: 'bandyta',
  upior_nocy: 'upior_zwiadowca',
  wilk: 'wilk',
  dzik: 'dzik',
  klusownik: 'klusownik',
  maruder: 'maruder',
  herszt_zbojcow: 'herszt_zbojcow',
  kieszonkowiec: 'kieszonkowiec'
};

/**
 * Resolves the best 64x48 `.pix` enemy sprite ID from origin/data/art/.
 */
export function resolveEnemyPixArtId(actorId: string, actorName: string): string | null {
  const originId = resolveEnemyOriginId(actorId, actorName);
  if (originId) {
    const mapped = ORIGIN_ENEMY_TO_PIX[originId] ?? originId;
    if (hasPixArt(mapped)) return mapped;
    if (hasPixArt(originId)) return originId;
  }
  return null;
}

/**
 * Formats enemy damageTaken multipliers from origin/data/enemies.json into UI resistance/weakness pills.
 */
export function formatEnemyResistances(
  originEnemyId: string | null,
  data: OriginGameData
): EnemyResistanceTag[] {
  if (!originEnemyId) return [];
  const def = data.enemies.find((e) => e.id === originEnemyId);
  if (!def?.damageTaken) return [];

  const tags: EnemyResistanceTag[] = [];
  for (const [dmgType, mult] of Object.entries(def.damageTaken)) {
    if (typeof mult !== 'number' || mult === 1) continue;
    const typeLabel = DAMAGE_TYPE_LABELS[dmgType] ?? dmgType;
    if (mult < 1) {
      const pct = Math.round((1 - mult) * 100);
      tags.push({
        damageType: dmgType,
        label: `🛡️ -${pct}% ${typeLabel}`,
        kind: 'resist'
      });
    } else {
      const pct = Math.round((mult - 1) * 100);
      tags.push({
        damageType: dmgType,
        label: `🔥 +${pct}% ${typeLabel}`,
        kind: 'weak'
      });
    }
  }
  return tags;
}

/**
 * Classifies a combat log line to drive procedural WebAudio SFX & crit HUD feedback.
 */
export function classifyCombatLogEvent(line: string): 'crit' | 'hit' | 'miss' | null {
  const lower = line.toLowerCase();
  if (lower.includes('krytycz') || lower.includes('crit')) {
    return 'crit';
  }
  if (
    lower.includes('pudł') ||
    lower.includes('pudlo') ||
    lower.includes('chyb') ||
    lower.includes('unik') ||
    lower.includes('spudł') ||
    lower.includes('miss')
  ) {
    return 'miss';
  }
  if (
    lower.includes('obraż') ||
    lower.includes('obraz') ||
    lower.includes('zadaje') ||
    lower.includes('trafi') ||
    lower.includes('cios') ||
    lower.includes('damage')
  ) {
    return 'hit';
  }
  return null;
}
