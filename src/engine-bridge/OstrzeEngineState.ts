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
  private readonly persistentMarkers = new Map<string, string>();
  private activeOstrzeState: OstrzeGameState | null = null;
  private combatAiSession = createCombatAiSessionState();
  private combatStatusSession = createCombatStatusSessionState();
  private pendingPlayerAttackMultiplier = 1;

  constructor() {
    ensureOstrzeEngineExtensionsRegistered();
    super('forest_clearing');
    this.chronicleEntries.length = 0;
    this.logs.length = 0;
    this.addCombatAttackListener((event) => {
      if (!this.activeCustomSceneId) return;
      if (event.target.id !== this.player.id || !event.outcome.hit) return;
      this.handleEnemyHitStatusEffects(event.attacker);
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
    const effects = primaryAttack?.effects ?? [];
    for (const eff of effects) {
      const mappedStatusId =
        originId === 'zmija_lesna' && eff.id === 'krwawienie' ? 'zatrucie' : eff.id;
      const res = tryApplyPlayerCombatStatus({
        state: this.activeOstrzeState,
        session: this.combatStatusSession,
        statusId: mappedStatusId,
        chancePct: eff.chance,
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
        this.player.combat.customDamageBonus = Math.max(0, Math.floor((s.attributes.sila - 5) / 2));
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
    return true;
  }

  public override getActorCombatant(actor: ActorEntity): CombatantSnapshot {
    const base = super.getActorCombatant(actor);
    if (!this.activeCustomSceneId) {
      return base;
    }

    if (actor.id === this.player.id) {
      const hitPenalty = getPlayerStatusHitPenaltyPct(
        this.activeOstrzeState,
        this.combatStatusSession
      );
      const mult = this.pendingPlayerAttackMultiplier;
      if (hitPenalty <= 0 && mult === 1) {
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
          activeProficiency: Math.max(10, base.derived.activeProficiency - hitPenalty)
        }
      };
    }

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

    const minDamage = primaryAttack
      ? Math.max(1, primaryAttack.damage![0])
      : Math.min(base.derived.minDamage, 6);
    const maxDamage = primaryAttack
      ? Math.max(minDamage + 1, primaryAttack.damage![1])
      : Math.max(minDamage + 1, Math.min(base.derived.maxDamage, 10));

    const critChancePct =
      originId === 'instruktor' ? 5 : isBossOrVeryHard ? 10 : 6;

    const dazed = (actor.combat?.dazedHeadTurns ?? 0) > 0;
    const defending = Boolean(actor.combat?.defending);
    const baseMaxAp = enemyDef?.ap ?? actor.combat?.maxAp ?? 6;
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
    const damageType = resolvePlayerWeaponDamageType(this.activeOstrzeState, ORIGIN_DATA);
    const mult = getEnemyDamageMultiplier(originId, damageType, ORIGIN_DATA);

    this.pendingPlayerAttackMultiplier = mult;
    let outcome;
    try {
      outcome = super.performPlayerCombatAttack(targetId, mode, rng);
    } finally {
      this.pendingPlayerAttackMultiplier = 1;
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
