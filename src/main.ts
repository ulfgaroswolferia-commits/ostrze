import '@ulf/styles/main.css';
import './game/styles/ostrze.css';
import { CombatAudioEngine } from '@ulf/audio/combatAudio';
import { IsoSceneView } from '@ulf/renderer/isoSceneView';
import { HudOverlay } from '@ulf/ui/hudOverlay';
import { OstrzeEngineState } from './engine-bridge/OstrzeEngineState';
import { ostrzeAudio } from './game/audio/ostrzeAudio';
import { ORIGIN_DATA } from './game/data/originData';
import { createCharacter, createEmptyOstrzeState, grantXp, xpRequiredForLevel } from './game/rules/character';
import { forageWorldProp, performCampRecipe } from './game/rules/campCrafting';
import { resolveQuickBeltSlots, useCombatBeltItem } from './game/rules/combatConsumables';
import { rollStealthCheck } from './game/rules/stealth';
import { waitUntilHour } from './game/rules/time';
import { syncWorldLighting } from './game/rules/worldCycle';
import { OSTRZE_LOCATIONS } from './game/rules/travel';
import { PrologueDirector, type ProloguePhase } from './game/scenes/PrologueDirector';
import {
  clearOstrzeSave,
  exportSaveKey,
  hasOstrzeSave,
  hasOstrzeSaveForKey,
  importSaveKey,
  loadOstrzeGame,
  saveOstrzeGame,
  OSTRZE_DEV_SAVE_KEY,
  type ChapterId,
  type OstrzeSavePayload
} from './game/state/saveManager';
import { OstrzeModalUi } from './game/ui/OstrzeModalUi';
import { ChronicleUxController } from './game/ui/chronicleUxController';
import { CombatTargetOverlay } from './game/ui/combatTargetOverlay';

async function bootstrapOstrze(): Promise<void> {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  const viewportContainer = document.getElementById('viewport-container');
  const hudRoot = document.getElementById('hud-root');
  const inspectorRoot = document.getElementById('inspector-root');

  if (!viewportContainer || !hudRoot || !inspectorRoot) {
    throw new Error('Brak kontenerów DOM (#viewport-container, #hud-root, #inspector-root).');
  }

  const params = new URLSearchParams(window.location.search);
  const isDevMode = params.get('dev') === '1';
  const startChapter = params.get('chapter');

  const engine = new OstrzeEngineState();

  let hud: HudOverlay | null = null;
  let inspector: { render(): void } | null = null;
  const chronicleUx = new ChronicleUxController(hudRoot, engine);
  const combatTargetOverlay = new CombatTargetOverlay(engine, ORIGIN_DATA);

  const refreshUi = (): void => {
    hud?.render();
    inspector?.render();
    chronicleUx.sync();
    combatTargetOverlay.sync();
  };

  const sceneView = new IsoSceneView(engine, refreshUi);
  sceneView.organicTerrainBlending = true;
  sceneView.showGridInExploration = isDevMode;
  sceneView.zoom = 0.78;
  sceneView.targetZoom = 0.78;
  if (isDevMode) {
    engine.fogOfWarEnabled = false;
    engine.ambientLightIntensity = 0.85;
    sceneView.activeTool = 'paint_terrain';
    document.body.classList.add('editor-workspace-mode');
  }

  await sceneView.mount(viewportContainer);
  engine.onSceneLoaded = () => {
    sceneView.centerCameraOnPlayer();
  };

  // Prevent edge-panning when hovering over Ostrze UI windows (top-right hub/description panel,
  // modals, journal/chronicle, combat log, top bar) — matching engine HUD behavior.
  const uiPanBlockSelector = [
    '.ostrze-hub-bar',
    '.ostrze-combat-target-card',
    '.ostrze-overlay',
    '.ostrze-toast',
    '.top-bar',
    '.hero-card',
    '.chronicle-log.expanded',
    '.chronicle-log .chronicle-toggle-btn',
    '.chronicle-log .combat-tab-btn',
    '.chronicle-log .combat-report-tag-btn',
    '.combat-top-banner',
    '.combat-log-dock',
    '.combat-live-log',
    '.combat-tactical-bar',
    '.inventory-drawer',
    '.inspector-card',
    '.inspector-expand-btn',
    '.dialogue-modal',
    '[data-ui-block-pan]'
  ].join(', ');

  window.addEventListener('mousemove', (e) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest(uiPanBlockSelector)) {
      sceneView.updateEdgePanPointerState(e.clientX, e.clientY, true, true);
    }
  });

  if (isDevMode) {
    const { InspectorPanel } = await import('@ulf/ui/inspectorPanel');
    inspector = new InspectorPanel(inspectorRoot, engine, sceneView, refreshUi);
  } else {
    inspectorRoot.innerHTML = '';
  }

  const prologue = new PrologueDirector({
    engine,
    onUiRefresh: refreshUi
  });
  const modalUi = new OstrzeModalUi(prologue.data, prologue.state, prologue.rng);
  modalUi.setCombatChecker(() => engine.combatState.active);
  prologue.attachUi(modalUi);

  engine.getCombatQuickBeltSlots = () => {
    const pCombat = engine.player.combat;
    const livingEnemies = engine.npcs.filter((n) => n.combat?.isHostile && n.combat.isAlive);
    return resolveQuickBeltSlots(prologue.state, prologue.data, pCombat?.ap ?? 0, {
      playerHp: pCombat?.hp,
      playerMaxHp: pCombat?.maxHp,
      hasLivingEnemy: livingEnemies.length > 0
    });
  };
  engine.onUseCombatQuickBeltSlot = (slotIndex) => {
    const res = useCombatBeltItem({
      state: prologue.state,
      data: prologue.data,
      rng: prologue.rng,
      engine,
      slotIndex
    });
    if (res.used) {
      refreshUi();
    }
    return res.used;
  };
  engine.onStealthDetectionCheck = (_enemy, distance) => {
    const check = rollStealthCheck(prologue.state, prologue.data, prologue.rng, distance);
    return check.detected;
  };

  const openCampfirePanel = (): void => {
    if (engine.combatState.active || !prologue.state.character) return;
    modalUi.showCampfireModal({
      onPerform: (recipeId) => {
        const res = performCampRecipe({
          state: prologue.state,
          data: prologue.data,
          rng: prologue.rng,
          recipeId,
          engine
        });
        if (res.ok) {
          refreshUi();
        }
        return res;
      },
      onWaitHour: (hour) => {
        waitUntilHour(prologue.state, hour, prologue.data);
        syncWorldLighting(prologue.state, prologue.data, engine);
        if (activeChapter === 'chapter1' && prologue.state.world.location === 'stary_mlyn') {
          chapter1.enterStaryMlyn();
        } else if (activeChapter === 'chapter1') {
          chapter1.refreshHubPanel();
        } else if (activeChapter === 'chapter2') {
          chapter2?.refreshHubPanel();
        } else {
          prologue.refreshObjectiveTracker();
        }
        const label = hour === 6 ? 'świtu (06:00)' : hour === 19 ? 'zmierzchu (19:00)' : 'nocy (21:00)';
        modalUi.showToast(`Przeczekano przy ognisku do ${label}.`, 'info');
        refreshUi();
      },
      onClosed: () => refreshUi()
    });
  };
  modalUi.onOpenCampfire = openCampfirePanel;

  engine.onFallbackPropInteract = (propId) => {
    const prop = engine.map.props.find((p) => p.id === propId);
    if (!prop) return false;
    if (prop.kind === 'campfire') {
      openCampfirePanel();
      return true;
    }
    if (prop.kind === 'wildflower_patch' || prop.kind === 'berry_bush') {
      const res = forageWorldProp({
        prop,
        state: prologue.state,
        data: prologue.data,
        rng: prologue.rng,
        engine
      });
      if (res.message) {
        modalUi.showToast(res.message, res.harvested ? 'success' : 'info');
      }
      refreshUi();
      return true;
    }
    return false;
  };

  const baseOnSceneLoaded = engine.onSceneLoaded;
  engine.onSceneLoaded = (sceneId) => {
    baseOnSceneLoaded?.(sceneId);
    syncWorldLighting(prologue.state, prologue.data, engine);
  };

  const { Chapter1Director } = await import('./game/scenes/Chapter1Director');
  const chapter1 = new Chapter1Director({
    engine,
    state: prologue.state,
    rng: prologue.rng,
    ui: modalUi,
    data: prologue.data,
    onUiRefresh: refreshUi
  });

  type Chapter2DirectorType = import('./game/scenes/Chapter2Director').Chapter2Director;
  let chapter2: Chapter2DirectorType | null = null;
  const ensureChapter2 = async (): Promise<Chapter2DirectorType> => {
    if (chapter2) return chapter2;
    const { Chapter2Director } = await import('./game/scenes/Chapter2Director');
    chapter2 = new Chapter2Director({
      engine,
      state: prologue.state,
      rng: prologue.rng,
      ui: modalUi,
      data: prologue.data,
      onUiRefresh: refreshUi
    });
    chapter2.hasSave = hasAvailableSave;
    chapter2.onSaveRequested = () => performSave(false);
    chapter2.onAutoSave = () => performSave(true);
    chapter2.onLoadRequested = performLoad;
    chapter2.onKeyRequested = () => openSaveKeyModal();
    chapter2.onDefeatToPrologue = returnToPrologueStart;
    return chapter2;
  };

  let activeChapter: ChapterId =
    startChapter === '2' ? 'chapter2' : startChapter === '1' ? 'chapter1' : 'prologue';

  const activeSaveKey = isDevMode ? OSTRZE_DEV_SAVE_KEY : undefined;
  const hasAvailableSave = (): boolean =>
    hasOstrzeSave() || (isDevMode && hasOstrzeSaveForKey(OSTRZE_DEV_SAVE_KEY));

  const performSave = (silent = false): void => {
    prologue.state.rngState = prologue.rng.getState();
    const fallbackScene =
      activeChapter === 'chapter2'
        ? 'gluszec'
        : activeChapter === 'chapter1'
          ? 'wilczy_brod'
          : 'brzezina_dziedziniec';
    const ok = saveOstrzeGame({
      chapter: activeChapter,
      sceneId: engine.activeCustomSceneId ?? fallbackScene,
      prologueStep: activeChapter === 'prologue' ? prologue.phase : undefined,
      state: prologue.state
    }, activeSaveKey);
    if (!silent) {
      modalUi.showToast(ok ? 'Gra zapisana.' : 'Nie udało się zapisać gry.', ok ? 'success' : 'info');
    }
    if (activeChapter === 'prologue') {
      prologue.refreshObjectiveTracker();
    } else if (activeChapter === 'chapter2') {
      chapter2?.refreshHubPanel();
    } else {
      chapter1.refreshHubPanel();
    }
  };

  const applyLoadedPayload = (loaded: OstrzeSavePayload): void => {
    const clonedState = JSON.parse(JSON.stringify(loaded.state)) as typeof prologue.state;
    Object.assign(prologue.state, clonedState);
    prologue.rng.setState(clonedState.rngState);
    activeChapter = loaded.chapter;
    if (loaded.chapter === 'chapter2') {
      void ensureChapter2().then((ch2) => {
        ch2.restoreFromSave(loaded.sceneId);
        refreshUi();
      });
    } else if (loaded.chapter === 'chapter1') {
      chapter1.restoreFromSave(loaded.sceneId);
    } else {
      prologue.restoreFromSave((loaded.prologueStep as ProloguePhase) ?? 'brzezina_gnieworad', loaded.sceneId);
    }
  };

  const performLoad = (): void => {
    const loaded = loadOstrzeGame() ?? (isDevMode ? loadOstrzeGame(OSTRZE_DEV_SAVE_KEY) : null);
    if (!loaded) {
      modalUi.showToast('Brak prawidłowego zapisu gry.', 'info');
      return;
    }
    applyLoadedPayload(loaded);
    modalUi.showToast('Wczytano zapis gry.', 'success');
  };

  const openSaveKeyModal = (onClosed?: () => void): void => {
    const currentKey = exportSaveKey({
      chapter: activeChapter,
      sceneId: engine.activeCustomSceneId ?? (activeChapter === 'chapter1' ? 'wilczy_brod' : 'brzezina_dziedziniec'),
      prologueStep: activeChapter === 'prologue' ? prologue.phase : undefined,
      state: prologue.state
    });
    modalUi.showSaveKeyModal(
      currentKey,
      (rawKey) => {
        const parsed = importSaveKey(rawKey);
        if (!parsed) return false;
        saveOstrzeGame({
          chapter: parsed.chapter,
          sceneId: parsed.sceneId,
          prologueStep: parsed.prologueStep,
          state: parsed.state
        }, activeSaveKey);
        applyLoadedPayload(parsed);
        modalUi.showToast('Wczytano grę z klucza rozgrywki.', 'success');
        return true;
      },
      onClosed
    );
  };

  const returnToPrologueStart = (): void => {
    const prevName = prologue.state.character?.name ?? 'Mściwój';
    const fresh = createEmptyOstrzeState(prologue.data, Date.now() & 0xfffffff);
    Object.assign(prologue.state, fresh);
    prologue.rng.setState(fresh.rngState);
    modalUi.resetShopStock();
    activeChapter = 'prologue';
    modalUi.setDraftName(prevName);
    prologue.startPrologue();
  };

  const startNewGame = (): void => {
    clearOstrzeSave(isDevMode ? OSTRZE_DEV_SAVE_KEY : undefined);
    returnToPrologueStart();
  };

  prologue.hasSave = hasAvailableSave;
  prologue.onSaveRequested = () => performSave(false);
  prologue.onAutoSave = () => performSave(true);
  prologue.onLoadRequested = performLoad;
  prologue.onKeyRequested = () => openSaveKeyModal();
  prologue.onDefeatToPrologue = returnToPrologueStart;

  chapter1.hasSave = hasAvailableSave;
  chapter1.onSaveRequested = () => performSave(false);
  chapter1.onAutoSave = () => performSave(true);
  chapter1.onLoadRequested = performLoad;
  chapter1.onKeyRequested = () => openSaveKeyModal();
  chapter1.onDefeatToPrologue = returnToPrologueStart;

  const ensureDevTestCharacter = (): void => {
    if (prologue.state.character) return;
    createCharacter(
      prologue.state,
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
      prologue.data
    );
    grantXp(prologue.state, 160, prologue.data);
    prologue.state.character!.money += 15;
    prologue.state.flags.ukryte_insygnia = true;
  };

  const devLocations = OSTRZE_LOCATIONS.map((location) => ({
    id: location.id,
    label: `${location.chapter === 'prologue' ? 'Prolog' : location.chapter === 'chapter2' ? 'Akt II' : 'Akt I'} — ${location.name}`
  }));

  const switchToDevLocation = (locationId: string): void => {
    const location = OSTRZE_LOCATIONS.find((candidate) => candidate.id === locationId);
    if (!location) return;
    modalUi.closeAll();
    if (!prologue.state.character) ensureDevTestCharacter();

    const finishTeleport = (ch2?: Chapter2DirectorType): void => {
      engine.syncFromOstrzeState(prologue.state, prologue.data);
      if (!engine.loadCustomScene(location.id)) return;
      activeChapter = location.chapter;
      prologue.state.world.location = location.id;
      if (location.chapter === 'prologue') prologue.activateForDevTeleport();
      else if (location.chapter === 'chapter2') ch2?.activateForDevTeleport();
      else chapter1.activateForDevTeleport();
      ostrzeAudio.setAmbience(location.ambience);
      syncWorldLighting(prologue.state, prologue.data, engine);
      if (location.chapter === 'prologue') prologue.refreshObjectiveTracker();
      else if (location.chapter === 'chapter2') ch2?.refreshHubPanel();
      else chapter1.refreshHubPanel();
      modalUi.showToast(`DEV: teleport do ${location.name}; postać i stan świata zachowane.`, 'info');
      refreshUi();
    };

    if (location.chapter === 'chapter2') {
      void ensureChapter2().then((ch2) => finishTeleport(ch2));
    } else {
      finishTeleport();
    }
  };

  const toggleUnifiedAudio = (): boolean => {
    const engineAudio = CombatAudioEngine.getInstance();
    const nextMuted = !engineAudio.getMuted();
    engineAudio.setMuted(nextMuted);
    ostrzeAudio.setMuted(nextMuted);
    refreshUi();
    return nextMuted;
  };

  const openPauseMenu = (): void => {
    if (modalUi.hasOpenModal() || modalUi.wasEscapeJustConsumed()) return;
    modalUi.showPauseMenu({
      hasSave: hasAvailableSave(),
      devMode: isDevMode,
      isMuted: CombatAudioEngine.getInstance().getMuted(),
      onSave: () => performSave(false),
      onLoad: performLoad,
      onOpenKey: () => openSaveKeyModal(),
      onToggleMute: toggleUnifiedAudio,
      onNewGame: startNewGame,
      onClosed: () => refreshUi()
    });
  };

  hud = new HudOverlay(hudRoot, engine, sceneView, {
    devMode: isDevMode,
    devScenes: devLocations,
    getActiveDevSceneId: () => engine.activeCustomSceneId ?? activeChapter,
    onSelectDevScene: switchToDevLocation,
    getHeroMeta: () => {
      const ch = prologue.state.character;
      if (!ch) return null;
      const curFloorXp = xpRequiredForLevel(ch.level, prologue.data.rules.leveling.xpStep);
      const nextLvXp = xpRequiredForLevel(ch.level + 1, prologue.data.rules.leveling.xpStep);
      const xpPct = Math.min(
        100,
        Math.max(0, Math.round(((ch.xp - curFloorXp) / Math.max(1, nextLvXp - curFloorXp)) * 100))
      );
      return {
        level: ch.level,
        xpPct,
        xpTooltip: `Doświadczenie: ${ch.xp} / ${nextLvXp} XP`,
        currencyText: `${ch.money} gr`,
        pendingLevelUpPts: ch.freeAttributePoints + ch.freeSkillPoints + ch.freePerkPicks
      };
    },
    unifiedCharacterSheet: true,
    onOpenCharacterSheet: (initialTab) => {
      if (!prologue.state.character) return;
      modalUi.showCharacterSheet(() => {
        engine.syncFromOstrzeState(prologue.state, prologue.data);
        if (activeChapter === 'prologue') {
          prologue.refreshObjectiveTracker();
        } else if (activeChapter === 'chapter2') {
          chapter2?.refreshHubPanel();
        } else {
          chapter1.refreshHubPanel();
        }
        performSave(true);
        refreshUi();
      }, initialTab);
    },
    onOpenCamp: openCampfirePanel,
    onSaveGame: () => performSave(false),
    onLoadGame: performLoad,
    hasSave: hasAvailableSave,
    onOpenSaveKey: () => openSaveKeyModal(),
    onNewGame: startNewGame,
    onToggleAudio: (muted) => {
      ostrzeAudio.setMuted(muted);
    },
    onEscapeNoModal: openPauseMenu
  });

  prologue.onPrologueCompleted = () => {
    activeChapter = 'chapter1';
    chapter1.enterWilczyBrod();
    performSave(true);
  };

  chapter1.onChapter1Completed = () => {
    void ensureChapter2().then((ch2) => {
      activeChapter = 'chapter2';
      ch2.enterGluszec();
      performSave(true);
      refreshUi();
    });
  };

  if (isDevMode) {
    engine.loadCustomScene('brzezina_dziedziniec');
    engine.addLog('Tryb deweloperski (?dev=1): załadowano scenę Brzezina — Dziedziniec.', 'info');
  } else if (startChapter === '2') {
    ensureDevTestCharacter();
    const ch2 = await ensureChapter2();
    ch2.enterGluszec();
  } else if (startChapter === '1') {
    ensureDevTestCharacter();
    chapter1.enterWilczyBrod();
  } else {
    const showWelcome = (): void => {
      const existingSave = loadOstrzeGame();
      const savedChar = existingSave?.state.character;
      const savedSummary = savedChar
        ? `${savedChar.name} · Poz. ${savedChar.level}`
        : undefined;

      modalUi.showWelcome({
        initialName: savedChar?.name ?? 'Mściwój',
        hasSave: Boolean(existingSave),
        savedSummary,
        onStartNew: (playerName) => {
          clearOstrzeSave();
          modalUi.setDraftName(playerName);
          prologue.startPrologue();
        },
        onContinue: existingSave
          ? () => {
              applyLoadedPayload(existingSave);
              modalUi.showToast('Wczytano zapis gry.', 'success');
            }
          : undefined,
        onOpenImportKey: () => openSaveKeyModal(showWelcome)
      });
    };

    engine.loadCustomScene('brzezina_dziedziniec');
    showWelcome();
  }

  refreshUi();
}

bootstrapOstrze().catch((err) => {
  console.error('Błąd inicjalizacji gry Ostrze 2.5D:', err);
  const viewportContainer = document.getElementById('viewport-container');
  if (viewportContainer) {
    const errBox = document.createElement('div');
    errBox.style.cssText = 'color:#ff6b6b;padding:24px;font-family:monospace;';
    errBox.textContent = `Błąd inicjalizacji Ostrze 2.5D: ${String(err)}`;
    viewportContainer.replaceChildren(errBox);
  }
});
