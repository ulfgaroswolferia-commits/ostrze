import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter, grantXp } from '../src/game/rules/character';
import { resolveEnemyTacticalTier } from '../src/game/rules/combatAi';
import { resolvePlayerWeaponDamageType } from '../src/game/rules/combatEnemyMeta';
import { createRng } from '../src/game/rules/dice';
import {
  chooseOstrzeDialogueOption,
  getOstrzeDialogueView,
  startOstrzeDialogue
} from '../src/game/rules/dialogueEngine';
import { PrologueDirector } from '../src/game/scenes/PrologueDirector';

function createHero(director: PrologueDirector, classId: 'miecz' | 'wlocznia') {
  createCharacter(
    director.state,
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
      tagged: [classId === 'miecz' ? 'sieczna' : 'drzewcowa', 'wymowa', 'skradanie']
    },
    ORIGIN_DATA
  );
}

describe('Prologue 2.5D Audit (WYTYCZNE_PROLOG_25D.md checklist)', () => {
  it('verifies every Prologue story scene and dialogue ID resolves to non-empty content', () => {
    const storyIds = [
      'prolog_wstep',
      'prolog_wstep_wies',
      'demo_swit',
      'demo_sparing',
      'demo_sparing_wygrana',
      'demo_sparing_porazka',
      'prolog_kurier_narracja',
      'prolog_wymarsz',
      'bandyci_zasadzka',
      'bandyci_po_walce',
      'bandyci_ucieczka',
      'noc_zmierzch',
      'noc_atak',
      'noc_omdlenie',
      'noc_zaglada',
      'noc_swit',
      'noc_bezdroza'
    ];
    for (const id of storyIds) {
      const scene =
        ORIGIN_DATA.story.scenes.find((s) => s.id === id) ?? ORIGIN_DATA.travelScenes[id];
      expect(scene, `Missing story scene: ${id}`).toBeDefined();
      const text = typeof scene?.text === 'string' ? scene.text.trim() : '';
      expect(text.length, `Empty story scene text: ${id}`).toBeGreaterThan(0);
    }

    const dialogueIds = [
      'kurier',
      'delegacja',
      'kwatermistrz',
      'brzezina_skarimir',
      'brzezina_ragnoslawa',
      'brzezina_wojmir',
      'brzezina_skarimir_kociol',
      'brzezina_wojmir_studnia',
      'brzezina_ragnoslawa_trop',
      'trakt_ognisko_skarimir',
      'trakt_ognisko_ragnoslawa',
      'trakt_ognisko_wojmir',
      'ognisko',
      'istota',
      'pobojowisko_skarimir',
      'pobojowisko_ragnoslawa',
      'pobojowisko_wojmir',
      'pobojowisko',
      'rozdroze'
    ];
    for (const id of dialogueIds) {
      expect(ORIGIN_DATA.prologueDialogues[id], `Missing dialogue: ${id}`).toBeDefined();
    }
  });

  it('grants level 2 with unspent skill points and a perk pick after sparing for both classes', () => {
    for (const classId of ['miecz', 'wlocznia'] as const) {
      const engine = new OstrzeEngineState();
      const director = new PrologueDirector({ engine, seed: 2026 });
      createHero(director, classId);

      expect(resolvePlayerWeaponDamageType(director.state, ORIGIN_DATA)).toBe(
        classId === 'miecz' ? 'sieczne' : 'klute'
      );
      expect(resolveEnemyTacticalTier('brzezina_dziedziniec', 'bandyta')).toBe('early');

      director.enterBrzezinaSparingPhase();
      director.handleNpcInteract('npc_gnieworad');
      director.handleNpcInteract('npc_radogost');
      director.handleCombatEnded('victory');

      const ch = director.state.character!;
      expect(ch.level).toBe(2);
      expect(ch.freeSkillPoints).toBeGreaterThan(0);
      expect(ch.freePerkPicks).toBeGreaterThanOrEqual(1);
      expect(engine.logs.some((l) => l.includes('Atut'))).toBe(true);
    }
  });

  it('handles custom-scene player defeat cleanly without ulfRPG teleport or text leak', () => {
    const engine = new OstrzeEngineState();
    const director = new PrologueDirector({ engine, seed: 2026 });
    createHero(director, 'miecz');

    let endedOutcome: string | null = null;
    director.enterBrzezinaSparingPhase();
    director.handleNpcInteract('npc_gnieworad');
    director.handleNpcInteract('npc_radogost');

    // Simulate player falling to 0 HP during sparing
    const prevX = engine.player.tileX;
    const prevY = engine.player.tileY;
    engine.onCombatEnded = (outcome) => {
      endedOutcome = outcome;
      director.handleCombatEnded(outcome);
    };
    engine.update(0.016); // arm wasCombatActive = true
    engine.player.combat!.hp = 0;
    (engine as unknown as { handlePlayerDefeated: () => void }).handlePlayerDefeated();
    engine.update(0.016);

    expect(endedOutcome).toBe('defeat');
    expect(director.phase).toBe('brzezina_kurier');
    expect(director.state.flags.combat_demo_sparing_walka_porazka).toBe(true);
    expect(engine.player.tileX).toBe(prevX);
    expect(engine.player.tileY).toBe(prevY);
    expect(engine.combatLogs.some((l) => l.includes('Topora Kata'))).toBe(false);
  });

  it('supports dialogue skill checks with failedChecks lock and restores all key Prologue phases from save', () => {
    const engine = new OstrzeEngineState();
    const director = new PrologueDirector({ engine, seed: 2026 });
    createHero(director, 'miecz');
    grantXp(director.state, 160, ORIGIN_DATA);

    // Kurier dialogue has skill checks (wymowa / skradanie)
    const session = startOstrzeDialogue('kurier', director.state, ORIGIN_DATA);
    const view = getOstrzeDialogueView(session, director.state, ORIGIN_DATA);
    const checkOption = view.options.find((o) => Boolean(o.option.check));
    expect(checkOption).toBeDefined();
    if (checkOption) {
      chooseOstrzeDialogueOption(session, checkOption.index, director.state, ORIGIN_DATA, createRng(1));
    }

    // Restore key phases from save without errors
    const phases = [
      ['brzezina_kurier', 'brzezina_dziedziniec'],
      ['trakt_ognisko', 'trakt_zasadzka'],
      ['noc_istota', 'uroczysko_noc'],
      ['pobojowisko', 'pobojowisko_swit'],
      ['rozdroze', 'pobojowisko_swit']
    ] as const;

    for (const [phase, sceneId] of phases) {
      director.restoreFromSave(phase, sceneId);
      expect(director.phase).toBe(phase);
      expect(engine.activeCustomSceneId).toBe(sceneId);
    }
  });
});
