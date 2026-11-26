import { registerCustomCharacterBaker } from '@ulf/assets/characterBakery';
import { FovGridState } from '@ulf/core/fov';
import { deltaToDirection8 } from '@ulf/core/pathfinding';
import { IsometricWorldMap, MapId } from '@ulf/core/worldMap';
import { registerPropVisualTransform } from '@ulf/renderer/isoSceneView';
import { DIALOGUE_TREES, DialogueNode } from '@ulf/rpg/dialogueSystem';
import type { CombatAttackMode, CombatantSnapshot } from '@ulf/rpg/combatSystem';
import {
  ActorEntity,
  CrpgGameState,
  EnemyAiAttackDecision,
  EnemyAiMovePlan,
  LogSeverity
} from '@ulf/rpg/gameLoop';
import {
  bakeBlednikCharacterBuffers,
  bakeBoarCharacterBuffers,
  bakeDogCharacterBuffers,
  bakeSkrzatCharacterBuffers,
  bakeViperCharacterBuffers,
  bakeWolfCharacterBuffers,
  isBlednikRecipe,
  isBoarRecipe,
  isDogRecipe,
  isSkrzatRecipe,
  isViperRecipe,
  isWolfRecipe
} from '../game/assets/beastSprites';
import { getPropVisualTransform } from '../game/assets/buildingScaling';
import {
  getHunterLoreBonusDamage,
  recordBestiaryEncounter,
  recordBestiaryKill
} from '../game/rules/bestiary';
import {
  getDifficultyProfile,
  getOstrzeDifficulty
} from '../game/rules/difficulty';
import {
  computeActorTacticalCover,
  findDetonatableOilBarrel,
  OIL_BARREL_AP_COST,
  OIL_BARREL_BLAST_RADIUS,
  type TacticalCoverInfo
} from '../game/rules/combatArenaTactics';
import {
  computeKnockbackTile,
  resolveActiveWeaponManeuver,
  type WeaponManeuverDef
} from '../game/rules/weaponManeuvers';
import {
  evaluateGuardBreak,
  evaluateGuardRiposte,
  evaluateStatusSynergies
} from '../game/rules/combatSynergies';
import { registerOstrzePainterlyProps } from '../game/assets/painterlyProps';
import { ostrzeAudio } from '../game/audio/ostrzeAudio';
import { ORIGIN_DATA } from '../game/data/originData';
import type { OriginGameData, OstrzeGameState } from '../game/data/originTypes';
import {
  createCombatAiSessionState,
  findBestFlankAdjacentTile,
  findBestKiteTile,
  findBestRangedApproachTile,
  pickBossTelegraphIntent,
  resolveEnemyArchetype,
  resolveEnemyTacticalTier,
  shouldCautiousEnemyHoldForGuard,
  TACTICAL_BUDGETS
} from '../game/rules/combatAi';
import {
  getDamageTypeLabel,
  getEnemyDamageMultiplier,
  resolveEnemyOriginId,
  resolvePlayerWeaponDamageType
} from '../game/rules/combatEnemyMeta';
import {
  createCombatStatusSessionState,
  getPlayerStatusHitPenaltyPct,
  markPlayerStatusCured,
  tickPlayerCombatStatuses,
  tryApplyPlayerCombatStatus
} from '../game/rules/combatStatuses';
import { ComputedStats, getStats } from '../game/rules/stats';

let ostrzeEngineExtensionsRegistered = false;

export function ensureOstrzeEngineExtensionsRegistered(): void {
  if (ostrzeEngineExtensionsRegistered) return;
  ostrzeEngineExtensionsRegistered = true;
  registerCustomCharacterBaker({
    matches: (recipe) => isDogRecipe(recipe),
    computeHash: (recipe) => `dog_${recipe.id}`,
    bake: (recipe) => bakeDogCharacterBuffers(recipe)
  });
  registerCustomCharacterBaker({
    matches: (recipe) => isBoarRecipe(recipe),
    computeHash: (recipe) => `boar_${recipe.id}`,
    bake: (recipe) => bakeBoarCharacterBuffers(recipe)
  });
  registerCustomCharacterBaker({
    matches: (recipe) => isWolfRecipe(recipe),
    computeHash: (recipe) => `wolf|${recipe.id}|${recipe.name}`,
    bake: (recipe) => bakeWolfCharacterBuffers(recipe)
  });
  registerCustomCharacterBaker({
    matches: (recipe) => isViperRecipe(recipe),
    computeHash: (recipe) => `viper|${recipe.id}|${recipe.name}`,
    bake: (recipe) => bakeViperCharacterBuffers(recipe)
  });
  registerCustomCharacterBaker({
    matches: (recipe) => isBlednikRecipe(recipe),
    computeHash: (recipe) => `blednik|${recipe.id}|${recipe.name}`,
    bake: (recipe) => bakeBlednikCharacterBuffers(recipe)
  });
  registerCustomCharacterBaker({
    matches: (recipe) => isSkrzatRecipe(recipe),
    computeHash: (recipe) => `skrzat|${recipe.id}|${recipe.name}`,
    bake: (recipe) => bakeSkrzatCharacterBuffers(recipe)
  });
  registerPropVisualTransform(getPropVisualTransform);
  registerOstrzePainterlyProps();
}

export interface CustomSceneConfig {
  id: string;
  map: IsometricWorldMap;
  spawnX: number;
  spawnY: number;
  actors?: ActorEntity[];
  ambientLightIntensity?: number;
  fogOfWarEnabled?: boolean;
  introLog?: string;
  introSeverity?: LogSeverity;
}

/**
 * Bridge layer isolating Ostrze game content from the upstream ulfRPG engine.
 * Allows loading custom 2.5D scenes and registering Ostrze dialogues without
 * modifying any files inside ../ulfRPG.
 */
export class OstrzeEngineState extends CrpgGameState {
  private readonly customScenes = new Map<string, CustomSceneConfig>();
  public activeCustomSceneId: string | null = null;
  private wasCombatActive = false;
  public onCombatEnded?: (outcome: 'victory' | 'defeat' | 'fled') => void;
  public onNpcInteract?: (npcId: string) => boolean;
  public onPropInteract?: (propId: string) => boolean;
  public onFallbackPropInteract?: (propId: string) => boolean;
  public onSceneLoaded?: (sceneId: string) => void;
  public onJuicyImpact?: (isBigImpact: boolean) => void;
  public onPropReaction?: (propId: string, kind: 'rock' | 'pop') => void;
  private readonly persistentMarkers = new Map<string, string>();
  private activeOstrzeState: OstrzeGameState | null = null;
  private combatAiSession = createCombatAiSessionState();
  private combatStatusSession = createCombatStatusSessionState();
  private readonly enemyBurnTurns = new Map<string, number>();
  private readonly enemyBleedTurns = new Map<string, number>();
  private pendingPlayerAttackMultiplier = 1;
  private pendingPlayerHitBonusPct = 0;
  private pendingPlayerCritBonusPct = 0;
  private pendingPlayerFeintActive = false;
  private feintUsedRound = -1;
  private riposteUsedRound = -1;
  private maneuverCooldownUntilRound = 0;
  private readonly detonatedOilBarrelIds = new Set<string>();
  private readonly enemyBaseMaxHp = new Map<string, number>();
  private readonly countedBestiaryKillActorIds = new Set<string>();

  constructor() {
    ensureOstrzeEngineExtensionsRegistered();
    super('forest_clearing');
    this.chronicleEntries.length = 0;
    this.logs.length = 0;
    this.addCombatAttackListener((event) => {
      if (!this.activeCustomSceneId) return;
      if (event.attacker.id !== this.player.id) {
        const originId = resolveEnemyOriginId(event.attacker.id, event.attacker.recipe.name);
        ostrzeAudio.playEnemyAttackVoice(originId);
      }
      if (event.target.id === this.player.id && event.attacker.id !== this.player.id) {
        if (event.outcome.hit) {
          this.handleEnemyHitStatusEffects(event.attacker);
        }
        this.tryTriggerPlayerGuardRiposte(event.attacker, event.outcome);
      }
    });
  }

  public notifyPlayerStatusCured(statusId: string): void {
    markPlayerStatusCured(this.combatStatusSession, statusId, this.combatState.round);
  }

  public getActiveOstrzeState(): OstrzeGameState | null {
    return this.activeOstrzeState;
  }

  public getTelegraphedIntent(enemyId: string) {
    return this.combatAiSession.telegraphedIntentByEnemy[enemyId] ?? null;
  }

  public resetCombatTacticalSessions(): void {
    this.combatAiSession = createCombatAiSessionState();
    this.combatStatusSession = createCombatStatusSessionState();
    this.enemyBurnTurns.clear();
    this.enemyBleedTurns.clear();
    this.feintUsedRound = -1;
    this.riposteUsedRound = -1;
    this.maneuverCooldownUntilRound = 0;
    this.detonatedOilBarrelIds.clear();
    this.pendingPlayerFeintActive = false;
    this.pendingPlayerHitBonusPct = 0;
    this.pendingPlayerCritBonusPct = 0;
  }

  public applyEnemyBurn(enemyId: string, turns = 2): void {
    const prev = this.enemyBurnTurns.get(enemyId) ?? 0;
    this.enemyBurnTurns.set(enemyId, Math.max(prev, turns));
  }

  public getEnemyBurnTurns(enemyId: string): number {
    return this.enemyBurnTurns.get(enemyId) ?? 0;
  }

  public applyEnemyBleed(enemyId: string, turns = 2): void {
    const prev = this.enemyBleedTurns.get(enemyId) ?? 0;
    this.enemyBleedTurns.set(enemyId, Math.max(prev, turns));
  }

  public getEnemyBleedTurns(enemyId: string): number {
    return this.enemyBleedTurns.get(enemyId) ?? 0;
  }

  public getPlayerActiveStatusTurns(): Partial<Record<'krwawienie' | 'zatrucie' | 'strach', number>> {
    return { ...this.combatStatusSession.activeTurns };
  }

  public getActorVisualStatuses(actorId: string): string[] {
    if (actorId === this.player.id) {
      const result: string[] = [];
      for (const [id, turns] of Object.entries(this.combatStatusSession.activeTurns)) {
        if ((turns ?? 0) > 0) result.push(id);
      }
      return result;
    }
    const enemyStatuses: string[] = [];
    if ((this.enemyBleedTurns.get(actorId) ?? 0) > 0) {
      enemyStatuses.push('krwawienie');
    }
    if ((this.enemyBurnTurns.get(actorId) ?? 0) > 0) {
      enemyStatuses.push('podpalenie');
    }
    return enemyStatuses;
  }

  public isPlayerFeintReady(): boolean {
    return Boolean(
      this.activeOstrzeState?.character?.perks.includes('finta') &&
        this.feintUsedRound !== this.combatState.round
    );
  }

  public isPlayerRiposteReady(): boolean {
    return Boolean(
      this.player.combat?.defending &&
        this.combatState.active &&
        this.riposteUsedRound !== this.combatState.round
    );
  }

  public tickEnemyBurn(enemy: ActorEntity, rng: () => number = Math.random): number {
    const rem = this.enemyBurnTurns.get(enemy.id) ?? 0;
    if (rem <= 0 || !enemy.combat?.isAlive) {
      this.enemyBurnTurns.delete(enemy.id);
      return 0;
    }
    const base = 3 + Math.floor(rng() * 2); // 3–4 fire damage
    const originId = resolveEnemyOriginId(enemy.id, enemy.recipe.name);
    const mult = getEnemyDamageMultiplier(originId, 'ogien', ORIGIN_DATA);
    const dmg = Math.max(1, Math.round(base * mult));
    enemy.combat.hp = Math.max(0, enemy.combat.hp - dmg);
    enemy.damageFlashTimer = 0.24;

    if (rem - 1 <= 0) this.enemyBurnTurns.delete(enemy.id);
    else this.enemyBurnTurns.set(enemy.id, rem - 1);

    this.pushFloatingCombatText(
      enemy.x,
      enemy.y,
      enemy.z + 2.0,
      `🔥 -${dmg} PODPALENIE!`,
      0xff7043
    );
    this.addCombatLog(
      `🔥 Podpalenie zadaje ${dmg} obr. ognia: ${enemy.recipe.name}${mult > 1 ? ` (×${mult} podatność)` : ''}.`
    );

    if (enemy.combat.hp <= 0) {
      enemy.combat.isAlive = false;
      this.enemyBurnTurns.delete(enemy.id);
      this.addCombatLog(`🔥 ${enemy.recipe.name} ginie w płomieniach!`);
      const remainingHostiles = this.npcs.filter((n) => n.combat?.isHostile && n.combat.isAlive);
      if (remainingHostiles.length === 0) {
        this.combatState.active = false;
        this.addLog(`Zwycięstwo w walce! Pokonano: ${enemy.recipe.name}.`, 'important');
      } else if (this.combatState.selectedTargetId === enemy.id) {
        this.combatState.selectedTargetId = remainingHostiles[0].id;
      }
    }
    return dmg;
  }

  public tickEnemyBleed(enemy: ActorEntity, rng: () => number = Math.random): number {
    const rem = this.enemyBleedTurns.get(enemy.id) ?? 0;
    if (rem <= 0 || !enemy.combat?.isAlive) {
      this.enemyBleedTurns.delete(enemy.id);
      return 0;
    }
    const dmg = 2 + Math.floor(rng() * 2); // 2–3 bleed damage
    enemy.combat.hp = Math.max(0, enemy.combat.hp - dmg);
    enemy.damageFlashTimer = 0.2;

    if (rem - 1 <= 0) this.enemyBleedTurns.delete(enemy.id);
    else this.enemyBleedTurns.set(enemy.id, rem - 1);

    this.pushFloatingCombatText(
      enemy.x,
      enemy.y,
      enemy.z + 2.05,
      `🩸 -${dmg} KRWAWIENIE!`,
      0xef4444
    );
    this.addCombatLog(`🩸 Krwawienie osłabia ${enemy.recipe.name}: -${dmg} HP.`);

    if (enemy.combat.hp <= 0) {
      enemy.combat.isAlive = false;
      this.enemyBleedTurns.delete(enemy.id);
      this.enemyBurnTurns.delete(enemy.id);
      const originId = resolveEnemyOriginId(enemy.id, enemy.recipe.name);
      this.checkAndRecordEnemyKill(enemy, originId);
      this.addCombatLog(`🩸 ${enemy.recipe.name} wykrwawia się na polu bitwy!`);
      const remainingHostiles = this.npcs.filter((n) => n.combat?.isHostile && n.combat.isAlive);
      if (remainingHostiles.length === 0) {
        this.combatState.active = false;
        this.resetCombatTacticalSessions();
        this.addLog(`Zwycięstwo w walce! Pokonano: ${enemy.recipe.name}.`, 'important');
        this.onCombatEnded?.('victory');
      } else if (this.combatState.selectedTargetId === enemy.id) {
        this.combatState.selectedTargetId = remainingHostiles[0].id;
      }
    }
    return dmg;
  }

  private isPlayerEquippedMelee(): boolean {
    const weaponId = this.activeOstrzeState?.inventory?.equipped?.bron;
    const weapon = weaponId ? ORIGIN_DATA.items.find((it) => it.id === weaponId) : undefined;
    if (!weapon?.skill) return true;
    return weapon.skill !== 'strzelecka' && weapon.skill !== 'proch';
  }

  private tryTriggerPlayerGuardRiposte(
    attacker: ActorEntity,
    outcome: Pick<
      import('@ulf/rpg/combatSystem').CombatAttackOutcome,
      'hit' | 'rawDamage' | 'mitigatedByArmor' | 'damageDealt'
    >
  ): void {
    const pCombat = this.player.combat;
    const aCombat = attacker.combat;
    if (!this.combatState.active || !pCombat || !aCombat) return;

    const weaponId = this.activeOstrzeState?.inventory?.equipped?.bron;
    const weapon = weaponId ? ORIGIN_DATA.items.find((it) => it.id === weaponId) : undefined;
    const avgDmg = weapon?.damage ? (weapon.damage[0] + weapon.damage[1]) * 0.5 : 5.5;
    const dist = Math.hypot(attacker.tileX - this.player.tileX, attacker.tileY - this.player.tileY);

    const riposte = evaluateGuardRiposte({
      playerDefending: Boolean(pCombat.defending),
      playerAlive: pCombat.isAlive,
      playerWeaponIsMelee: this.isPlayerEquippedMelee(),
      attackerAlive: aCombat.isAlive,
      distanceTiles: dist,
      currentRound: this.combatState.round,
      riposteUsedRound: this.riposteUsedRound,
      playerBaseAvgDamage: avgDmg,
      outcome
    });
    if (!riposte.triggered) return;

    this.riposteUsedRound = this.combatState.round;
    aCombat.hp = Math.max(0, aCombat.hp - riposte.damage);
    this.player.attackAnimTimer = 0.18;
    this.player.attackAnimMaxTimer = 0.18;
    this.player.attackTargetX = attacker.x;
    this.player.attackTargetY = attacker.y;
    attacker.hitRecoilTimer = 0.18;
    attacker.hitRecoilMaxTimer = 0.18;
    attacker.hitFromX = this.player.x;
    attacker.hitFromY = this.player.y;
    attacker.damageFlashTimer = 0.22;

    this.onJuicyImpact?.(false);
    ostrzeAudio.playRiposte();
    this.pushFloatingCombatText(
      attacker.x,
      attacker.y,
      attacker.z + 2.35,
      `⚔️ RIPOSTA! -${riposte.damage}`,
      0xfde047
    );
    this.addCombatLog(
      `⚔️ RIPOSTA Z GARDY! ${this.player.recipe.name} kontruje ${attacker.recipe.name} za ${riposte.damage} HP.`
    );

    if (aCombat.hp <= 0) {
      aCombat.isAlive = false;
      const originId = resolveEnemyOriginId(attacker.id, attacker.recipe.name);
      this.checkAndRecordEnemyKill(attacker, originId);
      const remainingHostiles = this.npcs.filter((n) => n.combat?.isHostile && n.combat.isAlive);
      if (remainingHostiles.length === 0) {
        this.combatState.active = false;
        this.resetCombatTacticalSessions();
        this.addLog(`Zwycięstwo w walce! Riposta powaliła: ${attacker.recipe.name}.`, 'important');
        this.onCombatEnded?.('victory');
      } else if (this.combatState.selectedTargetId === attacker.id) {
        this.combatState.selectedTargetId = remainingHostiles[0].id;
      }
    }
  }

  private handleEnemyHitStatusEffects(attacker: ActorEntity): void {
    const originId = resolveEnemyOriginId(attacker.id, attacker.recipe.name);
    const tier = resolveEnemyTacticalTier(
      this.activeCustomSceneId,
      originId,
      attacker.combat?.difficulty
    );
    const budget = TACTICAL_BUDGETS[tier];
    if (!budget.allowStatusEffects) return;

    const enemyDef = originId ? ORIGIN_DATA.enemies.find((e) => e.id === originId) : undefined;
    const primaryAttack = enemyDef?.attacks?.find(
      (a) => Array.isArray(a.damage) && a.damage.length >= 2
    );
    const playerStats = this.activeOstrzeState?.character
      ? getStats(this.activeOstrzeState, ORIGIN_DATA)
      : null;

    const effects = primaryAttack?.effects ?? [];
    for (const eff of effects) {
      const mappedStatusId =
        originId === 'zmija_lesna' && eff.id === 'krwawienie' ? 'zatrucie' : eff.id;
      let resistPct = 0;
      if (playerStats) {
        if (mappedStatusId === 'strach') resistPct = playerStats.derived.resistStrach;
        else if (mappedStatusId === 'ogluszenie' || mappedStatusId === 'zamroczenie') {
          resistPct = playerStats.derived.resistOgluszenie;
        } else if (mappedStatusId === 'rozkojarzenie') {
          resistPct = playerStats.derived.resistRozkojarzenie;
        }
      }
      const adjustedChance = Math.max(0, eff.chance - resistPct);
      const res = tryApplyPlayerCombatStatus({
        state: this.activeOstrzeState,
        session: this.combatStatusSession,
        statusId: mappedStatusId,
        chancePct: adjustedChance,
        currentRound: this.combatState.round,
        allowStatusEffects: budget.allowStatusEffects,
        sourceName: attacker.recipe.name
      });
      if (res.applied && res.logMessage) {
        this.addCombatLog(res.logMessage);
        if (res.floatingText) {
          this.pushFloatingCombatText(
            this.player.x,
            this.player.y,
            this.player.z + 2.05,
            res.floatingText,
            res.floatingColorHex ?? 0xff453a
          );
        }
      }
    }
  }

  public setNpcMarker(npcId: string, markerText: string | null): void {
    if (markerText) {
      this.persistentMarkers.set(npcId, markerText);
    } else {
      this.persistentMarkers.delete(npcId);
    }
    const npc = this.npcs.find((n) => n.id === npcId);
    if (npc) {
      npc.speechBubbleText = markerText;
      npc.speechBubbleTimer = markerText ? 999 : 0;
    }
  }

  public clearAllNpcMarkers(): void {
    for (const npcId of Array.from(this.persistentMarkers.keys())) {
      this.setNpcMarker(npcId, null);
    }
  }

  public override startDialogueWithNpc(npcId: string): void {
    if (this.onNpcInteract?.(npcId)) {
      return;
    }
    super.startDialogueWithNpc(npcId);
  }

  public override togglePropInteraction(propId: string): void {
    const prop = this.map.props.find((p) => p.id === propId);
    if (prop?.kind === 'training_dummy') {
      this.onPropReaction?.(prop.id, 'rock');
    } else if (prop?.kind === 'chest') {
      this.onPropReaction?.(prop.id, 'pop');
    }
    if (this.onPropInteract?.(propId)) {
      return;
    }
    if (this.onFallbackPropInteract?.(propId)) {
      return;
    }
    super.togglePropInteraction(propId);
  }

  public override update(dtSeconds: number): void {
    for (const [npcId, markerText] of this.persistentMarkers.entries()) {
      const npc = this.npcs.find((n) => n.id === npcId);
      if (npc) {
        npc.speechBubbleText = markerText;
        npc.speechBubbleTimer = 999;
      }
    }
    super.update(dtSeconds);
    if (this.wasCombatActive && !this.combatState.active) {
      const reportOutcome =
        this.activeCombatReportId && this.combatReports[this.activeCombatReportId]?.outcome;
      const outcome: 'victory' | 'defeat' | 'fled' =
        this.player.combat && (!this.player.combat.isAlive || this.player.combat.hp <= 0)
          ? 'defeat'
          : (reportOutcome || 'victory');
      this.wasCombatActive = false;
      this.resetCombatTacticalSessions();
      this.onCombatEnded?.(outcome);
      return;
    }
    this.wasCombatActive = this.combatState.active;
  }

  /**
   * Synchronizes the 2.5D hero actor's visual loadout and combat pool with Ostrze rules.
   */
  public syncHeroFromOstrze(opts: {
    name: string;
    classId: 'miecz' | 'wlocznia';
    hp: number;
    hpMax: number;
    ap: number;
    hasHunterHood?: boolean;
    headVisual?: string | null;
    torsoVisual?: string;
    mainHandVisual?: string;
    offHandVisual?: string | null;
    stats?: ComputedStats;
  }): void {
    this.player.recipe.name = opts.name;
    this.player.recipe.title = opts.classId === 'miecz' ? 'Adept Szkoły Ostrzy (Miecz)' : 'Adept Szkoły Ostrzy (Włócznia)';
    this.player.recipe.equipment = {
      head: opts.headVisual !== undefined ? opts.headVisual : (opts.hasHunterHood ? 'helm_shadow_hood' : null),
      torso: opts.torsoVisual ?? 'torso_przeszywanica',
      cloak: null,
      legs: 'legs_leather_boots',
      mainHand: opts.mainHandVisual ?? (opts.classId === 'miecz' ? 'weapon_sunblade_longsword' : 'weapon_astral_staff'),
      offHand: opts.offHandVisual ?? null
    };
    if (this.player.combat) {
      this.player.combat.maxHp = opts.hpMax;
      this.player.combat.hp = Math.max(1, Math.min(opts.hpMax, opts.hp));
      this.player.combat.isAlive = true;
      this.player.combat.maxAp = opts.ap;
      if (!this.combatState.active) {
        this.player.combat.ap = opts.ap;
      }

      if (opts.stats) {
        const s = opts.stats;
        this.player.combat.customArmorBonus = Math.max(0, Math.round(s.derived.armor + s.derived.defense / 4));
        this.player.combat.customDamageBonus = Math.max(
          0,
          Math.floor((s.attributes.sila - 5) / 2) + s.derived.bonusDamage
        );
        this.player.combat.proficiencies.blades = Math.max(
          60,
          Math.min(95, 55 + Math.round(s.skills.sieczna * 0.45) + Math.round(s.derived.meleeHitChance * 0.2))
        );
        this.player.combat.proficiencies.axes_blunt = Math.max(
          60,
          Math.min(95, 55 + Math.round(s.skills.drzewcowa * 0.45) + Math.round(s.derived.meleeHitChance * 0.2))
        );
      }
    }
  }

  /**
   * Unified helper to synchronize Ostrze character state + derived stats into the 2.5D hero actor.
   */
  public syncFromOstrzeState(state: OstrzeGameState, data: OriginGameData): void {
    this.activeOstrzeState = state;
    this.applyDifficultyScalingToLoadedEnemies();
    if (!state.character) return;
    const stats = getStats(state, data);
    const eq = state.inventory.equipped;
    const headId = eq.glowa;
    const headVisual =
      headId === 'kaptur_mysliwego'
        ? 'helm_shadow_hood'
        : headId
          ? 'helm_szyszak'
          : null;
    const torsoId = eq.tulow ?? eq.korpus;
    const torsoVisual =
      torsoId === 'kolczuga' || torsoId === 'zbroja_luskowa' || torsoId === 'kirys'
        ? 'torso_slavic_lamellar'
        : torsoId === 'brygantyna' || torsoId === 'skorzana_kurtka'
          ? 'torso_warden_brigandine'
          : 'torso_przeszywanica';
    const weaponItem = eq.bron ? data.items.find((i) => i.id === eq.bron) : undefined;
    const mainHandVisual =
      weaponItem?.skill === 'strzelecka'
        ? 'weapon_hunting_bow'
        : weaponItem?.skill === 'drzewcowa' ||
            (!weaponItem && state.character.classId === 'wlocznia')
          ? 'weapon_astral_staff'
          : 'weapon_sunblade_longsword';
    const offHandVisual = eq.bron_druga || eq.tarcza ? 'offhand_slavic_shield' : null;

    this.syncHeroFromOstrze({
      name: state.character.name,
      classId: state.character.classId,
      hp: state.character.hp,
      hpMax: stats.derived.hpMax,
      ap: stats.derived.ap,
      headVisual,
      torsoVisual,
      mainHandVisual,
      offHandVisual,
      stats
    });

    if (this.player.combat) {
      if (state.flags.bogdan_ulepszenie_bron) {
        this.player.combat.customDamageBonus = (this.player.combat.customDamageBonus ?? 0) + 2;
      }
      if (state.flags.bogdan_gwiezdne_ostrze) {
        this.player.combat.customDamageBonus = (this.player.combat.customDamageBonus ?? 0) + 3;
      }
      if (state.flags.bogdan_ulepszenie_pancerz) {
        this.player.combat.customArmorBonus = (this.player.combat.customArmorBonus ?? 0) + 2;
      }
    }
  }

  /**
   * Registers a custom 2.5D scene definition for Ostrze.
   */
  public registerCustomScene(scene: CustomSceneConfig): void {
    this.customScenes.set(scene.id, scene);
  }

  /**
   * Registers dialogue nodes into the engine's dialogue registry.
   */
  public registerDialogues(dialogues: Record<string, DialogueNode>): void {
    Object.assign(DIALOGUE_TREES, dialogues);
  }

  /**
   * Loads a registered Ostrze custom scene by ID, resetting combat/dialogue state.
   */
  public loadCustomScene(sceneId: string): boolean {
    const scene = this.customScenes.get(sceneId);
    if (!scene) {
      return false;
    }

    this.resetRuntimeStateForCustomMap();
    this.resetCombatTacticalSessions();
    this.enemyBaseMaxHp.clear();
    this.countedBestiaryKillActorIds.clear();
    this.persistentMarkers.clear();
    this.wasCombatActive = false;
    this.activeCustomSceneId = sceneId;
    this.map = scene.map;
    this.fov = new FovGridState(this.map.width, this.map.height);
    this.rebuildPropGrid();
    this.bumpMapRevision();

    if (typeof scene.ambientLightIntensity === 'number') {
      this.ambientLightIntensity = scene.ambientLightIntensity;
    }
    if (typeof scene.fogOfWarEnabled === 'boolean') {
      this.fogOfWarEnabled = scene.fogOfWarEnabled;
    }

    const clampedX = Math.max(0, Math.min(this.map.width - 1, scene.spawnX));
    const clampedY = Math.max(0, Math.min(this.map.height - 1, scene.spawnY));
    this.player.tileX = clampedX;
    this.player.tileY = clampedY;
    this.player.x = clampedX + 0.5;
    this.player.y = clampedY + 0.5;
    this.player.z = this.map.tiles[clampedY][clampedX].z;
    this.player.path = [];
    this.player.isMoving = false;
    this.player.speechBubbleText = null;
    this.player.speechBubbleTimer = 0;

    if (scene.actors && scene.actors.length > 0) {
      for (const actor of scene.actors) {
        this.npcs.push({
          ...actor,
          recipe: {
            ...actor.recipe,
            skinTone: { ...actor.recipe.skinTone },
            hairColor: { ...actor.recipe.hairColor },
            equipment: { ...actor.recipe.equipment },
            attributes: { ...actor.recipe.attributes }
          },
          path: [...actor.path],
          combat: actor.combat
            ? {
                ...actor.combat,
                proficiencies: { ...actor.combat.proficiencies },
                lootTable: [...actor.combat.lootTable]
              }
            : undefined
        });
      }
    }

    for (const npc of this.npcs) {
      if (!npc.dialogueId) continue;
      npc.direction = deltaToDirection8(
        this.player.tileX - npc.tileX,
        this.player.tileY - npc.tileY
      );
    }

    if (scene.introLog) {
      this.addLog(scene.introLog, scene.introSeverity ?? 'important');
    }

    this.recomputeFov();
    this.onSceneLoaded?.(sceneId);
    this.applyDifficultyScalingToLoadedEnemies();
    return true;
  }

  public applyDifficultyScalingToLoadedEnemies(): void {
    const profile = getDifficultyProfile(getOstrzeDifficulty(this.activeOstrzeState));
    for (const npc of this.npcs) {
      if (!npc.combat?.isHostile) continue;
      let baseMaxHp = this.enemyBaseMaxHp.get(npc.id);
      if (baseMaxHp === undefined) {
        baseMaxHp = npc.combat.maxHp;
        this.enemyBaseMaxHp.set(npc.id, baseMaxHp);
      }
      const prevMax = Math.max(1, npc.combat.maxHp);
      const hpRatio = Math.min(1, Math.max(0, npc.combat.hp / prevMax));
      const nextMax = Math.max(4, Math.round(baseMaxHp * profile.enemyHpMult));
      if (nextMax !== npc.combat.maxHp) {
        npc.combat.maxHp = nextMax;
        if (npc.combat.isAlive) {
          npc.combat.hp = Math.max(1, Math.round(nextMax * hpRatio));
        }
      }
    }
  }

  public override getActorCombatant(actor: ActorEntity): CombatantSnapshot {
    const base = super.getActorCombatant(actor);
    if (!this.activeCustomSceneId) {
      return base;
    }

    if (actor.id === this.player.id) {
      const diffProfile = getDifficultyProfile(getOstrzeDifficulty(this.activeOstrzeState));
      const hitPenalty = getPlayerStatusHitPenaltyPct(
        this.activeOstrzeState,
        this.combatStatusSession
      );
      const mult = this.pendingPlayerAttackMultiplier;
      const feintBonus = this.pendingPlayerFeintActive ? 15 : 0;
      const synergyHitBonus = this.pendingPlayerHitBonusPct;
      const diffHitBonus = diffProfile.playerHitBonusPct;
      const surpriseCritBonus = this.pendingSurpriseAttack ? 15 : 0;
      const synergyCritBonus = this.pendingPlayerCritBonusPct;
      const ostrzeCrit = this.activeOstrzeState?.character
        ? getStats(this.activeOstrzeState, ORIGIN_DATA).derived.critChance
        : null;
      const nextCrit =
        ostrzeCrit !== null
          ? Math.max(
              base.derived.critChancePct,
              Math.min(75, ostrzeCrit + surpriseCritBonus + synergyCritBonus)
            )
          : Math.min(75, base.derived.critChancePct + surpriseCritBonus + synergyCritBonus);
      if (
        hitPenalty <= 0 &&
        mult === 1 &&
        feintBonus === 0 &&
        synergyHitBonus === 0 &&
        diffHitBonus === 0 &&
        nextCrit === base.derived.critChancePct
      ) {
        return base;
      }
      const scaledMin = Math.max(1, Math.round(base.derived.minDamage * mult));
      const scaledMax = Math.max(scaledMin, Math.round(base.derived.maxDamage * mult));
      return {
        ...base,
        derived: {
          ...base.derived,
          minDamage: scaledMin,
          maxDamage: scaledMax,
          critChancePct: nextCrit,
          activeProficiency: Math.min(
            98,
            Math.max(
              10,
              base.derived.activeProficiency - hitPenalty + feintBonus + synergyHitBonus + diffHitBonus
            )
          )
        }
      };
    }

    const diffProfile = getDifficultyProfile(getOstrzeDifficulty(this.activeOstrzeState));
    const originId = resolveEnemyOriginId(actor.id, actor.recipe.name);
    const enemyDef = originId ? ORIGIN_DATA.enemies.find((e) => e.id === originId) : undefined;
    const archetype = resolveEnemyArchetype(originId, enemyDef, actor.combat?.difficulty);
    const primaryAttack = enemyDef?.attacks?.find(
      (a) => Array.isArray(a.damage) && a.damage.length >= 2
    );

    const isBossOrVeryHard =
      actor.combat?.difficulty === 'very_hard' ||
      originId === 'upior_nocy' ||
      originId === 'herszt_zbojcow';

    const rawMinDamage = primaryAttack
      ? Math.max(1, primaryAttack.damage![0])
      : Math.min(base.derived.minDamage, 6);
    const rawMaxDamage = primaryAttack
      ? Math.max(rawMinDamage + 1, primaryAttack.damage![1])
      : Math.max(rawMinDamage + 1, Math.min(base.derived.maxDamage, 10));
    const minDamage = Math.max(1, Math.round(rawMinDamage * diffProfile.enemyDamageMult));
    const maxDamage = Math.max(minDamage + 1, Math.round(rawMaxDamage * diffProfile.enemyDamageMult));

    const critChancePct =
      originId === 'instruktor' ? 5 : isBossOrVeryHard ? 10 : 6;

    const dazed = (actor.combat?.dazedHeadTurns ?? 0) > 0;
    const defending = Boolean(actor.combat?.defending);
    const baseMaxAp =
      (enemyDef?.ap ?? actor.combat?.maxAp ?? 6) + (isBossOrVeryHard ? diffProfile.bossApBonus : 0);
    const maxAp = Math.max(3, baseMaxAp - (dazed ? 2 : 0));

    const activeProficiency = Math.max(
      55,
      Math.min(88, Math.round((primaryAttack?.hit ?? 62) + 12))
    );

    const evasionPct = enemyDef
      ? Math.min(55, Math.max(5, Math.round(enemyDef.defense * 0.9) + (defending ? 20 : 0)))
      : Math.min(40, base.derived.evasionPct);
    const enemyArmor = enemyDef?.armor ?? 0;
    const damageThreshold = enemyDef
      ? Math.max(0, Math.floor(enemyArmor / 2) + (defending ? 2 : 0))
      : Math.min(4, base.derived.damageThreshold);
    const damageResistancePct = enemyDef
      ? Math.min(60, Math.max(0, enemyArmor * 6 + (defending ? 15 : 0)))
      : Math.min(35, base.derived.damageResistancePct);

    const weaponProfile = {
      ...base.derived.weaponProfile,
      minRange: 1,
      maxRange: archetype === 'ranged_kiter' ? 5 : base.derived.weaponProfile.maxRange,
      label: archetype === 'ranged_kiter' ? 'Łuk myśliwski' : base.derived.weaponProfile.label,
      shortLabel: archetype === 'ranged_kiter' ? 'Łuk' : base.derived.weaponProfile.shortLabel,
      baseApCost: Math.max(4, Math.min(base.derived.weaponProfile.baseApCost, 4)),
      armorPenetrationRatio: Math.min(
        base.derived.weaponProfile.armorPenetrationRatio,
        isBossOrVeryHard ? 0.25 : 0.15
      ),
      critBonus: 0
    };

    return {
      ...base,
      perception: 10,
      derived: {
        ...base.derived,
        maxAp,
        evasionPct,
        damageThreshold,
        damageResistancePct,
        minDamage,
        maxDamage,
        critChancePct,
        activeProficiency,
        weaponProfile
      }
    };
  }

  protected override planEnemyCombatMove(
    enemy: ActorEntity,
    eSnap: CombatantSnapshot,
    dist: number
  ): EnemyAiMovePlan | null {
    if (!this.activeCustomSceneId || !enemy.combat) {
      return super.planEnemyCombatMove(enemy, eSnap, dist);
    }

    const ec = enemy.combat;
    const moveApCost = ec.crippledLegsTurns > 0 ? 2 : 1;
    if (ec.ap < moveApCost) return null;

    const originId = resolveEnemyOriginId(enemy.id, enemy.recipe.name);
    const enemyDef = originId ? ORIGIN_DATA.enemies.find((e) => e.id === originId) : undefined;
    const archetype = resolveEnemyArchetype(originId, enemyDef, ec.difficulty);
    const isWalkable = (x: number, y: number) => this.isTileWalkable(x, y, enemy.id);

    if (archetype === 'ranged_kiter') {
      if (dist <= 1.55) {
        const maxKiteSteps = Math.min(3, Math.floor(ec.ap / moveApCost));
        const kiteTile = findBestKiteTile({
          enemyPos: { x: enemy.tileX, y: enemy.tileY },
          playerPos: { x: this.player.tileX, y: this.player.tileY },
          mapWidth: this.map.width,
          mapHeight: this.map.height,
          maxSteps: maxKiteSteps,
          isWalkable
        });
        if (kiteTile) {
          return {
            targetTile: kiteTile,
            maxSteps: maxKiteSteps,
            logMessage: `🏹 ${enemy.recipe.name} odskakuje na dystans!`
          };
        }
        return null;
      }

      if (dist > 5.45) {
        const approachTile = findBestRangedApproachTile({
          enemyPos: { x: enemy.tileX, y: enemy.tileY },
          playerPos: { x: this.player.tileX, y: this.player.tileY },
          mapWidth: this.map.width,
          mapHeight: this.map.height,
          isWalkable
        });
        if (approachTile) {
          return { targetTile: approachTile };
        }
      }
      return null;
    }

    const maxRange = eSnap.derived.weaponProfile.maxRange;
    if (dist > maxRange + 0.45) {
      const allyPositions = this.npcs
        .filter((n) => n.id !== enemy.id && n.combat?.isHostile && n.combat.isAlive)
        .map((n) => ({ x: n.tileX, y: n.tileY }));
      const flankTile = findBestFlankAdjacentTile({
        enemyPos: { x: enemy.tileX, y: enemy.tileY },
        playerPos: { x: this.player.tileX, y: this.player.tileY },
        allyPositions,
        mapWidth: this.map.width,
        mapHeight: this.map.height,
        isWalkable
      });
      if (flankTile) {
        return { targetTile: flankTile };
      }
      return super.planEnemyCombatMove(enemy, eSnap, dist);
    }

    return null;
  }

  protected override chooseEnemyCombatAttack(
    enemy: ActorEntity,
    eSnap: CombatantSnapshot,
    playerSnap: CombatantSnapshot,
    dist: number,
    attacksThisTurn: number
  ): EnemyAiAttackDecision {
    if (!this.activeCustomSceneId || !enemy.combat) {
      return super.chooseEnemyCombatAttack(enemy, eSnap, playerSnap, dist, attacksThisTurn);
    }

    const ec = enemy.combat;
    const originId = resolveEnemyOriginId(enemy.id, enemy.recipe.name);
    const enemyDef = originId ? ORIGIN_DATA.enemies.find((e) => e.id === originId) : undefined;
    const archetype = resolveEnemyArchetype(originId, enemyDef, ec.difficulty);
    const tier = resolveEnemyTacticalTier(this.activeCustomSceneId, originId, ec.difficulty);
    const budget = TACTICAL_BUDGETS[tier];

    if (attacksThisTurn >= budget.maxAttacksPerTurn) {
      return { kind: 'stop' };
    }

    if (
      shouldCautiousEnemyHoldForGuard({
        archetype,
        hp: ec.hp,
        maxHp: ec.maxHp,
        ap: ec.ap,
        attacksThisTurn
      })
    ) {
      return { kind: 'stop' };
    }

    // Handle pending telegraphed boss intent on first action of the turn
    if (attacksThisTurn === 0 && this.combatAiSession.telegraphedIntentByEnemy[enemy.id]) {
      const intent = this.combatAiSession.telegraphedIntentByEnemy[enemy.id]!;
      delete this.combatAiSession.telegraphedIntentByEnemy[enemy.id];

      if (ec.dazedHeadTurns > 0) {
        this.addCombatLog(`💫 Atak specjalny ${enemy.recipe.name} został przerwany przez ogłuszenie!`);
        this.pushFloatingCombatText(
          enemy.x,
          enemy.y,
          enemy.z + 2.0,
          '💫 PRZERWANO!',
          0xffca28
        );
      } else if (intent === 'terror_howl' && ec.ap >= 4) {
        return {
          kind: 'special',
          apCost: 4,
          execute: (rng) => {
            this.addCombatLog(`👻 ${enemy.recipe.name} wydaje mrożące krew w żyłach Wycie!`);
            this.pushFloatingCombatText(
              enemy.x,
              enemy.y,
              enemy.z + 2.0,
              '👻 WYCIE!',
              0xce93d8
            );
            const res = tryApplyPlayerCombatStatus({
              state: this.activeOstrzeState,
              session: this.combatStatusSession,
              statusId: 'strach',
              chancePct: 75,
              currentRound: this.combatState.round,
              allowStatusEffects: true,
              sourceName: enemy.recipe.name,
              rng
            });
            if (res.applied && res.logMessage) {
              this.addCombatLog(res.logMessage);
              if (res.floatingText) {
                this.pushFloatingCombatText(
                  this.player.x,
                  this.player.y,
                  this.player.z + 2.05,
                  res.floatingText,
                  res.floatingColorHex ?? 0xce93d8
                );
              }
            } else {
              this.addCombatLog('🛡️ Oparłeś się grozie Wycia!');
            }
          }
        };
      } else if (intent === 'heavy_cleave' && dist <= eSnap.derived.weaponProfile.maxRange + 0.45 && ec.ap >= 4) {
        const scale = playerSnap.combat.defending ? 0.65 : 1.25;
        if (playerSnap.combat.defending) {
          this.addCombatLog('🛡️ Twoja Garda amortyzuje telegrafowany zamach bossa!');
        }
        return {
          kind: 'attack',
          mode: 'power',
          apCostOverride: 4,
          damageRangeOverride: [
            Math.max(2, Math.round(eSnap.derived.minDamage * scale)),
            Math.max(4, Math.round(eSnap.derived.maxDamage * scale))
          ],
          labelOverride: 'Telegrafowany Zamach'
        };
      }
    }

    // Ranged kiter cornered in melee falls back to weaker knife strike
    if (archetype === 'ranged_kiter' && dist <= 1.55) {
      if (ec.ap >= 3) {
        return {
          kind: 'attack',
          mode: 'quick',
          apCostOverride: 3,
          damageRangeOverride: [2, 4],
          labelOverride: 'Nóż (zwarcie)'
        };
      }
      return { kind: 'stop' };
    }

    const maxRange = eSnap.derived.weaponProfile.maxRange;
    const baseAttackAp = eSnap.derived.weaponProfile.baseApCost;
    if (dist > maxRange + 0.45 || ec.ap < baseAttackAp) {
      return { kind: 'stop' };
    }

    let mode: CombatAttackMode = 'quick';
    if (budget.allowPowerOrTorso && playerSnap.combat.defending && ec.ap >= baseAttackAp + 1) {
      mode = archetype === 'boss' ? 'power' : 'aimed_torso';
    }

    return {
      kind: 'attack',
      mode,
      labelOverride: archetype === 'ranged_kiter' ? 'Strzał z łuku' : undefined
    };
  }

  protected override onEnemyCombatTurnEnded(enemy: ActorEntity, attacksThisTurn: number): void {
    if (!this.activeCustomSceneId || !enemy.combat) {
      super.onEnemyCombatTurnEnded(enemy, attacksThisTurn);
      return;
    }

    const ec = enemy.combat;
    const originId = resolveEnemyOriginId(enemy.id, enemy.recipe.name);
    const enemyDef = originId ? ORIGIN_DATA.enemies.find((e) => e.id === originId) : undefined;
    const archetype = resolveEnemyArchetype(originId, enemyDef, ec.difficulty);
    const tier = resolveEnemyTacticalTier(this.activeCustomSceneId, originId, ec.difficulty);

    const willGuard = ec.ap >= 2;
    const lowHp = ec.maxHp > 0 && ec.hp / ec.maxHp < 0.4;
    super.onEnemyCombatTurnEnded(enemy, attacksThisTurn);

    this.tickEnemyBurn(enemy);
    if (!ec.isAlive || !this.combatState.active) {
      return;
    }
    this.tickEnemyBleed(enemy);
    if (!ec.isAlive || !this.combatState.active) {
      return;
    }

    if (willGuard && ec.defending && (archetype === 'melee_cautious' || lowHp)) {
      this.addCombatLog(`🛡️ ${enemy.recipe.name} przechodzi w gardę (+20% Unik, +15% DR).`);
      this.pushFloatingCombatText(enemy.x, enemy.y, enemy.z + 1.9, '🛡️ GARDA', 0x4da6ff);
    }

    const telegraph = pickBossTelegraphIntent({
      enemyId: enemy.id,
      originId,
      archetype,
      tier,
      dazedHeadTurns: ec.dazedHeadTurns,
      currentRound: this.combatState.round,
      session: this.combatAiSession
    });
    if (telegraph) {
      this.addCombatLog(telegraph.logMessage);
      this.pushFloatingCombatText(
        enemy.x,
        enemy.y,
        enemy.z + 2.1,
        telegraph.floatingText,
        0xffca28
      );
    }
  }

  protected override onPlayerCombatTurnStarted(): void {
    if (!this.activeCustomSceneId || !this.player.combat) return;

    const summary = tickPlayerCombatStatuses({
      state: this.activeOstrzeState,
      session: this.combatStatusSession,
      currentRound: this.combatState.round
    });

    for (const log of summary.logs) {
      this.addCombatLog(log);
    }
    for (const ft of summary.floatingTexts) {
      this.pushFloatingCombatText(
        this.player.x,
        this.player.y,
        this.player.z + 2.0,
        ft.text,
        ft.colorHex
      );
    }

    if (summary.apPenalty > 0) {
      this.player.combat.ap = Math.max(1, this.player.combat.ap - summary.apPenalty);
    }
    if (summary.totalDamage > 0) {
      this.player.combat.hp = Math.max(0, this.player.combat.hp - summary.totalDamage);
      if (this.activeOstrzeState?.character) {
        this.activeOstrzeState.character.hp = this.player.combat.hp;
      }
      if (this.player.combat.hp <= 0) {
        this.handlePlayerDefeated();
      }
    }
  }

  public override performPlayerCombatAttack(
    targetId: string,
    mode?: CombatAttackMode,
    rng?: () => number
  ) {
    if (!this.activeCustomSceneId) {
      return super.performPlayerCombatAttack(targetId, mode, rng);
    }

    const enemy = this.npcs.find((n) => n.id === targetId);
    const originId = enemy ? resolveEnemyOriginId(enemy.id, enemy.recipe.name) : null;
    recordBestiaryEncounter(this.activeOstrzeState, originId);
    const hunterBonus = getHunterLoreBonusDamage(this.activeOstrzeState, originId);
    const damageType = resolvePlayerWeaponDamageType(this.activeOstrzeState, ORIGIN_DATA);
    const mult = getEnemyDamageMultiplier(originId, damageType, ORIGIN_DATA);

    const hasFeint = Boolean(
      this.activeOstrzeState?.character?.perks.includes('finta') &&
        this.feintUsedRound !== this.combatState.round
    );
    const guardBreak = evaluateGuardBreak({
      targetDefending: Boolean(enemy?.combat?.defending),
      attackMode: mode,
      isFeint: hasFeint
    });
    if (hasFeint && enemy?.combat) {
      this.feintUsedRound = this.combatState.round;
      this.pendingPlayerFeintActive = true;
      this.addCombatLog(
        guardBreak.triggered
          ? `⚔️ Mistrz finty! Zmyłka przełamuje gardę ${enemy.recipe.name} (+15% trafienia).`
          : `⚔️ Mistrz finty! Pierwszy cios w rundzie (+15% trafienia).`
      );
    }
    if (guardBreak.triggered && enemy?.combat) {
      enemy.combat.defending = false;
    }

    const isMelee = this.isPlayerEquippedMelee();
    const synergies = enemy?.combat
      ? evaluateStatusSynergies({
          targetBleeding: this.getEnemyBleedTurns(enemy.id) > 0,
          targetBurning: this.getEnemyBurnTurns(enemy.id) > 0,
          targetDazedOrCrippled:
            (enemy.combat.dazedHeadTurns ?? 0) > 0 || (enemy.combat.crippledLegsTurns ?? 0) > 0,
          isMeleeAttack: isMelee,
          isHeavyOrManeuver: mode === 'power'
        })
      : {
          damageMultiplier: 1,
          hitBonusPct: 0,
          critBonusPct: 0,
          bonusFireDamage: 0,
          extraBurnTurns: 0,
          tags: []
        };

    const isSurprise = this.pendingSurpriseAttack;
    if (isSurprise && enemy) {
      this.addCombatLog(
        `⚡ ATAK Z ZASKOCZENIA na ${enemy.recipe.name}! (+20% obrażeń, +15% szansy na kryta)`
      );
      this.pushFloatingCombatText(
        enemy.x,
        enemy.y,
        enemy.z + 2.35,
        '⚡ Z ZASKOCZENIA!',
        0xffd54f
      );
    }

    this.pendingPlayerAttackMultiplier =
      mult *
      (isSurprise ? 1.2 : 1) *
      guardBreak.damageMultiplier *
      synergies.damageMultiplier;
    this.pendingPlayerHitBonusPct = synergies.hitBonusPct;
    this.pendingPlayerCritBonusPct = synergies.critBonusPct;
    let outcome;
    try {
      outcome = super.performPlayerCombatAttack(targetId, mode, rng);
    } finally {
      this.pendingPlayerAttackMultiplier = 1;
      this.pendingPlayerHitBonusPct = 0;
      this.pendingPlayerCritBonusPct = 0;
      this.pendingPlayerFeintActive = false;
      this.pendingSurpriseAttack = false;
    }

    if (outcome?.hit && enemy?.combat) {
      if (guardBreak.triggered) {
        enemy.combat.ap = Math.max(0, enemy.combat.ap - guardBreak.apPenalty);
        ostrzeAudio.playGuardBreak();
        this.addCombatLog(
          `💥 PRZEŁAMANIE GARDY na ${enemy.recipe.name}! (+25% obr., -${guardBreak.apPenalty} AP)`
        );
        this.pushFloatingCombatText(
          enemy.x,
          enemy.y,
          enemy.z + 2.45,
          '💥 PRZEŁAMANIE GARDY!',
          0xf59e0b
        );
      }

      if (synergies.tags.length > 0) {
        ostrzeAudio.playSynergyProc();
      }

      if (synergies.bonusFireDamage > 0 && enemy.combat.isAlive) {
        enemy.combat.hp = Math.max(0, enemy.combat.hp - synergies.bonusFireDamage);
        outcome.damageDealt += synergies.bonusFireDamage;
        if (synergies.extraBurnTurns > 0) {
          this.applyEnemyBurn(
            enemy.id,
            this.getEnemyBurnTurns(enemy.id) + synergies.extraBurnTurns
          );
        }
        if (enemy.combat.hp <= 0) {
          enemy.combat.isAlive = false;
        }
      }

      if (synergies.tags.length > 0) {
        const tagSummary = synergies.tags.join(' • ');
        this.addCombatLog(`✨ SYNERGIA (${enemy.recipe.name}): ${tagSummary}`);
        this.pushFloatingCombatText(
          enemy.x,
          enemy.y,
          enemy.z + 2.55,
          synergies.tags[0],
          0xfb923c
        );
      }

      if (outcome.critical && isMelee && enemy.combat.isAlive) {
        this.applyEnemyBleed(enemy.id, 2);
      }

      if (hunterBonus > 0 && enemy.combat.isAlive) {
        enemy.combat.hp = Math.max(0, enemy.combat.hp - hunterBonus);
        outcome.damageDealt += hunterBonus;
        if (enemy.combat.hp <= 0) {
          enemy.combat.isAlive = false;
        }
      }
      this.checkAndRecordEnemyKill(enemy, originId);
    }

    if (outcome?.hit && (outcome.critical || isSurprise || guardBreak.triggered)) {
      this.onJuicyImpact?.(true);
    }

    if (outcome?.hit && enemy && mult !== 1) {
      const label = getDamageTypeLabel(damageType);
      if (mult < 1) {
        const pct = Math.round((1 - mult) * 100);
        this.addCombatLog(`🛡️ Odporność ${enemy.recipe.name} na ${label} (-${pct}% obr.).`);
        this.pushFloatingCombatText(
          enemy.x,
          enemy.y,
          enemy.z + 2.15,
          `🛡️ ODPORNOŚĆ (${label})`,
          0x90caf9
        );
      } else {
        const pct = Math.round((mult - 1) * 100);
        this.addCombatLog(`🔥 Podatność ${enemy.recipe.name} na ${label} (+${pct}% obr.)!`);
        this.pushFloatingCombatText(
          enemy.x,
          enemy.y,
          enemy.z + 2.15,
          `🔥 PODATNOŚĆ (+${pct}%)!`,
          0xffab40
        );
      }
    }

    return outcome;
  }

  public getActorCoverInfo(actor: ActorEntity): TacticalCoverInfo {
    return computeActorTacticalCover(
      actor.tileX,
      actor.tileY,
      this.map.props,
      this.detonatedOilBarrelIds
    );
  }

  public getWeaponManeuverState(targetId?: string | null): {
    maneuver: WeaponManeuverDef;
    cooldownLeft: number;
    canUse: boolean;
    reason: string | null;
  } {
    const maneuver = resolveActiveWeaponManeuver(this.activeOstrzeState, ORIGIN_DATA);
    const cooldownLeft = Math.max(0, this.maneuverCooldownUntilRound - this.combatState.round);
    const pCombat = this.player.combat;
    if (!this.combatState.active || !pCombat || !pCombat.isAlive) {
      return { maneuver, cooldownLeft, canUse: false, reason: 'Tylko w walce' };
    }
    if (cooldownLeft > 0) {
      return { maneuver, cooldownLeft, canUse: false, reason: `Odnowienie: ${cooldownLeft} t.` };
    }
    if (pCombat.ap < maneuver.apCost) {
      return { maneuver, cooldownLeft: 0, canUse: false, reason: `Wymaga ${maneuver.apCost} AP` };
    }
    const target = this.npcs.find(
      (n) => n.id === (targetId ?? this.combatState.selectedTargetId) && n.combat?.isHostile && n.combat.isAlive
    );
    if (!target) {
      return { maneuver, cooldownLeft: 0, canUse: false, reason: 'Wybierz cel' };
    }
    const dist = Math.hypot(target.tileX - this.player.tileX, target.tileY - this.player.tileY);
    if (dist > maneuver.rangeTiles) {
      return { maneuver, cooldownLeft: 0, canUse: false, reason: 'Cel poza zasięgiem' };
    }
    return { maneuver, cooldownLeft: 0, canUse: true, reason: null };
  }

  public performPlayerWeaponManeuver(
    targetId?: string | null,
    rng: () => number = Math.random
  ): { ok: boolean; damage: number; secondaryDamage: number; message: string } {
    const target = this.npcs.find(
      (n) => n.id === (targetId ?? this.combatState.selectedTargetId) && n.combat?.isHostile && n.combat.isAlive
    );
    const st = this.getWeaponManeuverState(target?.id ?? null);
    if (!st.canUse || !target || !target.combat || !this.player.combat) {
      return { ok: false, damage: 0, secondaryDamage: 0, message: st.reason ?? 'Manewr niedostępny' };
    }

    const { maneuver } = st;
    const pCombat = this.player.combat;
    pCombat.ap = Math.max(0, pCombat.ap - maneuver.apCost);
    this.maneuverCooldownUntilRound = this.combatState.round + maneuver.cooldownRounds;

    const weaponId = this.activeOstrzeState?.inventory?.equipped?.bron;
    const weapon = weaponId ? ORIGIN_DATA.items.find((it) => it.id === weaponId) : undefined;
    const baseMin = weapon?.damage?.[0] ?? 4;
    const baseMax = weapon?.damage?.[1] ?? 7;
    const rawRoll = baseMin + Math.floor(rng() * Math.max(1, baseMax - baseMin + 1));
    const damageType = resolvePlayerWeaponDamageType(this.activeOstrzeState, ORIGIN_DATA);
    const originId = resolveEnemyOriginId(target.id, target.recipe.name);
    recordBestiaryEncounter(this.activeOstrzeState, originId);
    const hunterBonus = getHunterLoreBonusDamage(this.activeOstrzeState, originId);
    const mult = getEnemyDamageMultiplier(originId, damageType, ORIGIN_DATA);
    const targetCover = this.getActorCoverInfo(target);
    const isRangedManeuver = maneuver.id === 'strzal_w_sciegno' || maneuver.id === 'huk_zaporowy';
    const coverMult = isRangedManeuver && targetCover.hasCover ? 0.85 : 1;
    const guardBreak = evaluateGuardBreak({
      targetDefending: Boolean(target.combat.defending),
      isWeaponManeuver: true
    });
    if (guardBreak.triggered) {
      target.combat.defending = false;
      target.combat.ap = Math.max(0, target.combat.ap - guardBreak.apPenalty);
      ostrzeAudio.playGuardBreak();
    }
    const synergies = evaluateStatusSynergies({
      targetBleeding: this.getEnemyBleedTurns(target.id) > 0,
      targetBurning: this.getEnemyBurnTurns(target.id) > 0,
      targetDazedOrCrippled:
        (target.combat.dazedHeadTurns ?? 0) > 0 || (target.combat.crippledLegsTurns ?? 0) > 0,
      isMeleeAttack: !isRangedManeuver,
      isHeavyOrManeuver: true
    });
    if (synergies.tags.length > 0) {
      ostrzeAudio.playSynergyProc();
    }
    const finalDmg =
      Math.max(
        1,
        Math.round(
          rawRoll *
            maneuver.damageMultiplier *
            mult *
            coverMult *
            guardBreak.damageMultiplier *
            synergies.damageMultiplier
        ) + hunterBonus
      ) + synergies.bonusFireDamage;

    if (synergies.extraBurnTurns > 0) {
      this.applyEnemyBurn(target.id, this.getEnemyBurnTurns(target.id) + synergies.extraBurnTurns);
    }

    target.combat.hp = Math.max(0, target.combat.hp - finalDmg);
    if (target.combat.hp <= 0) {
      target.combat.isAlive = false;
    }
    this.checkAndRecordEnemyKill(target, originId);

    let secondaryDamage = 0;
    let extraNote = '';

    if (maneuver.id === 'ciecie_lukiem') {
      // Bleed on primary + cleave 1 adjacent living hostile
      this.applyEnemyBleed(target.id, 2);
      const secondary = this.npcs.find(
        (n) =>
          n.id !== target.id &&
          n.combat?.isHostile &&
          n.combat.isAlive &&
          Math.hypot(n.tileX - this.player.tileX, n.tileY - this.player.tileY) <= 1.9
      );
      if (secondary && secondary.combat) {
        secondaryDamage = Math.max(1, Math.round(finalDmg * 0.7));
        secondary.combat.hp = Math.max(0, secondary.combat.hp - secondaryDamage);
        if (secondary.combat.hp <= 0) secondary.combat.isAlive = false;
        this.pushFloatingCombatText(
          secondary.x,
          secondary.y,
          secondary.z + 2.1,
          `-${secondaryDamage} ⚔️`,
          0xff8a65
        );
        extraNote = ` + cięcie w ${secondary.recipe.name} (-${secondaryDamage})`;
      } else {
        extraNote = ' + Krwawienie!';
      }
    } else if (maneuver.id === 'pchniecie_zaporowe') {
      target.combat.ap = Math.max(0, target.combat.ap - 1);
      if (target.combat.isAlive) {
        const kb = computeKnockbackTile(
          this.player.tileX,
          this.player.tileY,
          target.tileX,
          target.tileY,
          (tx, ty) => {
            if (tx <= 0 || ty <= 0 || tx >= this.map.width - 1 || ty >= this.map.height - 1) return false;
            const cell = this.map.tiles[ty]?.[tx];
            if (!cell || !cell.walkable) return false;
            const occupied =
              (this.player.tileX === tx && this.player.tileY === ty) ||
              this.npcs.some((n) => n.combat?.isAlive !== false && n.tileX === tx && n.tileY === ty);
            if (occupied) return false;
            return !this.map.props.some(
              (p) =>
                p.blocksMovement &&
                !this.detonatedOilBarrelIds.has(p.id) &&
                tx >= p.x &&
                tx < p.x + Math.max(1, p.sizeX) &&
                ty >= p.y &&
                ty < p.y + Math.max(1, p.sizeY)
            );
          }
        );
        if (kb) {
          target.tileX = kb.x;
          target.tileY = kb.y;
          target.x = kb.x + 0.5;
          target.y = kb.y + 0.5;
          extraNote = ' (odepchnięty, -1 AP)';
        } else {
          extraNote = ' (-1 AP)';
        }
      }
    } else if (maneuver.id === 'strzal_w_sciegno') {
      target.combat.crippledLegsTurns = Math.max(target.combat.crippledLegsTurns, 2);
      extraNote = ' (Okaleczenie nóg 2 t.)';
    } else if (maneuver.id === 'huk_zaporowy') {
      target.combat.ap = Math.max(0, target.combat.ap - 1);
      target.combat.dazedHeadTurns = Math.max(target.combat.dazedHeadTurns, 1);
      extraNote = ' (Strach i Oszołomienie!)';
    } else {
      target.combat.ap = Math.max(0, target.combat.ap - 1);
      extraNote = ' (-1 AP)';
    }

    this.onJuicyImpact?.(true);
    if (guardBreak.triggered) {
      this.pushFloatingCombatText(
        target.x,
        target.y,
        target.z + 2.55,
        '💥 PRZEŁAMANIE GARDY!',
        0xf59e0b
      );
      extraNote += ' + Przełamanie Gardy!';
    }
    if (synergies.tags.length > 0) {
      this.pushFloatingCombatText(
        target.x,
        target.y,
        target.z + 2.75,
        synergies.tags[0],
        0xfb923c
      );
      extraNote += ` + ${synergies.tags.join(', ')}`;
    }
    this.pushFloatingCombatText(
      target.x,
      target.y,
      target.z + 2.3,
      `${maneuver.icon} -${finalDmg}`,
      0xffd54f
    );
    const msg = `${maneuver.icon} ${maneuver.name} w ${target.recipe.name}: -${finalDmg} HP${extraNote}`;
    this.addCombatLog(msg);

    // Check if all enemies died
    const anyAlive = this.npcs.some((n) => n.combat?.isHostile && n.combat.isAlive);
    if (!anyAlive) {
      this.combatState.active = false;
      this.resetCombatTacticalSessions();
      this.onCombatEnded?.('victory');
    }

    return { ok: true, damage: finalDmg, secondaryDamage, message: msg };
  }

  public findNearbyOilBarrel() {
    if (!this.combatState.active) return null;
    const weaponId = this.activeOstrzeState?.inventory?.equipped?.bron;
    const weapon = weaponId ? ORIGIN_DATA.items.find((it) => it.id === weaponId) : undefined;
    const isRanged = weapon?.skill === 'strzelecka' || weapon?.skill === 'proch';
    const maxRange = isRanged ? 5.0 : 2.8;
    return findDetonatableOilBarrel(
      this.player.tileX,
      this.player.tileY,
      this.map.props,
      this.detonatedOilBarrelIds,
      maxRange
    );
  }

  public detonateOilBarrel(
    barrelId?: string,
    rng: () => number = Math.random
  ): { ok: boolean; hitCount: number; totalDamage: number; message: string } {
    if (!this.combatState.active || !this.player.combat || !this.player.combat.isAlive) {
      return { ok: false, hitCount: 0, totalDamage: 0, message: 'Tylko podczas walki.' };
    }
    if (this.player.combat.ap < OIL_BARREL_AP_COST) {
      return { ok: false, hitCount: 0, totalDamage: 0, message: `Wymaga ${OIL_BARREL_AP_COST} AP.` };
    }
    const barrel = barrelId
      ? this.map.props.find((p) => p.id === barrelId && !this.detonatedOilBarrelIds.has(p.id))
      : this.findNearbyOilBarrel();
    if (!barrel) {
      return { ok: false, hitCount: 0, totalDamage: 0, message: 'Brak beczki ze smołą w zasięgu.' };
    }

    this.player.combat.ap = Math.max(0, this.player.combat.ap - OIL_BARREL_AP_COST);
    this.detonatedOilBarrelIds.add(barrel.id);
    const idx = this.map.props.findIndex((p) => p.id === barrel.id);
    if (idx >= 0) {
      this.map.props.splice(idx, 1);
    }

    let hitCount = 0;
    let totalDamage = 0;
    for (const enemy of this.npcs) {
      if (!enemy.combat?.isHostile || !enemy.combat.isAlive) continue;
      const d = Math.hypot(enemy.tileX - barrel.x, enemy.tileY - barrel.y);
      if (d > OIL_BARREL_BLAST_RADIUS) continue;
      const baseRoll = 10 + Math.floor(rng() * 5);
      const originId = resolveEnemyOriginId(enemy.id, enemy.recipe.name);
      const fireMult = getEnemyDamageMultiplier(originId, 'ogien', ORIGIN_DATA);
      const dmg = Math.max(1, Math.round(baseRoll * fireMult));
      enemy.combat.hp = Math.max(0, enemy.combat.hp - dmg);
      if (enemy.combat.hp <= 0) {
        enemy.combat.isAlive = false;
      } else {
        this.applyEnemyBurn(enemy.id, 2);
      }
      this.checkAndRecordEnemyKill(enemy, originId);
      hitCount += 1;
      totalDamage += dmg;
      this.pushFloatingCombatText(
        enemy.x,
        enemy.y,
        enemy.z + 2.25,
        `🔥 -${dmg}${fireMult > 1 ? ' (×2!)' : ''}`,
        0xff7043
      );
    }

    this.onJuicyImpact?.(true);
    this.pushFloatingCombatText(barrel.x + 0.5, barrel.y + 0.5, barrel.z + 1.8, '💥 BUM!', 0xffab40);
    const msg =
      hitCount > 0
        ? `🛢️ Wybuch beczki ze smołą! Trafiono ${hitCount} wrogów (-${totalDamage} HP ognia + Podpalenie).`
        : `🛢️ Beczka ze smołą eksplodowała ogniem (nikt nie był w polu rażenia).`;
    this.addCombatLog(msg);

    const anyAlive = this.npcs.some((n) => n.combat?.isHostile && n.combat.isAlive);
    if (!anyAlive) {
      this.combatState.active = false;
      this.resetCombatTacticalSessions();
      this.onCombatEnded?.('victory');
    }

    return { ok: true, hitCount, totalDamage, message: msg };
  }

  private checkAndRecordEnemyKill(enemy: ActorEntity, originId: string | null): void {
    if (!enemy.combat || enemy.combat.isAlive) return;
    if (this.countedBestiaryKillActorIds.has(enemy.id)) return;
    this.countedBestiaryKillActorIds.add(enemy.id);
    const res = recordBestiaryKill(this.activeOstrzeState, originId);
    if (res.justUnlockedHunterLore) {
      this.addCombatLog(
        `🎯 Wiedza Łowiecka odblokowana (${enemy.recipe.name}): stałe +1 obrażeń przeciwko temu gatunkowi!`
      );
    }
  }

  protected override handlePlayerDefeated(): void {
    if (!this.activeCustomSceneId) {
      super.handlePlayerDefeated();
      return;
    }

    this.isSequentialEnemyTurnActive = false;
    this.combatState.active = false;
    this.combatState.activeTurnActorId = null;
    this.combatState.selectedTargetId = null;

    if (this.player.combat) {
      this.player.combat.hp = 0;
      this.player.combat.isAlive = false;
      this.player.combat.defending = false;
      this.player.combat.dazedHeadTurns = 0;
      this.player.combat.crippledLegsTurns = 0;
    }

    for (const npc of this.npcs) {
      npc.path = [];
      npc.isMoving = false;
      npc.aggroCooldownTimer = 5.0;
    }

    if (this.activeCombatReportId && this.combatReports[this.activeCombatReportId]) {
      this.combatReports[this.activeCombatReportId].outcome = 'defeat';
    }
    this.addCombatLog('💀 Zostałeś powalony w walce!');
    this.addLog(
      '📜 Raport z walki: Porażka w starciu.',
      'critical',
      this.activeCombatReportId ?? undefined
    );
  }

  public override loadMap(mapId: MapId): void {
    this.activeCustomSceneId = null;
    super.loadMap(mapId);
  }
}
