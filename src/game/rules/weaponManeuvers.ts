import type { OriginGameData, OstrzeGameState, SkillId } from '../data/originTypes';

export type WeaponManeuverId =
  | 'ciecie_lukiem'
  | 'pchniecie_zaporowe'
  | 'strzal_w_sciegno'
  | 'huk_zaporowy'
  | 'cios_w_splot';

export interface WeaponManeuverDef {
  id: WeaponManeuverId;
  name: string;
  shortLabel: string;
  icon: string;
  description: string;
  weaponSkill: SkillId;
  apCost: number;
  cooldownRounds: number;
  rangeTiles: number;
  damageMultiplier: number;
}

const MANEUVER_BY_SKILL: Readonly<Record<string, WeaponManeuverDef>> = {
  sieczna: {
    id: 'ciecie_lukiem',
    name: 'Cięcie Łukiem',
    shortLabel: 'Cięcie Łukiem',
    icon: '⚔️',
    description: 'Szerokie cięcie — trafia cel i sąsiedniego wroga, nakładając Krwawienie.',
    weaponSkill: 'sieczna',
    apCost: 4,
    cooldownRounds: 2,
    rangeTiles: 1.9,
    damageMultiplier: 1.15
  },
  drzewcowa: {
    id: 'pchniecie_zaporowe',
    name: 'Pchnięcie Zaporowe',
    shortLabel: 'Pchnięcie [2 k.]',
    icon: '🔱',
    description: 'Długie pchnięcie na 2 kafle — odpycha wroga o 1 kafel i odbiera mu 1 AP.',
    weaponSkill: 'drzewcowa',
    apCost: 4,
    cooldownRounds: 2,
    rangeTiles: 2.6,
    damageMultiplier: 1.2
  },
  strzelecka: {
    id: 'strzal_w_sciegno',
    name: 'Strzał w Ścięgno',
    shortLabel: 'Strzał w Ścięgno',
    icon: '🏹',
    description: 'Mierzony strzał okaleczający nogi wroga (2 tury spowolnienia + bonus obrażeń).',
    weaponSkill: 'strzelecka',
    apCost: 4,
    cooldownRounds: 2,
    rangeTiles: 6.5,
    damageMultiplier: 1.2
  },
  proch: {
    id: 'huk_zaporowy',
    name: 'Huk Zaporowy',
    shortLabel: 'Huk Zaporowy',
    icon: '💥',
    description: 'Ogłuszająca salwa — zwiększone obrażenia i Strach (-1 AP wroga).',
    weaponSkill: 'proch',
    apCost: 4,
    cooldownRounds: 2,
    rangeTiles: 6.0,
    damageMultiplier: 1.25
  }
};

const FALLBACK_MANEUVER: WeaponManeuverDef = {
  id: 'cios_w_splot',
  name: 'Cios w Splot',
  shortLabel: 'Cios w Splot',
  icon: '✊',
  description: 'Mocne uderzenie wręcz — odbiera wrogowi 1 AP i wytrąca go z równowagi.',
  weaponSkill: 'wrecz',
  apCost: 4,
  cooldownRounds: 2,
  rangeTiles: 1.9,
  damageMultiplier: 1.15
};

export function resolveActiveWeaponManeuver(
  state: OstrzeGameState | null,
  data: OriginGameData
): WeaponManeuverDef {
  const weaponId = state?.inventory?.equipped?.bron;
  if (weaponId) {
    const item = data.items.find((it) => it.id === weaponId);
    if (item?.skill && MANEUVER_BY_SKILL[item.skill]) {
      return MANEUVER_BY_SKILL[item.skill];
    }
  }
  const classId = state?.character?.classId;
  if (classId === 'wlocznia') return MANEUVER_BY_SKILL.drzewcowa;
  if (classId === 'miecz') return MANEUVER_BY_SKILL.sieczna;
  return FALLBACK_MANEUVER;
}

export function computeKnockbackTile(
  attackerX: number,
  attackerY: number,
  targetX: number,
  targetY: number,
  isTileFree: (tx: number, ty: number) => boolean
): { x: number; y: number } | null {
  const dx = Math.sign(targetX - attackerX);
  const dy = Math.sign(targetY - attackerY);
  if (dx === 0 && dy === 0) return null;
  const candX = targetX + dx;
  const candY = targetY + dy;
  if (isTileFree(candX, candY)) {
    return { x: candX, y: candY };
  }
  // Try orthogonal fallback if diagonal is blocked
  if (dx !== 0 && dy !== 0) {
    if (isTileFree(targetX + dx, targetY)) return { x: targetX + dx, y: targetY };
    if (isTileFree(targetX, targetY + dy)) return { x: targetX, y: targetY + dy };
  }
  return null;
}
