import type { OstrzeEngineState } from '../../engine-bridge/OstrzeEngineState';
import { ostrzeAudio } from '../audio/ostrzeAudio';
import { ORIGIN_DATA } from '../data/originData';
import type { OriginGameData, OstrzeGameState } from '../data/originTypes';
import {
  createBrzezinaYardScene,
  createIstotaActor,
  createPobojowiskoSwitScene,
  createTraktCampfireActor,
  createTraktZasadzkaScene,
  createUroczyskoNocScene
} from '../maps/prologueMaps';
import { createEmptyOstrzeState, grantXp } from '../rules/character';
import { createRng, SeededRng } from '../rules/dice';
import { startOstrzeDialogue } from '../rules/dialogueEngine';
import { getStats } from '../rules/stats';
import { advanceMinutes, clockOf, waitUntilHour } from '../rules/time';
import { markOstrzeLocationVisited } from '../rules/travel';
import type { OstrzeModalUi } from '../ui/OstrzeModalUi';

export type ProloguePhase =
  | 'intro'
  | 'brzezina_gnieworad'
  | 'brzezina_sparing_talk'
  | 'brzezina_sparing_fight'
  | 'brzezina_kurier'
  | 'brzezina_delegacja'
  | 'brzezina_towarzysze'
  | 'brzezina_gotowy_do_wymarszu'
  | 'trakt_bandyci'
  | 'trakt_ognisko'
  | 'noc_upiory'
  | 'noc_istota'
  | 'pobojowisko'
  | 'rozdroze'
  | 'completed';

export class PrologueDirector {
  public readonly engine: OstrzeEngineState;
  public readonly data: OriginGameData;
  public readonly state: OstrzeGameState;
  public readonly rng: SeededRng;
  private ui: OstrzeModalUi | null;
  private readonly onUiRefresh?: () => void;
  public onPrologueCompleted?: () => void;
  public onSaveRequested?: () => void;
  public onLoadRequested?: () => void;
  public onAutoSave?: () => void;
  public onKeyRequested?: () => void;
  public onDefeatToPrologue?: () => void;
  public hasSave?: () => boolean;

  public phase: ProloguePhase = 'intro';

  constructor(opts: {
    engine: OstrzeEngineState;
    ui?: OstrzeModalUi | null;
    data?: OriginGameData;
    seed?: number;
    onUiRefresh?: () => void;
  }) {
    this.engine = opts.engine;
    this.data = opts.data ?? ORIGIN_DATA;
    this.state = createEmptyOstrzeState(this.data, opts.seed ?? 2026);
    this.rng = createRng(this.state.rngState);
    this.ui = opts.ui ?? null;
    this.onUiRefresh = opts.onUiRefresh;

    this.registerAllPrologueScenes();
    this.bindEngineHooks();
  }

  public attachUi(ui: OstrzeModalUi): void {
    this.ui = ui;
  }

  private bindEngineHooks(): void {
    this.engine.onCombatEnded = (outcome) => this.handleCombatEnded(outcome);
    this.engine.onNpcInteract = (npcId) => this.handleNpcInteract(npcId);
    this.engine.onPropInteract = (propId) => this.handlePropInteract(propId);
  }

  private registerAllPrologueScenes(): void {
    this.engine.registerCustomScene(createBrzezinaYardScene());
    this.engine.registerCustomScene(createTraktZasadzkaScene());
    this.engine.registerCustomScene(createUroczyskoNocScene());
    this.engine.registerCustomScene(createPobojowiskoSwitScene());
  }

  private static readonly FALLBACK_TITLES: Record<string, string> = {
    demo_sparing_wygrana: 'Wygrana w sparingu',
    demo_sparing_porazka: 'Porażka w sparingu',
    bandyci_po_walce: 'Po zasadzce',
    bandyci_ucieczka: 'Ucieczka z traktu'
  };

  private getStoryScene(id: string): { title: string; text: string; art?: string } {
    const raw =
      this.data.story.scenes.find((s) => s.id === id) ??
      this.data.travelScenes[id];
    const rawTitle = typeof raw?.title === 'string' ? raw.title.trim() : '';
    const rawArt = typeof (raw as { art?: unknown } | undefined)?.art === 'string'
      ? ((raw as { art: string }).art).trim()
      : '';
    return {
      title: rawTitle || PrologueDirector.FALLBACK_TITLES[id] || 'Prolog',
      text: typeof raw?.text === 'string' ? raw.text.trim() : '',
      art: rawArt || undefined
    };
  }

  private syncHeroTo25D(): void {
    if (!this.state.character) return;
    this.engine.syncFromOstrzeState(this.state, this.data);
    this.onUiRefresh?.();
  }

  private showNarrativeScene(
    sceneId: string,
    onContinue: () => void,
    subtitle?: string,
    buttonLabel?: string
  ): void {
    const scene = this.getStoryScene(sceneId);
    if (!this.ui || !scene.text) {
      onContinue();
      return;
    }
    this.ui.showNarrative({
      title: scene.title,
      subtitle,
      artId: scene.art,
      text: scene.text,
      buttonLabel,
      onContinue
    });
  }

  private runDialogue(dialogueId: string, onDone: () => void): void {
    const session = startOstrzeDialogue(dialogueId, this.state, this.data);
    if (!this.ui) {
      onDone();
      return;
    }
    this.ui.showDialogue(session, {
      onClosed: () => {
        this.syncHeroTo25D();
        onDone();
        this.onAutoSave?.();
      },
      onOpenShop: (shopId) => {
        this.ui?.showShop(shopId, () => {
          this.syncHeroTo25D();
          this.refreshObjectiveTracker();
        });
      }
    });
  }

  /**
   * Starts the Prologue: intro cards -> Character Creator -> playable 2.5D Brzezina yard.
   */
  public startPrologue(): void {
    this.bindEngineHooks();
    this.phase = 'intro';
    this.engine.clearAllNpcMarkers();
    this.ui?.setHubPanel(null);
    this.engine.registerCustomScene(createBrzezinaYardScene({ withCourier: false, sparingHostile: false }));
    this.engine.loadCustomScene('brzezina_dziedziniec');
    markOstrzeLocationVisited(this.state, 'brzezina_dziedziniec');
    ostrzeAudio.setAmbience('dawn');
    this.showNarrativeScene(
      'prolog_wstep',
      () => {
        this.showNarrativeScene(
          'prolog_wstep_wies',
          () => {
            advanceMinutes(this.state, 30, this.data);
            this.showNarrativeScene(
              'demo_swit',
              () => this.openCreator(),
              this.formatClock()
            );
          },
          'Brzezina — Pogórze'
        );
      },
      'Voided: na przekór gwiazdom'
    );
  }

  private openCreator(): void {
    if (!this.ui) return;
    this.ui.showCharacterCreator(() => {
      this.syncHeroTo25D();
      this.enterBrzezinaSparingPhase();
      this.onAutoSave?.();
    });
  }

  public enterBrzezinaSparingPhase(): void {
    this.bindEngineHooks();
    this.phase = 'brzezina_gnieworad';
    this.engine.registerCustomScene(createBrzezinaYardScene({ sparingHostile: false }));
    this.engine.loadCustomScene('brzezina_dziedziniec');
    markOstrzeLocationVisited(this.state, 'brzezina_dziedziniec');
    this.syncHeroTo25D();

    this.engine.clearAllNpcMarkers();
    this.engine.setNpcMarker('npc_gnieworad', '❗ Mistrz Gnieworad');
    this.engine.addLog(
      '📜 Podejdź do Mistrza Gnieworada na dziedzińcu i kliknij na niego, aby rozpocząć.',
      'important'
    );
    this.refreshObjectiveTracker();
  }

  private refreshMarkersAndTracker(): void {
    this.engine.clearAllNpcMarkers();
    switch (this.phase) {
      case 'brzezina_gnieworad':
        this.engine.setNpcMarker('npc_gnieworad', '❗ Porozmawiaj');
        break;
      case 'brzezina_sparing_talk':
        this.engine.setNpcMarker('npc_radogost', '⚔️ Podejdź do sparingu');
        break;
      case 'brzezina_kurier':
        this.engine.setNpcMarker('npc_kurier', '❗ Cesarski Kurier');
        break;
      case 'brzezina_delegacja':
        this.engine.setNpcMarker('npc_gnieworad', '❗ Delegacja');
        break;
      case 'brzezina_towarzysze':
        this.engine.setNpcMarker('npc_dobrogost', '💬 Kram (opcjonalnie)');
        this.engine.setNpcMarker(
          'npc_skarimir',
          this.state.flags.przysluga_skarimir_start && !this.state.flags.przysluga_skarimir_done
            ? '❗ Skarimir (słonina)'
            : '❗ Skarimir'
        );
        this.engine.setNpcMarker(
          'npc_ragnoslawa',
          this.state.flags.przysluga_ragnoslawa_start && !this.state.flags.przysluga_ragnoslawa_done
            ? '❗ Ragnosława (pieczęć)'
            : '❗ Ragnosława'
        );
        this.engine.setNpcMarker(
          'npc_wojmir',
          this.state.flags.przysluga_wojmir_start && !this.state.flags.przysluga_wojmir_done
            ? '❗ Wojmir (sakwa)'
            : '❗ Wojmir'
        );
        if (this.state.flags.przysluga_ragnoslawa_start && !this.state.flags.ragnoslawa_trop_odkryty) {
          this.engine.setNpcMarker('npc_radogost', '💬 Zapytaj o pieczęć');
        }
        break;
      case 'brzezina_gotowy_do_wymarszu':
        this.engine.setNpcMarker('npc_dobrogost', '💬 Kram');
        if (!this.state.flags.tow_skarimir || (this.state.flags.przysluga_skarimir_start && !this.state.flags.przysluga_skarimir_done)) {
          this.engine.setNpcMarker('npc_skarimir', '💬 Skarimir');
        }
        if (!this.state.flags.tow_ragnoslawa || (this.state.flags.przysluga_ragnoslawa_start && !this.state.flags.przysluga_ragnoslawa_done)) {
          this.engine.setNpcMarker('npc_ragnoslawa', '💬 Ragnosława');
        }
        if (!this.state.flags.tow_wojmir || (this.state.flags.przysluga_wojmir_start && !this.state.flags.przysluga_wojmir_done)) {
          this.engine.setNpcMarker('npc_wojmir', '💬 Wojmir');
        }
        if (this.state.flags.przysluga_ragnoslawa_start && !this.state.flags.ragnoslawa_trop_odkryty) {
          this.engine.setNpcMarker('npc_radogost', '💬 Zapytaj o pieczęć');
        }
        break;
      case 'trakt_bandyci':
        this.engine.setNpcMarker('enemy_bandyta_1', '⚔️ Zasadzka!');
        this.engine.setNpcMarker('enemy_bandyta_2', '⚔️ Zasadzka!');
        break;
      case 'trakt_ognisko':
        this.engine.setNpcMarker('npc_trakt_ognisko', '❗ Ognisko — Porozmawiaj');
        if (!this.state.flags.og_skarimir) {
          this.engine.setNpcMarker('npc_trakt_skarimir', '💬 Skarimir');
        }
        if (!this.state.flags.og_ragnoslawa) {
          this.engine.setNpcMarker('npc_trakt_ragnoslawa', '💬 Ragnosława');
        }
        if (!this.state.flags.og_wojmir) {
          this.engine.setNpcMarker('npc_trakt_wojmir', '💬 Wojmir');
        }
        break;
      case 'noc_upiory':
        this.engine.setNpcMarker('enemy_upior_1', '☠️ Upiór Nocy');
        this.engine.setNpcMarker('enemy_upior_2', '☠️ Upiór Nocy');
        break;
      case 'noc_istota':
        this.engine.setNpcMarker('npc_istota', '❗ Istota — Podejdź');
        break;
      case 'pobojowisko':
        this.engine.setNpcMarker('npc_pobojowisko_slad', '❗ Zbadaj pobojowisko');
        if (!this.state.flags.pobojowisko_skarimir) {
          this.engine.setNpcMarker('npc_pobojowisko_skarimir', '🕯️ Skarimir');
        }
        if (!this.state.flags.pobojowisko_ragnoslawa) {
          this.engine.setNpcMarker('npc_pobojowisko_ragnoslawa', '🕯️ Ragnosława');
        }
        if (!this.state.flags.pobojowisko_wojmir) {
          this.engine.setNpcMarker('npc_pobojowisko_wojmir', '🕯️ Wojmir');
        }
        break;
      case 'rozdroze':
        this.engine.setNpcMarker('npc_rozdroze_szlak', '❗ Rozdroże — Wybierz drogę');
        if (!this.state.flags.pobojowisko_skarimir) {
          this.engine.setNpcMarker('npc_pobojowisko_skarimir', '🕯️ Skarimir');
        }
        if (!this.state.flags.pobojowisko_ragnoslawa) {
          this.engine.setNpcMarker('npc_pobojowisko_ragnoslawa', '🕯️ Ragnosława');
        }
        if (!this.state.flags.pobojowisko_wojmir) {
          this.engine.setNpcMarker('npc_pobojowisko_wojmir', '🕯️ Wojmir');
        }
        break;
      default:
        break;
    }
    this.refreshObjectiveTracker();
  }

  public refreshObjectiveTracker(): void {
    if (!this.ui) return;
    if (this.phase === 'completed' || this.phase === 'intro') {
      this.ui.setHubPanel(null);
      return;
    }

    const ch = this.state.character;
    const hpMax = ch ? getStats(this.state, this.data).derived.hpMax : 0;
    const statusLine = `${ch?.name ?? 'Adept'} · Poz. ${ch?.level ?? 1} · HP ${ch?.hp ?? 0}/${hpMax} · ${ch?.money ?? 0} gr · ${this.formatClock()}`;

    let questsLine = '';
    const actions: Array<{ id: string; label: string; disabled?: boolean; alert?: boolean; onClick: () => void }> = [];

    switch (this.phase) {
      case 'brzezina_gnieworad':
        questsLine = 'Cel: Podejdź na dziedzińcu do Mistrza Gnieworada (❗) i kliknij na niego.';
        actions.push({
          id: 'walk_gnieworad',
          label: '🚶 Mistrz Gnieworad',
          onClick: () => this.engine.commandTalkToNpc('npc_gnieworad')
        });
        break;
      case 'brzezina_sparing_talk':
        questsLine = 'Cel: Podejdź do Instruktora Radogosta (⚔️) na środku placu, aby stoczyć sparing.';
        actions.push({
          id: 'walk_radogost',
          label: '🚶 Instruktor Radogost',
          onClick: () => this.engine.commandTalkToNpc('npc_radogost')
        });
        break;
      case 'brzezina_sparing_fight':
        questsLine = 'Walka ćwiczebna z Instruktorem Radogostem w toku!';
        break;
      case 'brzezina_kurier':
        questsLine = 'Cel: Podejdź do Cesarskiego Kuriera w czerwonym płaszczu (❗) i porozmawiaj.';
        actions.push({
          id: 'walk_kurier',
          label: '🚶 Cesarski Kurier',
          onClick: () => this.engine.commandTalkToNpc('npc_kurier')
        });
        break;
      case 'brzezina_delegacja':
        questsLine = 'Cel: Wróć do Mistrza Gnieworada (❗) po decyzję w sprawie delegacji.';
        actions.push({
          id: 'walk_gnieworad_del',
          label: '🚶 Mistrz Gnieworad',
          onClick: () => this.engine.commandTalkToNpc('npc_gnieworad')
        });
        break;
      case 'brzezina_towarzysze':
        questsLine = 'Cel: Porozmawiaj z towarzyszami przy bramie (Skarimir, Ragnosława, Wojmir) i pomóż im przed wymarszem lub zajrzyj do Dobrogosta.';
        actions.push(
          {
            id: 'walk_skarimir',
            label: '💬 Skarimir',
            onClick: () => this.engine.commandTalkToNpc('npc_skarimir')
          },
          {
            id: 'walk_ragnoslawa',
            label: '💬 Ragnosława',
            onClick: () => this.engine.commandTalkToNpc('npc_ragnoslawa')
          },
          {
            id: 'walk_wojmir',
            label: '💬 Wojmir',
            onClick: () => this.engine.commandTalkToNpc('npc_wojmir')
          },
          {
            id: 'walk_dobrogost',
            label: '🛒 Kwatermistrz Dobrogost',
            onClick: () => this.engine.commandTalkToNpc('npc_dobrogost')
          }
        );
        break;
      case 'brzezina_gotowy_do_wymarszu':
        questsLine = 'Cel: Możesz jeszcze porozmawiać z towarzyszami i dokończyć ich przysługi albo ruszyć na trakt ku Wilczemu Brodowi.';
        actions.push(
          {
            id: 'march_out',
            label: '🚶 Wymarsz na trakt (Dzień 1)',
            onClick: () => this.beginMarchDay1()
          },
          {
            id: 'walk_skarimir_ready',
            label: '💬 Skarimir',
            onClick: () => this.engine.commandTalkToNpc('npc_skarimir')
          },
          {
            id: 'walk_ragnoslawa_ready',
            label: '💬 Ragnosława',
            onClick: () => this.engine.commandTalkToNpc('npc_ragnoslawa')
          },
          {
            id: 'walk_wojmir_ready',
            label: '💬 Wojmir',
            onClick: () => this.engine.commandTalkToNpc('npc_wojmir')
          },
          {
            id: 'walk_dobrogost_ready',
            label: '🛒 Kwatermistrz Dobrogost',
            onClick: () => this.engine.commandTalkToNpc('npc_dobrogost')
          }
        );
        break;
      case 'trakt_bandyci':
        questsLine = 'Cel: Zasadzka na gościńcu! Podejdź do bandytów (⚔️) i odeprzyj atak.';
        break;
      case 'trakt_ognisko':
        questsLine = 'Cel: Porozmawiaj z towarzyszami przy ognisku, a gdy będziesz gotów, kliknij Ognisko (❗), by ruszyć dalej przed zmrokiem.';
        if (!this.state.flags.og_skarimir) {
          actions.push({
            id: 'walk_trakt_skarimir',
            label: '💬 Skarimir',
            onClick: () => this.engine.commandTalkToNpc('npc_trakt_skarimir')
          });
        }
        if (!this.state.flags.og_ragnoslawa) {
          actions.push({
            id: 'walk_trakt_ragnoslawa',
            label: '💬 Ragnosława',
            onClick: () => this.engine.commandTalkToNpc('npc_trakt_ragnoslawa')
          });
        }
        if (!this.state.flags.og_wojmir) {
          actions.push({
            id: 'walk_trakt_wojmir',
            label: '💬 Wojmir',
            onClick: () => this.engine.commandTalkToNpc('npc_trakt_wojmir')
          });
        }
        actions.push({
          id: 'walk_ognisko',
          label: '🔥 Ognisko — Ruszaj dalej',
          onClick: () => this.engine.commandTalkToNpc('npc_trakt_ognisko')
        });
        break;
      case 'noc_upiory':
        questsLine = 'Noc Upiorów! Broń obozu przed Upiorami Nocy.';
        break;
      case 'noc_istota':
        questsLine = 'Cel: Podejdź do tajemniczej Istoty przy wygasłym ognisku (❗).';
        actions.push({
          id: 'walk_istota',
          label: '🚶 Istota przy ognisku',
          onClick: () => this.engine.commandTalkToNpc('npc_istota')
        });
        break;
      case 'pobojowisko':
        questsLine = 'Cel: Pożegnaj poległych towarzyszy (🕯️) i zbadaj porzucony tobół przewodnika (❗).';
        if (!this.state.flags.pobojowisko_skarimir) {
          actions.push({
            id: 'walk_pob_skarimir',
            label: '🕯️ Skarimir',
            onClick: () => this.engine.commandTalkToNpc('npc_pobojowisko_skarimir')
          });
        }
        if (!this.state.flags.pobojowisko_ragnoslawa) {
          actions.push({
            id: 'walk_pob_ragnoslawa',
            label: '🕯️ Ragnosława',
            onClick: () => this.engine.commandTalkToNpc('npc_pobojowisko_ragnoslawa')
          });
        }
        if (!this.state.flags.pobojowisko_wojmir) {
          actions.push({
            id: 'walk_pob_wojmir',
            label: '🕯️ Wojmir',
            onClick: () => this.engine.commandTalkToNpc('npc_pobojowisko_wojmir')
          });
        }
        actions.push({
          id: 'walk_pobojowisko',
          label: '🚶 Tobół przewodnika',
          onClick: () => this.engine.commandTalkToNpc('npc_pobojowisko_slad')
        });
        break;
      case 'rozdroze':
        questsLine = 'Cel: Podejdź do Rozdroża (❗) i zdecyduj o dalszej drodze.';
        actions.push({
          id: 'walk_rozdroze',
          label: '🚶 Rozdroże',
          onClick: () => this.engine.commandTalkToNpc('npc_rozdroze_szlak')
        });
        break;
      default:
        break;
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
            this.refreshObjectiveTracker();
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

    this.ui.setHubPanel({
      title: 'Prolog — Zadanie w świecie 2.5D',
      statusLine,
      questsLine,
      actions
    });
  }

  public handlePropInteract(propId: string): boolean {
    if (propId === 'brzezina_drogowskaz') {
      if (this.phase === 'brzezina_gotowy_do_wymarszu') {
        this.beginMarchDay1();
      } else {
        this.engine.addLog(
          '⛔ Nie możesz jeszcze opuścić Brzeziny — najpierw porozmawiaj z wyznaczonymi osobami na dziedzińcu!',
          'critical'
        );
      }
      return true;
    }
    if (propId === 'brzezina_kram') {
      this.handleNpcInteract('npc_dobrogost');
      return true;
    }
    if (propId === 'brzezina_ognisko') {
      const hasBacon = this.state.inventory.items.some((i) => i.id === 'slonina_na_droge' && i.qty > 0);
      if (
        (this.phase === 'brzezina_towarzysze' || this.phase === 'brzezina_gotowy_do_wymarszu') &&
        this.state.flags.przysluga_skarimir_start &&
        !this.state.flags.przysluga_skarimir_done &&
        !hasBacon
      ) {
        this.runDialogue('brzezina_skarimir_kociol', () => this.refreshMarkersAndTracker());
      } else {
        this.engine.addLog('🔥 Ognisko na dziedzińcu Szkoły Ostrzy. Z kotła pachnie kaszą bez omasty.', 'info');
      }
      return true;
    }
    if (propId === 'brzezina_studnia') {
      if (
        (this.phase === 'brzezina_towarzysze' || this.phase === 'brzezina_gotowy_do_wymarszu') &&
        this.state.flags.przysluga_wojmir_start &&
        !this.state.flags.wojmir_tobol_uratowany &&
        !this.state.flags.przysluga_wojmir_done
      ) {
        this.runDialogue('brzezina_wojmir_studnia', () => this.refreshMarkersAndTracker());
      } else {
        this.engine.addLog('💧 Studnia przy murze szkoły. Zimna woda zmywa pot po musztrze.', 'info');
      }
      return true;
    }
    if (propId === 'trakt_ognisko' && this.phase === 'trakt_ognisko') {
      this.handleNpcInteract('npc_trakt_ognisko');
      return true;
    }
    if (propId === 'rozdroze_plecak' && this.phase === 'pobojowisko') {
      this.handleNpcInteract('npc_pobojowisko_slad');
      return true;
    }
    if (propId === 'rozdroze_drogowskaz') {
      if (this.phase === 'rozdroze') {
        this.handleNpcInteract('npc_rozdroze_szlak');
      } else if (this.phase === 'pobojowisko') {
        this.engine.addLog(
          '⛔ Najpierw zbadaj pobojowisko i tobół przewodnika!',
          'critical'
        );
      }
      return true;
    }
    return false;
  }

  public handleNpcInteract(npcId: string): boolean {
    // 1. Brzezina: Gnieworad
    if (npcId === 'npc_gnieworad') {
      if (this.phase === 'brzezina_gnieworad') {
        advanceMinutes(this.state, 120, this.data);
        this.showNarrativeScene(
          'demo_sparing',
          () => {
            this.phase = 'brzezina_sparing_talk';
            this.refreshMarkersAndTracker();
            this.engine.addLog(
              '⚔️ Podejdź do Instruktora Radogosta na środku placu, aby rozpocząć sparing.',
              'important'
            );
          },
          this.formatClock(),
          'Rozumiem, mistrzu'
        );
        return true;
      }
      if (this.phase === 'brzezina_delegacja') {
        advanceMinutes(this.state, 15, this.data);
        this.runDialogue('delegacja', () => {
          this.phase = 'brzezina_towarzysze';
          this.refreshMarkersAndTracker();
          this.engine.addLog(
            '📜 Udaj się pod południową bramę i porozmawiaj z towarzyszami (Skarimir, Ragnosława, Wojmir).',
            'important'
          );
        });
        return true;
      }
      this.engine.addLog('Mistrz Gnieworad: „Nie stój jak kołek, rób swoje.”', 'info');
      return true;
    }

    // 2. Brzezina: Instruktor Radogost
    if (npcId === 'npc_radogost') {
      if (this.phase === 'brzezina_sparing_talk') {
        this.phase = 'brzezina_sparing_fight';
        this.engine.registerCustomScene(createBrzezinaYardScene({ sparingHostile: true }));
        this.engine.loadCustomScene('brzezina_dziedziniec');
    markOstrzeLocationVisited(this.state, 'brzezina_dziedziniec');
        this.syncHeroTo25D();
        this.refreshMarkersAndTracker();
        this.engine.addLog(
          '⚔️ Sparing ćwiczebny z Instruktorem Radogostem (walka nieśmiercionośna)!',
          'combat'
        );
        this.engine.startCombatWithEnemy('npc_radogost');
        return true;
      }
      if (
        (this.phase === 'brzezina_towarzysze' || this.phase === 'brzezina_gotowy_do_wymarszu') &&
        this.state.flags.przysluga_ragnoslawa_start &&
        !this.state.flags.ragnoslawa_trop_odkryty
      ) {
        this.runDialogue('brzezina_ragnoslawa_trop', () => this.refreshMarkersAndTracker());
        return true;
      }
      this.engine.addLog('Instruktor Radogost ociera pot z czoła: „Jeszcze się wyrobisz.”', 'info');
      return true;
    }

    // 3. Brzezina: Cesarski Kurier
    if (npcId === 'npc_kurier') {
      if (this.phase === 'brzezina_kurier') {
        advanceMinutes(this.state, 15, this.data);
        this.runDialogue('kurier', () => {
          this.phase = 'brzezina_delegacja';
          this.refreshMarkersAndTracker();
          this.engine.addLog(
            '📜 Kurier skończył. Podejdź teraz do Mistrza Gnieworada po listę delegacji.',
            'important'
          );
        });
        return true;
      }
      if (
        (this.phase === 'brzezina_towarzysze' || this.phase === 'brzezina_gotowy_do_wymarszu') &&
        this.state.flags.przysluga_ragnoslawa_start &&
        !this.state.flags.ragnoslawa_trop_odkryty
      ) {
        this.runDialogue('brzezina_ragnoslawa_trop', () => this.refreshMarkersAndTracker());
        return true;
      }
      this.engine.addLog('Cesarski Kurier poprawia siodło i nie ma już nic do dodania.', 'info');
      return true;
    }

    // 4. Brzezina: Kwatermistrz Dobrogost
    if (npcId === 'npc_dobrogost') {
      if (
        this.phase === 'brzezina_towarzysze' ||
        this.phase === 'brzezina_gotowy_do_wymarszu'
      ) {
        this.runDialogue('kwatermistrz', () => {
          this.ui?.showShop('kramarz_szkolny', () => {
            this.syncHeroTo25D();
            this.refreshMarkersAndTracker();
            this.onAutoSave?.();
          });
        });
      } else {
        this.engine.addLog(
          'Kwatermistrz Dobrogost: „Najpierw załatw sprawy na placu, potem przyjdź po towar.”',
          'info'
        );
      }
      return true;
    }

    // 5. Brzezina: Towarzysze przy bramie (dwuetapowo: reakcje przed delegacją, potem 1-na-1 + przysługi)
    if (npcId === 'npc_skarimir' || npcId === 'npc_ragnoslawa' || npcId === 'npc_wojmir') {
      if (this.phase === 'brzezina_towarzysze' || this.phase === 'brzezina_gotowy_do_wymarszu') {
        const dialogueMap: Record<string, string> = {
          npc_skarimir: 'brzezina_skarimir',
          npc_ragnoslawa: 'brzezina_ragnoslawa',
          npc_wojmir: 'brzezina_wojmir'
        };
        advanceMinutes(this.state, 10, this.data);
        this.runDialogue(dialogueMap[npcId], () => {
          if (this.phase === 'brzezina_towarzysze') {
            this.phase = 'brzezina_gotowy_do_wymarszu';
            this.engine.addLog(
              '🚶 Możesz jeszcze porozmawiać z resztą towarzyszy i pomóc im w Brzezinie, albo ruszyć na trakt przy bramie.',
              'important'
            );
          }
          this.refreshMarkersAndTracker();
        });
        return true;
      }
      this.logPreDelegationCompanionBark(npcId);
      return true;
    }

    // 6. Trakt: Indywidualne rozmowy z towarzyszami przy ognisku
    if (
      this.phase === 'trakt_ognisko' &&
      (npcId === 'npc_trakt_skarimir' || npcId === 'npc_trakt_ragnoslawa' || npcId === 'npc_trakt_wojmir')
    ) {
      const campMap: Record<string, string> = {
        npc_trakt_skarimir: 'trakt_ognisko_skarimir',
        npc_trakt_ragnoslawa: 'trakt_ognisko_ragnoslawa',
        npc_trakt_wojmir: 'trakt_ognisko_wojmir'
      };
      advanceMinutes(this.state, 10, this.data);
      this.runDialogue(campMap[npcId], () => {
        this.refreshMarkersAndTracker();
      });
      return true;
    }

    // 6b. Trakt: Ognisko po bandytach (domknięcie popasu i przejście do Nocy Upiorów)
    if (npcId === 'npc_trakt_ognisko' && this.phase === 'trakt_ognisko') {
      advanceMinutes(this.state, 30, this.data);
      this.runDialogue('ognisko', () => this.beginNightOfWraiths());
      return true;
    }

    // 7. Uroczysko Nocą: Istota
    if (npcId === 'npc_istota' && this.phase === 'noc_istota') {
      ostrzeAudio.playCreatureSound('ghost_breath');
      if (this.state.character) {
        this.state.character.hp = getStats(this.state, this.data).derived.hpMax;
      }
      this.state.flags.dlug_istoty = true;
      this.runDialogue('istota', () => this.beginDawnBattlefield());
      return true;
    }

    // 8. Pobojowisko o Świcie: indywidualne badanie poległych towarzyszy
    if (
      (this.phase === 'pobojowisko' || this.phase === 'rozdroze') &&
      (npcId === 'npc_pobojowisko_skarimir' ||
        npcId === 'npc_pobojowisko_ragnoslawa' ||
        npcId === 'npc_pobojowisko_wojmir')
    ) {
      const fallenMap: Record<string, string> = {
        npc_pobojowisko_skarimir: 'pobojowisko_skarimir',
        npc_pobojowisko_ragnoslawa: 'pobojowisko_ragnoslawa',
        npc_pobojowisko_wojmir: 'pobojowisko_wojmir'
      };
      this.runDialogue(fallenMap[npcId], () => {
        this.refreshMarkersAndTracker();
      });
      return true;
    }

    // 8b. Pobojowisko o Świcie: tobół przewodnika / pozostałe ślady
    if (npcId === 'npc_pobojowisko_slad' && this.phase === 'pobojowisko') {
      this.runDialogue('pobojowisko', () => {
        this.phase = 'rozdroze';
        this.refreshMarkersAndTracker();
        this.engine.addLog(
          '📜 Zbadałeś pobojowisko. Podejdź teraz do Rozdroża (❗), aby wybrać dalszą drogę.',
          'important'
        );
      });
      return true;
    }

    // 9. Rozdroże ku Wilczemu Brodowi
    if (npcId === 'npc_rozdroze_szlak') {
      if (this.phase === 'pobojowisko') {
        this.engine.addLog(
          '⛔ Najpierw podejdź do poległych towarzyszy i tobołu przewodnika!',
          'critical'
        );
        return true;
      }
      if (this.phase === 'rozdroze') {
        this.runDialogue('rozdroze', () => this.completePrologue());
        return true;
      }
    }

    return false;
  }

  public handleCombatEnded(outcome: 'victory' | 'defeat' | 'fled'): void {
    this.engine.combatState.active = false;
    this.engine.combatState.participantIds = [];
    this.engine.combatState.activeTurnActorId = null;
    if (this.phase === 'brzezina_sparing_fight') {
      this.phase = 'brzezina_kurier';
      for (const npc of this.engine.npcs) {
        if (npc.id === 'npc_radogost' && npc.combat) {
          npc.combat.isHostile = false;
        }
      }
      if (outcome === 'victory') {
        this.state.flags.combat_demo_sparing_walka_wygrana = true;
      } else {
        this.state.flags.combat_demo_sparing_walka_porazka = true;
      }
      if (this.state.character) {
        this.state.character.hp = getStats(this.state, this.data).derived.hpMax;
      }
      this.applySparingReward();
      this.onAutoSave?.();
      const resultId = outcome === 'victory' ? 'demo_sparing_wygrana' : 'demo_sparing_porazka';
      this.showNarrativeScene(resultId, () => this.spawnCourierInBrzezina());
      return;
    }

    if (this.phase === 'trakt_bandyci') {
      if (outcome === 'defeat') {
        if (this.ui && this.onDefeatToPrologue) {
          this.ui.showNarrative({
            title: 'Poległeś na trakcie',
            subtitle: this.formatClock(),
            text: 'Bandyci okazali się silniejsi. Twoja historia kończy się na leśnym trakcie — ale możesz zacząć od nowa.',
            buttonLabel: 'Wróć na początek Prologu',
            onContinue: () => this.onDefeatToPrologue?.()
          });
        } else {
          this.onDefeatToPrologue?.();
        }
        return;
      }

      this.phase = 'trakt_ognisko';
      for (let i = this.engine.npcs.length - 1; i >= 0; i--) {
        if (this.engine.npcs[i].id.startsWith('enemy_bandyta_')) {
          this.engine.npcs.splice(i, 1);
        }
      }
      if (this.state.character && this.engine.player.combat) {
        this.state.character.hp = Math.max(1, this.engine.player.combat.hp);
      }
      if (outcome === 'victory') {
        this.addItemStack('kamien_zmierzchu', 1);
        this.engine.addLog('✨ Zdobyto artefakt: Kamień Zmierzchu!', 'important');
        this.onAutoSave?.();
      }
      const campfireActor = createTraktCampfireActor(this.engine.map.tiles[15]?.[11]?.z ?? 0);
      this.engine.npcs.push(campfireActor);
      this.refreshMarkersAndTracker();

      const sceneId = outcome === 'victory' ? 'bandyci_po_walce' : 'bandyci_ucieczka';
      this.showNarrativeScene(sceneId, () => {
        this.engine.addLog(
          '🔥 Podejdź do Skarimira przy ognisku (❗), aby porozmawiać przed zmrokiem.',
          'important'
        );
        this.refreshMarkersAndTracker();
      });
      return;
    }

    if (this.phase === 'noc_upiory') {
      this.phase = 'noc_istota';
      for (let i = this.engine.npcs.length - 1; i >= 0; i--) {
        if (
          this.engine.npcs[i].id.startsWith('enemy_upior_') ||
          this.engine.npcs[i].id.startsWith('npc_noc_')
        ) {
          this.engine.npcs.splice(i, 1);
        }
      }
      if (this.state.character && this.engine.player.combat) {
        this.state.character.hp = Math.max(1, this.engine.player.combat.hp);
      }
      this.state.flags.towarzysze_zgineli = true;
      waitUntilHour(this.state, 2, this.data);
      this.syncHeroTo25D();

      // Spawn Istota on the nocturnal map
      const istota = createIstotaActor(this.engine.map.tiles[9]?.[10]?.z ?? 0);
      this.engine.npcs.push(istota);

      const omdlenie = this.getStoryScene('noc_omdlenie');
      const zaglada = this.getStoryScene('noc_zaglada');
      const combinedText = [omdlenie.text, zaglada.text].filter(Boolean).join('\n\n');
      const showIstotaPrompt = (): void => {
        this.refreshMarkersAndTracker();
        this.engine.addLog(
          '👁️ Tajemnicza Istota stoi przy wygasłym ognisku. Podejdź do niej i kliknij (❗).',
          'important'
        );
      };

      if (this.ui && combinedText) {
        this.ui.showNarrative({
          title: 'Ciemność i Cisza',
          subtitle: this.formatClock(),
          artId: omdlenie.art ?? zaglada.art ?? 'noc_ciemnosc',
          text: combinedText,
          buttonLabel: 'Ocknij się',
          onContinue: showIstotaPrompt
        });
      } else {
        showIstotaPrompt();
      }
    }
  }

  private addItemStack(itemId: string, qty: number): void {
    const existing = this.state.inventory.items.find((i) => i.id === itemId);
    if (existing) {
      existing.qty += qty;
    } else {
      this.state.inventory.items.push({ id: itemId, qty });
    }
  }

  private applySparingReward(): void {
    if (this.state.flags.klasa_miecz) {
      this.state.vars.dlug = (this.state.vars.dlug ?? 0) + 1;
    } else if (this.state.flags.klasa_wlocznia) {
      this.state.vars.wola = (this.state.vars.wola ?? 0) + 1;
    }

    if (this.state.character) {
      const xpRes = grantXp(this.state, 160, this.data);
      this.state.character.money += 15;
      this.addItemStack('kaptur_mysliwego', 1);
      this.state.inventory.equipped.glowa = 'kaptur_mysliwego';
      this.engine.addLog(
        `🏆 Nagroda po sparingu: +160 XP (Poziom ${xpRes.newLevel}), +15 gr, Kaptur Myśliwego!`,
        'important'
      );
    }
    this.syncHeroTo25D();
  }

  private spawnCourierInBrzezina(): void {
    waitUntilHour(this.state, 12, this.data);
    this.engine.registerCustomScene(createBrzezinaYardScene({ withCourier: true }));
    this.engine.loadCustomScene('brzezina_dziedziniec');
    markOstrzeLocationVisited(this.state, 'brzezina_dziedziniec');
    this.syncHeroTo25D();

    this.showNarrativeScene(
      'prolog_kurier_narracja',
      () => {
        this.refreshMarkersAndTracker();
        this.engine.addLog(
          '📜 Cesarski Kurier zsiadł z konia na placu. Podejdź do niego i porozmawiaj (❗).',
          'important'
        );
      },
      this.formatClock()
    );
  }

  public beginMarchDay1(): void {
    waitUntilHour(this.state, 6, this.data);
    this.phase = 'trakt_bandyci';
    this.engine.loadCustomScene('trakt_zasadzka');
    markOstrzeLocationVisited(this.state, 'trakt_zasadzka');
    ostrzeAudio.setAmbience('forest');
    this.syncHeroTo25D();

    const wymarsz = this.getStoryScene('prolog_wymarsz');
    const zasadzka = this.getStoryScene('bandyci_zasadzka');
    const combinedText = [wymarsz.text, zasadzka.text].filter(Boolean).join('\n\n');
    const startAmbushCombat = (): void => {
      this.refreshMarkersAndTracker();
      this.engine.addLog('⚔️ Zasadzka bandytów na trakcie! Podejdź do nich lub kliknij wroga!', 'combat');
      this.engine.startCombatWithEnemy('enemy_bandyta_1');
      this.applyCompanionAmbushSupport();
      this.onUiRefresh?.();
    };

    if (this.ui && combinedText) {
      this.ui.showNarrative({
        title: zasadzka.title || 'Zasadzka na trakcie',
        subtitle: this.formatClock(),
        artId: wymarsz.art ?? zasadzka.art,
        text: combinedText,
        buttonLabel: 'Broń się!',
        onContinue: startAmbushCombat
      });
    } else {
      startAmbushCombat();
    }
  }

  private beginNightOfWraiths(): void {
    waitUntilHour(this.state, 21, this.data);
    this.phase = 'noc_upiory';
    this.state.world.activePhenomenon = 'burza_iskier';
    this.engine.loadCustomScene('uroczysko_noc');
    markOstrzeLocationVisited(this.state, 'uroczysko_noc');
    ostrzeAudio.setAmbience('night_storm');
    ostrzeAudio.playCreatureSound('wraith_moan');
    this.syncHeroTo25D();

    const zmierzch = this.getStoryScene('noc_zmierzch');
    const atak = this.getStoryScene('noc_atak');
    const combinedText = [zmierzch.text, atak.text].filter(Boolean).join('\n\n');

    const startWraithCombat = (): void => {
      this.refreshMarkersAndTracker();
      this.engine.addLog('☠️ Noc Upiorów — Burza Iskier rozrywa niebo!', 'critical');
      this.logNightOfWraithsCompanionCries();
      this.engine.startCombatWithEnemy('enemy_upior_1');
      this.onUiRefresh?.();
    };

    if (this.ui && combinedText) {
      this.ui.showNarrative({
        title: atak.title || 'Noc Upiorów',
        subtitle: `${this.formatClock()} · Zjawisko: Burza Iskier`,
        artId: atak.art ?? zmierzch.art ?? 'noc_upiory',
        text: combinedText,
        buttonLabel: 'Staw czoła Upiorom',
        onContinue: startWraithCombat
      });
    } else {
      startWraithCombat();
    }
  }

  private beginDawnBattlefield(): void {
    this.state.world.activePhenomenon = null;
    waitUntilHour(this.state, 5, this.data);
    this.state.flags.ukryte_insygnia = true;
    this.phase = 'pobojowisko';
    this.engine.loadCustomScene('pobojowisko_swit');
    markOstrzeLocationVisited(this.state, 'pobojowisko_swit');
    ostrzeAudio.setAmbience('dawn');
    this.syncHeroTo25D();

    this.showNarrativeScene(
      'noc_swit',
      () => {
        this.refreshMarkersAndTracker();
        this.engine.addLog(
          '📜 Podejdź do śladów towarzyszy i tobołu przewodnika (❗), zanim ruszysz dalej.',
          'important'
        );
      },
      this.formatClock()
    );
  }

  private completePrologue(): void {
    advanceMinutes(this.state, 180, this.data);
    this.state.world.location = 'wilczy_brod';
    this.phase = 'completed';
    this.engine.clearAllNpcMarkers();
    this.ui?.setHubPanel(null);

    const ch = this.state.character;
    const summary = [
      this.getStoryScene('noc_bezdroza').text,
      '',
      '--- KONIEC PROLOGU 2.5D ---',
      `Bohater: ${ch?.name ?? 'Bezimienny'} (Poz. ${ch?.level ?? 1}, ${ch?.xp ?? 0} XP, ${ch?.money ?? 0} gr)`,
      `Osie moralne: Wola = ${this.state.vars.wola ?? 0}, Dług = ${this.state.vars.dlug ?? 0}`
    ].join('\n');

    if (this.ui) {
      this.ui.showNarrative({
        title: 'Wilczy Bród — Koniec Prologu',
        subtitle: this.formatClock(),
        artId: 'mapa_brod',
        text: summary,
        buttonLabel: 'Ruszaj do Wilczego Brodu (Rozdział I)',
        onContinue: () => {
          this.engine.addLog('🏁 Prolog ukończony! Wkraczasz do Strażnicy Wilczy Bród.', 'important');
          this.onUiRefresh?.();
          this.onPrologueCompleted?.();
        }
      });
    } else {
      this.onPrologueCompleted?.();
    }
  }

  public restoreFromSave(phase: ProloguePhase, sceneId: string): void {
    this.bindEngineHooks();
    this.phase = phase;
    const includeCourier =
      phase === 'brzezina_kurier' ||
      phase === 'brzezina_delegacja' ||
      phase === 'brzezina_towarzysze' ||
      phase === 'brzezina_gotowy_do_wymarszu';
    if (sceneId === 'brzezina_dziedziniec') {
      this.engine.registerCustomScene(
        createBrzezinaYardScene({
          withCourier: includeCourier,
          sparingHostile: phase === 'brzezina_sparing_fight'
        })
      );
    }
    this.engine.loadCustomScene(sceneId);
    if (phase === 'trakt_ognisko') {
      for (let i = this.engine.npcs.length - 1; i >= 0; i--) {
        if (this.engine.npcs[i].id.startsWith('enemy_bandyta_')) {
          this.engine.npcs.splice(i, 1);
        }
      }
      this.engine.npcs.push(createTraktCampfireActor(this.engine.map.tiles[15]?.[11]?.z ?? 0));
    } else if (phase === 'noc_istota') {
      for (let i = this.engine.npcs.length - 1; i >= 0; i--) {
        if (
          this.engine.npcs[i].id.startsWith('enemy_upior_') ||
          this.engine.npcs[i].id.startsWith('npc_noc_')
        ) {
          this.engine.npcs.splice(i, 1);
        }
      }
      this.engine.npcs.push(createIstotaActor(this.engine.map.tiles[9]?.[10]?.z ?? 0));
    }
    this.syncHeroTo25D();
    this.refreshMarkersAndTracker();
  }

  private logPreDelegationCompanionBark(npcId: string): void {
    const wonSparing = this.state.flags.combat_demo_sparing_walka_wygrana === true;
    const lostSparing = this.state.flags.combat_demo_sparing_walka_porazka === true;

    if (npcId === 'npc_skarimir') {
      if (wonSparing) {
        this.engine.addLog(
          'Skarimir gwiżdże z uznaniem: „Rozłożyłeś Radogosta! Stawiam miskę kaszy, że Gnieworad ma już cię na oku.”',
          'info'
        );
      } else if (lostSparing) {
        this.engine.addLog(
          'Skarimir klepie cię po ramieniu: „Nie łam się, mnie Radogost wczoraj wbił w błoto po same uszy!”',
          'info'
        );
      } else {
        this.engine.addLog(
          'Skarimir podrzuca kość do gry: „Najpierw załatw sprawę z Gnieworadem i Radogostem, potem pogadamy przy kotle!”',
          'info'
        );
      }
      return;
    }

    if (npcId === 'npc_ragnoslawa') {
      if (wonSparing) {
        this.engine.addLog(
          'Ragnosława kiwa krótko głową: „Niezła praca nóg na sparingu. Zobaczymy, co przyniósł ten kurier w czerwieni.”',
          'info'
        );
      } else if (lostSparing) {
        this.engine.addLog(
          'Ragnosława opiera się o włócznię: „Radogost bije za mocno jak na ćwiczenia. Uważaj na ten list od kuriera — coś tu śmierdzi.”',
          'info'
        );
      } else {
        this.engine.addLog(
          'Ragnosława patrzy na plac: „Idź najpierw do Mistrza Gnieworada. Nie lubię, gdy w szkole jest tak cicho.”',
          'info'
        );
      }
      return;
    }

    if (wonSparing) {
      this.engine.addLog(
        'Wojmir Cienki notuje coś pospiesznie: „Niesamowite, jak wybroniłeś cięcie Radogosta! Słuchaj, ten cesarski posłaniec chyba czeka na placu.”',
        'info'
      );
    } else if (lostSparing) {
      this.engine.addLog(
        'Wojmir Cienki podaje ci szmatkę: „Wszystko w porządku? Radogost nie ma litości... ale zaraz, czy to nie cesarski kurier wjechał na dziedziniec?”',
        'info'
      );
    } else {
      this.engine.addLog(
        'Wojmir Cienki poprawia rzemienie: „Mistrz Gnieworad wzywał cię na środek placu. Lepiej go nie drażnić!”',
        'info'
      );
    }
  }

  private applyCompanionAmbushSupport(): void {
    const skarimirBond = (this.state.vars.wiez_skarimir ?? 0) >= 2 || this.state.flags.przysluga_skarimir_done;
    const ragnoslawaBond = (this.state.vars.wiez_ragnoslawa ?? 0) >= 2 || this.state.flags.przysluga_ragnoslawa_done;
    const wojmirBond = (this.state.vars.wiez_wojmir ?? 0) >= 2 || this.state.flags.przysluga_wojmir_done;

    if (skarimirBond && this.engine.player.combat) {
      this.engine.player.combat.ap += 1;
      this.state.flags.trakt_wsparcie_skarimir = true;
      this.engine.addLog(
        '🤝 Skarimir ciska kamieniem w krzaki, odwracając uwagę zbójów (+1 AP w pierwszej turze)!',
        'important'
      );
    }
    if (ragnoslawaBond && this.engine.player.combat) {
      this.engine.player.combat.customArmorBonus = (this.engine.player.combat.customArmorBonus ?? 0) + 2;
      this.state.flags.trakt_wsparcie_ragnoslawa = true;
      this.engine.addLog(
        '🤝 Ragnosława osłania twoją flankę włócznią (+2 do pancerza na czas zasadzki)!',
        'important'
      );
    }
    if (wojmirBond) {
      const firstBandit = this.engine.npcs.find((n) => n.id === 'enemy_bandyta_1');
      if (firstBandit?.combat) {
        firstBandit.combat.hp = Math.max(1, firstBandit.combat.hp - 4);
      }
      this.state.flags.trakt_wsparcie_wojmir = true;
      this.engine.addLog(
        '🤝 Wojmir wypatrzył zasadzkę ułamek sekundy wcześniej — pierwszy bandyta traci impet (-4 HP na start)!',
        'important'
      );
    }
  }

  private logNightOfWraithsCompanionCries(): void {
    if ((this.state.vars.wiez_skarimir ?? 0) >= 2) {
      this.engine.addLog('Skarimir: „Nie dam cię zajść z boku! Trzymaj się, druhu!”', 'combat');
    } else {
      this.engine.addLog('Skarimir: „Co to za cholerstwo?! Ostrza przez nie przechodzą!”', 'combat');
    }
    if ((this.state.vars.wiez_ragnoslawa ?? 0) >= 2) {
      this.engine.addLog('Ragnosława: „Zwieraj szyk! Jeszcze wisisz mi to piwo w stolicy!”', 'combat');
    } else {
      this.engine.addLog('Ragnosława: „Włócznie naprzód! Nie cofać się!”', 'combat');
    }
    if ((this.state.vars.wiez_wojmir ?? 0) >= 2) {
      this.engine.addLog('Wojmir Cienki: „Uciekaj! Jeśli przeżyjesz — pamiętaj o liście!”', 'combat');
    } else {
      this.engine.addLog('Wojmir Cienki: „Burza iskier... to nie są żywi ludzie!”', 'combat');
    }
  }

  private formatClock(): string {
    const c = clockOf(this.state.time.minutes);
    const hh = String(c.hour).padStart(2, '0');
    const mm = String(c.minute).padStart(2, '0');
    return `Dzień ${c.day}, ${hh}:${mm}`;
  }
}
