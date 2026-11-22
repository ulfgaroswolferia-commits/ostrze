import type { OstrzeGameState } from '../data/originTypes';

export type SupportedCombatStatusId = 'krwawienie' | 'zatrucie' | 'strach';

export interface ActiveCombatStatusTracker {
  remainingTurns: number;
}

export interface CombatStatusSessionState {
  activeTurns: Partial<Record<SupportedCombatStatusId, number>>;
  immuneUntilRound: Partial<Record<SupportedCombatStatusId, number>>;
}

export function createCombatStatusSessionState(): CombatStatusSessionState {
  return {
    activeTurns: {},
    immuneUntilRound: {}
  };
}

export function isSupportedCombatStatus(id: string): id is SupportedCombatStatusId {
  return id === 'krwawienie' || id === 'zatrucie' || id === 'strach';
}

const STATUS_DEFAULT_TURNS: Record<SupportedCombatStatusId, number> = {
  krwawienie: 2,
  zatrucie: 2,
  strach: 1
};

const STATUS_LABELS: Record<SupportedCombatStatusId, string> = {
  krwawienie: 'Krwawienie',
  zatrucie: 'Zatrucie',
  strach: 'Strach'
};

export const ANTI_STUNLOCK_IMMUNITY_TURNS = 2;

export interface ApplyStatusResult {
  applied: boolean;
  reason?: 'unsupported' | 'blocked_tier' | 'immune' | 'already_active' | 'resisted';
  statusId?: SupportedCombatStatusId;
  logMessage?: string;
  floatingText?: string;
  floatingColorHex?: number;
}

/**
 * Attempts to apply an Ostrze combat status (`krwawienie`, `zatrucie`, `strach`)
 * to the player, enforcing anti-stunlock immunity and syncing with `state.character.effects`.
 */
export function tryApplyPlayerCombatStatus(params: {
  state: OstrzeGameState | null;
  session: CombatStatusSessionState;
  statusId: string;
  chancePct: number;
  currentRound: number;
  allowStatusEffects: boolean;
  sourceName: string;
  rng?: () => number;
}): ApplyStatusResult {
  const {
    state,
    session,
    statusId,
    chancePct,
    currentRound,
    allowStatusEffects,
    sourceName,
    rng = Math.random
  } = params;

  if (!allowStatusEffects) {
    return { applied: false, reason: 'blocked_tier' };
  }
  if (!isSupportedCombatStatus(statusId)) {
    return { applied: false, reason: 'unsupported' };
  }

  const immuneUntil = session.immuneUntilRound[statusId] ?? 0;
  if (currentRound <= immuneUntil) {
    return { applied: false, reason: 'immune' };
  }

  if ((session.activeTurns[statusId] ?? 0) > 0) {
    return { applied: false, reason: 'already_active' };
  }

  const roll = rng() * 100;
  if (roll >= Math.max(0, Math.min(100, chancePct))) {
    return { applied: false, reason: 'resisted' };
  }

  const duration = STATUS_DEFAULT_TURNS[statusId];
  session.activeTurns[statusId] = duration;

  if (state?.character) {
    const existing = state.character.effects.find((e) => e.id === statusId);
    if (!existing) {
      state.character.effects.push({ id: statusId, stacks: 1, remainingHours: 1 });
    }
  }

  const label = STATUS_LABELS[statusId];
  const colorMap: Record<SupportedCombatStatusId, number> = {
    krwawienie: 0xff453a,
    zatrucie: 0x76ff03,
    strach: 0xce93d8
  };
  const descMap: Record<SupportedCombatStatusId, string> = {
    krwawienie: `2–3 obr./turę (${duration} tury)`,
    zatrucie: `2 obr./turę i -10% trafienia (${duration} tury)`,
    strach: `-1 AP w następnej turze`
  };

  return {
    applied: true,
    statusId,
    floatingText: `⚠️ ${label.toUpperCase()}!`,
    floatingColorHex: colorMap[statusId],
    logMessage: `⚠️ ${sourceName} nakłada status [${label}]: ${descMap[statusId]}.`
  };
}

/**
 * Grants 2-turn anti-stunlock immunity when a status is cured via the Quick-Use Belt.
 */
export function markPlayerStatusCured(
  session: CombatStatusSessionState,
  statusId: string,
  currentRound: number
): void {
  if (!isSupportedCombatStatus(statusId)) return;
  delete session.activeTurns[statusId];
  session.immuneUntilRound[statusId] = currentRound + ANTI_STUNLOCK_IMMUNITY_TURNS;
}

export interface PlayerStatusTickSummary {
  totalDamage: number;
  apPenalty: number;
  logs: string[];
  floatingTexts: Array<{ text: string; colorHex: number }>;
  expiredStatuses: SupportedCombatStatusId[];
}

/**
 * Ticks active Ostrze combat statuses at the start of the player's turn.
 * Keeps `state.character.effects` synchronized and grants 2-turn immunity on expiry.
 */
export function tickPlayerCombatStatuses(params: {
  state: OstrzeGameState | null;
  session: CombatStatusSessionState;
  currentRound: number;
  rng?: () => number;
}): PlayerStatusTickSummary {
  const { state, session, currentRound, rng = Math.random } = params;
  const summary: PlayerStatusTickSummary = {
    totalDamage: 0,
    apPenalty: 0,
    logs: [],
    floatingTexts: [],
    expiredStatuses: []
  };

  const trackedIds: SupportedCombatStatusId[] = ['krwawienie', 'zatrucie', 'strach'];
  for (const statusId of trackedIds) {
    const remaining = session.activeTurns[statusId] ?? 0;
    if (remaining <= 0) continue;

    // If cured externally from state.character.effects, respect the cure
    if (state?.character && !state.character.effects.some((e) => e.id === statusId)) {
      markPlayerStatusCured(session, statusId, currentRound);
      continue;
    }

    if (statusId === 'krwawienie') {
      const dmg = rng() < 0.5 ? 2 : 3;
      summary.totalDamage += dmg;
      summary.logs.push(`🩸 Krwawienie zadaje Ci ${dmg} obr.`);
      summary.floatingTexts.push({ text: `🩸 -${dmg} HP (Krwawienie)`, colorHex: 0xff453a });
    } else if (statusId === 'zatrucie') {
      const dmg = 2;
      summary.totalDamage += dmg;
      summary.logs.push(`☠️ Zatrucie zadaje Ci ${dmg} obr. (-10% do celności).`);
      summary.floatingTexts.push({ text: `☠️ -${dmg} HP (Zatrucie)`, colorHex: 0x76ff03 });
    } else if (statusId === 'strach') {
      summary.apPenalty += 1;
      summary.logs.push('😨 Strach odbiera Ci 1 AP w tej turze.');
      summary.floatingTexts.push({ text: '😨 -1 AP (Strach)', colorHex: 0xce93d8 });
    }

    const nextRemaining = remaining - 1;
    if (nextRemaining <= 0) {
      delete session.activeTurns[statusId];
      session.immuneUntilRound[statusId] = currentRound + ANTI_STUNLOCK_IMMUNITY_TURNS;
      summary.expiredStatuses.push(statusId);
      if (state?.character) {
        state.character.effects = state.character.effects.filter((e) => e.id !== statusId);
      }
      summary.logs.push(
        `✨ Status [${STATUS_LABELS[statusId]}] ustępuje (2 tury odporności).`
      );
    } else {
      session.activeTurns[statusId] = nextRemaining;
    }
  }

  return summary;
}

export function getPlayerStatusHitPenaltyPct(
  state: OstrzeGameState | null,
  session: CombatStatusSessionState
): number {
  const poisonedInSession = (session.activeTurns.zatrucie ?? 0) > 0;
  const poisonedInState = Boolean(state?.character?.effects.some((e) => e.id === 'zatrucie'));
  return poisonedInSession || poisonedInState ? 10 : 0;
}
