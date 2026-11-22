import { resolveCharacterArchetypeTag } from '@ulf/assets/characterBakery';
import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { isWolfRecipe } from '../src/game/assets/beastSprites';
import { CHAPTER2_DIALOGUES } from '../src/game/data/chapter2Data';
import { ORIGIN_DATA } from '../src/game/data/originData';
import {
  createBagnaSzarejWodyScene,
  createBorKlusownikowScene,
  createGluszecScene,
  createKamieniolomScene,
  createKapliczkaRozstajeScene,
  createSpalonaOsadaScene,
  createStaraKopalniaScene,
  createStaryTraktScene,
  createWzgorzeWartowniczeScene
} from '../src/game/maps/chapter2Maps';
import { createCharacter, createEmptyOstrzeState, grantXp } from '../src/game/rules/character';
import { resolveEnemyArchetype } from '../src/game/rules/combatAi';
import { resolveEnemyOriginId } from '../src/game/rules/combatEnemyMeta';
import { createRng } from '../src/game/rules/dice';
import { Chapter2Director } from '../src/game/scenes/Chapter2Director';

function createAct2Fixture() {
  const engine = new OstrzeEngineState();
  const state = createEmptyOstrzeState(ORIGIN_DATA, 2026);
  createCharacter(
    state,
    {
      name: 'Mściwój',
      classId: 'miecz',
      attributes: {
        sila: 7,
        zrecznosc: 7,
        krzepa: 6,
        bystrosc: 5,
        rozum: 6,
        oglada: 5,
        fart: 5
      },
      tagged: ['sieczna', 'wymowa', 'skradanie']
    },
    ORIGIN_DATA
  );
  grantXp(state, 500, ORIGIN_DATA);
  const director = new Chapter2Director({
    engine,
    state,
    rng: createRng(2026),
    data: ORIGIN_DATA
  });
  return { engine, state, director };
}

describe('Chapter 2 Phase 1 Audit (Gluszec, Bor Klusownikow, Stary Trakt & Visual Guardrails)', () => {
  it('guarantees standing NPC archetypes, proper quadruped wolves (no human sprites), and full boss visuals', () => {
    const gluszec = createGluszecScene();
    const byId = new Map((gluszec.actors ?? []).map((a) => [a.id, a]));

    // Every Głuszec NPC resolves to an intentional standing archetype
    expect(resolveCharacterArchetypeTag(byId.get('npc_soltys_gluszec')!.recipe)).toBe('noble');
    expect(resolveCharacterArchetypeTag(byId.get('npc_karczmarz_kogut')!.recipe)).toBe('trader');
    expect(resolveCharacterArchetypeTag(byId.get('npc_kramarz_gluszec')!.recipe)).toBe('trader');
    expect(resolveCharacterArchetypeTag(byId.get('npc_kowal_bogdan')!.recipe)).toBe('peasant_man');
    expect(resolveCharacterArchetypeTag(byId.get('npc_zielarka_znachorka')!.recipe)).toBe('peasant_woman');
    expect(resolveCharacterArchetypeTag(byId.get('npc_wartownik_gajowy')!.recipe)).toBe('knight');
    expect(resolveCharacterArchetypeTag(byId.get('npc_kopacz_jerzy')!.recipe)).toBe('peasant_man');
    expect(resolveCharacterArchetypeTag(byId.get('npc_zona_wdowa_jaga')!.recipe)).toBe('peasant_woman');
    expect(resolveCharacterArchetypeTag(byId.get('npc_najemnik_kogut')!.recipe)).toBe('knight');

    // Unobstructed exit gate in Głuszec
    const gate = gluszec.map.props.find((p) => p.id === 'gluszec_drogowskaz');
    expect(gate?.kind).toBe('exit_path');
    expect(gate?.blocksMovement).toBe(false);
    const blockingInGate = gluszec.map.props.filter(
      (p) => p.blocksMovement && p.x <= 14 && p.x + p.sizeX - 1 >= 13 && p.y <= 26 && p.y + p.sizeY - 1 >= 24
    );
    expect(blockingInGate).toEqual([]);

    // Stary Trakt wolves MUST use custom quadruped wolf baker and have ZERO human gear
    const trakt = createStaryTraktScene({ withHunt: true });
    const wolves = (trakt.actors ?? []).filter((a) => a.combat?.isHostile);
    expect(wolves.length).toBe(3);
    for (const w of wolves) {
      expect(isWolfRecipe(w.recipe)).toBe(true);
      expect(resolveCharacterArchetypeTag(w.recipe)).toBe('wilk');
      expect(w.recipe.equipment.mainHand).toBeNull();
      expect(w.recipe.equipment.head).toBeNull();
    }

    // Bór Kłusowników: ranged kiters + distinct Boss Herszt visuals
    const bor = createBorKlusownikowScene({ withHunt: true });
    const boss = (bor.actors ?? []).find((a) => a.id === 'enemy_bor_herszt');
    expect(boss).toBeDefined();
    expect(boss!.combat?.difficulty).toBe('very_hard');
    expect(boss!.recipe.equipment.torso).toBe('torso_slavic_lamellar');
    expect(boss!.recipe.equipment.head).toBe('helm_szyszak');
    expect(boss!.recipe.equipment.mainHand).toBe('weapon_slavic_axe');
    expect(boss!.recipe.equipment.offHand).toBe('offhand_slavic_shield');
    const bossOriginId = resolveEnemyOriginId(boss!.id, boss!.recipe.name);
    expect(resolveEnemyArchetype(bossOriginId, undefined, boss!.combat?.difficulty)).toBe('boss');

    const archers = (bor.actors ?? []).filter((a) => a.id.startsWith('enemy_bor_klusownik_'));
    expect(archers.length).toBe(2);
    for (const archer of archers) {
      const oid = resolveEnemyOriginId(archer.id, archer.recipe.name);
      expect(resolveEnemyArchetype(oid, undefined, archer.combat?.difficulty)).toBe('ranged_kiter');
    }
  });

  it('registers all Phase 1 Act II dialogues, shops, hunts, and defeat handling cleanly', () => {
    const { engine, state, director } = createAct2Fixture();
    for (const key of Object.keys(CHAPTER2_DIALOGUES)) {
      expect(ORIGIN_DATA.prologueDialogues[key], `Dialogue ${key}`).toBeDefined();
    }
    expect(ORIGIN_DATA.shops.some((s) => s.id === 'handlarz_gluszec')).toBe(true);
    expect(ORIGIN_DATA.shops.some((s) => s.id === 'kowal_gluszec_sklep')).toBe(true);

    director.enterGluszec({ skipIntro: true });
    expect(engine.activeCustomSceneId).toBe('gluszec');

    // Hunt victory in Bór Kłusowników
    director.enterBorKlusownikow(true);
    expect(director.activeCombatStage).toBe('bor_klusownikow_hunt');
    director.handleCombatEnded('victory');
    expect(state.flags.bor_maruderzy_pokonani).toBe(true);
    expect(state.quests.klusownik_i_gajowy).toBe('completed');

    // Hunt victory in Stary Trakt
    director.enterStaryTrakt(true);
    director.handleCombatEnded('victory');
    expect(state.flags.stary_trakt_wilki_pokonane).toBe(true);
    expect(state.quests.zaginiona_karawana).toBe('completed');

    // Defeat triggers onDefeatToPrologue cleanly
    let defeated = false;
    director.onDefeatToPrologue = () => {
      defeated = true;
    };
    director.enterStaryTrakt(true);
    director.handleCombatEnded('defeat');
    expect(defeated).toBe(true);
  });

  it('verifies Phase 2 scenes: utopiec monster sprites, standing NPCs, Oblawa boss visuals, and Act II finale', () => {
    const bagna = createBagnaSzarejWodyScene({ withHunt: true });
    const utopce = (bagna.actors ?? []).filter((a) => a.combat?.isHostile);
    expect(utopce.length).toBe(3);
    for (const u of utopce) {
      expect(resolveCharacterArchetypeTag(u.recipe)).toBe('utopiec');
      expect(u.recipe.equipment.mainHand).toBeNull();
      expect(u.recipe.equipment.head).toBeNull();
    }

    const kapliczka = createKapliczkaRozstajeScene();
    const halina = (kapliczka.actors ?? []).find((a) => a.id === 'npc_halina_kapliczka')!;
    expect(resolveCharacterArchetypeTag(halina.recipe)).toBe('peasant_woman');

    const kamieniolom = createKamieniolomScene({ withHunt: false });
    const dozorca = (kamieniolom.actors ?? []).find((a) => a.id === 'npc_dozorca_wincenty')!;
    expect(resolveCharacterArchetypeTag(dozorca.recipe)).toBe('knight');

    const wzgorze = createWzgorzeWartowniczeScene({ withHunt: true });
    const oblawaBoss = (wzgorze.actors ?? []).find((a) => a.id === 'enemy_oblawa_dowodca')!;
    expect(oblawaBoss.combat?.difficulty).toBe('very_hard');
    expect(oblawaBoss.recipe.equipment.torso).toBe('torso_slavic_lamellar');
    expect(oblawaBoss.recipe.equipment.head).toBe('helm_szyszak');
    expect(oblawaBoss.recipe.equipment.offHand).toBe('offhand_slavic_shield');

    const { state, director } = createAct2Fixture();
    director.enterBagnaSzarejWody(false);
    director.handlePropInteract('bagna_trzcinowisko');
    expect(state.quests.szara_trzcina).toBe('completed');

    director.enterWzgorzeWartownicze(true);
    director.handleCombatEnded('victory');
    expect(state.flags.oblawa_pokonana).toBe(true);
    expect(state.flags.akt3a_koniec).toBe(true);
    expect(director.chapter2Completed).toBe(true);
  });

  it('verifies Phase 3 exploration scenes: Spalona Osada & Stara Kopalnia (utopiec + wraith boss, star-iron vein)', () => {
    const spalona = createSpalonaOsadaScene({ withHunt: true });
    const chwalislaw = (spalona.actors ?? []).find((a) => a.id === 'npc_pogorzelec_chwalislaw')!;
    expect(resolveCharacterArchetypeTag(chwalislaw.recipe)).toBe('peasant_man');

    const kopalnia = createStaraKopalniaScene({ withHunt: true });
    const zmoraBoss = (kopalnia.actors ?? []).find((a) => a.id === 'enemy_kopalnia_zmora_boss')!;
    expect(resolveCharacterArchetypeTag(zmoraBoss.recipe)).toBe('wraith');
    expect(zmoraBoss.combat?.difficulty).toBe('very_hard');
    expect(zmoraBoss.recipe.equipment.mainHand).toBeNull();
    expect(zmoraBoss.recipe.equipment.head).toBeNull();

    const { state, director } = createAct2Fixture();
    director.enterSpalonaOsada(false);
    director.handlePropInteract('spalona_piwnica');
    expect(state.flags.spalona_piwnica_zbadana).toBe(true);

    director.enterStaraKopalnia(false);
    director.handlePropInteract('kopalnia_zyla_zelaza');
    expect(state.flags.zyla_gwiezdnego_zelaza_wydobyta).toBe(true);

    director.enterStaraKopalnia(true);
    director.handleCombatEnded('victory');
    expect(state.flags.stara_kopalnia_oczyszczona).toBe(true);
  });
});
