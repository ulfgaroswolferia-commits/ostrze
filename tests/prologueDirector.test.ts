import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter } from '../src/game/rules/character';
import { PrologueDirector } from '../src/game/scenes/PrologueDirector';

describe('Playable 2.5D PrologueDirector (NPC markers & non-skippable flow)', () => {
  it.each([
    ['miecz', 'victory'],
    ['miecz', 'defeat'],
    ['wlocznia', 'victory'],
    ['wlocznia', 'defeat']
  ] as const)(
    'resolves sparing for %s with %s outcome and grants the class reward',
    (classId, outcome) => {
      const engine = new OstrzeEngineState();
      const director = new PrologueDirector({ engine, seed: 2026 });
      const state = director.state;
    const classSkill = classId === 'miecz' ? 'sieczna' : 'drzewcowa';
    createCharacter(
      director.state,
      {
        name: 'Mściwój',
        classId,
        attributes: {
          sila: 8,
          zrecznosc: 7,
          krzepa: 5,
          bystrosc: 5,
          rozum: 6,
          oglada: 5,
          fart: 5
        },
        tagged: [classSkill, 'wymowa', 'skradanie']
      },
      ORIGIN_DATA
    );
    const startingMoney = state.character!.money;

    director.enterBrzezinaSparingPhase();
    director.handleNpcInteract('npc_gnieworad');
    director.handleNpcInteract('npc_radogost');
    director.handleCombatEnded(outcome);

    expect(director.phase).toBe('brzezina_kurier');
    const resultFlag =
      outcome === 'victory'
        ? 'combat_demo_sparing_walka_wygrana'
        : 'combat_demo_sparing_walka_porazka';
    expect(state.flags[resultFlag]).toBe(true);
    expect(state.character!.xp).toBe(160);
    expect(state.character!.level).toBe(2);
    expect(state.character!.money).toBe(startingMoney + 15);
    expect(state.inventory.items.some((item) => item.id === 'kaptur_mysliwego')).toBe(true);
    expect(state.vars[classId === 'miecz' ? 'dlug' : 'wola']).toBe(1);
    }
  );

  it('enforces NPC interactions with visible markers through every phase of the Prologue', () => {
    const engine = new OstrzeEngineState();
    const director = new PrologueDirector({ engine, seed: 2026 });

    createCharacter(
      director.state,
      {
        name: 'Mściwój',
        classId: 'miecz',
        attributes: {
          sila: 8,
          zrecznosc: 7,
          krzepa: 5,
          bystrosc: 5,
          rozum: 6,
          oglada: 5,
          fart: 5
        },
        tagged: ['sieczna', 'wymowa', 'skradanie']
      },
      ORIGIN_DATA
    );

    // 1. Start in Brzezina -> Gnieworad is visibly marked
    director.enterBrzezinaSparingPhase();
    expect(director.phase).toBe('brzezina_gnieworad');
    expect(engine.npcs.find((n) => n.id === 'npc_gnieworad')?.speechBubbleText).toBe('❗ Mistrz Gnieworad');

    // Cannot skip to companions or gate early
    director.handleNpcInteract('npc_skarimir');
    expect(director.phase).toBe('brzezina_gnieworad');
    director.handlePropInteract('brzezina_drogowskaz');
    expect(director.phase).toBe('brzezina_gnieworad');

    // 2. Talk to Gnieworad -> Radogost becomes marked
    director.handleNpcInteract('npc_gnieworad');
    expect(director.phase).toBe('brzezina_sparing_talk');
    expect(engine.npcs.find((n) => n.id === 'npc_radogost')?.speechBubbleText).toBe('⚔️ Podejdź do sparingu');

    // 3. Approach Radogost -> starts sparing -> win -> Courier spawns
    director.handleNpcInteract('npc_radogost');
    expect(director.phase).toBe('brzezina_sparing_fight');
    director.handleCombatEnded('victory');
    expect(director.phase).toBe('brzezina_kurier');
    expect(director.state.character?.level).toBe(2);
    expect(engine.npcs.find((n) => n.id === 'npc_kurier')?.speechBubbleText).toBe('❗ Cesarski Kurier');

    // 4. Talk to Courier -> Gnieworad (Delegacja) -> Towarzysze -> Gate
    director.handleNpcInteract('npc_kurier');
    expect(director.phase).toBe('brzezina_delegacja');
    director.handleNpcInteract('npc_gnieworad');
    expect(director.phase).toBe('brzezina_towarzysze');
    director.handleNpcInteract('npc_skarimir');
    expect(director.phase).toBe('brzezina_gotowy_do_wymarszu');

    // 5. Leave via gate -> Trakt Bandits -> Campfire NPC -> Night of Wraiths -> Istota -> Pobojowisko -> Rozdroze
    director.handlePropInteract('brzezina_drogowskaz');
    expect(director.phase).toBe('trakt_bandyci');
    director.handleCombatEnded('victory');
    expect(director.phase).toBe('trakt_ognisko');
    expect(engine.npcs.find((n) => n.id === 'npc_trakt_ognisko')?.speechBubbleText).toBe('❗ Ognisko — Porozmawiaj');

    director.handleNpcInteract('npc_trakt_ognisko');
    expect(director.phase).toBe('noc_upiory');
    director.handleCombatEnded('defeat');
    expect(director.phase).toBe('noc_istota');
    expect(engine.npcs.some((n) => n.id.startsWith('enemy_upior_'))).toBe(false);
    engine.update(0.1);
    expect(engine.combatState.active).toBe(false);
    expect(engine.npcs.find((n) => n.id === 'npc_istota')?.speechBubbleText).toBe('❗ Istota — Podejdź');

    director.handleNpcInteract('npc_istota');
    expect(director.phase).toBe('pobojowisko');
    // Cannot skip pobojowisko at rozdroze
    director.handleNpcInteract('npc_rozdroze_szlak');
    expect(director.phase).toBe('pobojowisko');

    director.handleNpcInteract('npc_pobojowisko_slad');
    expect(director.phase).toBe('rozdroze');
    director.handleNpcInteract('npc_rozdroze_szlak');
    expect(director.phase).toBe('completed');
    expect(director.state.world.location).toBe('wilczy_brod');
  });
});
