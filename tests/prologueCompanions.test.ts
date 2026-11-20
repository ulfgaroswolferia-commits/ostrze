import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { findOriginItem, ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import {
  type ActiveOstrzeDialogue,
  chooseOstrzeDialogueOption,
  getOstrzeDialogueView,
  startOstrzeDialogue
} from '../src/game/rules/dialogueEngine';
import { Chapter1Director } from '../src/game/scenes/Chapter1Director';
import { PrologueDirector } from '../src/game/scenes/PrologueDirector';

function setupHero(director: PrologueDirector): void {
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
}

function pickById(
  session: ActiveOstrzeDialogue | null,
  optionId: string,
  director: { state: PrologueDirector['state']; rng: PrologueDirector['rng'] }
): ActiveOstrzeDialogue | null {
  expect(session, `Dialogue session ended unexpectedly before '${optionId}'`).not.toBeNull();
  const view = getOstrzeDialogueView(session!, director.state, ORIGIN_DATA);
  const opt = view.options.find((o) => o.option.id === optionId);
  expect(opt, `Expected option '${optionId}' in ${session!.dialogueId}:${session!.nodeId}`).toBeDefined();
  return chooseOstrzeDialogueOption(session!, opt!.index, director.state, ORIGIN_DATA, director.rng);
}

describe('Prologue Companion Expansion (Skarimir, Ragnosława, Wojmir + Act 1 Echoes)', () => {
  it('registers overlay items and dialogues in ORIGIN_DATA cleanly', () => {
    expect(findOriginItem('slonina_na_droge')).toBeDefined();
    expect(findOriginItem('kosc_skarimira')).toBeDefined();
    expect(findOriginItem('miedziak_ragnoslawy')).toBeDefined();
    expect(findOriginItem('list_wojmira')).toBeDefined();

    for (const id of [
      'brzezina_skarimir',
      'brzezina_skarimir_kociol',
      'brzezina_ragnoslawa',
      'brzezina_ragnoslawa_trop',
      'brzezina_wojmir',
      'brzezina_wojmir_studnia',
      'trakt_ognisko_skarimir',
      'trakt_ognisko_ragnoslawa',
      'trakt_ognisko_wojmir',
      'pobojowisko_skarimir',
      'pobojowisko_ragnoslawa',
      'pobojowisko_wojmir',
      'wilczy_brod_pamiec_brzeziny'
    ]) {
      expect(ORIGIN_DATA.prologueDialogues[id], `Missing dialogue ${id}`).toBeDefined();
    }
  });

  it('plays through two-stage Brzezina, all 3 mini-favors, Trakt ambush support, campfire, Dawn keepsakes, and Act 1 echoes', () => {
    const engine = new OstrzeEngineState();
    const director = new PrologueDirector({ engine, seed: 2026 });
    setupHero(director);

    // Stage 1: Brzezina before delegation (sparing win -> lively companion barks, no phase skip)
    director.enterBrzezinaSparingPhase();
    director.handleNpcInteract('npc_gnieworad');
    director.handleNpcInteract('npc_radogost');
    director.handleCombatEnded('victory');
    expect(director.phase).toBe('brzezina_kurier');

    const logBefore = engine.logs.length;
    director.handleNpcInteract('npc_skarimir');
    expect(director.phase).toBe('brzezina_kurier');
    expect(engine.logs.length).toBeGreaterThan(logBefore);
    expect(engine.logs.some((l) => l.includes('Rozłożyłeś Radogosta'))).toBe(true);

    // Courier -> Gnieworad (Delegacja) -> Stage 2: brzezina_towarzysze
    director.handleNpcInteract('npc_kurier');
    director.handleNpcInteract('npc_gnieworad');
    expect(director.phase).toBe('brzezina_towarzysze');

    // 1. Skarimir 1-on-1 + "Słonina na drogę" favor at campfire
    let sSkarimir: ActiveOstrzeDialogue | null = startOstrzeDialogue('brzezina_skarimir', director.state, ORIGIN_DATA);
    sSkarimir = pickById(sSkarimir, 'smiech_razem', director);
    sSkarimir = pickById(sSkarimir, 'przyjmij_slonine', director);
    expect(director.state.flags.przysluga_skarimir_start).toBe(true);
    expect(director.state.vars.wiez_skarimir).toBe(1);

    // Buy smoked bacon for 3 gr at campfire
    const sKociol = startOstrzeDialogue('brzezina_skarimir_kociol', director.state, ORIGIN_DATA);
    pickById(sKociol, 'kup_slonine', director);
    expect(director.state.inventory.items.some((i) => i.id === 'slonina_na_droge')).toBe(true);

    // Deliver bacon back to Skarimir
    const sSkarimir2 = startOstrzeDialogue('brzezina_skarimir', director.state, ORIGIN_DATA);
    pickById(sSkarimir2, 'oddaj_slonine', director);
    expect(director.state.flags.przysluga_skarimir_done).toBe(true);
    expect(director.state.vars.wiez_skarimir).toBe(2);

    // 2. Ragnosława 1-on-1 + "Czerwona pieczęć" favor via Radogost
    let sRagnoslawa: ActiveOstrzeDialogue | null = startOstrzeDialogue('brzezina_ragnoslawa', director.state, ORIGIN_DATA);
    sRagnoslawa = pickById(sRagnoslawa, 'zaklad_piwo', director);
    sRagnoslawa = pickById(sRagnoslawa, 'wez_trop', director);
    expect(director.state.flags.przysluga_ragnoslawa_start).toBe(true);
    expect(director.state.vars.wiez_ragnoslawa).toBe(1);

    const sTrop = startOstrzeDialogue('brzezina_ragnoslawa_trop', director.state, ORIGIN_DATA);
    pickById(sTrop, 'test_wymowa', director);
    expect(director.state.flags.ragnoslawa_trop_odkryty).toBe(true);

    const sRagnoslawa2 = startOstrzeDialogue('brzezina_ragnoslawa', director.state, ORIGIN_DATA);
    pickById(sRagnoslawa2, 'raport_tropu', director);
    expect(director.state.flags.przysluga_ragnoslawa_done).toBe(true);
    expect(director.state.vars.wiez_ragnoslawa).toBe(2);

    // 3. Wojmir 1-on-1 + "Ciężki tobół" favor at school well
    let sWojmir: ActiveOstrzeDialogue | null = startOstrzeDialogue('brzezina_wojmir', director.state, ORIGIN_DATA);
    sWojmir = pickById(sWojmir, 'wsparcie_wojmir', director);
    sWojmir = pickById(sWojmir, 'przyjmij_wojmir', director);
    expect(director.state.flags.przysluga_wojmir_start).toBe(true);
    expect(director.state.vars.wiez_wojmir).toBe(1);

    const sStudnia = startOstrzeDialogue('brzezina_wojmir_studnia', director.state, ORIGIN_DATA);
    pickById(sStudnia, 'wyjmij_sila', director);
    expect(director.state.flags.wojmir_tobol_uratowany).toBe(true);

    const sWojmir2 = startOstrzeDialogue('brzezina_wojmir', director.state, ORIGIN_DATA);
    pickById(sWojmir2, 'oddaj_tobol', director);
    expect(director.state.flags.przysluga_wojmir_done).toBe(true);
    expect(director.state.vars.wiez_wojmir).toBe(2);

    // March out to Trakt (Day 1)
    director.handleNpcInteract('npc_skarimir');
    expect(director.phase).toBe('brzezina_gotowy_do_wymarszu');
    director.handlePropInteract('brzezina_drogowskaz');
    expect(director.phase).toBe('trakt_bandyci');

    // Physical companions present on Trakt & tactical ambush support applied
    expect(engine.npcs.some((n) => n.id === 'npc_trakt_skarimir')).toBe(true);
    expect(engine.npcs.some((n) => n.id === 'npc_trakt_ragnoslawa')).toBe(true);
    expect(engine.npcs.some((n) => n.id === 'npc_trakt_wojmir')).toBe(true);
    expect(director.state.flags.trakt_wsparcie_skarimir).toBe(true);
    expect(director.state.flags.trakt_wsparcie_ragnoslawa).toBe(true);
    expect(director.state.flags.trakt_wsparcie_wojmir).toBe(true);
    expect(engine.npcs.find((n) => n.id === 'enemy_bandyta_1')?.combat?.hp).toBe(22);

    // Defeat bandits -> Trakt campfire individual talks
    director.handleCombatEnded('victory');
    expect(director.phase).toBe('trakt_ognisko');
    expect(engine.npcs.find((n) => n.id === 'npc_trakt_skarimir')?.speechBubbleText).toBe('💬 Skarimir');

    const sCampSkarimir = startOstrzeDialogue('trakt_ognisko_skarimir', director.state, ORIGIN_DATA);
    pickById(sCampSkarimir, 'wspomnij_slonine', director);
    expect(director.state.vars.wiez_skarimir).toBe(3);

    const sCampRagnoslawa = startOstrzeDialogue('trakt_ognisko_ragnoslawa', director.state, ORIGIN_DATA);
    pickById(sCampRagnoslawa, 'omow_pieczec', director);
    expect(director.state.vars.wiez_ragnoslawa).toBe(3);

    const sCampWojmir = startOstrzeDialogue('trakt_ognisko_wojmir', director.state, ORIGIN_DATA);
    pickById(sCampWojmir, 'list_do_matki', director);
    expect(director.state.vars.wiez_wojmir).toBe(3);

    // Night of Wraiths -> companion silhouettes present, then cleared on defeat/Istota
    director.handleNpcInteract('npc_trakt_ognisko');
    expect(director.phase).toBe('noc_upiory');
    expect(engine.npcs.some((n) => n.id === 'npc_noc_skarimir')).toBe(true);
    expect(engine.npcs.some((n) => n.id === 'npc_noc_ragnoslawa')).toBe(true);
    expect(engine.npcs.some((n) => n.id === 'npc_noc_wojmir')).toBe(true);

    director.handleCombatEnded('defeat');
    expect(director.phase).toBe('noc_istota');
    expect(engine.npcs.some((n) => n.id.startsWith('npc_noc_'))).toBe(false);

    // Istota -> Dawn Battlefield with individual fallen companion actors
    director.handleNpcInteract('npc_istota');
    expect(director.phase).toBe('pobojowisko');
    expect(engine.npcs.find((n) => n.id === 'npc_pobojowisko_skarimir')?.speechBubbleText).toBe('🕯️ Skarimir');
    expect(engine.npcs.find((n) => n.id === 'npc_pobojowisko_ragnoslawa')?.speechBubbleText).toBe('🕯️ Ragnosława');
    expect(engine.npcs.find((n) => n.id === 'npc_pobojowisko_wojmir')?.speechBubbleText).toBe('🕯️ Wojmir');

    // Examine each fallen companion individually -> canon loot + personal keepsakes
    let sPobSkarimir: ActiveOstrzeDialogue | null = startOstrzeDialogue('pobojowisko_skarimir', director.state, ORIGIN_DATA);
    sPobSkarimir = pickById(sPobSkarimir, 'zbadaj_bliski', director);
    pickById(sPobSkarimir, 'gest_wola', director);

    let sPobRagnoslawa: ActiveOstrzeDialogue | null = startOstrzeDialogue('pobojowisko_ragnoslawa', director.state, ORIGIN_DATA);
    sPobRagnoslawa = pickById(sPobRagnoslawa, 'zbadaj_bliska', director);
    pickById(sPobRagnoslawa, 'gest_wola', director);

    let sPobWojmir: ActiveOstrzeDialogue | null = startOstrzeDialogue('pobojowisko_wojmir', director.state, ORIGIN_DATA);
    sPobWojmir = pickById(sPobWojmir, 'zbadaj_bliski', director);
    pickById(sPobWojmir, 'gest_dlug', director);

    expect(director.state.inventory.items.some((i) => i.id === 'kosc_skarimira')).toBe(true);
    expect(director.state.inventory.items.some((i) => i.id === 'miedziak_ragnoslawy')).toBe(true);
    expect(director.state.inventory.items.some((i) => i.id === 'list_wojmira')).toBe(true);
    expect(director.state.inventory.items.some((i) => i.id === 'sztylet')).toBe(true);
    expect(director.state.inventory.items.some((i) => i.id === 'amulet_strazniczy')).toBe(true);

    // Finish Prologue -> Enter Act 1 (Wilczy Bród) and test Memory Echoes
    director.handleNpcInteract('npc_pobojowisko_slad');
    director.handleNpcInteract('npc_rozdroze_szlak');
    expect(director.phase).toBe('completed');

    const ch1 = new Chapter1Director({
      engine,
      state: director.state,
      rng: createRng(2026)
    });
    expect(ch1.hasBrzezinaMemoryEchoAvailable()).toBe(true);

    // Trigger all 3 keepsake echoes + ocalali reflection in Wilczy Bród inn
    ch1.state.quests.kto_pyta_o_ocalalych = 'active';
    const xpBefore = ch1.state.character!.xp;
    let sEcho: ActiveOstrzeDialogue | null = startOstrzeDialogue('wilczy_brod_pamiec_brzeziny', ch1.state, ORIGIN_DATA);
    sEcho = pickById(sEcho, 'toast_ragnoslawa', ch1);
    sEcho = chooseOstrzeDialogueOption(sEcho!, 0, ch1.state, ORIGIN_DATA, ch1.rng);
    sEcho = pickById(sEcho, 'wyslij_list_wojmira', ch1);
    sEcho = chooseOstrzeDialogueOption(sEcho!, 0, ch1.state, ORIGIN_DATA, ch1.rng);
    sEcho = pickById(sEcho, 'kosc_skarimira_rzut', ch1);
    sEcho = chooseOstrzeDialogueOption(sEcho!, 0, ch1.state, ORIGIN_DATA, ch1.rng);
    pickById(sEcho, 'ocalali_wspomnienie', ch1);

    expect(ch1.state.flags.echo_ragnoslawa_toast).toBe(true);
    expect(ch1.state.flags.echo_wojmir_list_wyslany).toBe(true);
    expect(ch1.state.flags.echo_skarimir_kosc).toBe(true);
    expect(ch1.state.flags.echo_ocalali_wspomnienie).toBe(true);
    expect(ch1.state.inventory.items.some((i) => i.id === 'list_wojmira')).toBe(false);
    expect(ch1.state.character!.xp).toBeGreaterThan(xpBefore);
    expect(ch1.hasBrzezinaMemoryEchoAvailable()).toBe(false);
  });
});
