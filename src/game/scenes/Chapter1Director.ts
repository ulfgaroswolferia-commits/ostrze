import { generateRandomCharacterRecipe } from '@ulf/assets/characterBakery';
import { createDefaultProficiencies } from '@ulf/rpg/combatSystem';
import type { ActorEntity } from '@ulf/rpg/gameLoop';
import type { OstrzeEngineState } from '../../engine-bridge/OstrzeEngineState';
import { ostrzeAudio } from '../audio/ostrzeAudio';
import { findOriginEnemy, ORIGIN_DATA } from '../data/originData';
import type { OriginGameData, OriginTravelEventDef, OriginTravelSceneDef, OstrzeGameState } from '../data/originTypes';
import {
  createKamiennaPrzeleczScene,
  createLesniczowkaScene,
  createRuinyStraznicyScene,
  createStaryMlynScene,
  createTraktKupieckiScene,
  createWilczaNoraScene,
  createWilczyBrodScene,
  createWilczyLasScene
} from '../maps/chapter1Maps';
import { createTraktZasadzkaScene } from '../maps/prologueMaps';
import { grantXp } from '../rules/character';
import { evaluateCondition } from '../rules/conditions';
import type { SeededRng } from '../rules/dice';
import { startOstrzeDialogue } from '../rules/dialogueEngine';
import { getStats } from '../rules/stats';
import { advanceMinutes, clockOf, timeOfDay, waitUntilHour } from '../rules/time';
import {
  getOstrzeLocationMeta,
  getVisitedOstrzeLocations,
  markOstrzeLocationVisited,
  rollOriginTravelEncounter
} from '../rules/travel';
import type { OstrzeModalUi } from '../ui/OstrzeModalUi';

export type Chapter1CombatStage =
  | 'none'
  | 'wilcza_nora'
  | 'eskorta_ostromira'
  | 'wilczy_las_hunt'
  | 'trakt_kupiecki_hunt'
  | 'lesniczowka_hunt'
  | 'ruiny_straznicy_hunt'
  | 'travel_encounter';

const CHAPTER1_QUEST_IDS = new Set([
  'wilcza_nora',
  'eskorta_ostromira',
  'lek_dla_wrzoska',
  'zboze_dla_mlyna',
  'dlug_kupca',
  'list_do_lesniczego',
  'kto_pyta_o_ocalalych',
  'swiatlo_w_mlynie',
  'zaginiony_pasterz_borek',
  'amulet_z_ruin'
]);

const SATELLITE_SCENES = new Set([
  'wilczy_las',
  'stary_mlyn',
  'trakt_kupiecki',
  'lesniczowka',
  'ruiny_straznicy'
]);

export class Chapter1Director {
  public readonly engine: OstrzeEngineState;
  public readonly data: OriginGameData;
  public readonly state: OstrzeGameState;
  public readonly rng: SeededRng;
  private ui: OstrzeModalUi | null;
  private readonly onUiRefresh?: () => void;

  public activeCombatStage: Chapter1CombatStage = 'none';
  public chapter1Completed = false;
  private pendingTravel: {
    destId: string;
    afterVictoryText?: string;
    afterFleeText?: string;
  } | null = null;
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

    this.registerChapter1Scenes();
  }

  public attachUi(ui: OstrzeModalUi): void {
    this.ui = ui;
  }

  private registerChapter1Scenes(): void {
    this.engine.registerCustomScene(createWilczyBrodScene());
    this.engine.registerCustomScene(createWilczaNoraScene());
    this.engine.registerCustomScene(createKamiennaPrzeleczScene());
    this.engine.registerCustomScene(createWilczyLasScene());
    this.engine.registerCustomScene(createStaryMlynScene());
    this.engine.registerCustomScene(createTraktKupieckiScene());
    this.engine.registerCustomScene(createLesniczowkaScene());
    this.engine.registerCustomScene(createRuinyStraznicyScene());
  }

  public hasBrzezinaMemoryEchoAvailable(): boolean {
    const hasItem = (id: string): boolean =>
      this.state.inventory.items.some((i) => i.id === id && i.qty > 0);
    const hasRagnoslawa = hasItem('miedziak_ragnoslawy') && !this.state.flags.echo_ragnoslawa_toast;
    const hasWojmir = hasItem('list_wojmira') && !this.state.flags.echo_wojmir_list;
    const hasSkarimir = hasItem('kosc_skarimira') && !this.state.flags.echo_skarimir_kosc;
    const ocalaliStatus = this.state.quests.kto_pyta_o_ocalalych;
    const hasAnyBond =
      (this.state.vars.wiez_skarimir ?? 0) >= 1 ||
      (this.state.vars.wiez_ragnoslawa ?? 0) >= 1 ||
      (this.state.vars.wiez_wojmir ?? 0) >= 1;
    const hasOcalaliEcho =
      (ocalaliStatus === 'active' || ocalaliStatus === 'completed') &&
      !this.state.flags.echo_ocalali_wspomnienie &&
      hasAnyBond;
    return hasRagnoslawa || hasWojmir || hasSkarimir || hasOcalaliEcho;
  }

  public openBrzezinaMemoryEcho(): void {
    this.runDialogue('wilczy_brod_pamiec_brzeziny');
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

  private revealPlace(placeId: string): void {
    if (!this.state.world.knownPlaces.includes(placeId)) {
      this.state.world.knownPlaces.push(placeId);
    }
  }

  private isPlaceKnown(placeId: string): boolean {
    return this.state.world.knownPlaces.includes(placeId);
  }

  private syncHeroTo25D(): void {
    if (!this.state.character) return;
    this.engine.syncFromOstrzeState(this.state, this.data);
    this.onUiRefresh?.();
  }

  private bindHubHooks(): void {
    this.engine.onNpcInteract = (npcId) => this.handleNpcInteract(npcId);
    this.engine.onPropInteract = (propId) => this.handlePropInteract(propId);
    this.engine.onCombatEnded = (outcome) => this.handleCombatEnded(outcome);
  }

  public handlePropInteract(propId: string): boolean {
    if (propId === 'wb_tablica') {
      this.openNoticeBoard();
      return true;
    }
    if (propId === 'wb_kramik') {
      this.openShop('kramarz_brod');
      return true;
    }
    if (propId === 'wb_karczma') {
      this.restAtInn();
      return true;
    }
    if (propId === 'wb_ognisko') {
      this.engine.addLog('🔥 Przy ognisku strażniczym grzeją się wartownicy. Jeśli potrzebujesz odpoczynku, zajrzyj do Izby.', 'info');
      return true;
    }
    if (propId === 'wb_studnia') {
      this.engine.addLog('💧 Zimna woda ze studni w Wilczym Brodzie orzeźwia po marszu.', 'info');
      return true;
    }
    if (propId === 'wb_drogowskaz' || propId === 'brzezina_drogowskaz') {
      if (propId === 'wb_drogowskaz' && this.state.flags.akt2_koniec && !this.chapter1Completed) {
        this.finishChapter1();
      } else if (getVisitedOstrzeLocations(this.state).length >= 2) {
        this.openTravelModal();
      } else {
        this.engine.addLog('🪧 Drogowskaz wskazuje okoliczne szlaki i Kamienną Przełęcz. Wybierz cel z panelu u góry lub porozmawiaj z Ostromirem.', 'important');
      }
      return true;
    }

    // Satellite map props
    if (
      propId === 'las_drogowskaz' ||
      propId === 'mlyn_drogowskaz' ||
      propId === 'trakt_k_drogowskaz' ||
      propId === 'lesniczowka_drogowskaz' ||
      propId === 'ruiny_drogowskaz'
    ) {
      this.returnToWilczyBrod();
      return true;
    }
    if (propId === 'las_polana_ziol') {
      this.handleNpcInteract('npc_las_polana');
      return true;
    }
    if (propId === 'las_slady_borka') {
      this.handleNpcInteract('npc_las_slady');
      return true;
    }
    if (propId === 'mlyn_budynek' || propId === 'mlyn_wnetrze_krysztal') {
      this.handleNpcInteract('npc_mlyn_wnetrze');
      return true;
    }
    if (propId === 'trakt_k_woz') {
      this.handleNpcInteract('npc_trakt_ostromir');
      return true;
    }
    if (propId === 'trakt_k_ognisko') {
      this.handleNpcInteract('npc_trakt_zwiadowcy');
      return true;
    }
    if (propId === 'lesniczowka_schowek') {
      this.inspectLesniczowkaStash();
      return true;
    }
    if (propId === 'ruiny_rumowisko') {
      this.handleNpcInteract('npc_borek_ruiny');
      return true;
    }
    if (propId === 'ruiny_mur_znak') {
      this.handleNpcInteract('npc_ruiny_mur');
      return true;
    }
    return false;
  }

  public openNoticeBoard(): void {
    if (!this.ui) return;
    const noraDone = this.state.quests.wilcza_nora === 'completed';
    const noraActive = this.state.quests.wilcza_nora === 'active';
    const lekDone = this.state.quests.lek_dla_wrzoska === 'completed';
    const lekActive = this.state.quests.lek_dla_wrzoska === 'active';
    const zbozeDone = this.state.quests.zboze_dla_mlyna === 'completed';
    const zbozeActive = this.state.quests.zboze_dla_mlyna === 'active';
    const swiatloDone = this.state.quests.swiatlo_w_mlynie === 'completed';
    const swiatloActive = this.state.quests.swiatlo_w_mlynie === 'active';
    const ocalaliDone = this.state.quests.kto_pyta_o_ocalalych === 'completed';
    const ocalaliActive = this.state.quests.kto_pyta_o_ocalalych === 'active';
    const eskortaDone = this.state.quests.eskorta_ostromira === 'completed';
    const eskortaActive = this.state.quests.eskorta_ostromira === 'active';

    this.ui.showNoticeBoard(
      [
        {
          id: 'nb_nora',
          title: 'Zlecenie: Wataha z Wilczej Nory',
          author: 'Komendant Wszebor — Strażnica Wilczy Bród',
          reward: '25 gr + 40 XP',
          body: 'Wilki zagnieździły się w wąwozie na północ od brodu i napadają na patrole. Kto oczyści norę i przyniesie dowód komendantowi, odbierze żołd.',
          actionLabel: noraDone
            ? '✓ Ukończono'
            : noraActive
              ? 'Wyrusz do Wilczej Nory'
              : 'Przyjmij zlecenie',
          actionDisabled: noraDone,
          onAction: () => {
            this.ui?.closeAll();
            if (!noraActive) {
              this.state.quests.wilcza_nora = 'active';
              this.ui?.showToast('Przyjęto zlecenie: Wilcza Nora', 'gold');
              this.refreshHubPanel();
            } else {
              this.startWilczaNoraQuest();
            }
          }
        },
        {
          id: 'nb_lek',
          title: 'Zlecenie: Lek dla Wrzoska',
          author: 'Karczmarz Wrzosek — Karczma „Pod Wilczym Kłem”',
          reward: '10 gr + 30 XP',
          body: 'Karczmarz Wrzosek cierpi po wczorajszym i płaci za ziela z leśnej polany w Lesie Rubieży.',
          actionLabel: lekDone
            ? '✓ Ukończono'
            : lekActive
              ? 'Idź do Lasu Rubieży'
              : 'Przyjmij zlecenie',
          actionDisabled: lekDone,
          onAction: () => {
            this.ui?.closeAll();
            this.revealPlace('wilczy_las');
            if (!lekActive) {
              this.state.quests.lek_dla_wrzoska = 'active';
              this.ui?.showToast('Przyjęto zlecenie: Lek dla Wrzoska', 'gold');
              this.refreshHubPanel();
            } else {
              this.enterWilczyLas();
            }
          }
        },
        {
          id: 'nb_zboze',
          title: 'Ogłoszenie: Zboże dla młyna',
          author: 'Stary Młyn nad Rzeką',
          reward: '12 gr + 30 XP',
          body: 'Ktoś pozbywa się worka zboża i szuka kogoś, kto zaniesie go młynarzowi Ostapowi nad rzekę i przekaże wiadomość karczmarzowi Wrzoskowi.',
          actionLabel: zbozeDone
            ? '✓ Ukończono'
            : zbozeActive
              ? 'Idź do Starego Młyna'
              : 'Weź worek zboża i przyjmij',
          actionDisabled: zbozeDone,
          onAction: () => {
            this.ui?.closeAll();
            this.revealPlace('stary_mlyn');
            if (!zbozeActive) {
              this.state.quests.zboze_dla_mlyna = 'active';
              if (!this.hasItem('worek_zboza') && !this.state.flags.ostap_zboze) {
                this.addItemStack('worek_zboza', 1);
              }
              this.ui?.showToast('Przyjęto zlecenie: Zboże dla młyna (+Worek zboża)', 'gold');
              this.refreshHubPanel();
            } else {
              this.enterStaryMlyn();
            }
          }
        },
        {
          id: 'nb_swiatlo',
          title: 'Zlecenie: Światło w młynie',
          author: 'Młynarz Ostap & Kowal Zbych',
          reward: '10 gr + 40 XP',
          body: 'Ostap twierdzi, że po zmroku w starym młynie świeci coś zimnego. Zajrzyj tam nocą, znajdź źródło blasku i pokaż znalezisko kowalowi Zbychowi w kuźni.',
          actionLabel: swiatloDone
            ? '✓ Ukończono'
            : swiatloActive
              ? 'Idź do Starego Młyna'
              : 'Przyjmij zlecenie',
          actionDisabled: swiatloDone,
          onAction: () => {
            this.ui?.closeAll();
            this.revealPlace('stary_mlyn');
            if (!swiatloActive) {
              this.state.quests.swiatlo_w_mlynie = 'active';
              this.ui?.showToast('Przyjęto zlecenie: Światło w młynie', 'gold');
              this.refreshHubPanel();
            } else {
              this.enterStaryMlyn();
            }
          }
        },
        {
          id: 'nb_ocalali',
          title: 'Zlecenie: Kto pyta o ocalałych',
          author: 'Strażnica Wilczy Bród',
          reward: '25 gr + 50 XP',
          body: 'Na Trakcie Kupieckim kręcą się zwiadowcy i po zmierzchu przy ognisku zadają niewłaściwe pytania o ocalałych z Brzeziny. Dowiedz się, kogo szukają, i zamelduj komendantowi.',
          actionLabel: ocalaliDone
            ? '✓ Ukończono'
            : ocalaliActive
              ? 'Idź na Trakt Kupiecki'
              : 'Przyjmij zlecenie',
          actionDisabled: ocalaliDone,
          onAction: () => {
            this.ui?.closeAll();
            this.revealPlace('trakt_kupiecki');
            if (!ocalaliActive) {
              this.state.quests.kto_pyta_o_ocalalych = 'active';
              this.ui?.showToast('Przyjęto zlecenie: Kto pyta o ocalałych', 'gold');
              this.refreshHubPanel();
            } else {
              this.enterTraktKupiecki();
            }
          }
        },
        {
          id: 'nb_eskorta',
          title: 'Kontrakt: Eskorta wozu na Kamienną Przełęcz',
          author: 'Kupiec Ostromir — Plac targowy',
          reward: '40 gr + 2 prowiant + 80 XP',
          body: 'Szlak przez Kamienną Przełęcz roi się od maruderów. Potrzebny zbrojny towarzysz do ochrony ładunku.',
          actionLabel: eskortaDone
            ? '✓ Ukończono'
            : eskortaActive
              ? 'Eskortuj wóz na Przełęcz'
              : 'Porozmawiaj z Ostromirem',
          actionDisabled: eskortaDone,
          onAction: () => {
            this.ui?.closeAll();
            if (eskortaActive) {
              this.startOstromirEscort();
            } else {
              this.handleNpcInteract('npc_ostromir');
            }
          }
        }
      ],
      () => this.refreshHubPanel()
    );
  }

  /**
   * Transitions from the end of Prologue into Rozdział I: Strażnica Wilczy Bród.
   */
  public enterWilczyBrod(opts?: { skipIntro?: boolean }): void {
    this.bindHubHooks();
    this.chapter1Completed = false;
    this.engine.clearAllNpcMarkers();
    this.state.world.location = 'wilczy_brod';
    this.revealPlace('wilczy_brod');
    markOstrzeLocationVisited(this.state, 'wilczy_brod');

    this.engine.loadCustomScene('wilczy_brod');
    ostrzeAudio.setAmbience('town');
    this.syncHeroTo25D();

    const showHub = (): void => {
      this.engine.addLog(
        '🏰 Dotarłeś do Strażnicy Wilczy Bród (Rozdział I). Kliknij na postacie w świecie 2.5D lub użyj panelu strażnicy.',
        'important'
      );
      this.refreshHubPanel();
    };

    if (opts?.skipIntro || !this.ui) {
      showHub();
      return;
    }

    const intro = this.data.story.scenes.find((s) => s.id === 'demo_kurier');
    advanceMinutes(this.state, 480, this.data);
    this.ui.showNarrative({
      title: typeof intro?.title === 'string' ? intro.title : 'Wilczy Bród',
      subtitle: 'Rozdział I — Strażnica na Pogórzu',
      text: typeof intro?.text === 'string' ? intro.text : '',
      buttonLabel: 'Wejdź do strażnicy',
      onContinue: showHub
    });
  }

  public returnToWilczyBrod(travelMinutes = 45): void {
    advanceMinutes(this.state, travelMinutes, this.data);
    this.state.world.location = 'wilczy_brod';
    this.engine.loadCustomScene('wilczy_brod');
    ostrzeAudio.setAmbience('town');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    this.onAutoSave?.();
  }

  public enterWilczyLas(withHunt = false): void {
    this.bindHubHooks();
    this.revealPlace('wilczy_las');
    if (!withHunt) {
      advanceMinutes(this.state, 90, this.data);
    }
    this.state.world.location = 'wilczy_las';
    this.engine.registerCustomScene(createWilczyLasScene({ withHunt }));
    this.engine.loadCustomScene('wilczy_las');
    ostrzeAudio.setAmbience('forest');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    if (withHunt) {
      this.activeCombatStage = 'wilczy_las_hunt';
      this.engine.addLog('🐗 Legowisko w gęstwinie Lasu Rubieży — dzik i dwa wilki ruszają do ataku!', 'combat');
      this.engine.startCombatWithEnemy('enemy_las_dzik');
      this.onUiRefresh?.();
    } else {
      this.engine.addLog('🌲 Dotarłeś do Lasu Rubieży. Zbadaj Polanę Ziół (❗) lub Ślady za Polaną (❗).', 'important');
    }
  }

  public enterStaryMlyn(): void {
    this.bindHubHooks();
    this.revealPlace('stary_mlyn');
    if (this.state.world.location !== 'stary_mlyn') {
      advanceMinutes(this.state, 35, this.data);
    }
    const isNight = timeOfDay(this.state.time.minutes, this.data.rules) === 'noc';
    this.state.world.location = 'stary_mlyn';
    this.engine.registerCustomScene(createStaryMlynScene({ isNight }));
    this.engine.loadCustomScene('stary_mlyn');
    ostrzeAudio.setAmbience(isNight ? 'creepy_forest' : 'dawn');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    this.engine.addLog(
      isNight
        ? '🌙 Stary Młyn nocą — wewnątrz pod kołem zębatym coś pulsuje zimnym blaskiem!'
        : '⚙️ Dotarłeś pod Stary Młyn nad rzeką. Porozmawiaj z młynarzem Ostapem (❗) lub zbadaj wnętrze młyna.',
      'important'
    );
  }

  public enterTraktKupiecki(withHunt = false): void {
    this.bindHubHooks();
    this.revealPlace('trakt_kupiecki');
    if (!withHunt && this.state.world.location !== 'trakt_kupiecki') {
      advanceMinutes(this.state, 180, this.data);
    }
    this.state.world.location = 'trakt_kupiecki';
    this.engine.registerCustomScene(createTraktKupieckiScene({ withHunt }));
    this.engine.loadCustomScene('trakt_kupiecki');
    ostrzeAudio.setAmbience('forest');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    if (withHunt) {
      this.activeCombatStage = 'trakt_kupiecki_hunt';
      this.engine.addLog('⚔️ Rozbójnicy w krzakach przy Trakcie Kupieckim!', 'combat');
      this.engine.startCombatWithEnemy('enemy_trakt_rabus_1');
      this.onUiRefresh?.();
    } else {
      this.engine.addLog('🛞 Trakt Kupiecki — podejdź do wozu Ostromira (❗) lub ogniska zwiadowców (❗).', 'important');
    }
  }

  public enterLesniczowka(withHunt = false): void {
    this.bindHubHooks();
    this.revealPlace('lesniczowka');
    if (!withHunt && this.state.world.location !== 'lesniczowka') {
      advanceMinutes(this.state, 240, this.data);
    }
    this.state.world.location = 'lesniczowka';
    this.engine.registerCustomScene(createLesniczowkaScene({ withHunt }));
    this.engine.loadCustomScene('lesniczowka');
    ostrzeAudio.setAmbience('forest');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    if (withHunt) {
      this.activeCombatStage = 'lesniczowka_hunt';
      this.engine.addLog('🏹 Kłusownicy przy sidłach w zagajniku za Leśniczówką!', 'combat');
      this.engine.startCombatWithEnemy('enemy_klusownik_1');
      this.onUiRefresh?.();
    } else {
      this.engine.addLog('🏡 Dotarłeś do Leśniczówki. Porozmawiaj z Leśniczym (❗) lub sprawdź skrytkę pod dębem.', 'important');
    }
  }

  public enterRuinyStraznicy(withHunt = false): void {
    this.bindHubHooks();
    this.revealPlace('ruiny_straznicy');
    if (!withHunt && this.state.world.location !== 'ruiny_straznicy') {
      advanceMinutes(this.state, 180, this.data);
    }
    this.state.world.location = 'ruiny_straznicy';
    this.engine.registerCustomScene(createRuinyStraznicyScene({ withHunt }));
    this.engine.loadCustomScene('ruiny_straznicy');
    ostrzeAudio.setAmbience('creepy_forest');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    if (withHunt) {
      this.activeCombatStage = 'ruiny_straznicy_hunt';
      this.engine.addLog('⚔️ Obóz zbójców pod osypanym murem w Ruinach Strażnicy!', 'combat');
      this.engine.startCombatWithEnemy('enemy_ruiny_rabus_1');
      this.onUiRefresh?.();
    } else {
      this.engine.addLog('🏚️ Ruiny Strażnicy na wzgórzu — przeszukaj rumowisko (❗ Pasterz Borek) lub mur ze znakiem (❗).', 'important');
    }
  }

  public refreshHubPanel(): void {
    if (!this.ui) return;
    const loc = this.state.world.location;
    if (loc !== 'wilczy_brod' && !SATELLITE_SCENES.has(loc)) {
      this.ui.setHubPanel(null);
      return;
    }

    const ch = this.state.character;
    const hpMax = ch ? getStats(this.state, this.data).derived.hpMax : 0;
    const c = clockOf(this.state.time.minutes);
    const tod = timeOfDay(this.state.time.minutes, this.data.rules);
    const clockText = `Dzień ${c.day}, ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')} (${tod})`;

    const actions: Array<{ id: string; label: string; disabled?: boolean; alert?: boolean; onClick: () => void }> = [];

    if (loc === 'wilczy_brod') {
      actions.push(
        {
          id: 'open_tablica',
          label: '📋 Tablica Zleceń',
          onClick: () => this.openNoticeBoard()
        },
        {
          id: 'talk_wszebor',
          label: 'Komendant Wszebor',
          onClick: () => this.handleNpcInteract('npc_wszebor')
        },
        {
          id: 'talk_wrzosek',
          label: 'Karczma (Wrzosek)',
          onClick: () => this.handleNpcInteract('npc_wrzosek')
        },
        {
          id: 'talk_kowal',
          label: 'Kuźnia (Kowal Zbych)',
          onClick: () => this.handleNpcInteract('npc_kowal_zbych')
        },
        {
          id: 'talk_zona_borka',
          label: 'Żona Borka (Studnia)',
          onClick: () => this.handleNpcInteract('npc_zona_borka')
        },
        {
          id: 'talk_corka',
          label: 'Córka strażnika',
          onClick: () => this.handleNpcInteract('npc_corka_straznika')
        },
        {
          id: 'talk_ostromir',
          label: 'Kupiec Ostromir',
          onClick: () => this.handleNpcInteract('npc_ostromir')
        },
        {
          id: 'open_kram',
          label: 'Kramik (Handel)',
          onClick: () => this.openShop('kramarz_brod')
        },
        {
          id: 'talk_szkarad',
          label: 'Rusznikarz Szkarad',
          onClick: () => this.handleNpcInteract('npc_szkarad')
        },
        {
          id: 'rest_izba',
          label: 'Izba (Odpoczynek)',
          onClick: () => this.restAtInn()
        }
      );
      if (this.hasBrzezinaMemoryEchoAvailable()) {
        actions.push({
          id: 'brzezina_memory_echo',
          label: '🕯️ Pamięć Brzeziny (Karczma)',
          alert: true,
          onClick: () => this.openBrzezinaMemoryEcho()
        });
      }

      if (this.state.quests.wilcza_nora === 'active' && !this.state.flags.nora_wykonana) {
        actions.push({
          id: 'go_wilcza_nora',
          label: '⚔️ Wilcza Nora',
          alert: true,
          onClick: () => this.startWilczaNoraQuest()
        });
      }

      if (
        this.isPlaceKnown('wilczy_las') ||
        this.state.quests.lek_dla_wrzoska === 'active' ||
        this.state.quests.zaginiony_pasterz_borek === 'active'
      ) {
        actions.push({
          id: 'go_wilczy_las',
          label: '🌲 Las Rubieży',
          alert:
            (this.state.quests.lek_dla_wrzoska === 'active' && !this.state.flags.ziola_zebrane) ||
            (this.state.quests.zaginiony_pasterz_borek === 'active' && !this.state.flags.borek_slady),
          onClick: () => this.enterWilczyLas()
        });
      }

      if (
        this.isPlaceKnown('stary_mlyn') ||
        this.state.quests.zboze_dla_mlyna === 'active' ||
        this.state.quests.swiatlo_w_mlynie === 'active'
      ) {
        actions.push({
          id: 'go_stary_mlyn',
          label: '⚙️ Stary Młyn',
          alert:
            (this.state.quests.zboze_dla_mlyna === 'active' && !this.state.flags.ostap_zboze) ||
            (this.state.quests.swiatlo_w_mlynie === 'active' && !this.state.flags.odlamek_zebrany),
          onClick: () => this.enterStaryMlyn()
        });
      }

      if (
        this.isPlaceKnown('trakt_kupiecki') ||
        this.state.quests.dlug_kupca === 'active' ||
        this.state.quests.kto_pyta_o_ocalalych === 'active'
      ) {
        actions.push({
          id: 'go_trakt_kupiecki',
          label: '🛞 Trakt Kupiecki',
          alert:
            (this.state.quests.dlug_kupca === 'active' && !this.state.flags.ostromir_dlug) ||
            (this.state.quests.kto_pyta_o_ocalalych === 'active' && !this.state.flags.zwiadowcy_slysza),
          onClick: () => this.enterTraktKupiecki()
        });
      }

      if (this.isPlaceKnown('lesniczowka') || this.state.quests.list_do_lesniczego === 'active') {
        actions.push({
          id: 'go_lesniczowka',
          label: '🏡 Leśniczówka',
          alert: this.state.quests.list_do_lesniczego === 'active' && !this.state.flags.lesniczy_list,
          onClick: () => this.enterLesniczowka()
        });
      }

      if (
        this.isPlaceKnown('ruiny_straznicy') ||
        this.state.quests.zaginiony_pasterz_borek === 'active' ||
        this.state.quests.amulet_z_ruin === 'active'
      ) {
        actions.push({
          id: 'go_ruiny',
          label: '🏚️ Ruiny Strażnicy',
          alert:
            (this.state.quests.zaginiony_pasterz_borek === 'active' && !this.state.flags.borek_znaleziony) ||
            (this.state.quests.amulet_z_ruin === 'active' && !this.state.flags.amulet_pasuje),
          onClick: () => this.enterRuinyStraznicy()
        });
      }

      if (this.state.quests.eskorta_ostromira === 'active' && !this.state.flags.akt2_koniec) {
        actions.push({
          id: 'go_eskorta',
          label: '🛡️ Eskortuj wóz na Przełęcz',
          alert: true,
          onClick: () => this.startOstromirEscort()
        });
      }

      if (this.state.flags.akt2_koniec && !this.chapter1Completed) {
        actions.push({
          id: 'finish_ch1',
          label: '⛰️ Przejdź przez Kamienną Przełęcz (Koniec Rozdziału I)',
          alert: true,
          onClick: () => this.finishChapter1()
        });
      }

      if (getVisitedOstrzeLocations(this.state).length >= 2) {
        actions.push({
          id: 'open_travel',
          label: '🧭 Podróż (Szlak)',
          alert: false,
          onClick: () => this.openTravelModal()
        });
      }
    } else if (loc === 'wilczy_las') {
      actions.push(
        {
          id: 'las_polana',
          label: this.state.flags.ziola_zebrane ? '🌿 Polana ziół (zebrano)' : '🌿 Zbierz zioła na polanie',
          alert: !this.state.flags.ziola_zebrane,
          onClick: () => this.handleNpcInteract('npc_las_polana')
        },
        {
          id: 'las_slady',
          label: this.state.flags.borek_slady ? '🐾 Ślady za polaną (zbadano)' : '🐾 Zbadaj ślady za polaną',
          alert: !this.state.flags.borek_slady,
          onClick: () => this.handleNpcInteract('npc_las_slady')
        },
        {
          id: 'las_drwal',
          label: '🪓 Porozmawiaj z Drwalem',
          onClick: () => this.handleNpcInteract('npc_las_drwal')
        },
        {
          id: 'las_hunt',
          label: '🐗 Legowisko w gęstwinie (Polowanie)',
          onClick: () => this.enterWilczyLas(true)
        },
        {
          id: 'back_wb',
          label: '🔙 Wróć do Wilczego Brodu',
          onClick: () => this.returnToWilczyBrod(90)
        }
      );
    } else if (loc === 'stary_mlyn') {
      actions.push(
        {
          id: 'mlyn_ostap',
          label: '🌾 Młynarz Ostap',
          alert: this.hasItem('worek_zboza') && !this.state.flags.ostap_zboze,
          onClick: () => this.handleNpcInteract('npc_ostap')
        },
        {
          id: 'mlyn_wnetrze',
          label: this.state.flags.odlamek_zebrany ? '✨ Wnętrze młyna (zbadano)' : '🔍 Zbadaj wnętrze młyna',
          alert: tod === 'noc' && !this.state.flags.odlamek_zebrany,
          onClick: () => this.handleNpcInteract('npc_mlyn_wnetrze')
        },
        {
          id: 'mlyn_zona',
          label: '💬 Żona młynarza',
          onClick: () => this.handleNpcInteract('npc_zona_mlynarza')
        }
      );
      if (tod !== 'noc' && !this.state.flags.odlamek_zebrany) {
        actions.push({
          id: 'mlyn_wait_night',
          label: '🌙 Czekaj do nocy (21:00)',
          alert: this.state.quests.swiatlo_w_mlynie === 'active',
          onClick: () => {
            waitUntilHour(this.state, 21, this.data);
            this.enterStaryMlyn();
          }
        });
      }
      actions.push({
        id: 'back_wb',
        label: '🔙 Wróć do Wilczego Brodu',
        onClick: () => this.returnToWilczyBrod(35)
      });
    } else if (loc === 'trakt_kupiecki') {
      actions.push(
        {
          id: 'trakt_ostromir',
          label: '🛞 Kupiec Ostromir przy wozie',
          alert: this.hasItem('weksel'),
          onClick: () => this.handleNpcInteract('npc_trakt_ostromir')
        },
        {
          id: 'trakt_zwiadowcy',
          label: this.state.flags.zwiadowcy_slysza ? '🔥 Ognisko zwiadowców (podsłuchano)' : '🔥 Ognisko zwiadowców',
          alert: !this.state.flags.zwiadowcy_slysza,
          onClick: () => this.handleNpcInteract('npc_trakt_zwiadowcy')
        },
        {
          id: 'trakt_pielgrzym',
          label: '💬 Pielgrzym na kamieniu',
          onClick: () => this.handleNpcInteract('npc_trakt_pielgrzym')
        },
        {
          id: 'trakt_hunt',
          label: '⚔️ Krzaki przy trakcie (Rozbójnicy)',
          onClick: () => this.enterTraktKupiecki(true)
        }
      );
      if (tod !== 'zmierzch' && tod !== 'noc' && !this.state.flags.zwiadowcy_slysza) {
        actions.push({
          id: 'trakt_wait_dusk',
          label: '🌆 Czekaj do zmierzchu (19:00)',
          alert: this.state.quests.kto_pyta_o_ocalalych === 'active',
          onClick: () => {
            waitUntilHour(this.state, 19, this.data);
            this.syncHeroTo25D();
            this.refreshHubPanel();
          }
        });
      }
      actions.push({
        id: 'back_wb',
        label: '🔙 Wróć do Wilczego Brodu',
        onClick: () => this.returnToWilczyBrod(180)
      });
    } else if (loc === 'lesniczowka') {
      actions.push(
        {
          id: 'les_lesniczy',
          label: '🏹 Leśniczy',
          alert: this.hasItem('list_komendanta'),
          onClick: () => this.handleNpcInteract('npc_lesniczy')
        },
        {
          id: 'les_schowek',
          label: this.state.flags.schowek_bylo ? '📦 Skrytka pod dębem (pusta)' : '📦 Skrytka pod dębem',
          alert: !this.state.flags.schowek_bylo,
          onClick: () => this.inspectLesniczowkaStash()
        },
        {
          id: 'les_gniewosz',
          label: '🪓 Pomocnik Gniewosz',
          onClick: () => this.handleNpcInteract('npc_gniewosz')
        },
        {
          id: 'les_pies',
          label: '🐕 Pies Burek',
          onClick: () => this.handleNpcInteract('npc_pies_burek')
        },
        {
          id: 'les_hunt',
          label: '⚔️ Sidła w zagajniku (Kłusownicy)',
          onClick: () => this.enterLesniczowka(true)
        },
        {
          id: 'back_wb',
          label: '🔙 Wróć do Wilczego Brodu',
          onClick: () => this.returnToWilczyBrod(240)
        }
      );
    } else if (loc === 'ruiny_straznicy') {
      actions.push(
        {
          id: 'ruiny_borek',
          label: this.state.flags.borek_znaleziony ? '🏚️ Rumowisko (Borek odnaleziony)' : '🏚️ Przeszukaj rumowisko (Borek)',
          alert: !this.state.flags.borek_znaleziony,
          onClick: () => this.handleNpcInteract('npc_borek_ruiny')
        },
        {
          id: 'ruiny_mur',
          label: this.state.flags.amulet_pasuje ? '🜂 Mur ze znakiem (sprawdzono)' : '🜂 Przyłóż amulet do muru',
          alert: this.hasItem('amulet_strazniczy') && !this.state.flags.amulet_pasuje,
          onClick: () => this.handleNpcInteract('npc_ruiny_mur')
        },
        {
          id: 'ruiny_czcibor',
          label: '🛡️ Wartownik Czcibor',
          onClick: () => this.handleNpcInteract('npc_czcibor')
        },
        {
          id: 'ruiny_kruk',
          label: '🐦‍⬛ Kruk między kamieniami',
          onClick: () => this.handleNpcInteract('npc_ruiny_kruk')
        },
        {
          id: 'ruiny_hunt',
          label: '⚔️ Obóz zbójców w ruinach',
          onClick: () => this.enterRuinyStraznicy(true)
        },
        {
          id: 'back_wb',
          label: '🔙 Wróć do Wilczego Brodu',
          onClick: () => this.returnToWilczyBrod(180)
        }
      );
    }

    if (ch) {
      const pendingPts = ch.freeAttributePoints + ch.freeSkillPoints + ch.freePerkPicks;
      actions.push({
        id: 'char_sheet',
        label: pendingPts > 0 ? `⬆️ Awans (+${pendingPts})` : '📜 Postać',
        alert: pendingPts > 0,
        onClick: () => {
          this.ui?.showCharacterSheet(() => {
            this.syncHeroTo25D();
            this.refreshHubPanel();
            this.onAutoSave?.();
          });
        }
      });
    }
    if (this.onSaveRequested) {
      actions.push({
        id: 'save_game',
        label: '💾 Zapisz',
        onClick: () => this.onSaveRequested?.()
      });
    }
    if (this.onLoadRequested && this.hasSave?.()) {
      actions.push({
        id: 'load_game',
        label: '📂 Wczytaj',
        onClick: () => this.onLoadRequested?.()
      });
    }
    if (this.onKeyRequested) {
      actions.push({
        id: 'save_key',
        label: '🔑 Klucz',
        onClick: () => this.onKeyRequested?.()
      });
    }

    const activeQuests = this.data.quests
      .filter((q) => CHAPTER1_QUEST_IDS.has(q.id) && this.state.quests[q.id] === 'active')
      .map((q) => q.name);

    this.refreshChapter1Markers();

    const locationTitles: Record<string, string> = {
      wilczy_brod: 'Strażnica Wilczy Bród (Rozdział I)',
      wilczy_las: 'Las Rubieży — Pogórze (Rozdział I)',
      stary_mlyn: 'Stary Młyn nad Rzeką (Rozdział I)',
      trakt_kupiecki: 'Trakt Kupiecki (Rozdział I)',
      lesniczowka: 'Leśniczówka na Wschodzie (Rozdział I)',
      ruiny_straznicy: 'Ruiny Strażnicy na Wzgórzu (Rozdział I)'
    };

    this.ui.setHubPanel({
      title: locationTitles[loc] ?? 'Rozdział I — Pogórze',
      statusLine: `${ch?.name ?? 'Adept'} · Poz. ${ch?.level ?? 1} · HP ${ch?.hp ?? 0}/${hpMax} · ${ch?.money ?? 0} gr · ${clockText}`,
      questsLine:
        activeQuests.length > 0
          ? `Aktywne zlecenia: ${activeQuests.join(', ')}`
          : 'Brak aktywnych zleceń — zajrzyj na Tablicę Zleceń lub porozmawiaj z mieszkańcami Brodu.',
      actions
    });
  }

  public handleNpcInteract(npcId: string): boolean {
    if (npcId === 'npc_wszebor') {
      const dlgId = this.pickKomendantDialogue();
      this.runDialogue(dlgId);
      return true;
    }
    if (npcId === 'npc_wrzosek') {
      this.runDialogue('wrzosek');
      return true;
    }
    if (npcId === 'npc_kowal_zbych') {
      this.runDialogue('kowal');
      return true;
    }
    if (npcId === 'npc_zona_borka') {
      if (this.state.flags.zona_poinformowana) {
        const msg = this.state.flags.borek_kulawy
          ? 'Żona Borka nabiera wody i podśpiewuje: „Kulawy, ale w chałupie. Siedzi przy piecu i klnie na nogę, na owce i na mnie. Dobrze, że klnie.”'
          : 'Żona Borka nabiera wody i podśpiewuje: „Wrócił cały, tylko głodny jak wilk! Kaszę żre trzecią miskę. Bóg ci zapłać!”';
        this.engine.addLog(msg, 'info');
        this.ui?.showNarrative({
          title: 'Żona Borka',
          text: msg,
          buttonLabel: 'Bywaj',
          onContinue: () => this.refreshHubPanel()
        });
      } else {
        this.runDialogue('zona_borka');
      }
      return true;
    }
    if (npcId === 'npc_corka_straznika') {
      this.runDialogue('corka');
      return true;
    }
    if (npcId === 'npc_wartownik') {
      const msg = !this.state.flags.straznik_0
        ? 'Wartownik opiera się o palisadę: „Szron na pikach od samego świtu. Żołd za trzy miesiące wisi, a kwatermistrz mówi, że cesarz też biedny.”'
        : 'Wartownik: „Powiem ci coś: palisada stoi tylko dlatego, że nikt jeszcze nie próbował jej szturmować.”';
      this.state.flags.straznik_0 = true;
      this.engine.addLog(msg, 'info');
      return true;
    }
    if (npcId === 'npc_szkarad') {
      this.runDialogue('szkarad');
      return true;
    }
    if (npcId === 'npc_kramarz_brod') {
      this.openShop('kramarz_brod');
      return true;
    }
    if (npcId === 'npc_ostromir') {
      const dlgId = this.pickOstromirDialogue();
      this.runDialogue(dlgId);
      return true;
    }

    // Satellite NPCs: Las Rubieży
    if (npcId === 'npc_las_polana') {
      if (this.state.flags.ziola_zebrane) {
        this.engine.addLog('🌿 Polana wydeptana do gołej ziemi. Zioła już zostały zebrane.', 'info');
        return true;
      }
      advanceMinutes(this.state, 30, this.data);
      this.state.flags.ziola_zebrane = true;
      this.addItemStack('ziola_dla_wrzoska', 1);
      this.engine.addLog('🌿 Zebrano: Zioła dla Wrzoska! Zanieś je karczmarzowi w Wilczym Brodzie.', 'important');
      this.ui?.showToast('Zebrano: Zioła dla Wrzoska', 'gold');
      this.syncHeroTo25D();
      this.refreshHubPanel();
      this.onAutoSave?.();
      this.ui?.showNarrative({
        title: 'Polana ziół',
        subtitle: 'Las Rubieży',
        text: 'Polana pachnie żywicą i czymś gorzkim jak piołun. Kucasz w mokrych paprociach i rwiesz ziele, które karczmarze zwą lekiem, a felczerzy chwastem.',
        buttonLabel: 'Schowaj zioła do torby',
        onContinue: () => this.refreshHubPanel()
      });
      return true;
    }
    if (npcId === 'npc_las_slady') {
      const firstTime = !this.state.flags.borek_slady;
      if (firstTime) {
        advanceMinutes(this.state, 20, this.data);
        this.state.flags.borek_slady = true;
        this.revealPlace('ruiny_straznicy');
        this.engine.addLog('🐾 Odnaleziono ślady pasterza Borka wiodące ku Ruinom Strażnicy na wzgórzu!', 'important');
        this.ui?.showToast('Odkryto trop ku Ruinom Strażnicy', 'gold');
      }
      this.syncHeroTo25D();
      this.refreshHubPanel();
      this.onAutoSave?.();
      this.ui?.showNarrative({
        title: 'Ślady za polaną',
        subtitle: 'Las Rubieży',
        text: firstTime
          ? 'Za polaną ziemia zryta owczymi racicami, a między nimi ciągną się ślady ciężkich buciorów. Dalej odciski głębsze, jakby ktoś szedł obładowany. Trop skręca ku starym murom na wzgórzu (Ruiny Strażnicy).'
          : 'Ślady stare, rozmyte błotem, ale wciąż wiodą w jedną stronę: ku murom Ruin Strażnicy na wzgórzu.',
        buttonLabel: 'Dalej',
        onContinue: () => this.refreshHubPanel()
      });
      return true;
    }
    if (npcId === 'npc_las_drwal') {
      const msg =
        'Drwal rąbie pień, aż drzazgi lecą: „Z cesarskiej kancelarii przysłali pisarczyka, że za karczunek mam płacić do cesarskiej kasy. Za drzewo, co samo rosło, psiajucha!”';
      this.state.flags.drwal_0 = true;
      this.engine.addLog(msg, 'info');
      return true;
    }

    // Satellite NPCs: Stary Młyn
    if (npcId === 'npc_ostap') {
      this.runDialogue('ostap');
      return true;
    }
    if (npcId === 'npc_mlyn_wnetrze') {
      const tod = timeOfDay(this.state.time.minutes, this.data.rules);
      if (tod !== 'noc') {
        if (!this.ui) {
          waitUntilHour(this.state, 21, this.data);
          this.handleNpcInteract('npc_mlyn_wnetrze');
          return true;
        }
        this.ui.showNarrative({
          title: 'Stary młyn (za dnia)',
          text: 'Koło młyńskie stoi, a woda ledwie się przy nim rusza. W środku czuć kurz, stęchłe ziarno i zimny kamień. Ostap mówił, że dziwne światło pojawia się dopiero nocą (po 21:00).',
          buttonLabel: 'Poczekaj do nocy i zbadaj młyn',
          onContinue: () => {
            waitUntilHour(this.state, 21, this.data);
            this.enterStaryMlyn();
            this.handleNpcInteract('npc_mlyn_wnetrze');
          }
        });
        return true;
      }

      if (this.state.flags.odlamek_zebrany) {
        this.engine.addLog('🌙 Nocą młyn jest ciemny i pusty. Zimnego światła już tu nie ma.', 'info');
        return true;
      }

      advanceMinutes(this.state, 20, this.data);
      this.state.flags.odlamek_zebrany = true;
      this.addItemStack('odlamek_szkla', 1);
      this.engine.addLog('✨ Znaleziono: Odłamek ciemnego szkła pod kołem młyńskim! Pokaż go Kowalowi Zbychowi.', 'important');
      this.ui?.showToast('Zdobyto: Odłamek szkła z młyna', 'gold');
      this.syncHeroTo25D();
      this.refreshHubPanel();
      this.onAutoSave?.();
      this.ui?.showNarrative({
        title: 'Światło w młynie',
        subtitle: 'Stary Młyn nocą',
        text: 'Po zmroku w środku coś rozbłyska bladym, zimnym światłem. Idziesz za nim po skrzypiących schodkach. W kącie, pod kołem zębatym, leży odłamek ciemnego szkła i pulsuje.',
        buttonLabel: 'Zabierz odłamek szkła',
        onContinue: () => this.refreshHubPanel()
      });
      return true;
    }
    if (npcId === 'npc_zona_mlynarza') {
      const msg =
        'Żona młynarza skrobie rzepę: „Na Kupałę mnie Ostap pod młyn ciągał, wianki puszczać, a teraz mu tylko światła w młynie w głowie. Ja mówię, że to sumienie mu świeci.”';
      this.state.flags.zonamlyn_0 = true;
      this.engine.addLog(msg, 'info');
      return true;
    }

    // Satellite NPCs: Trakt Kupiecki
    if (npcId === 'npc_trakt_ostromir') {
      this.runDialogue('ostromir_trakt');
      return true;
    }
    if (npcId === 'npc_trakt_zwiadowcy') {
      if (this.state.flags.zwiadowcy_slysza) {
        this.engine.addLog('🔥 Zwiadowców już nie ma, ognisko zimne. Czas zameldować Komendantowi Wszeborowi.', 'info');
        return true;
      }
      const tod = timeOfDay(this.state.time.minutes, this.data.rules);
      if (tod !== 'zmierzch' && tod !== 'noc') {
        waitUntilHour(this.state, 19, this.data);
      }
      this.runDialogue('zwiadowcy');
      return true;
    }
    if (npcId === 'npc_trakt_pielgrzym') {
      const msg =
        'Pielgrzym siedzi na przydrożnym kamieniu: „Sąsiedzi, synku, to największy krzyż. Mój co roku miedzę o skibę przesuwa, a w niedzielę pierwszy w kościele.”';
      this.state.flags.pielgrzym_0 = true;
      this.engine.addLog(msg, 'info');
      return true;
    }

    // Satellite NPCs: Leśniczówka
    if (npcId === 'npc_lesniczy') {
      this.runDialogue('lesniczy');
      return true;
    }
    if (npcId === 'npc_gniewosz') {
      const msg =
        'Pomocnik Gniewosz wyciera czoło rękawem: „Dwa dni drogi od Brodu, a ludzie przychodzą jak do karczmy. Wczoraj jeden pytał o piwo. Mamy żurek i psa.”';
      this.state.flags.gniewosz_0 = true;
      this.engine.addLog(msg, 'info');
      return true;
    }
    if (npcId === 'npc_pies_burek') {
      const msg =
        'Wielki pies leśniczego podnosi łeb, przygląda ci się i wraca do drzemki. Zza chaty ktoś woła: „Burek! Nie szczekaj na ludzi z mieczem!”';
      this.state.flags.pies_0 = true;
      this.engine.addLog(msg, 'info');
      return true;
    }

    // Satellite NPCs: Ruiny Strażnicy
    if (npcId === 'npc_borek_ruiny') {
      if (!this.state.flags.pobojowisko_ragnoslawa && !this.state.flags.amulet_zebrany && !this.hasItem('amulet_strazniczy')) {
        this.state.flags.amulet_zebrany = true;
        this.addItemStack('amulet_strazniczy', 1);
        this.engine.addLog('✨ Znaleziono w rumowisku: Amulet strażniczy!', 'important');
      }
      if (!this.state.flags.borek_znaleziony) {
        this.state.flags.borek_slady = true;
        this.runDialogue('borek_ruiny');
        return true;
      }
      this.engine.addLog('Pasterz Borek kuśtyka już w stronę Wilczego Brodu. Poinformuj jego żonę przy studni.', 'info');
      return true;
    }
    if (npcId === 'npc_ruiny_mur') {
      if (this.state.flags.amulet_pasuje) {
        this.engine.addLog('🜂 Znak na murze został już sprawdzony — wróć do córki strażnika w Wilczym Brodzie.', 'info');
        return true;
      }
      if (!this.hasItem('amulet_strazniczy')) {
        this.engine.addLog('🧱 W głębi stoi mur z wyżłobionym wgłębieniem w kształcie znaku strażnicy.', 'info');
        return true;
      }
      advanceMinutes(this.state, 15, this.data);
      this.state.flags.amulet_pytanie = true;
      this.state.flags.amulet_pasuje = true;
      this.engine.addLog('🜂 Przyłożyłeś amulet do muru w ruinach — znak pasuje kreska w kreskę! Wróć do córki strażnika.', 'important');
      this.ui?.showToast('Znak pasuje do muru w ruinach!', 'gold');
      this.syncHeroTo25D();
      this.refreshHubPanel();
      this.onAutoSave?.();
      this.ui?.showNarrative({
        title: 'Ruiny strażnicy',
        subtitle: 'Mur z wyżłobionym znakiem',
        text: 'W głębi stoi mur z wyżłobionym znakiem. Przykładasz amulet, a kamień drży, jakby się budził ze snu. Znak pasuje, kreska w kreskę, ale drzwi się nie otwierają. Jeszcze nie. Stary strażnik miał rację.',
        buttonLabel: 'Wróć z wieścią do córki strażnika',
        onContinue: () => this.refreshHubPanel()
      });
      return true;
    }
    if (npcId === 'npc_czcibor') {
      const msg =
        'Stary wartownik Czcibor salutuje ci kijem: „Dwadzieścia lat stoję w zawalonej bramie i nikt nie przyszedł mnie zluzować. Ale i nikt nie wszedł, więc służba idzie.”';
      this.state.flags.wsiebor_0 = true;
      this.engine.addLog(msg, 'info');
      return true;
    }
    if (npcId === 'npc_ruiny_kruk') {
      const msg =
        'Między kamieniami siedzi kruk, z wyglądu mądrzejszy niż pół Brodu. Patrzy ci w oczy i kracze raz, głucho.';
      this.state.flags.kamienie_0 = true;
      this.engine.addLog(msg, 'info');
      return true;
    }

    return false;
  }

  public inspectLesniczowkaStash(): void {
    if (this.state.flags.schowek_bylo) {
      this.engine.addLog('📦 Skrzynka pod dębem stoi już otwarta i pusta.', 'info');
      return;
    }
    this.state.flags.schowek_bylo = true;
    this.addItemStack('napar_ziol', 1);
    this.addItemStack('opatrunek', 1);
    if (this.state.character) {
      this.state.character.money += 20;
    }
    this.engine.addLog('📦 Skrytka pod dębem: znaleziono Napar z ziół, Opatrunek i +20 gr!', 'important');
    this.ui?.showToast('Skrytka: Napar z ziół, Opatrunek, +20 gr', 'gold');
    this.syncHeroTo25D();
    this.refreshHubPanel();
    this.onAutoSave?.();
    this.ui?.showNarrative({
      title: 'Skrytka pod dębem',
      subtitle: 'Leśniczówka',
      text: 'Pod ułamanym dębem na skraju polany ktoś zakopał skrzynkę. W środku zioła w woreczkach, zwój czystego płótna i garść groszy (+20 gr, Napar z ziół, Opatrunek).',
      buttonLabel: 'Zabierz znalezisko',
      onContinue: () => this.refreshHubPanel()
    });
  }

  private refreshChapter1Markers(): void {
    this.engine.clearAllNpcMarkers();
    const loc = this.state.world.location;
    if (loc === 'wilczy_brod') {
      const wszeborNeedsAttention =
        Boolean(this.state.flags.nora_wykonana && !this.state.flags.nora_rozliczona) ||
        Boolean(this.state.flags.lesniczy_list && !this.state.flags.list_odpowiedz) ||
        Boolean(this.state.flags.zwiadowcy_slysza && !this.state.flags.akt3_zapowiedz) ||
        !this.state.flags.komendant_byl;
      this.engine.setNpcMarker('npc_wszebor', wszeborNeedsAttention ? '❗' : '💬');

      const wrzosekNeedsAttention =
        Boolean(this.hasItem('ziola_dla_wrzoska') && this.state.quests.lek_dla_wrzoska === 'active') ||
        Boolean(this.state.flags.ostap_zboze && !this.state.flags.wrzosek_wiadomosc) ||
        Boolean(this.hasItem('pokwitowanie') && !this.state.flags.dlug_oddany) ||
        !this.state.quests.lek_dla_wrzoska;
      this.engine.setNpcMarker('npc_wrzosek', wrzosekNeedsAttention ? '❗' : '🍺');

      const kowalNeedsAttention = Boolean(this.hasItem('odlamek_szkla') && !this.state.flags.kamien_rozpoznany);
      this.engine.setNpcMarker('npc_kowal_zbych', kowalNeedsAttention ? '❗' : '⚒️');

      const zonaBorkaNeedsAttention =
        !this.state.flags.zona_poinformowana &&
        (!this.state.quests.zaginiony_pasterz_borek || Boolean(this.state.flags.borek_znaleziony));
      this.engine.setNpcMarker('npc_zona_borka', zonaBorkaNeedsAttention ? '❗' : '💬');

      const corkaNeedsAttention =
        Boolean(this.hasItem('amulet_strazniczy') && !this.state.flags.amulet_oddany && !this.state.flags.amulet_zatrzymany);
      this.engine.setNpcMarker('npc_corka_straznika', corkaNeedsAttention ? '❗' : '💬');

      this.engine.setNpcMarker(
        'npc_ostromir',
        this.state.quests.eskorta_ostromira === 'active' || !this.state.flags.ostromir_zgoda ? '❗' : '💬'
      );
      this.engine.setNpcMarker('npc_kramarz_brod', '🛒');
      this.engine.setNpcMarker('npc_szkarad', '⚒️');
      this.engine.setNpcMarker('npc_wartownik', '💬');
      return;
    }

    if (loc === 'wilczy_las') {
      if (!this.state.flags.ziola_zebrane) {
        this.engine.setNpcMarker('npc_las_polana', '❗ Polana Ziół');
      }
      if (!this.state.flags.borek_slady) {
        this.engine.setNpcMarker('npc_las_slady', '❗ Ślady Borka');
      }
      this.engine.setNpcMarker('npc_las_drwal', '💬 Drwal');
      return;
    }

    if (loc === 'stary_mlyn') {
      this.engine.setNpcMarker('npc_ostap', this.hasItem('worek_zboza') && !this.state.flags.ostap_zboze ? '❗ Ostap' : '💬 Ostap');
      if (!this.state.flags.odlamek_zebrany) {
        this.engine.setNpcMarker('npc_mlyn_wnetrze', '❗ Wnętrze Młyna');
      }
      this.engine.setNpcMarker('npc_zona_mlynarza', '💬');
      return;
    }

    if (loc === 'trakt_kupiecki') {
      this.engine.setNpcMarker('npc_trakt_ostromir', this.hasItem('weksel') ? '❗ Weksel dla Ostromira' : '💬 Ostromir');
      if (!this.state.flags.zwiadowcy_slysza) {
        this.engine.setNpcMarker('npc_trakt_zwiadowcy', '❗ Ognisko Zwiadowców');
      }
      this.engine.setNpcMarker('npc_trakt_pielgrzym', '💬');
      return;
    }

    if (loc === 'lesniczowka') {
      this.engine.setNpcMarker('npc_lesniczy', this.hasItem('list_komendanta') ? '❗ List od Komendanta' : '💬 Leśniczy');
      this.engine.setNpcMarker('npc_gniewosz', '💬');
      this.engine.setNpcMarker('npc_pies_burek', '🐕');
      return;
    }

    if (loc === 'ruiny_straznicy') {
      if (!this.state.flags.borek_znaleziony) {
        this.engine.setNpcMarker('npc_borek_ruiny', '❗ Pasterz Borek');
      }
      if (this.hasItem('amulet_strazniczy') && !this.state.flags.amulet_pasuje) {
        this.engine.setNpcMarker('npc_ruiny_mur', '❗ Mur ze Znakiem');
      }
      this.engine.setNpcMarker('npc_czcibor', '💬 Czcibor');
      this.engine.setNpcMarker('npc_ruiny_kruk', '🐦‍⬛');
    }
  }

  private pickKomendantDialogue(): string {
    if (this.state.flags.nora_wykonana && !this.state.flags.nora_rozliczona) {
      return 'komendant_raport';
    }
    if (!this.state.flags.komendant_byl) {
      return 'komendant';
    }
    if (this.state.flags.nora_rozliczona || this.state.quests.wilcza_nora === 'failed') {
      return 'komendant_po';
    }
    if (this.state.flags.nora_zgoda && !this.state.flags.nora_wykonana) {
      return 'komendant_odburk';
    }
    return 'komendant_namysl';
  }

  private pickOstromirDialogue(): string {
    if (this.state.flags.akt2_koniec) {
      return 'ostromir_pozegnanie';
    }
    if (this.state.quests.eskorta_ostromira === 'failed') {
      return 'ostromir_powrot';
    }
    if ((this.state.flags.komendant_byl || this.state.flags.dlug_oddany) && !this.state.flags.ostromir_zgoda) {
      return 'ostromir_brama';
    }
    return 'ostromir';
  }

  private awardSideQuestCompletion(
    questId: string,
    title: string,
    money: number,
    xp: number
  ): void {
    if (this.state.quests[questId] === 'completed') return;
    this.state.quests[questId] = 'completed';
    let leveledUp = false;
    if (this.state.character) {
      if (money > 0) {
        this.state.character.money += money;
      }
      if (xp > 0) {
        const xpRes = grantXp(this.state, xp, this.data);
        leveledUp = xpRes.levelsGained > 0;
        if (leveledUp) {
          this.ui?.showToast(`Awans na poziom ${xpRes.newLevel}! Otwórz kartę Postaci.`, 'gold');
        }
      }
    }
    const rewardSummary = [money > 0 ? `+${money} gr` : '', xp > 0 ? `+${xp} XP` : '']
      .filter(Boolean)
      .join(', ');
    this.engine.addLog(`🏆 Ukończono „${title}” (${rewardSummary})!`, 'important');
    this.ui?.showToast(`Ukończono: ${title} (${rewardSummary})`, 'success');
    ostrzeAudio.playQuestEvent(leveledUp ? 'levelup' : 'complete');
  }

  public checkAndCompleteSideQuests(): void {
    // 1. Lek dla Wrzoska (+10 gr, +30 XP)
    if (this.state.flags.wrzosek_ziola_oddane && this.state.quests.lek_dla_wrzoska !== 'completed') {
      this.revealPlace('stary_mlyn');
      this.awardSideQuestCompletion('lek_dla_wrzoska', 'Lek dla Wrzoska', 10, 30);
    }

    // 2. Zboże dla młyna (+12 gr, +30 XP, hint trakt_kupiecki)
    if (this.state.flags.wrzosek_wiadomosc && this.state.quests.zboze_dla_mlyna !== 'completed') {
      this.revealPlace('trakt_kupiecki');
      this.awardSideQuestCompletion('zboze_dla_mlyna', 'Zboże dla młyna', 12, 30);
    }

    // 3. Dług kupca (+20 gr, +40 XP)
    if (this.state.flags.dlug_oddany && this.state.quests.dlug_kupca !== 'completed') {
      this.awardSideQuestCompletion('dlug_kupca', 'Dług kupca', 20, 40);
    }

    // 4. List do leśniczego (+15 gr, +30 XP, reveal ruiny_straznicy)
    if (this.state.flags.list_odpowiedz && this.state.quests.list_do_lesniczego !== 'completed') {
      this.revealPlace('ruiny_straznicy');
      this.awardSideQuestCompletion('list_do_lesniczego', 'List do leśniczego', 15, 30);
    }

    // 5. Kto pyta o ocalałych (+25 gr, +50 XP)
    if (this.state.flags.akt3_zapowiedz && this.state.quests.kto_pyta_o_ocalalych !== 'completed') {
      this.awardSideQuestCompletion('kto_pyta_o_ocalalych', 'Kto pyta o ocalałych', 25, 50);
    }

    // 6. Światło w młynie (+10 gr, +40 XP)
    if (this.state.flags.kamien_rozpoznany && this.state.quests.swiatlo_w_mlynie !== 'completed') {
      this.awardSideQuestCompletion('swiatlo_w_mlynie', 'Światło w młynie', 10, 40);
    }

    // 7. Zaginiony pasterz Borek (+30 gr, +60 XP)
    if (this.state.flags.zona_poinformowana && this.state.quests.zaginiony_pasterz_borek !== 'completed') {
      this.awardSideQuestCompletion('zaginiony_pasterz_borek', 'Zaginiony pasterz Borek', 30, 60);
    }

    // 8. Amulet z ruin (+50 XP, technologia_wiedza)
    if (
      (this.state.flags.amulet_oddany || this.state.flags.amulet_zatrzymany) &&
      this.state.quests.amulet_z_ruin !== 'completed'
    ) {
      this.state.flags.technologia_wiedza = true;
      this.awardSideQuestCompletion('amulet_z_ruin', 'Amulet z ruin', 0, 50);
    }
  }

  private runDialogue(dialogueId: string): void {
    const session = startOstrzeDialogue(dialogueId, this.state, this.data);
    if (!this.ui) {
      this.checkAndCompleteSideQuests();
      return;
    }

    this.ui.showDialogue(session, {
      onClosed: () => {
        // Post-dialogue state sync matching travel.json rules
        if (dialogueId === 'komendant' || dialogueId === 'komendant_namysl') {
          this.state.flags.komendant_byl = true;
          if (this.state.flags.nora_zgoda && !this.state.quests.wilcza_nora) {
            this.state.quests.wilcza_nora = 'active';
            this.engine.addLog('📜 Nowe zlecenie: Wilcza Nora (25 gr za watahę).', 'important');
          }
        }
        if (dialogueId === 'komendant_raport' && this.state.flags.nora_rozliczona) {
          this.completeWilczaNoraQuest(true);
        }
        if (
          (dialogueId === 'ostromir' || dialogueId === 'ostromir_brama' || dialogueId === 'ostromir_powrot') &&
          this.state.flags.ostromir_zgoda &&
          this.state.quests.eskorta_ostromira !== 'completed'
        ) {
          this.state.quests.eskorta_ostromira = 'active';
          this.engine.addLog('📜 Nowe zlecenie: Eskorta kupca Ostromira na Kamienną Przełęcz.', 'important');
        }
        if (dialogueId === 'corka' && this.state.flags.amulet_pytanie) {
          this.revealPlace('ruiny_straznicy');
        }
        this.checkAndCompleteSideQuests();

        if (this.state.flags.szkarad_sklep) {
          this.state.flags.szkarad_sklep = false;
          this.openShop('szkarad_ruszniczar');
          return;
        }
        if (this.state.flags.kowal_sklep) {
          this.state.flags.kowal_sklep = false;
          this.openShop('kowal_brod');
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
    this.engine.addLog('🛏️ Przespałeś noc w izbie w Wilczym Brodzie. Zdrowie w pełni odnowione.', 'info');
    this.refreshHubPanel();
    this.onAutoSave?.();
  }

  public startWilczaNoraQuest(): void {
    this.state.quests.wilcza_nora = 'active';
    this.state.world.location = 'wilcza_nora';
    markOstrzeLocationVisited(this.state, 'wilcza_nora');
    this.engine.loadCustomScene('wilcza_nora');
    this.engine.npcs.forEach((n) => {
      if (n.id.startsWith('enemy_wilk_')) {
        n.recipe.id = n.id;
        n.recipe.equipment.head = null;
        n.recipe.equipment.mainHand = null;
        n.recipe.equipment.offHand = null;
      }
    });
    ostrzeAudio.setAmbience('creepy_forest');
    this.syncHeroTo25D();
    this.refreshHubPanel();

    const startFight = (): void => {
      this.activeCombatStage = 'wilcza_nora';
      this.engine.addLog('🐺 Wąwóz Wilczej Nory — trzy pary ślepi błyskają w ciemności!', 'combat');
      this.engine.startCombatWithEnemy('enemy_wilk_1');
      this.onUiRefresh?.();
    };

    if (!this.ui) {
      startFight();
      return;
    }

    this.ui.showNarrative({
      title: 'Wilcza Nora',
      subtitle: 'Wąwóz w górę strumienia',
      text: 'Wąwóz cuchnie padliną. Pod korzeniami starego buka ziemia rozgrzebana, a wokół bieleją obgryzione owcze kości. Z ciemności błyskają trzy pary ślepi.',
      buttonLabel: 'Walcz z watahą',
      onContinue: startFight
    });
  }

  public completeWilczaNoraQuest(fromDialogue = false): void {
    const alreadyCompleted = this.state.quests.wilcza_nora === 'completed';
    if (!fromDialogue && this.state.flags.nora_rozliczona && alreadyCompleted) return;

    this.state.quests.wilcza_nora = 'completed';
    this.state.flags.nora_rozliczona = true;
    if (this.state.character) {
      let leveledUp = false;
      if (!alreadyCompleted) {
        this.state.character.money += 25;
        const xpRes = grantXp(this.state, 40, this.data);
        leveledUp = xpRes.levelsGained > 0;
        if (leveledUp) {
          this.ui?.showToast(`Awans na poziom ${xpRes.newLevel}! Otwórz kartę Postaci.`, 'gold');
        }
      }
      this.engine.addLog('🏆 Ukończono „Wilcza Nora”: +25 gr i +40 XP!', 'important');
      this.ui?.showToast('Ukończono zlecenie: Wilcza Nora (+25 gr, +40 XP)', 'success');
      ostrzeAudio.playQuestEvent(leveledUp ? 'levelup' : 'complete');
    }
    this.syncHeroTo25D();
    this.onAutoSave?.();
  }

  public startOstromirEscort(): void {
    this.state.quests.eskorta_ostromira = 'active';
    this.state.world.location = 'kamienna_przelecz';
    this.engine.loadCustomScene('kamienna_przelecz');
    ostrzeAudio.setAmbience('dawn');
    this.syncHeroTo25D();
    this.refreshHubPanel();

    const startFight = (): void => {
      this.activeCombatStage = 'eskorta_ostromira';
      this.engine.addLog('⚔️ Napad na wóz Ostromira! Dwóch zbirów wyskakuje spod mostku!', 'combat');
      this.engine.startCombatWithEnemy('enemy_przelecz_bandyta_1');
      this.onUiRefresh?.();
    };

    if (!this.ui) {
      startFight();
      return;
    }

    this.ui.showNarrative({
      title: 'Napad na wóz',
      subtitle: 'Droga ku Kamiennej Przełęczy',
      text: 'Spod mostku wyskakuje dwóch zbirów w maskach z worków. Jeden łapie konia za uzdę, drugi celuje w ciebie widłami. Ostromir chowa się pod wóz i modli na głos do wszystkich bogów naraz.',
      buttonLabel: 'Broń wozu',
      onContinue: startFight
    });
  }

  public handleCombatEnded(outcome: 'victory' | 'defeat' | 'fled'): void {
    this.engine.combatState.active = false;
    this.engine.combatState.participantIds = [];
    this.engine.combatState.activeTurnActorId = null;
    if (this.state.character && this.engine.player.combat) {
      this.state.character.hp = Math.max(1, this.engine.player.combat.hp);
    }

    if (
      this.activeCombatStage === 'wilczy_las_hunt' ||
      this.activeCombatStage === 'trakt_kupiecki_hunt' ||
      this.activeCombatStage === 'lesniczowka_hunt' ||
      this.activeCombatStage === 'ruiny_straznicy_hunt'
    ) {
      const stage = this.activeCombatStage;
      this.activeCombatStage = 'none';
      for (let i = this.engine.npcs.length - 1; i >= 0; i--) {
        if (this.engine.npcs[i].combat?.isHostile) {
          this.engine.npcs.splice(i, 1);
        }
      }
      if (outcome === 'victory' && this.state.character) {
        const xpGain = stage === 'ruiny_straznicy_hunt' ? 50 : 35;
        const moneyGain = stage === 'wilczy_las_hunt' ? 10 : 15;
        this.state.character.money += moneyGain;
        grantXp(this.state, xpGain, this.data);
        if (stage === 'wilczy_las_hunt') {
          this.addItemStack('kiel_dzika', 1);
        }
        this.engine.addLog(`🏆 Wygrana potyczka: +${moneyGain} gr, +${xpGain} XP!`, 'important');
        this.ui?.showToast(`Potyczka wygrana (+${moneyGain} gr, +${xpGain} XP)`, 'success');
      }
      this.syncHeroTo25D();
      this.refreshHubPanel();
      this.onAutoSave?.();
      return;
    }

    if (this.activeCombatStage === 'wilcza_nora') {
      this.activeCombatStage = 'none';
      if (outcome === 'victory') {
        this.state.flags.nora_wykonana = true;
        this.state.world.location = 'wilczy_brod';
        this.engine.loadCustomScene('wilczy_brod');
        ostrzeAudio.setAmbience('town');
        this.syncHeroTo25D();
        this.refreshHubPanel();
        this.onAutoSave?.();
        this.ui?.showNarrative({
          title: 'Wilcza Nora oczyszczona',
          text: 'Wataha leży pokotem w kałuży krwi. Odcinasz uszy na dowód, bo komendant Wszebor na słowo nie uwierzy.',
          buttonLabel: 'Wróć do Wilczego Brodu',
          onContinue: () => this.refreshHubPanel()
        });
      } else if (outcome === 'defeat') {
        if (this.ui && this.onDefeatToPrologue) {
          this.ui.showNarrative({
            title: 'Poległeś w Wilczej Norze',
            text: 'Wataha rozszarpała cię w ciemnościach wąwozu. Twoja podróż dobiega końca — wracasz na początek Prologu.',
            buttonLabel: 'Wróć na początek Prologu',
            onContinue: () => this.onDefeatToPrologue?.()
          });
        } else {
          this.onDefeatToPrologue?.();
        }
      } else {
        this.state.world.location = 'wilczy_brod';
        this.engine.loadCustomScene('wilczy_brod');
        ostrzeAudio.setAmbience('town');
        this.syncHeroTo25D();
        this.refreshHubPanel();
      }
      return;
    }

    if (this.activeCombatStage === 'eskorta_ostromira') {
      this.activeCombatStage = 'none';
      if (outcome === 'victory') {
        this.state.flags.akt2_koniec = true;
        this.state.quests.eskorta_ostromira = 'completed';
        if (this.state.character) {
          this.state.character.money += 40;
          this.addItemStack('prowiant', 2);
          const xpRes = grantXp(this.state, 80, this.data);
          this.ui?.showToast('Ukończono: Eskorta Ostromira (+40 gr, +2 prowiant, +80 XP)', 'success');
          if (xpRes.levelsGained > 0) {
            this.ui?.showToast(`Awans na poziom ${xpRes.newLevel}! Otwórz kartę Postaci.`, 'gold');
          }
        }
        this.state.world.location = 'wilczy_brod';
        this.engine.loadCustomScene('wilczy_brod');
        ostrzeAudio.setAmbience('town');
        this.syncHeroTo25D();
        this.refreshHubPanel();
        this.onAutoSave?.();

        this.ui?.showNarrative({
          title: 'Kamienna Przełęcz osiągnięta',
          text: 'Zbiry uciekają w krzaki, gubiąc maski. Ostromir wyłazi spod wozu, otrzepuje kaftan i doprowadza wóz na przełęcz. Droga do Głuszca stoi otworem!',
          buttonLabel: 'Wróć do Wilczego Brodu',
          onContinue: () => this.refreshHubPanel()
        });
      } else if (outcome === 'defeat') {
        if (this.ui && this.onDefeatToPrologue) {
          this.ui.showNarrative({
            title: 'Poległeś na Kamiennej Przełęczy',
            text: 'Zbiry przeważyły szalę. Twoja historia urywa się na przełęczy — wracasz na początek Prologu.',
            buttonLabel: 'Wróć na początek Prologu',
            onContinue: () => this.onDefeatToPrologue?.()
          });
        } else {
          this.onDefeatToPrologue?.();
        }
      } else {
        this.state.flags.ostromir_ograbiony = true;
        this.state.quests.eskorta_ostromira = 'failed';
        this.state.world.location = 'wilczy_brod';
        this.engine.loadCustomScene('wilczy_brod');
        ostrzeAudio.setAmbience('town');
        this.syncHeroTo25D();
        this.refreshHubPanel();
      }
      return;
    }

    if (this.activeCombatStage === 'travel_encounter') {
      this.activeCombatStage = 'none';
      if (outcome === 'victory') {
        const xp = grantXp(this.state, 35, this.data);
        this.engine.addLog(`🏆 Zwycięstwo w starciu na trakcie! +35 XP (Poz. ${xp.newLevel}).`, 'important');
        if (this.pendingTravel?.afterVictoryText && this.ui) {
          const dest = this.pendingTravel.destId;
          this.ui.showNarrative({
            title: 'Starcie na Trakcie',
            subtitle: 'Zwycięstwo',
            text: this.pendingTravel.afterVictoryText,
            buttonLabel: 'Kontynuuj podróż',
            onContinue: () => {
              this.arriveAtLocation(dest);
            }
          });
          this.pendingTravel = null;
          return;
        }
      } else if (outcome === 'fled') {
        this.engine.addLog('🏃 Udało ci się uciec przed napastnikami.', 'info');
        if (this.pendingTravel?.afterFleeText && this.ui) {
          const dest = this.pendingTravel.destId;
          this.ui.showNarrative({
            title: 'Ucieczka',
            subtitle: 'Ocalenie',
            text: this.pendingTravel.afterFleeText,
            buttonLabel: 'Dalej w drogę',
            onContinue: () => {
              this.arriveAtLocation(dest);
            }
          });
          this.pendingTravel = null;
          return;
        }
      } else {
        this.engine.addLog('💀 Klęska na leśnym trakcie.', 'critical');
      }
      const targetDest = this.pendingTravel?.destId;
      this.pendingTravel = null;
      if (targetDest && outcome !== 'defeat') {
        this.arriveAtLocation(targetDest);
      } else {
        this.syncHeroTo25D();
        this.refreshHubPanel();
      }
      return;
    }
  }

  public finishChapter1(): void {
    this.chapter1Completed = true;
    const scene = this.data.story.scenes.find((s) => s.id === 'akt2_koniec_scena');
    const ch = this.state.character;
    const summary = [
      typeof scene?.text === 'string'
        ? scene.text
        : 'Wóz Ostromira skrzypi pod górę ku Kamiennej Przełęczy, a ty idziesz obok i nie oglądasz się za siebie.',
      '',
      '--- KONIEC ROZDZIAŁU I (WILCZY BRÓD) ---',
      `Bohater: ${ch?.name ?? 'Adept'} (Poz. ${ch?.level ?? 1}, ${ch?.xp ?? 0} XP, ${ch?.money ?? 0} gr)`,
      `Osie moralne: Wola = ${this.state.vars.wola ?? 0}, Dług = ${this.state.vars.dlug ?? 0}`
    ].join('\n');

    this.ui?.showNarrative({
      title: 'Kamienna Przełęcz — Koniec Rozdziału I',
      subtitle: 'Droga do Głuszca (Rozdział II)',
      text: summary,
      buttonLabel: 'Zostań w świecie 2.5D',
      onContinue: () => {
        this.engine.addLog('🏁 Rozdział I ukończony! Otwarto drogę za Kamienną Przełęcz.', 'important');
        this.refreshHubPanel();
      }
    });
  }

  public restoreFromSave(sceneId: string): void {
    this.bindHubHooks();
    this.activeCombatStage = 'none';
    this.chapter1Completed = false;
    this.engine.clearAllNpcMarkers();
    const validScenes = new Set([
      'wilczy_brod',
      'wilcza_nora',
      'kamienna_przelecz',
      'wilczy_las',
      'stary_mlyn',
      'trakt_kupiecki',
      'lesniczowka',
      'ruiny_straznicy'
    ]);
    const targetScene = validScenes.has(sceneId) ? sceneId : 'wilczy_brod';
    this.state.world.location = targetScene;
    this.engine.loadCustomScene(targetScene);
    ostrzeAudio.setAmbience(
      targetScene === 'wilcza_nora' || targetScene === 'ruiny_straznicy'
        ? 'creepy_forest'
        : targetScene === 'kamienna_przelecz' || targetScene === 'stary_mlyn'
          ? 'dawn'
          : targetScene === 'wilczy_brod'
            ? 'town'
            : 'forest'
    );
    this.syncHeroTo25D();
    this.refreshHubPanel();
  }

  public openTravelModal(): void {
    if (!this.ui) return;
    const currentLoc = this.engine.activeCustomSceneId ?? this.state.world.location;
    const destinations = getVisitedOstrzeLocations(this.state).map((loc) => ({
      id: loc.id,
      name: loc.name,
      subtitle: loc.subtitle,
      travelMinutes: loc.travelMinutes,
      isCurrent: loc.id === currentLoc
    }));

    this.ui.showTravelModal(destinations, (destId) => {
      this.startTravelTo(destId);
    });
  }

  public startTravelTo(destId: string): void {
    const currentLoc = this.engine.activeCustomSceneId ?? this.state.world.location;
    if (destId === currentLoc) return;
    const dest = getOstrzeLocationMeta(destId);
    if (!dest) return;

    advanceMinutes(this.state, dest.travelMinutes, this.data);
    const encounter = rollOriginTravelEncounter(
      this.state,
      this.data,
      this.rng,
      currentLoc,
      destId
    );

    if (!encounter) {
      this.arriveAtLocation(destId);
      return;
    }

    this.handleTravelEvent(encounter, destId);
  }

  private handleTravelEvent(ev: OriginTravelEventDef, destId: string): void {
    const scenes = ev.scenes ?? [];
    if (scenes.length === 0) {
      this.arriveAtLocation(destId);
      return;
    }

    const runStep = (idx: number): void => {
      if (idx >= scenes.length) {
        this.arriveAtLocation(destId);
        return;
      }
      const sc = scenes[idx];
      if (sc.if && !evaluateCondition(sc.if, this.state, this.data)) {
        runStep(idx + 1);
        return;
      }

      if (sc.type === 'narration') {
        if (!this.ui || !sc.text) {
          runStep(idx + 1);
          return;
        }
        const c = clockOf(this.state.time.minutes);
        const clockText = `Dzień ${c.day}, ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;
        this.ui.showNarrative({
          title: sc.title ?? 'Wydarzenie na Trakcie',
          subtitle: `${getOstrzeLocationMeta(destId)?.name ?? 'Podróż'} · ${clockText}`,
          text: sc.text,
          buttonLabel: 'Dalej',
          onContinue: () => runStep(idx + 1)
        });
        return;
      }

      if (sc.type === 'item') {
        for (const itemId of sc.items ?? []) {
          const existing = this.state.inventory.items.find((i) => i.id === itemId);
          if (existing) existing.qty += 1;
          else this.state.inventory.items.push({ id: itemId, qty: 1 });
        }
        if ((sc.items?.length ?? 0) > 0) {
          this.ui?.showToast(`Otrzymano: ${sc.items!.join(', ')}`, 'success');
        }
        runStep(idx + 1);
        return;
      }

      if (sc.type === 'shop' && sc.shop) {
        if (!this.ui) {
          runStep(idx + 1);
          return;
        }
        this.ui.showShop(sc.shop, () => runStep(idx + 1));
        return;
      }

      if (sc.type === 'dialogue' && sc.dialogue) {
        const dlgFile = this.data.prologueDialogues[sc.dialogue];
        if (!dlgFile || !this.ui) {
          runStep(idx + 1);
          return;
        }
        const session = startOstrzeDialogue(sc.dialogue, this.state, this.data);
        this.ui.showDialogue(session, {
          onClosed: () => {
            this.syncHeroTo25D();
            runStep(idx + 1);
          }
        });
        return;
      }

      if (sc.type === 'combat') {
        const afterVictory = scenes.find((s, i) => i > idx && s.type === 'narration' && s.id !== sc.onFlee);
        const afterFlee = sc.onFlee ? scenes.find((s) => s.id === sc.onFlee) : undefined;
        this.startTravelCombatEncounter(sc, destId, afterVictory?.text, afterFlee?.text);
        return;
      }

      runStep(idx + 1);
    };

    runStep(0);
  }

  private startTravelCombatEncounter(
    sc: OriginTravelSceneDef,
    destId: string,
    afterVictoryText?: string,
    afterFleeText?: string
  ): void {
    const roadScene = createTraktZasadzkaScene();
    this.engine.registerCustomScene(roadScene);
    this.engine.loadCustomScene('trakt_zasadzka');
    this.engine.npcs.length = 0;

    const specs = sc.enemies ?? [{ id: 'wilk', count: 2 }];
    const spawned: ActorEntity[] = [];
    let idx = 0;
    for (const spec of specs) {
      const enemyDef = findOriginEnemy(spec.id, this.data);
      const count = Math.max(1, spec.count ?? 1);
      for (let c = 0; c < count; c++) {
        const x = 10 + (idx % 3) * 2;
        const y = 8 + Math.floor(idx / 3) * 2;
        const z = this.engine.map.tiles[y]?.[x]?.z ?? 0;
        const actorId = `travel_enemy_${idx}`;
        const recipe = generateRandomCharacterRecipe(900 + idx * 17, actorId);
        recipe.name = enemyDef?.name ?? spec.id;
        recipe.title = 'Zasadzka na trakcie';
        recipe.equipment = {
          head: spec.id === 'wilk' || spec.id === 'dzik' || spec.id === 'zmija_lesna' ? 'helm_druid_antlers' : 'helm_shadow_hood',
          torso: 'torso_przeszywanica',
          cloak: null,
          legs: 'legs_leather_boots',
          mainHand: spec.id === 'wilk' || spec.id === 'dzik' ? 'weapon_slavic_axe' : 'weapon_iron_longsword',
          offHand: null
        };
        const hp = enemyDef?.hp ?? 18;
        spawned.push({
          id: actorId,
          recipe,
          tileX: x,
          tileY: y,
          x: x + 0.5,
          y: y + 0.5,
          z,
          direction: 4,
          path: [],
          isMoving: false,
          animFrame: 0,
          animTimer: 0,
          dialogueId: undefined,
          combat: {
            hp,
            maxHp: hp,
            ap: 7,
            maxAp: 7,
            proficiencies: createDefaultProficiencies(),
            isHostile: true,
            isAlive: true,
            xpReward: enemyDef?.xp ?? 20,
            lootTable: [],
            difficulty: 'normal',
            aggroRadius: 14,
            dazedHeadTurns: 0,
            crippledLegsTurns: 0,
            defending: false
          }
        });
        idx++;
      }
    }

    this.engine.npcs.push(...spawned);
    ostrzeAudio.setAmbience('forest');
    this.syncHeroTo25D();
    this.activeCombatStage = 'travel_encounter';
    this.pendingTravel = { destId, afterVictoryText, afterFleeText };
    this.ui?.setHubPanel(null);
    this.engine.addLog(`⚔️ ${sc.title ?? 'Zasadzka na trakcie'}!`, 'combat');
    this.engine.startCombatWithEnemy(spawned[0].id);
    this.onUiRefresh?.();
  }

  private arriveAtLocation(destId: string): void {
    const dest = getOstrzeLocationMeta(destId);
    if (!dest) return;
    this.state.world.location = destId;
    markOstrzeLocationVisited(this.state, destId);
    this.engine.loadCustomScene(destId);
    if (destId !== 'wilczy_brod') {
      const peaceful = this.engine.npcs.filter((n) => !n.combat?.isHostile);
      this.engine.npcs.length = 0;
      this.engine.npcs.push(...peaceful);
    }
    ostrzeAudio.setAmbience(dest.ambience);
    this.syncHeroTo25D();
    this.refreshHubPanel();
    this.engine.addLog(`🧭 Dotarłeś do: ${dest.name}.`, 'important');
    this.onAutoSave?.();
  }
}
