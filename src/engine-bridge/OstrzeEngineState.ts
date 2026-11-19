import { FovGridState } from '@ulf/core/fov';
import { IsometricWorldMap, MapId } from '@ulf/core/worldMap';
import { DIALOGUE_TREES, DialogueNode } from '@ulf/rpg/dialogueSystem';
import { ActorEntity, CrpgGameState, LogSeverity } from '@ulf/rpg/gameLoop';
import type { OriginGameData, OstrzeGameState } from '../game/data/originTypes';
import { ComputedStats, getStats } from '../game/rules/stats';

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
  public onSceneLoaded?: (sceneId: string) => void;
  private readonly persistentMarkers = new Map<string, string>();

  constructor() {
    super('forest_clearing');
    this.chronicleEntries.length = 0;
    this.logs.length = 0;
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

    // Let base engine reset all internal combat/dialogue state cleanly first,
    // without polluting Ostrze's Chronicle with the default engine map welcome entry.
    const prevChronicleHeadId = this.chronicleEntries[0]?.id ?? null;
    const prevLogsLength = this.logs.length;
    super.loadMap('forest_clearing');
    while (
      this.chronicleEntries.length > 0 &&
      this.chronicleEntries[0].id !== prevChronicleHeadId
    ) {
      this.chronicleEntries.shift();
    }
    while (this.logs.length > prevLogsLength) {
      this.logs.shift();
    }

    this.persistentMarkers.clear();
    this.wasCombatActive = false;
    this.activeCustomSceneId = sceneId;
    this.map = scene.map;
    this.fov = new FovGridState(this.map.width, this.map.height);
    this.rebuildPropGrid();
    this.bumpMapRevision();
    this.npcs.length = 0;

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

    if (scene.introLog) {
      this.addLog(scene.introLog, scene.introSeverity ?? 'important');
    }

    this.recomputeFov();
    this.onSceneLoaded?.(sceneId);
    return true;
  }

  public override loadMap(mapId: MapId): void {
    this.activeCustomSceneId = null;
    super.loadMap(mapId);
  }
}
