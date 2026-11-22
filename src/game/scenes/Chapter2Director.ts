import type { OstrzeEngineState } from '../../engine-bridge/OstrzeEngineState';
import { ostrzeAudio } from '../audio/ostrzeAudio';
import { registerChapter2Dialogues } from '../data/chapter2Data';
import { ORIGIN_DATA } from '../data/originData';
import type { OriginGameData, OstrzeGameState } from '../data/originTypes';
import {
  createBagnaSzarejWodyScene,
  createBorKlusownikowScene,
  createGluszecScene,
  createKamieniolomScene,
  createKapliczkaRozstajeScene,
  createStaryTraktScene,
  createWzgorzeWartowniczeScene
} from '../maps/chapter2Maps';
import { grantXp } from '../rules/character';
import type { SeededRng } from '../rules/dice';
import { startOstrzeDialogue } from '../rules/dialogueEngine';
import { getStats } from '../rules/stats';
import { advanceMinutes, clockOf, timeOfDay, waitUntilHour } from '../rules/time';
import { markOstrzeLocationVisited } from '../rules/travel';
import type { OstrzeModalUi } from '../ui/OstrzeModalUi';

export type Chapter2CombatStage =
  | 'none'
  | 'bor_klusownikow_hunt'
  | 'stary_trakt_hunt'
  | 'kamieniolom_hunt'
  | 'bagna_szarej_wody_hunt'
  | 'wzgorze_oblawa';

const CHAPTER2_SCENES = new Set([
  'gluszec',
  'bor_klusownikow',
  'stary_trakt',
  'kapliczka_rozstaje',
  'kamieniolom',
  'bagna_szarej_wody',
  'wzgorze_wartownicze'
]);

const CHAPTER2_QUEST_IDS = new Set([
  'przyjecie_w_osadzie',
  'klusownik_i_gajowy',
  'zaginiona_karawana',
  'wdowa_po_straznik',
  'najemnik_w_karczmie',
  'dlug_mlynarza',
  'listy_z_tamtej_strony',
  'kto_sprzedal_ocalalego',
  'zwiad_na_wzgorzu',
  'falszywe_papiery',
  'rannego_nie_zostawia_sie',
  'szara_trzcina',
  'co_widziala_ragnoslawa'
]);

export class Chapter2Director {
  public readonly engine: OstrzeEngineState;
  public readonly data: OriginGameData;
  public readonly state: OstrzeGameState;
  public readonly rng: SeededRng;
  private ui: OstrzeModalUi | null;
  private readonly onUiRefresh?: () => void;

  public activeCombatStage: Chapter2CombatStage = 'none';
  public chapter2Completed = false;
  public onSaveRequested?: () => void;
  public onLoadRequested?: () => void;
  public onAutoSave?: () => void;
  public onKeyRequested?: () => void;
  public onDefeatToPrologue?: () => void;
  public hasSave?: () => boolean;

  constructor(opts: {
    engine: OstrzeEngineState;
    state: OstrzeGameState;
    rng: SeededRng;
    ui?: OstrzeModalUi | null;
    data?: OriginGameData;
    onUiRefresh?: () => void;
  }) {
    this.engine = opts.engine;
    this.data = opts.data ?? ORIGIN_DATA;
    this.state = opts.state;
    this.rng = opts.rng;
    this.ui = opts.ui ?? null;
    this.onUiRefresh = opts.onUiRefresh;

    registerChapter2Dialogues(this.data);
    this.registerChapter2Scenes();
  }

  public attachUi(ui: OstrzeModalUi): void {
    this.ui = ui;
  }

  private registerChapter2Scenes(): void {
    this.engine.registerCustomScene(createGluszecScene());
    this.engine.registerCustomScene(createBorKlusownikowScene({ withHunt: false }));
    this.engine.registerCustomScene(createStaryTraktScene({ withHunt: false }));
    this.engine.registerCustomScene(createKapliczkaRozstajeScene());
    this.engine.registerCustomScene(createKamieniolomScene({ withHunt: false }));
    this.engine.registerCustomScene(createBagnaSzarejWodyScene({ withHunt: false }));
    this.engine.registerCustomScene(createWzgorzeWartowniczeScene({ withHunt: false }));
  }

  private bindHooks(): void {
    this.engine.onNpcInteract = (npcId) => this.handleNpcInteract(npcId);
    this.engine.onPropInteract = (propId) => this.handlePropInteract(propId);
    this.engine.onCombatEnded = (outcome) => this.handleCombatEnded(outcome);
  }

  public activateForDevTeleport(): void {
    this.activeCombatStage = 'none';
    this.bindHooks();
  }

  private syncHeroTo25D(): void {
    if (!this.state.character) return;
    this.engine.syncFromOstrzeState(this.state, this.data);
    this.onUiRefresh?.();
  }

  private addItemStack(itemId: string, qty: number): void {
    const existing = this.state.inventory.items.find((i) => i.id === itemId);
    if (existing) {
      existing.qty += qty;
    } else {
      this.state.inventory.items.push({ id: itemId, qty });
    }
  }

  public enterGluszec(opts?: { skipIntro?: boolean }): void {
    this.bindHooks();
    this.activeCombatStage = 'none';
    this.state.world.location = 'gluszec';
    markOstrzeLocationVisited(this.state, 'gluszec');
    this.engine.registerCustomScene(createGluszecScene());
    this.engine.loadCustomScene('gluszec');
    ostrzeAudio.setAmbience('town');
    this.syncHeroTo25D();

    const showHub = (): void => {
      this.engine.addLog(
        '🏘️ Dotarłeś do Osady Głuszec (Akt II). Odwiedź Karczmę, Sołtysa, Gajowego lub Tablicę Ogłoszeń.',
        'important'
      );
      this.refreshHubPanel();
    };

    if (opts?.skipIntro || !this.ui) {
      showHub();
      return;
    }

    const intro = this.data.story.scenes.find((s) => s.id === 'akt3_wejscie');
    advanceMinutes(this.state, 360, this.data);
    this.ui.showNarrative({
      title: typeof intro?.title === 'string' ? intro.title : 'Osada Głuszec',
      subtitle: 'Akt II — Okolice Głuszca',
      artId: 'gluszec',
      text:
        typeof intro?.text === 'string' && intro.text.trim()
          ? intro.text
          : 'Za Kamienną Przełęczą las gęstnieje, a w kotlinie dymią kominy Głuszca. Tu nikt nie pyta o nazwisko — dopóki płacisz w terminie.',
      buttonLabel: 'Wejdź do osady',
      onContinue: showHub
    });
  }

  public returnToGluszec(travelMinutes = 60): void {
    advanceMinutes(this.state, travelMinutes, this.data);
    this.enterGluszec({ skipIntro: true });
    this.onAutoSave?.();
  }

  public enterBorKlusownikow(withHunt = false): void {
    this.bindHooks();
    this.activeCombatStage = 'none';
    if (!withHunt && this.state.world.location !== 'bor_klusownikow') {
      advanceMinutes(this.state, 105, this.data);
    }
    this.state.world.location = 'bor_klusownikow';
    markOstrzeLocationVisited(this.state, 'bor_klusownikow');
    this.engine.registerCustomScene(createBorKlusownikowScene({ withHunt }));
    this.engine.loadCustomScene('bor_klusownikow');
    ostrzeAudio.setAmbience('forest');
    this.syncHeroTo25D();
    this.refreshHubPanel();

    if (withHunt) {
      this.activeCombatStage = 'bor_klusownikow_hunt';
      this.engine.addLog(
        '🏹 Obóz maruderów w Borze Kłusowników! Dwóch łuczników i Herszt Zbójców stają do walki!',
        'combat'
      );
      this.engine.startCombatWithEnemy('enemy_bor_herszt');
      this.onUiRefresh?.();
    } else {
      this.engine.addLog(
        '🌲 Bór Kłusowników — porozmawiaj ze Stachem (❗), sprawdź sidła lub zaatakuj obóz maruderów przy ognisku.',
        'important'
      );
    }
  }

  public enterStaryTrakt(withHunt = false): void {
    this.bindHooks();
    this.activeCombatStage = 'none';
    if (!withHunt && this.state.world.location !== 'stary_trakt') {
      advanceMinutes(this.state, 120, this.data);
    }
    this.state.world.location = 'stary_trakt';
    markOstrzeLocationVisited(this.state, 'stary_trakt');
    this.engine.registerCustomScene(createStaryTraktScene({ withHunt }));
    this.engine.loadCustomScene('stary_trakt');
    ostrzeAudio.setAmbience('forest');
    this.syncHeroTo25D();
    this.refreshHubPanel();

    if (withHunt) {
      this.activeCombatStage = 'stary_trakt_hunt';
      this.engine.addLog('🐺 Wataha wilków z Basiorem blokuje koleinę Starego Traktu!', 'combat');
      this.engine.startCombatWithEnemy('enemy_wilk_trakt_basior');
      this.onUiRefresh?.();
    } else {
      this.engine.addLog(
        '🛞 Stary Trakt — porozmawiaj z Furmanem Sieciechem (❗) lub zbadaj rozbity wóz zaginionej karawany.',
        'important'
      );
    }
  }

  public enterKapliczkaRozstaje(): void {
    this.bindHooks();
    this.activeCombatStage = 'none';
    if (this.state.world.location !== 'kapliczka_rozstaje') {
      advanceMinutes(this.state, 75, this.data);
    }
    this.state.world.location = 'kapliczka_rozstaje';
    markOstrzeLocationVisited(this.state, 'kapliczka_rozstaje');
    this.engine.registerCustomScene(createKapliczkaRozstajeScene());
    this.engine.loadCustomScene('kapliczka_rozstaje');
    ostrzeAudio.setAmbience('dawn');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    this.engine.addLog(
      '⛪ Kapliczka na Rozstajach — porozmawiaj z Siostrą Haliną (❗) lub Pustelnikiem (💬).',
      'important'
    );
  }

  public enterKamieniolom(withHunt = false): void {
    this.bindHooks();
    this.activeCombatStage = 'none';
    if (!withHunt && this.state.world.location !== 'kamieniolom') {
      advanceMinutes(this.state, 110, this.data);
    }
    this.state.world.location = 'kamieniolom';
    markOstrzeLocationVisited(this.state, 'kamieniolom');
    this.engine.registerCustomScene(createKamieniolomScene({ withHunt }));
    this.engine.loadCustomScene('kamieniolom');
    ostrzeAudio.setAmbience('creepy_forest');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    if (withHunt) {
      this.activeCombatStage = 'kamieniolom_hunt';
      this.engine.addLog('⛏️ Maruderzy i łucznik w sztolni Kamieniołomu!', 'combat');
      this.engine.startCombatWithEnemy('enemy_kamieniolom_maruder_1');
      this.onUiRefresh?.();
    } else {
      this.engine.addLog(
        '⛏️ Kamieniołom — porozmawiaj z Dozorcą Wincentym (❗) i Rannym Górnikiem (❗) lub wejdź w głąb sztolni.',
        'important'
      );
    }
  }

  public enterBagnaSzarejWody(withHunt = false): void {
    this.bindHooks();
    this.activeCombatStage = 'none';
    if (!withHunt && this.state.world.location !== 'bagna_szarej_wody') {
      advanceMinutes(this.state, 130, this.data);
    }
    this.state.world.location = 'bagna_szarej_wody';
    markOstrzeLocationVisited(this.state, 'bagna_szarej_wody');
    this.engine.registerCustomScene(createBagnaSzarejWodyScene({ withHunt }));
    this.engine.loadCustomScene('bagna_szarej_wody');
    ostrzeAudio.setAmbience('creepy_forest');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    if (withHunt) {
      this.activeCombatStage = 'bagna_szarej_wody_hunt';
      this.engine.addLog('🌊 Z topieli wyłaniają się Utopce i Pradawny Topielec!', 'combat');
      this.engine.startCombatWithEnemy('enemy_bagna_utopiec_boss');
      this.onUiRefresh?.();
    } else {
      this.engine.addLog(
        '🌿 Bagna Szarej Wody — zbierz Szarą Trzcinę na grobli lub oczyść topiel z utopców.',
        'important'
      );
    }
  }

  public enterWzgorzeWartownicze(withHunt = false): void {
    this.bindHooks();
    this.activeCombatStage = 'none';
    if (!withHunt && this.state.world.location !== 'wzgorze_wartownicze') {
      advanceMinutes(this.state, 115, this.data);
    }
    this.state.world.location = 'wzgorze_wartownicze';
    markOstrzeLocationVisited(this.state, 'wzgorze_wartownicze');
    this.engine.registerCustomScene(createWzgorzeWartowniczeScene({ withHunt }));
    this.engine.loadCustomScene('wzgorze_wartownicze');
    ostrzeAudio.setAmbience('dawn');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    if (withHunt) {
      this.activeCombatStage = 'wzgorze_oblawa';
      this.engine.addLog(
        '⚔️ Cesarska Obława na Wzgórzu Wartowniczym! Dowódca Obławy i zwiadowcy odcinają odwrót!',
        'combat'
      );
      this.engine.startCombatWithEnemy('enemy_oblawa_dowodca');
      this.onUiRefresh?.();
    } else {
      this.engine.addLog(
        '🗼 Wzgórze Wartownicze — porozmawiaj ze Starym Pasterzem (❗) lub podejdź do wieży, by skonfrontować się z Obławą.',
        'important'
      );
    }
  }

  public finishChapter2(viaOblawa = false): void {
    this.chapter2Completed = true;
    this.state.flags.akt3a_koniec = true;
    const sceneId = viaOblawa ? 'akt3a_koniec_oblawa' : 'akt3a_koniec_scena';
    const scene = this.data.story.scenes.find((s) => s.id === sceneId);
    const ch = this.state.character;
    const summary = [
      typeof scene?.text === 'string' && scene.text.trim()
        ? scene.text
        : 'Głuszec zostaje za plecami. Przed tobą Szklane Wzgórza i Obserwatorium, gdzie ślady spadłych gwiazd zbiegają się w jedno.',
      '',
      '--- KONIEC AKTU II (OSADA GŁUSZEC) ---',
      `Bohater: ${ch?.name ?? 'Adept'} (Poz. ${ch?.level ?? 1}, ${ch?.xp ?? 0} XP, ${ch?.money ?? 0} gr)`,
      `Osie moralne: Wola = ${this.state.vars.wola ?? 0}, Dług = ${this.state.vars.dlug ?? 0}`
    ].join('\n');

    this.ui?.showNarrative({
      title: viaOblawa ? 'Przerwanie Obławy — Koniec Aktu II' : 'Za Głuszcem — Koniec Aktu II',
      subtitle: 'Zapowiedź Aktu III: Obserwatorium na Szklanym Wzgórzu',
      artId: 'gluszec',
      text: summary,
      buttonLabel: 'Zostań w okolicach Głuszca',
      onContinue: () => {
        this.engine.addLog('🏁 Akt II ukończony! Otwarto szlak na Szklane Wzgórza (Akt III).', 'important');
        this.refreshHubPanel();
      }
    });
  }

  public handlePropInteract(propId: string): boolean {
    if (propId === 'gluszec_tablica') {
      this.openNoticeBoard();
      return true;
    }
    if (propId === 'gluszec_karczma') {
      this.restAtInn();
      return true;
    }
    if (propId === 'gluszec_kramy') {
      this.openShop('handlarz_gluszec');
      return true;
    }
    if (propId === 'gluszec_kuznia') {
      this.openShop('kowal_gluszec_sklep');
      return true;
    }
    if (propId === 'gluszec_studnia') {
      this.engine.addLog('💧 Studnia w Głuszcu — chłodna woda z głębokiego źródła.', 'info');
      return true;
    }
    if (propId === 'gluszec_drogowskaz') {
      this.openTravelModal();
      return true;
    }
    if (
      propId === 'bor_drogowskaz' ||
      propId === 'stary_trakt_drogowskaz' ||
      propId === 'kapliczka_drogowskaz' ||
      propId === 'kamieniolom_drogowskaz' ||
      propId === 'bagna_drogowskaz' ||
      propId === 'wzgorze_drogowskaz'
    ) {
      this.returnToGluszec();
      return true;
    }
    if (propId === 'kapliczka_oltarz') {
      this.engine.addLog('⛪ Stara przydrożna kapliczka na rozstajach. Cicho tu i spokojnie.', 'info');
      return true;
    }
    if (propId === 'kapliczka_skrzynka') {
      if (!this.state.flags.kapliczka_skrzynka_zbadana) {
        this.state.flags.kapliczka_skrzynka_zbadana = true;
        this.addItemStack('opatrunek', 1);
        this.engine.addLog('📦 W skrzynce przy kapliczce znalazłeś czysty Opatrunek.', 'important');
        this.syncHeroTo25D();
        this.onAutoSave?.();
      } else {
        this.engine.addLog('📦 Skrzynka przy kapliczce jest już pusta.', 'info');
      }
      return true;
    }
    if (propId === 'kamieniolom_sztolnia') {
      if (this.state.flags.kamieniolom_oczyszczony) {
        this.engine.addLog('⛏️ Sztolnia kamieniołomu jest już bezpieczna.', 'info');
      } else {
        this.enterKamieniolom(true);
      }
      return true;
    }
    if (propId === 'bagna_trzcinowisko') {
      if (!this.state.flags.szara_trzcina_zebrana) {
        this.state.flags.szara_trzcina_zebrana = true;
        this.state.quests.szara_trzcina = 'completed';
        this.addItemStack('napar_ziol', 1);
        const xp = grantXp(this.state, 55, this.data);
        this.engine.addLog(
          `🌿 Zebrałeś Szarą Trzcinę na moczarach! (+1 Napar z ziół, +55 XP, Poz. ${xp.newLevel}).`,
          'important'
        );
        this.syncHeroTo25D();
        this.refreshHubPanel();
        this.onAutoSave?.();
      } else {
        this.engine.addLog('🌿 Szara trzcina została już zebrana.', 'info');
      }
      return true;
    }
    if (propId === 'bagna_topiel') {
      if (this.state.flags.bagna_utopce_pokonane) {
        this.engine.addLog('🌊 Topiel ucichła — utopce zostały rozbite.', 'info');
      } else {
        this.enterBagnaSzarejWody(true);
      }
      return true;
    }
    if (propId === 'wzgorze_wieza') {
      if (this.state.flags.oblawa_pokonana) {
        this.finishChapter2(true);
      } else {
        this.enterWzgorzeWartownicze(true);
      }
      return true;
    }
    if (propId === 'bor_ognisko_obozu') {
      if (this.state.flags.bor_maruderzy_pokonani) {
        this.engine.addLog('🔥 Obóz maruderów jest już pusty i bezpieczny.', 'info');
      } else {
        this.enterBorKlusownikow(true);
      }
      return true;
    }
    if (propId === 'bor_sidla_polana') {
      if (!this.state.flags.bor_sidla_rozbrojone) {
        this.state.flags.bor_sidla_rozbrojone = true;
        this.addItemStack('opatrunek', 1);
        this.engine.addLog('🪤 Rozbroiłeś kłusownicze sidła i znalazłeś Opatrunek!', 'important');
        this.syncHeroTo25D();
        this.onAutoSave?.();
      } else {
        this.engine.addLog('🪤 Sidła na polanie zostały już rozbrojone.', 'info');
      }
      return true;
    }
    if (propId === 'stary_trakt_rozbity_woz') {
      if (this.state.flags.stary_trakt_wilki_pokonane) {
        this.engine.addLog('🛞 Rozbity wóz karawany został już dokładnie przeszukany.', 'info');
      } else {
        this.enterStaryTrakt(true);
      }
      return true;
    }
    if (propId === 'stary_trakt_sakwa') {
      if (!this.state.flags.stary_trakt_sakwa_zebrana) {
        this.state.flags.stary_trakt_sakwa_zebrana = true;
        if (this.state.character) this.state.character.money += 18;
        this.addItemStack('prowiant', 1);
        this.engine.addLog('💰 Sakwa pod mostkiem: +18 gr i +1 Prowiant!', 'important');
        this.syncHeroTo25D();
        this.onAutoSave?.();
      } else {
        this.engine.addLog('📦 Sakwa pod mostkiem jest już pusta.', 'info');
      }
      return true;
    }
    return false;
  }

  public handleNpcInteract(npcId: string): boolean {
    if (npcId === 'npc_soltys_gluszec') {
      this.runDialogue('soltys');
      return true;
    }
    if (npcId === 'npc_karczmarz_kogut') {
      this.runDialogue('karczmarz_kogut');
      return true;
    }
    if (npcId === 'npc_najemnik_kogut') {
      this.runDialogue('najemnik');
      return true;
    }
    if (npcId === 'npc_kramarz_gluszec') {
      this.openShop('handlarz_gluszec');
      return true;
    }
    if (npcId === 'npc_kowal_bogdan') {
      this.runDialogue('kowal_gluszec');
      return true;
    }
    if (npcId === 'npc_zielarka_znachorka') {
      this.runDialogue('znachorka');
      return true;
    }
    if (npcId === 'npc_wartownik_gajowy') {
      this.runDialogue('gajowy');
      return true;
    }
    if (npcId === 'npc_kopacz_jerzy') {
      this.runDialogue('kopacz');
      return true;
    }
    if (npcId === 'npc_zona_wdowa_jaga') {
      this.runDialogue('wdowa');
      return true;
    }
    if (npcId === 'npc_stach_bor') {
      this.runDialogue('stach');
      return true;
    }
    if (npcId === 'npc_furman_sieciech') {
      this.runDialogue('furman');
      return true;
    }
    if (npcId === 'npc_halina_kapliczka') {
      this.runDialogue('halina');
      return true;
    }
    if (npcId === 'npc_pustelnik_rozstaje') {
      this.runDialogue('pisarz');
      return true;
    }
    if (npcId === 'npc_dozorca_wincenty') {
      this.runDialogue('dozorca');
      return true;
    }
    if (npcId === 'npc_ranny_gornik') {
      this.runDialogue('ranny');
      return true;
    }
    if (npcId === 'npc_zielarka_bagna') {
      this.runDialogue('znachorka');
      return true;
    }
    if (npcId === 'npc_pasterz_wzgorze') {
      this.runDialogue('kontrola');
      return true;
    }
    return false;
  }

  private runDialogue(dialogueId: string): void {
    const session = startOstrzeDialogue(dialogueId, this.state, this.data);
    if (!this.ui) {
      return;
    }
    this.ui.showDialogue(session, {
      onClosed: () => {
        if (this.state.flags.kowal_gluszec_sklep) {
          this.state.flags.kowal_gluszec_sklep = false;
          this.openShop('kowal_gluszec_sklep');
          return;
        }
        this.syncHeroTo25D();
        this.refreshHubPanel();
        this.onAutoSave?.();
      },
      onOpenShop: (shopId) => {
        this.openShop(shopId);
      }
    });
  }

  public openShop(shopId: string): void {
    if (!this.ui) return;
    this.ui.showShop(shopId, () => {
      this.syncHeroTo25D();
      this.refreshHubPanel();
      this.onAutoSave?.();
    });
  }

  public restAtInn(): void {
    waitUntilHour(this.state, 6, this.data);
    if (this.state.character) {
      this.state.character.hp = getStats(this.state, this.data).derived.hpMax;
    }
    this.syncHeroTo25D();
    this.engine.addLog(
      '🛏️ Przespałeś noc w Karczmie „Pod Zdechłym Kogutem”. Zdrowie w pełni odnowione.',
      'info'
    );
    this.refreshHubPanel();
    this.onAutoSave?.();
  }

  public openNoticeBoard(): void {
    if (!this.ui) return;
    const borDone = Boolean(this.state.flags.bor_maruderzy_pokonani);
    const traktDone = Boolean(this.state.flags.stary_trakt_wilki_pokonane);

    this.ui.showNoticeBoard(
      [
        {
          id: 'nb_gluszec_bor',
          title: 'Zlecenie: Obóz Maruderów w Borze Kłusowników',
          author: 'Gajowy — Osada Głuszec',
          reward: '45 gr + 95 XP',
          body: 'Kłusownicy i herszt maruderów rozbili obóz na leśnej polanie. Oczyść bór lub dogadaj się ze Stachem.',
          actionLabel: borDone ? '✓ Oczyszczono' : 'Idź do Boru Kłusowników',
          actionDisabled: borDone,
          onAction: () => {
            this.ui?.closeAll();
            this.state.quests.klusownik_i_gajowy = 'active';
            this.enterBorKlusownikow(false);
          }
        },
        {
          id: 'nb_gluszec_trakt',
          title: 'Zlecenie: Zaginiona karawana na Starym Trakcie',
          author: 'Sołtys — Osada Głuszec',
          reward: '35 gr + 75 XP',
          body: 'Na Starym Trakcie rozbito wóz kupiecki, a w koleinach kręci się wataha z wielkim Basiorem. Sprawdź co zostało i porozmawiaj z furmanem.',
          actionLabel: traktDone ? '✓ Oczyszczono' : 'Idź na Stary Trakt',
          actionDisabled: traktDone,
          onAction: () => {
            this.ui?.closeAll();
            this.state.quests.zaginiona_karawana = 'active';
            this.enterStaryTrakt(false);
          }
        }
      ],
      () => this.refreshHubPanel()
    );
  }

  public openTravelModal(): void {
    if (!this.ui) return;
    const currentLoc = this.engine.activeCustomSceneId ?? this.state.world.location;
    this.ui.showTravelModal(
      [
        {
          id: 'gluszec',
          name: '🏘️ Osada Głuszec',
          subtitle: 'Główna osada Aktu II — karczma, kuźnia, kramy i sołtys.',
          travelMinutes: 60,
          isCurrent: currentLoc === 'gluszec'
        },
        {
          id: 'bor_klusownikow',
          name: '🌲 Bór Kłusowników',
          subtitle: 'Polana z sidłami, Stach i obóz maruderów z Hersztem.',
          travelMinutes: 105,
          isCurrent: currentLoc === 'bor_klusownikow'
        },
        {
          id: 'stary_trakt',
          name: '🛞 Stary Trakt',
          subtitle: 'Furman Sieciech, rozbity wóz karawany i wataha wilków.',
          travelMinutes: 120,
          isCurrent: currentLoc === 'stary_trakt'
        },
        {
          id: 'kapliczka_rozstaje',
          name: '⛪ Kapliczka na Rozstajach',
          subtitle: 'Siostra Halina, Pustelnik i stare rozdroże.',
          travelMinutes: 75,
          isCurrent: currentLoc === 'kapliczka_rozstaje'
        },
        {
          id: 'kamieniolom',
          name: '⛏️ Kamieniołom',
          subtitle: 'Dozorca Wincenty, ranny górnik i sztolnia maruderów.',
          travelMinutes: 110,
          isCurrent: currentLoc === 'kamieniolom'
        },
        {
          id: 'bagna_szarej_wody',
          name: '🌿 Bagna Szarej Wody',
          subtitle: 'Szara trzcina i topiel opanowana przez utopce.',
          travelMinutes: 130,
          isCurrent: currentLoc === 'bagna_szarej_wody'
        },
        {
          id: 'wzgorze_wartownicze',
          name: '🗼 Wzgórze Wartownicze',
          subtitle: 'Punkt zwiadowczy i finał Cesarskiej Obławy.',
          travelMinutes: 115,
          isCurrent: currentLoc === 'wzgorze_wartownicze'
        }
      ],
      (destId) => {
        if (destId === 'gluszec') this.returnToGluszec();
        else if (destId === 'bor_klusownikow') this.enterBorKlusownikow(false);
        else if (destId === 'stary_trakt') this.enterStaryTrakt(false);
        else if (destId === 'kapliczka_rozstaje') this.enterKapliczkaRozstaje();
        else if (destId === 'kamieniolom') this.enterKamieniolom(false);
        else if (destId === 'bagna_szarej_wody') this.enterBagnaSzarejWody(false);
        else if (destId === 'wzgorze_wartownicze') this.enterWzgorzeWartownicze(false);
      }
    );
  }

  public handleCombatEnded(outcome: 'victory' | 'defeat' | 'fled'): void {
    this.engine.combatState.active = false;
    this.engine.combatState.participantIds = [];
    this.engine.combatState.activeTurnActorId = null;

    if (outcome === 'defeat') {
      this.activeCombatStage = 'none';
      if (this.ui && this.onDefeatToPrologue) {
        this.ui.showNarrative({
          title: 'Poległeś w okolicach Głuszca',
          text: 'Przeciwnicy okazali się zbyt silni. Twoja podróż kończy się w głuszy — wracasz na początek Prologu.',
          buttonLabel: 'Wróć na początek Prologu',
          onContinue: () => this.onDefeatToPrologue?.()
        });
      } else {
        this.onDefeatToPrologue?.();
      }
      return;
    }

    if (this.state.character && this.engine.player.combat) {
      this.state.character.hp = Math.max(1, this.engine.player.combat.hp);
    }

    const stage = this.activeCombatStage;
    this.activeCombatStage = 'none';
    for (let i = this.engine.npcs.length - 1; i >= 0; i--) {
      if (this.engine.npcs[i].combat?.isHostile) {
        this.engine.npcs.splice(i, 1);
      }
    }

    if (outcome === 'victory' && this.state.character) {
      if (stage === 'bor_klusownikow_hunt') {
        this.state.flags.bor_maruderzy_pokonani = true;
        this.state.quests.klusownik_i_gajowy = 'completed';
        this.state.character.money += 45;
        const xp = grantXp(this.state, 95, this.data);
        this.engine.addLog(
          `🏆 Oczyszczono obóz maruderów w Borze Kłusowników! +45 gr, +95 XP (Poz. ${xp.newLevel}).`,
          'important'
        );
        this.ui?.showToast('Obóz maruderów oczyszczony (+45 gr, +95 XP)', 'success');
      } else if (stage === 'stary_trakt_hunt') {
        this.state.flags.stary_trakt_wilki_pokonane = true;
        this.state.quests.zaginiona_karawana = 'completed';
        this.state.character.money += 35;
        const xp = grantXp(this.state, 75, this.data);
        this.engine.addLog(
          `🏆 Rozbito watahę Starego Traktu! +35 gr, +75 XP (Poz. ${xp.newLevel}).`,
          'important'
        );
        this.ui?.showToast('Wataha pokonana (+35 gr, +75 XP)', 'success');
      } else if (stage === 'kamieniolom_hunt') {
        this.state.flags.kamieniolom_oczyszczony = true;
        this.state.quests.rannego_nie_zostawia_sie = 'completed';
        this.state.character.money += 40;
        const xp = grantXp(this.state, 80, this.data);
        this.engine.addLog(
          `🏆 Sztolnia Kamieniołomu oczyszczona! +40 gr, +80 XP (Poz. ${xp.newLevel}).`,
          'important'
        );
        this.ui?.showToast('Kamieniołom oczyszczony (+40 gr, +80 XP)', 'success');
      } else if (stage === 'bagna_szarej_wody_hunt') {
        this.state.flags.bagna_utopce_pokonane = true;
        this.state.character.money += 50;
        const xp = grantXp(this.state, 110, this.data);
        this.engine.addLog(
          `🏆 Pradawny Topielec i utopce rozbite! +50 gr, +110 XP (Poz. ${xp.newLevel}).`,
          'important'
        );
        this.ui?.showToast('Topiel oczyszczona (+50 gr, +110 XP)', 'success');
      } else if (stage === 'wzgorze_oblawa') {
        this.state.flags.oblawa_pokonana = true;
        this.state.quests.zwiad_na_wzgorzu = 'completed';
        this.state.character.money += 60;
        const xp = grantXp(this.state, 140, this.data);
        this.engine.addLog(
          `🏆 Przerwałeś Cesarską Obławę na Wzgórzu Wartowniczym! +60 gr, +140 XP (Poz. ${xp.newLevel}).`,
          'important'
        );
        this.syncHeroTo25D();
        this.onAutoSave?.();
        this.finishChapter2(true);
        return;
      }
    }

    this.syncHeroTo25D();
    this.refreshHubPanel();
    this.onAutoSave?.();
  }

  public refreshHubPanel(): void {
    this.refreshChapter2Markers();
    if (!this.ui) return;
    const loc = this.state.world.location;
    if (!CHAPTER2_SCENES.has(loc)) {
      this.ui.setHubPanel(null);
      return;
    }

    const ch = this.state.character;
    const hpMax = ch ? getStats(this.state, this.data).derived.hpMax : 0;
    const c = clockOf(this.state.time.minutes);
    const tod = timeOfDay(this.state.time.minutes, this.data.rules);
    const clockText = `Dzień ${c.day}, ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')} (${tod})`;

    const activeQuests = this.data.quests
      .filter((q) => CHAPTER2_QUEST_IDS.has(q.id) && this.state.quests[q.id] === 'active')
      .map((q) => q.name);

    const titles: Record<string, string> = {
      gluszec: 'Osada Głuszec (Akt II)',
      bor_klusownikow: 'Bór Kłusowników (Akt II)',
      stary_trakt: 'Stary Trakt (Akt II)',
      kapliczka_rozstaje: 'Kapliczka na Rozstajach (Akt II)',
      kamieniolom: 'Kamieniołom (Akt II)',
      bagna_szarej_wody: 'Bagna Szarej Wody (Akt II)',
      wzgorze_wartownicze: 'Wzgórze Wartownicze (Akt II)'
    };

    this.ui.setHubPanel({
      title: titles[loc] ?? 'Akt II — Okolice Głuszca',
      statusLine: `${ch?.name ?? 'Adept'} · Poz. ${ch?.level ?? 1} · HP ${ch?.hp ?? 0}/${hpMax} · ${ch?.money ?? 0} gr · ${clockText}`,
      questsLine:
        activeQuests.length > 0
          ? `Aktywne zlecenia: ${activeQuests.join(', ')}`
          : 'Porozmawiaj z mieszkańcami Głuszca, zajrzyj na Tablicę Ogłoszeń lub wyrusz przez Bramę na okoliczne szlaki.',
      actions: []
    });
  }

  private refreshChapter2Markers(): void {
    this.engine.clearAllNpcMarkers();
    const loc = this.state.world.location;
    if (loc === 'gluszec') {
      this.engine.setNpcMarker('npc_soltys_gluszec', '❗');
      this.engine.setNpcMarker('npc_karczmarz_kogut', '🍺');
      this.engine.setNpcMarker('npc_najemnik_kogut', '💬');
      this.engine.setNpcMarker('npc_kramarz_gluszec', '🛒');
      this.engine.setNpcMarker('npc_kowal_bogdan', '⚒️');
      this.engine.setNpcMarker('npc_zielarka_znachorka', '🌿');
      this.engine.setNpcMarker('npc_wartownik_gajowy', '❗');
      this.engine.setNpcMarker('npc_kopacz_jerzy', '💬');
      this.engine.setNpcMarker('npc_zona_wdowa_jaga', '💬');
    } else if (loc === 'bor_klusownikow') {
      this.engine.setNpcMarker('npc_stach_bor', '❗ Stach');
    } else if (loc === 'stary_trakt') {
      this.engine.setNpcMarker('npc_furman_sieciech', '❗ Furman');
    } else if (loc === 'kapliczka_rozstaje') {
      this.engine.setNpcMarker('npc_halina_kapliczka', '❗ Siostra Halina');
      this.engine.setNpcMarker('npc_pustelnik_rozstaje', '💬 Pustelnik');
    } else if (loc === 'kamieniolom') {
      this.engine.setNpcMarker('npc_dozorca_wincenty', '❗ Dozorca');
      this.engine.setNpcMarker('npc_ranny_gornik', '❗ Ranny Górnik');
    } else if (loc === 'bagna_szarej_wody') {
      this.engine.setNpcMarker('npc_zielarka_bagna', '🌿 Zielarka');
    } else if (loc === 'wzgorze_wartownicze') {
      this.engine.setNpcMarker('npc_pasterz_wzgorze', '❗ Pasterz');
    }
  }

  public restoreFromSave(sceneId: string): void {
    this.bindHooks();
    this.activeCombatStage = 'none';
    const targetScene = CHAPTER2_SCENES.has(sceneId) ? sceneId : 'gluszec';
    this.state.world.location = targetScene;
    if (targetScene === 'gluszec') {
      this.engine.registerCustomScene(createGluszecScene());
    } else if (targetScene === 'bor_klusownikow') {
      this.engine.registerCustomScene(createBorKlusownikowScene({ withHunt: false }));
    } else if (targetScene === 'stary_trakt') {
      this.engine.registerCustomScene(createStaryTraktScene({ withHunt: false }));
    } else if (targetScene === 'kapliczka_rozstaje') {
      this.engine.registerCustomScene(createKapliczkaRozstajeScene());
    } else if (targetScene === 'kamieniolom') {
      this.engine.registerCustomScene(createKamieniolomScene({ withHunt: false }));
    } else if (targetScene === 'bagna_szarej_wody') {
      this.engine.registerCustomScene(createBagnaSzarejWodyScene({ withHunt: false }));
    } else {
      this.engine.registerCustomScene(createWzgorzeWartowniczeScene({ withHunt: false }));
    }
    this.engine.loadCustomScene(targetScene);
    ostrzeAudio.setAmbience(
      targetScene === 'gluszec'
        ? 'town'
        : targetScene === 'kapliczka_rozstaje' || targetScene === 'wzgorze_wartownicze'
          ? 'dawn'
          : targetScene === 'kamieniolom' || targetScene === 'bagna_szarej_wody'
            ? 'creepy_forest'
            : 'forest'
    );
    this.syncHeroTo25D();
    this.refreshHubPanel();
  }
}
