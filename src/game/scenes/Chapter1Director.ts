import type { OstrzeEngineState } from '../../engine-bridge/OstrzeEngineState';
import { ostrzeAudio } from '../audio/ostrzeAudio';
import { ORIGIN_DATA } from '../data/originData';
import type { OriginGameData, OstrzeGameState } from '../data/originTypes';
import {
  createKamiennaPrzeleczScene,
  createWilczaNoraScene,
  createWilczyBrodScene
} from '../maps/chapter1Maps';
import { grantXp } from '../rules/character';
import type { SeededRng } from '../rules/dice';
import { startOstrzeDialogue } from '../rules/dialogueEngine';
import { getStats } from '../rules/stats';
import { advanceMinutes, clockOf, waitUntilHour } from '../rules/time';
import type { OstrzeModalUi } from '../ui/OstrzeModalUi';

export type Chapter1CombatStage = 'none' | 'wilcza_nora' | 'eskorta_ostromira';

export class Chapter1Director {
  public readonly engine: OstrzeEngineState;
  public readonly data: OriginGameData;
  public readonly state: OstrzeGameState;
  public readonly rng: SeededRng;
  private ui: OstrzeModalUi | null;
  private readonly onUiRefresh?: () => void;

  public activeCombatStage: Chapter1CombatStage = 'none';
  public chapter1Completed = false;
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
    if (propId === 'wb_ognisko') {
      this.engine.addLog('🔥 Przy ognisku strażniczym grzeją się wartownicy. Jeśli potrzebujesz odpoczynku, zajrzyj do Izby.', 'info');
      return true;
    }
    if (propId === 'wb_studnia') {
      this.engine.addLog('💧 Zimna woda ze studni w Wilczym Brodzie orzeźwia po marszu.', 'info');
      return true;
    }
    if (propId === 'wb_drogowskaz') {
      if (this.state.flags.akt2_koniec && !this.chapter1Completed) {
        this.finishChapter1();
      } else {
        this.engine.addLog('🪧 Drogowskaz wskazuje Kamienną Przełęcz. Kupiec Ostromir szuka eskorty, zanim ruszysz dalej.', 'important');
      }
      return true;
    }
    return false;
  }

  public openNoticeBoard(): void {
    if (!this.ui) return;
    const noraDone = this.state.quests.wilcza_nora === 'completed';
    const noraActive = this.state.quests.wilcza_nora === 'active';
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
        },
        {
          id: 'nb_gluszec',
          title: 'Ogłoszenie: Przejazd do Głuszca',
          author: 'Cesarski Urząd Szlakowy',
          reward: 'Informacja',
          body: 'Po burzach iskier gościniec na wschód bywa zatarasowany. Przepustki wydaje wyłącznie komendant lub wóz kupiecki zmierzający przez przełęcz.'
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
    if (!this.state.world.knownPlaces.includes('wilczy_brod')) {
      this.state.world.knownPlaces.push('wilczy_brod');
    }

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

  public refreshHubPanel(): void {
    if (!this.ui) return;
    if (this.state.world.location !== 'wilczy_brod') {
      this.ui.setHubPanel(null);
      return;
    }

    const ch = this.state.character;
    const hpMax = ch ? getStats(this.state, this.data).derived.hpMax : 0;
    const c = clockOf(this.state.time.minutes);
    const clockText = `Dzień ${c.day}, ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`;

    const actions: Array<{ id: string; label: string; disabled?: boolean; alert?: boolean; onClick: () => void }> = [
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
    ];

    if (this.state.quests.wilcza_nora === 'active' && !this.state.flags.nora_wykonana) {
      actions.push({
        id: 'go_wilcza_nora',
        label: '⚔️ Wyrusz do Wilczej Nory',
        onClick: () => this.startWilczaNoraQuest()
      });
    }

    if (this.state.quests.eskorta_ostromira === 'active' && !this.state.flags.akt2_koniec) {
      actions.push({
        id: 'go_eskorta',
        label: '🛡️ Eskortuj wóz na Przełęcz',
        onClick: () => this.startOstromirEscort()
      });
    }

    if (this.state.flags.akt2_koniec && !this.chapter1Completed) {
      actions.push({
        id: 'finish_ch1',
        label: '⛰️ Przejdź przez Kamienną Przełęcz (Koniec Rozdziału I)',
        onClick: () => this.finishChapter1()
      });
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

    const implementedIds = new Set(['wilcza_nora', 'eskorta_ostromira']);
    const activeQuests = this.data.quests
      .filter((q) => implementedIds.has(q.id) && this.state.quests[q.id] === 'active')
      .map((q) => q.name);

    this.refreshChapter1Markers();

    this.ui.setHubPanel({
      title: 'Strażnica Wilczy Bród (Rozdział I)',
      statusLine: `${ch?.name ?? 'Adept'} · Poz. ${ch?.level ?? 1} · HP ${ch?.hp ?? 0}/${hpMax} · ${ch?.money ?? 0} gr · ${clockText}`,
      questsLine:
        activeQuests.length > 0
          ? `Aktywne zlecenia: ${activeQuests.join(', ')}`
          : 'Brak aktywnych zleceń — zajrzyj na Tablicę Zleceń lub porozmawiaj z Wszeborem.',
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
    return false;
  }

  private refreshChapter1Markers(): void {
    this.engine.clearAllNpcMarkers();
    if (this.state.world.location !== 'wilczy_brod') return;
    const wszeborNeedsReport = Boolean(this.state.flags.nora_wykonana && !this.state.flags.nora_rozliczona);
    this.engine.setNpcMarker(
      'npc_wszebor',
      wszeborNeedsReport || !this.state.flags.komendant_byl ? '❗' : '💬'
    );
    this.engine.setNpcMarker(
      'npc_ostromir',
      this.state.quests.eskorta_ostromira === 'active' || !this.state.flags.ostromir_zgoda ? '❗' : '💬'
    );
    this.engine.setNpcMarker('npc_kramarz_brod', '🛒');
    this.engine.setNpcMarker('npc_szkarad', '⚒️');
    this.engine.setNpcMarker('npc_wrzosek', '🍺');
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
    if (this.state.flags.komendant_byl && !this.state.flags.ostromir_zgoda) {
      return 'ostromir_brama';
    }
    return 'ostromir';
  }

  private runDialogue(dialogueId: string): void {
    const session = startOstrzeDialogue(dialogueId, this.state, this.data);
    if (!this.ui) return;

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
        if (this.state.flags.szkarad_sklep) {
          this.state.flags.szkarad_sklep = false;
          this.openShop('szkarad_ruszniczar');
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
    this.engine.loadCustomScene('wilcza_nora');
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
    if (this.state.character && this.engine.player.combat) {
      this.state.character.hp = Math.max(1, this.engine.player.combat.hp);
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
          const prowiant = this.state.inventory.items.find((i) => i.id === 'prowiant');
          if (prowiant) prowiant.qty += 2;
          else this.state.inventory.items.push({ id: 'prowiant', qty: 2 });
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
    const targetScene =
      sceneId === 'wilcza_nora' || sceneId === 'kamienna_przelecz' ? sceneId : 'wilczy_brod';
    this.engine.loadCustomScene(targetScene);
    ostrzeAudio.setAmbience(
      targetScene === 'wilcza_nora' ? 'creepy_forest' : targetScene === 'kamienna_przelecz' ? 'dawn' : 'town'
    );
    this.syncHeroTo25D();
    this.refreshHubPanel();
  }
}
