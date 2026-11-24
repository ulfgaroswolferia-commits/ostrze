import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import {
  ROAD_ENCOUNTER_DIALOGUES,
  ROAD_ENCOUNTER_TRAVEL_EVENTS
} from '../src/game/data/roadEncounters';
import { createSpalonaOsadaScene, createStaraKopalniaScene } from '../src/game/maps/chapter2Maps';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';
import { computeActorTacticalCover } from '../src/game/rules/combatArenaTactics';
import { resolveActiveWeaponManeuver } from '../src/game/rules/weaponManeuvers';

function makeHeroState(classId: 'miecz' | 'wlocznia') {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 77);
  createCharacter(
    state,
    {
      name: 'Mściwój',
      classId,
      attributes: {
        sila: 7,
        zrecznosc: 7,
        krzepa: 6,
        bystrosc: 5,
        rozum: 6,
        oglada: 5,
        fart: 5
      },
      tagged: [classId === 'miecz' ? 'sieczna' : 'drzewcowa', 'skradanie', 'wymowa']
    },
    ORIGIN_DATA
  );
  return state;
}

describe('Tactical Combat (Weapon Maneuvers, Oil Barrels, Cover) & Road Encounters', () => {
  it('resolves weapon maneuvers per weapon family and executes sword cleave + cooldown', () => {
    const swordState = makeHeroState('miecz');
    expect(resolveActiveWeaponManeuver(swordState, ORIGIN_DATA).id).toBe('ciecie_lukiem');

    const spearState = makeHeroState('wlocznia');
    expect(resolveActiveWeaponManeuver(spearState, ORIGIN_DATA).id).toBe('pchniecie_zaporowe');

    const engine = new OstrzeEngineState();
    engine.registerCustomScene(createSpalonaOsadaScene({ withHunt: true }));
    engine.loadCustomScene('spalona_osada');
    engine.syncFromOstrzeState(swordState, ORIGIN_DATA);

    const enemies = engine.npcs.filter((n) => n.combat?.isHostile && n.combat.isAlive);
    expect(enemies.length).toBeGreaterThanOrEqual(2);
    // Position player adjacent to two enemies
    engine.player.tileX = 11;
    engine.player.tileY = 8;
    enemies[0].tileX = 11;
    enemies[0].tileY = 7;
    enemies[1].tileX = 12;
    enemies[1].tileY = 8;
    engine.combatState.active = true;
    engine.combatState.round = 1;
    engine.combatState.selectedTargetId = enemies[0].id;
    engine.player.combat!.ap = 7;

    const beforeHp0 = enemies[0].combat!.hp;
    const beforeHp1 = enemies[1].combat!.hp;
    const res = engine.performPlayerWeaponManeuver(enemies[0].id, () => 0.5);
    expect(res.ok).toBe(true);
    expect(enemies[0].combat!.hp).toBeLessThan(beforeHp0);
    expect(enemies[1].combat!.hp).toBeLessThan(beforeHp1);
    expect(engine.getEnemyBleedTurns(enemies[0].id)).toBeGreaterThan(0);

    // Cooldown prevents immediate reuse on same round
    const second = engine.performPlayerWeaponManeuver(enemies[0].id, () => 0.5);
    expect(second.ok).toBe(false);
    expect(second.message).toContain('Odnowienie');
  });

  it('detonates oil barrels for AoE fire damage (with x2 vulnerability vs Wraith boss) and computes tactical cover', () => {
    const state = makeHeroState('miecz');
    const engine = new OstrzeEngineState();
    engine.registerCustomScene(createStaraKopalniaScene({ withHunt: true }));
    engine.loadCustomScene('stara_kopalnia');
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    engine.combatState.active = true;
    engine.player.combat!.ap = 7;
    // Stand next to oil_barrel_kopalnia_1 at (11, 9)
    engine.player.tileX = 11;
    engine.player.tileY = 10;

    // Cover check: standing adjacent to solid barrel gives tactical cover before explosion
    const coverBefore = computeActorTacticalCover(11, 10, engine.map.props, new Set());
    expect(coverBefore.hasCover).toBe(true);
    expect(coverBefore.rangedHitPenaltyPct).toBe(20);

    // Move Zmora boss into blast radius of barrel at (11, 9)
    const zmora = engine.npcs.find((n) => n.id === 'enemy_kopalnia_zmora_boss')!;
    zmora.tileX = 11;
    zmora.tileY = 8;
    const hpBefore = zmora.combat!.hp;

    const barrel = engine.findNearbyOilBarrel();
    expect(barrel?.id).toBe('oil_barrel_kopalnia_1');

    const det = engine.detonateOilBarrel(barrel!.id, () => 0.5);
    expect(det.ok).toBe(true);
    expect(det.hitCount).toBeGreaterThanOrEqual(1);
    // Wraith is vulnerable to fire (x2): 12 * 2 = 24 damage!
    expect(hpBefore - zmora.combat!.hp).toBeGreaterThanOrEqual(20);
    // Barrel is removed after explosion
    expect(engine.findNearbyOilBarrel()).toBeNull();
  });

  it('wires all 6 one-time road encounters and their dialogues cleanly into ORIGIN_DATA', () => {
    expect(ROAD_ENCOUNTER_TRAVEL_EVENTS.length).toBe(6);
    for (const ev of ROAD_ENCOUNTER_TRAVEL_EVENTS) {
      expect(ev.once).toBe(true);
      expect(ORIGIN_DATA.travelEvents.some((t) => t.id === ev.id)).toBe(true);
      for (const sc of ev.scenes ?? []) {
        expect(sc.dialogue).toBeDefined();
        expect(ROAD_ENCOUNTER_DIALOGUES[sc.dialogue!]).toBeDefined();
        expect(ORIGIN_DATA.prologueDialogues[sc.dialogue!]).toBeDefined();
      }
    }
  });
});
