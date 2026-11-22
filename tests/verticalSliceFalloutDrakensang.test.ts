import { describe, expect, it, vi } from 'vitest';
import { resolveCustomPropSprite } from '@ulf/renderer/isoSceneView';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { PAINTERLY_PROP_SPECS } from '../src/game/assets/painterlyProps';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createBrzezinaYardScene } from '../src/game/maps/prologueMaps';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';

describe('Drakensang × Fallout Vertical Slice (Brzezina + Trakt)', () => {
  it('registers painterly 2.5D prop sprites for Brzezina and Trakt landmarks', () => {
    const engine = new OstrzeEngineState();
    expect(engine.enemyCombatMoveSpeed).toBeGreaterThan(4);
    expect(PAINTERLY_PROP_SPECS.length).toBeGreaterThanOrEqual(6);

    expect(resolveCustomPropSprite({ id: 'brzezina_dwor_szkoly', kind: 'slavic_cottage' })?.url).toContain(
      'brzezina_dwor'
    );
    expect(resolveCustomPropSprite({ id: 'brzezina_zbrojownia_szkoly', kind: 'slavic_cottage' })?.url).toContain(
      'brzezina_kuznia'
    );
    expect(resolveCustomPropSprite({ id: 'brzezina_baszta_szkoly', kind: 'watchtower' })?.url).toContain(
      'brzezina_brama'
    );
    expect(resolveCustomPropSprite({ id: 'brzezina_kapliczka', kind: 'slavic_shrine' })?.url).toContain(
      'trakt_kapliczka'
    );
    expect(resolveCustomPropSprite({ id: 'trakt_woz_rozbity', kind: 'dungeon_crate' })?.url).toContain(
      'trakt_woz'
    );
    expect(resolveCustomPropSprite({ id: 'brzezina_dab', kind: 'ancient_oak' })?.url).toContain(
      'drzewo_brzoza'
    );
  });

  it('opens combat with a Surprise Attack bonus from real-time exploration while protecting Prologue allies', () => {
    const state = createEmptyOstrzeState(ORIGIN_DATA, 33);
    createCharacter(
      state,
      {
        name: 'Mściwój',
        classId: 'miecz',
        attributes: {
          sila: 7,
          zrecznosc: 6,
          krzepa: 7,
          bystrosc: 5,
          rozum: 8,
          oglada: 4,
          fart: 4
        },
        tagged: ['sieczna', 'skradanie', 'wymowa']
      },
      ORIGIN_DATA
    );

    const engine = new OstrzeEngineState();
    engine.registerCustomScene(createBrzezinaYardScene({ sparingHostile: true }));
    engine.loadCustomScene('brzezina_dziedziniec');
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    const impactSpy = vi.fn();
    engine.onJuicyImpact = impactSpy;

    // Friendly story NPC (e.g. Gnieworad) cannot be attacked in Prologue
    const ally = engine.npcs.find((n) => !n.combat?.isHostile);
    expect(ally).toBeDefined();
    expect(engine.commandAttackEnemyFromExploration(ally!.id)).toBe(false);

    // Hostile sparring instructor can be initiated with Surprise Attack from exploration
    const hostile = engine.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive);
    expect(hostile).toBeDefined();
    hostile!.combat!.hp = 80;
    hostile!.combat!.maxHp = 80;
    hostile!.tileX = engine.player.tileX + 1;
    hostile!.tileY = engine.player.tileY;
    hostile!.x = hostile!.tileX + 0.5;
    hostile!.y = hostile!.tileY + 0.5;
    engine.isStealthActive = true;

    const ok = engine.commandAttackEnemyFromExploration(hostile!.id);
    expect(ok).toBe(true);
    expect(engine.combatState.active).toBe(true);
    expect(engine.combatLogs.some((l) => l.includes('ATAK Z ZASKOCZENIA'))).toBe(true);
    expect(engine.pendingSurpriseAttack).toBe(false);
  });
});
