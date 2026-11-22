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
  createSpalonaOsadaScene,
  createStaraKopalniaScene,
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
  | 'wzgorze_oblawa'
  | 'spalona_osada_hunt'
  | 'stara_kopalnia_hunt';

const CHAPTER2_SCENES = new Set([
  'gluszec',
  'bor_klusownikow',
  'stary_trakt',
  'kapliczka_rozstaje',
  'kamieniolom',
  'bagna_szarej_wody',
  'wzgorze_wartownicze',
  'spalona_osada',
  'stara_kopalnia'
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
    this.engine.registerCustomScene(createSpalonaOsadaScene({ withHunt: false }));
    this.engine.registerCustomScene(createStaraKopalniaScene({ withHunt: false }));
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

  private hasItem(itemId: string): boolean {
    if (this.state.inventory.items.some((i) => i.id === itemId && i.qty > 0)) return true;
    return Object.values(this.state.inventory.equipped).includes(itemId);
  }

  private awardQuestCompletion(
    questId: string,
    title: string,
    money: number,
    xp: number,
    items?: Array<{ id: string; qty: number }>
  ): void {
    if (this.state.quests[questId] === 'completed') return;
    this.state.quests[questId] = 'completed';
    let leveledUp = false;
    if (this.state.character) {
      if (money > 0) this.state.character.money += money;
      if (items) {
        for (const it of items) this.addItemStack(it.id, it.qty);
      }
      if (xp > 0) {
        const xpRes = grantXp(this.state, xp, this.data);
        leveledUp = xpRes.levelsGained > 0;
        if (leveledUp) {
          this.ui?.showToast(`Awans na poziom ${xpRes.newLevel}! Otwórz kartę Postaci [K].`, 'gold');
        }
      }
    }
    const rewardParts = [
      money > 0 ? `+${money} gr` : '',
      xp > 0 ? `+${xp} XP` : '',
      ...(items ?? []).map((it) => `+${it.qty}× ${it.id}`)
    ].filter(Boolean);
    this.engine.addLog(`🏆 Ukończono „${title}” (${rewardParts.join(', ')})!`, 'important');
    this.ui?.showToast(`Ukończono: ${title}`, 'success');
    ostrzeAudio.playQuestEvent(leveledUp ? 'levelup' : 'complete');
  }

  /**
   * Mirrors origin/data/quests.json completion rules for all 13 Act II (Głuszec) quests.
   */
  public checkAndCompleteSideQuests(): void {
    if (this.state.flags.soltys_potwierdzil) {
      this.awardQuestCompletion('przyjecie_w_osadzie', 'Swój w osadzie', 10, 40);
    }
    if (this.state.flags.gajowy_zamkniete) {
      this.awardQuestCompletion('klusownik_i_gajowy', 'Kłusownik i gajowy', 15, 40);
    }
    if (this.state.flags.mruk_dlug_rozliczony) {
      this.awardQuestCompletion('dlug_mlynarza', 'Dług młynarza', 6, 30);
    }
    if (this.state.flags.kopacz_listy_zamkniete) {
      this.awardQuestCompletion('listy_z_tamtej_strony', 'Listy z tamtej strony', 3, 45);
    }
    if (this.state.flags.soltys_donosiciel_zamkniete) {
      this.awardQuestCompletion('kto_sprzedal_ocalalego', 'Kto sprzedał ocalałego', 20, 55);
    }
    if (this.state.flags.kowal_zwiad_zamkniety) {
      this.awardQuestCompletion('zwiad_na_wzgorzu', 'Zwiad na wzgórzu', 10, 45);
    }
    if (this.state.flags.papiery_falszywe) {
      this.awardQuestCompletion('falszywe_papiery', 'Fałszywe papiery', 5, 40);
    }
    if (this.state.flags.dozorca_zamkniete) {
      this.awardQuestCompletion('rannego_nie_zostawia_sie', 'Rannego nie zostawia się', 18, 50);
    }
    if (this.state.flags.trzcina_oddana) {
      this.awardQuestCompletion('szara_trzcina', 'Szara trzcina', 0, 50, [
        { id: 'napar_ziol', qty: 2 }
      ]);
    }
    if (this.state.flags.wdowa_zamknieta) {
      this.awardQuestCompletion('wdowa_po_straznik', 'Wdowa po strażniku', 0, 45, [
        { id: 'prowiant', qty: 2 }
      ]);
    }
    if (this.state.flags.najemnik_rozwiazany) {
      this.awardQuestCompletion('najemnik_w_karczmie', 'Najemnik w karczmie', 0, 45);
    }
    if (this.state.flags.furman_zamkniety) {
      this.awardQuestCompletion('zaginiona_karawana', 'Zaginiona karawana', 20, 45, [
        { id: 'prowiant', qty: 1 }
      ]);
    }
    if (this.state.flags.halina_echo) {
      this.state.flags.akt3a_koniec = true;
      this.awardQuestCompletion('co_widziala_ragnoslawa', 'Co widziała Ragnosława', 0, 60);
    }
  }

  public applyBogdanUpgrade(kind: 'weapon' | 'armor' | 'star_blade'): { ok: boolean; message: string } {
    const ch = this.state.character;
    if (!ch) return { ok: false, message: 'Brak postaci.' };

    if (kind === 'weapon') {
      if (this.state.flags.bogdan_ulepszenie_bron) {
        return { ok: false, message: 'Broń została już przekuta u Bogdana.' };
      }
      if (ch.money < 35) return { ok: false, message: 'Potrzebujesz 35 gr.' };
      ch.money -= 35;
      this.state.flags.bogdan_ulepszenie_bron = true;
      this.syncHeroTo25D();
      this.engine.addLog('⚒️ Kowal Bogdan przekuł twoją broń (+2 do obrażeń)!', 'important');
      this.onAutoSave?.();
      return { ok: true, message: 'Broń przekuta (+2 obr.)!' };
    }

    if (kind === 'armor') {
      if (this.state.flags.bogdan_ulepszenie_pancerz) {
        return { ok: false, message: 'Pancerz został już wzmocniony u Bogdana.' };
      }
      if (ch.money < 35) return { ok: false, message: 'Potrzebujesz 35 gr.' };
      ch.money -= 35;
      this.state.flags.bogdan_ulepszenie_pancerz = true;
      this.syncHeroTo25D();
      this.engine.addLog('🛡️ Kowal Bogdan wzmocnił twój pancerz (+2 do pancerza)!', 'important');
      this.onAutoSave?.();
      return { ok: true, message: 'Pancerz wzmocniony (+2 pancerza)!' };
    }

    if (this.state.flags.bogdan_gwiezdne_ostrze) {
      return { ok: false, message: 'Gwiezdne Ostrze zostało już wykute.' };
    }
    if (!this.state.flags.zyla_gwiezdnego_zelaza_wydobyta) {
      return { ok: false, message: 'Wymagany okruch z żyły gwiezdnego żelaza (Stara Kopalnia).' };
    }
    if (ch.money < 50) return { ok: false, message: 'Potrzebujesz 50 gr.' };
    ch.money -= 50;
    this.state.flags.bogdan_gwiezdne_ostrze = true;
    this.syncHeroTo25D();
    this.engine.addLog(
      '✨ Kowal Bogdan wykuł Gwiezdne Ostrze (+3 obr., typ obrażeń „gwiezdne” — przełamuje odporność upiorów)!',
      'important'
    );
    this.onAutoSave?.();
    return { ok: true, message: 'Wykuto Gwiezdne Ostrze (+3 obr., przełamuje odporność upiorów)!' };
  }

  public openBogdanUpgrades(): void {
    if (!this.ui) return;
    const ch = this.state.character;
    const money = ch?.money ?? 0;
    const hasOre = Boolean(this.state.flags.zyla_gwiezdnego_zelaza_wydobyta);

    this.ui.showNoticeBoard(
      [
        {
          id: 'bogdan_upg_weapon',
          title: '⚒️ Przekucie i wyważenie broni (+2 obr.)',
          author: 'Kuźnia Bogdana — Głuszec',
          reward: 'Koszt: 35 gr',
          body: 'Bogdan hartuje krawędź i poprawia wyważenie twojej broni. Stała premia +2 do obrażeń w walce 2.5D.',
          actionLabel: this.state.flags.bogdan_ulepszenie_bron ? '✓ Wykuto' : 'Przekuj (35 gr)',
          actionDisabled: Boolean(this.state.flags.bogdan_ulepszenie_bron) || money < 35,
          onAction: () => {
            const res = this.applyBogdanUpgrade('weapon');
            this.ui?.showToast(res.message, res.ok ? 'success' : 'info');
            this.ui?.closeAll();
            this.refreshHubPanel();
          }
        },
        {
          id: 'bogdan_upg_armor',
          title: '🛡️ Wzmocnienie pancerza (+2 pancerza)',
          author: 'Kuźnia Bogdana — Głuszec',
          reward: 'Koszt: 35 gr',
          body: 'Bogdan nabija stalowe łuski na kluczowe punkty pancerza. Stała premia +2 do pancerza w walce 2.5D.',
          actionLabel: this.state.flags.bogdan_ulepszenie_pancerz ? '✓ Wzmocniono' : 'Wzmocnij (35 gr)',
          actionDisabled: Boolean(this.state.flags.bogdan_ulepszenie_pancerz) || money < 35,
          onAction: () => {
            const res = this.applyBogdanUpgrade('armor');
            this.ui?.showToast(res.message, res.ok ? 'success' : 'info');
            this.ui?.closeAll();
            this.refreshHubPanel();
          }
        },
        {
          id: 'bogdan_upg_star_blade',
          title: '✨ Wykucie Gwiezdnego Ostrza (+3 obr. · przełamuje upiory)',
          author: 'Kuźnia Bogdana — Sekretne rzemiosło',
          reward: hasOre ? 'Koszt: 50 gr + Okruch gwiezdnego żelaza' : 'Wymaga okruchu ze Starej Kopalni',
          body: 'Wtopienie gwiezdnego żelaza ze Starej Kopalni w klingę nadaje jej typ obrażeń „gwiezdne” — omija 90% odporności upiorów na stal!',
          actionLabel: this.state.flags.bogdan_gwiezdne_ostrze
            ? '✓ Wykuto'
            : hasOre
              ? 'Wykuj Gwiezdne Ostrze (50 gr)'
              : 'Brak gwiezdnego żelaza',
          actionDisabled: Boolean(this.state.flags.bogdan_gwiezdne_ostrze) || !hasOre || money < 50,
          onAction: () => {
            const res = this.applyBogdanUpgrade('star_blade');
            this.ui?.showToast(res.message, res.ok ? 'success' : 'info');
            this.ui?.closeAll();
            this.refreshHubPanel();
          }
        },
        {
          id: 'bogdan_open_shop',
          title: '🛒 Towar Kuźni Bogdana',
          author: 'Kuźnia Bogdana — Handel',
          reward: 'Sklep kowala',
          body: 'Przejrzyj gotową broń i pancerze dostępne u Bogdana.',
          actionLabel: 'Otwórz sklep',
          actionDisabled: false,
          onAction: () => {
            this.ui?.closeAll();
            this.openShop('kowal_gluszec_sklep');
          }
        }
      ],
      () => this.refreshHubPanel()
    );
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
    this.state.flags.wzgorze_zwiad = true;
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

  public enterSpalonaOsada(withHunt = false): void {
    this.bindHooks();
    this.activeCombatStage = 'none';
    if (!withHunt && this.state.world.location !== 'spalona_osada') {
      advanceMinutes(this.state, 140, this.data);
    }
    this.state.world.location = 'spalona_osada';
    markOstrzeLocationVisited(this.state, 'spalona_osada');
    this.engine.registerCustomScene(createSpalonaOsadaScene({ withHunt }));
    this.engine.loadCustomScene('spalona_osada');
    ostrzeAudio.setAmbience('creepy_forest');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    if (withHunt) {
      this.activeCombatStage = 'spalona_osada_hunt';
      this.engine.addLog('🔥 Szabrownicy i łucznik bronią łupów wśród zgliszczy!', 'combat');
      this.engine.startCombatWithEnemy('enemy_spalona_maruder_1');
      this.onUiRefresh?.();
    } else {
      this.engine.addLog(
        '🏚️ Spalona Osada — porozmawiaj z Chwalisławem (💬), przeszukaj piwnicę lub oczyść zgliszcza.',
        'important'
      );
    }
  }

  public enterStaraKopalnia(withHunt = false): void {
    this.bindHooks();
    this.activeCombatStage = 'none';
    if (!withHunt && this.state.world.location !== 'stara_kopalnia') {
      advanceMinutes(this.state, 150, this.data);
    }
    this.state.world.location = 'stara_kopalnia';
    markOstrzeLocationVisited(this.state, 'stara_kopalnia');
    this.engine.registerCustomScene(createStaraKopalniaScene({ withHunt }));
    this.engine.loadCustomScene('stara_kopalnia');
    ostrzeAudio.setAmbience('creepy_forest');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    if (withHunt) {
      this.activeCombatStage = 'stara_kopalnia_hunt';
      this.engine.addLog('👻 Z zalanej sztolni wyłaniają się Utopce i Zmora z Kopalni!', 'combat');
      this.engine.startCombatWithEnemy('enemy_kopalnia_zmora_boss');
      this.onUiRefresh?.();
    } else {
      this.engine.addLog(
        '⛏️ Stara Kopalnia — porozmawiaj z Pustelnikiem Rudym (💬) lub zbadaj żyłę gwiezdnego żelaza.',
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
      this.openBogdanUpgrades();
      return true;
    }
    if (propId === 'gluszec_kapliczka_cmentarz') {
      if (!this.state.flags.cmentarz_echo_ragnoslawa) {
        this.state.flags.cmentarz_echo_ragnoslawa = true;
        if (!this.state.quests.co_widziala_ragnoslawa) {
          this.state.quests.co_widziala_ragnoslawa = 'active';
        }
        const msg =
          '🕯️ Między nagrobkami cmentarza niesie się cichy szept przypominający głos Ragnosławy — wskazuje na Szklane Wzgórza, gdzie spadła gwiazda. Opowiedz o tym Siostrze Halinie w Kapliczce na Rozstajach.';
        this.engine.addLog(msg, 'important');
        this.ui?.showNarrative({
          title: 'Echo z kamieni — Ragnosława',
          subtitle: 'Cmentarz w Głuszcu',
          artId: 'gluszec',
          text: msg,
          buttonLabel: 'Zapamiętaj',
          onContinue: () => this.refreshHubPanel()
        });
        this.refreshHubPanel();
        this.onAutoSave?.();
      } else {
        this.engine.addLog('🕯️ Na cmentarzu panuje cisza. Porozmawiaj z Siostrą Haliną w Kapliczce na Rozstajach.', 'info');
      }
      return true;
    }
    if (propId === 'gluszec_studnia') {
      this.engine.addLog('💧 Studnia w Głuszcu — chłodna woda z głębokiego źródła.', 'info');
      return true;
    }
    if (propId === 'gluszec_drogowskaz') {
      if (this.state.flags.akt3a_koniec && !this.chapter2Completed) {
        if (this.state.flags.papiery_falszywe) {
          this.finishChapter2(false);
        } else {
          this.engine.addLog(
            '⚠️ Przy bramie czeka Cesarska Obława — bez fałszywych papierów musisz przebić się przez Wzgórze Wartownicze!',
            'critical'
          );
          this.enterWzgorzeWartownicze(true);
        }
      } else {
        this.openTravelModal();
      }
      return true;
    }
    if (
      propId === 'bor_drogowskaz' ||
      propId === 'stary_trakt_drogowskaz' ||
      propId === 'kapliczka_drogowskaz' ||
      propId === 'kamieniolom_drogowskaz' ||
      propId === 'bagna_drogowskaz' ||
      propId === 'wzgorze_drogowskaz' ||
      propId === 'spalona_drogowskaz' ||
      propId === 'kopalnia_drogowskaz'
    ) {
      this.returnToGluszec();
      return true;
    }
    if (propId === 'spalona_zgliszcza') {
      if (this.state.flags.spalona_osada_oczyszczona) {
        this.engine.addLog('🔥 Zgliszcza zostały już oczyszczone z szabrowników.', 'info');
      } else {
        this.enterSpalonaOsada(true);
      }
      return true;
    }
    if (propId === 'spalona_piwnica') {
      if (!this.state.flags.spalona_piwnica_zbadana) {
        this.state.flags.spalona_piwnica_zbadana = true;
        if (this.state.character) this.state.character.money += 25;
        this.addItemStack('flasza_oleju', 1);
        this.engine.addLog('📦 Ocalała piwnica: +25 gr oraz Flasza oleju!', 'important');
        this.syncHeroTo25D();
        this.onAutoSave?.();
      } else {
        this.engine.addLog('📦 Piwnica pod zgliszczami jest już pusta.', 'info');
      }
      return true;
    }
    if (propId === 'kopalnia_zyla_zelaza') {
      if (!this.state.flags.zyla_gwiezdnego_zelaza_wydobyta) {
        this.state.flags.zyla_gwiezdnego_zelaza_wydobyta = true;
        const xp = grantXp(this.state, 70, this.data);
        this.addItemStack('odlamek_szkla', 1);
        this.engine.addLog(
          `✨ Wydobyto okruch z żyły gwiezdnego żelaza (+70 XP, Poz. ${xp.newLevel})!`,
          'important'
        );
        this.syncHeroTo25D();
        this.refreshHubPanel();
        this.onAutoSave?.();
      } else {
        this.engine.addLog('⛏️ Żyła gwiezdnego żelaza została już wyeksploatowana.', 'info');
      }
      return true;
    }
    if (propId === 'kopalnia_zalana_sztolnia') {
      if (this.state.flags.stara_kopalnia_oczyszczona) {
        this.engine.addLog('⛏️ W zalanej sztolni zapanowała cisza.', 'info');
      } else {
        this.enterStaraKopalnia(true);
      }
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
        this.addItemStack('szara_trzcina', 1);
        this.engine.addLog(
          '🌿 Zebrałeś Szarą Trzcinę na moczarach! Zanieś ją Znachorce Dobrawie w Głuszcu.',
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
      this.state.flags.woz_znaleziony = true;
      if (this.state.flags.stary_trakt_wilki_pokonane) {
        this.engine.addLog('🛞 Rozbity wóz karawany został już dokładnie przeszukany. Zdaj relację Furmanowi Sieciechowi.', 'info');
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
    if (npcId === 'npc_mlynarz_radosz') {
      this.runDialogue('radosz');
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
    if (npcId === 'npc_pogorzelec_chwalislaw') {
      this.engine.addLog(
        'Pogorzelec Chwalisław: „Przyszli nocą, spalili dachy i zabrali konie. W piwnicy pod chatą jeszcze coś zostało — weź, jeśli przepędzisz szabrowników.”',
        'info'
      );
      return true;
    }
    if (npcId === 'npc_pustelnik_rudy') {
      this.engine.addLog(
        'Pustelnik Rudy: „Ta niebieska żyła w skale nie jest ze zwykłego żelaza. Spadła z nieba dawno temu... i przyciąga zmory ze sztolni.”',
        'info'
      );
      return true;
    }
    return false;
  }

  private runDialogue(dialogueId: string): void {
    const session = startOstrzeDialogue(dialogueId, this.state, this.data);
    if (!this.ui) {
      this.checkAndCompleteSideQuests();
      return;
    }
    this.ui.showDialogue(session, {
      onClosed: () => {
        this.checkAndCompleteSideQuests();
        if (this.state.flags.kowal_gluszec_sklep) {
          this.state.flags.kowal_gluszec_sklep = false;
          this.openBogdanUpgrades();
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
        },
        {
          id: 'spalona_osada',
          name: '🏚️ Spalona Osada',
          subtitle: 'Zgliszcza, ocalała piwnica i obóz szabrowników.',
          travelMinutes: 140,
          isCurrent: currentLoc === 'spalona_osada'
        },
        {
          id: 'stara_kopalnia',
          name: '⛏️ Stara Kopalnia',
          subtitle: 'Zalana sztolnia i żyła gwiezdnego żelaza.',
          travelMinutes: 150,
          isCurrent: currentLoc === 'stara_kopalnia'
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
        else if (destId === 'spalona_osada') this.enterSpalonaOsada(false);
        else if (destId === 'stara_kopalnia') this.enterStaraKopalnia(false);
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
      } else if (stage === 'spalona_osada_hunt') {
        this.state.flags.spalona_osada_oczyszczona = true;
        this.state.character.money += 45;
        const xp = grantXp(this.state, 90, this.data);
        this.engine.addLog(
          `🏆 Spalona Osada oczyszczona z szabrowników! +45 gr, +90 XP (Poz. ${xp.newLevel}).`,
          'important'
        );
        this.ui?.showToast('Spalona Osada oczyszczona (+45 gr, +90 XP)', 'success');
      } else if (stage === 'stara_kopalnia_hunt') {
        this.state.flags.stara_kopalnia_oczyszczona = true;
        this.state.character.money += 55;
        const xp = grantXp(this.state, 120, this.data);
        this.engine.addLog(
          `🏆 Zmora i utopce w Starej Kopalni pokonane! +55 gr, +120 XP (Poz. ${xp.newLevel}).`,
          'important'
        );
        this.ui?.showToast('Stara Kopalnia oczyszczona (+55 gr, +120 XP)', 'success');
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
      wzgorze_wartownicze: 'Wzgórze Wartownicze (Akt II)',
      spalona_osada: 'Spalona Osada (Akt II)',
      stara_kopalnia: 'Stara Kopalnia (Akt II)'
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
      const soltysUrgent =
        !this.state.flags.soltys_przyjal ||
        Boolean(this.state.flags.nocleg_oplacony && !this.state.flags.soltys_potwierdzil) ||
        Boolean(
          this.state.flags.znachorka_wskazala &&
            this.state.flags.kowal_wskazal &&
            !this.state.flags.soltys_donosiciel_zamkniete
        );
      this.engine.setNpcMarker('npc_soltys_gluszec', soltysUrgent ? '❗' : '💬');

      const karczmarzUrgent =
        !this.state.flags.nocleg_oplacony ||
        Boolean(this.state.flags.radosz_rozmowa && !this.state.flags.mruk_dlug_rozliczony);
      this.engine.setNpcMarker('npc_karczmarz_kogut', karczmarzUrgent ? '❗' : '🍺');

      this.engine.setNpcMarker(
        'npc_najemnik_kogut',
        !this.state.flags.najemnik_rozwiazany ? '❗' : '💬'
      );
      this.engine.setNpcMarker('npc_kramarz_gluszec', '🛒');

      const bogdanUrgent =
        Boolean(this.state.flags.wzgorze_zwiad && !this.state.flags.kowal_zwiad_zamkniety) ||
        Boolean(this.state.flags.zyla_gwiezdnego_zelaza_wydobyta && !this.state.flags.bogdan_gwiezdne_ostrze);
      this.engine.setNpcMarker('npc_kowal_bogdan', bogdanUrgent ? '❗' : '⚒️');

      const znachorkaUrgent =
        Boolean(this.hasItem('szara_trzcina') && !this.state.flags.trzcina_oddana);
      this.engine.setNpcMarker('npc_zielarka_znachorka', znachorkaUrgent ? '❗' : '🌿');

      const gajowyUrgent =
        !this.state.flags.gajowy_zamkniete &&
        (!this.state.quests.klusownik_i_gajowy || Boolean(this.state.flags.stach_rozmowa));
      this.engine.setNpcMarker('npc_wartownik_gajowy', gajowyUrgent ? '❗' : '💬');

      const kopaczUrgent =
        Boolean(this.state.flags.halina_przeczytala && !this.state.flags.kopacz_listy_zamkniete);
      this.engine.setNpcMarker('npc_kopacz_jerzy', kopaczUrgent ? '❗' : '💬');

      const wdowaUrgent =
        Boolean(this.state.flags.grob_odwiedzony && !this.state.flags.wdowa_zamknieta);
      this.engine.setNpcMarker('npc_zona_wdowa_jaga', wdowaUrgent ? '❗' : '💬');

      const radoszUrgent =
        this.state.quests.dlug_mlynarza === 'active' && !this.state.flags.radosz_rozmowa;
      this.engine.setNpcMarker('npc_mlynarz_radosz', radoszUrgent ? '❗ Radosz' : '💬 Radosz');
    } else if (loc === 'bor_klusownikow') {
      this.engine.setNpcMarker('npc_stach_bor', !this.state.flags.stach_rozmowa ? '❗ Stach' : '💬 Stach');
    } else if (loc === 'stary_trakt') {
      this.engine.setNpcMarker(
        'npc_furman_sieciech',
        Boolean(this.state.flags.woz_znaleziony && !this.state.flags.furman_zamkniety)
          ? '❗ Furman'
          : '💬 Furman'
      );
    } else if (loc === 'kapliczka_rozstaje') {
      const halinaUrgent =
        Boolean(this.state.flags.cmentarz_echo_ragnoslawa && !this.state.flags.halina_echo) ||
        !this.state.flags.halina_przeczytala;
      this.engine.setNpcMarker('npc_halina_kapliczka', halinaUrgent ? '❗ Siostra Halina' : '💬 Siostra Halina');
      this.engine.setNpcMarker('npc_pustelnik_rozstaje', '💬 Pustelnik');
    } else if (loc === 'kamieniolom') {
      this.engine.setNpcMarker(
        'npc_dozorca_wincenty',
        Boolean(this.state.flags.ranny_pomoc && !this.state.flags.dozorca_zamkniete) ? '❗ Dozorca' : '💬 Dozorca'
      );
      this.engine.setNpcMarker(
        'npc_ranny_gornik',
        !this.state.flags.ranny_pomoc ? '❗ Ranny Górnik' : '💬 Górnik'
      );
    } else if (loc === 'bagna_szarej_wody') {
      this.engine.setNpcMarker('npc_zielarka_bagna', '🌿 Zielarka');
    } else if (loc === 'wzgorze_wartownicze') {
      this.engine.setNpcMarker('npc_pasterz_wzgorze', '❗ Pasterz');
    } else if (loc === 'spalona_osada') {
      this.engine.setNpcMarker('npc_pogorzelec_chwalislaw', '💬 Chwalisław');
    } else if (loc === 'stara_kopalnia') {
      this.engine.setNpcMarker('npc_pustelnik_rudy', '💬 Pustelnik Rudy');
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
    } else if (targetScene === 'wzgorze_wartownicze') {
      this.engine.registerCustomScene(createWzgorzeWartowniczeScene({ withHunt: false }));
    } else if (targetScene === 'spalona_osada') {
      this.engine.registerCustomScene(createSpalonaOsadaScene({ withHunt: false }));
    } else {
      this.engine.registerCustomScene(createStaraKopalniaScene({ withHunt: false }));
    }
    this.engine.loadCustomScene(targetScene);
    ostrzeAudio.setAmbience(
      targetScene === 'gluszec'
        ? 'town'
        : targetScene === 'kapliczka_rozstaje' || targetScene === 'wzgorze_wartownicze'
          ? 'dawn'
          : targetScene === 'kamieniolom' ||
              targetScene === 'bagna_szarej_wody' ||
              targetScene === 'spalona_osada' ||
              targetScene === 'stara_kopalnia'
            ? 'creepy_forest'
            : 'forest'
    );
    this.syncHeroTo25D();
    this.refreshHubPanel();
  }
}
