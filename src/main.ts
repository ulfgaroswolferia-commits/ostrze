import '@ulf/styles/main.css';
import './game/styles/ostrze.css';
import { CombatAudioEngine } from '@ulf/audio/combatAudio';
import { IsoSceneView, isOutdoorMap } from '@ulf/renderer/isoSceneView';
import { HudOverlay } from '@ulf/ui/hudOverlay';
import { OstrzeEngineState } from './engine-bridge/OstrzeEngineState';
import { ostrzeAudio } from './game/audio/ostrzeAudio';
import { ORIGIN_DATA } from './game/data/originData';
import { tryOpenSecretCache } from './game/data/secretCachesAndRelics';
import { createCharacter, createEmptyOstrzeState, grantXp, xpRequiredForLevel } from './game/rules/character';
import { checkNewAchievementUnlocks } from './game/rules/achievements';
import { tryTriggerAmbientBark } from './game/rules/ambientBarks';
import {
  cycleOstrzeDifficulty,
  getDifficultyProfile,
  getOstrzeDifficulty,
  setOstrzeDifficulty
} from './game/rules/difficulty';
import { forageWorldProp, performCampRecipe } from './game/rules/campCrafting';
import { resolveQuickBeltSlots, useCombatBeltItem } from './game/rules/combatConsumables';
import { rollStealthCheck } from './game/rules/stealth';
import { waitUntilHour } from './game/rules/time';
import { getWorldAtmosphere, syncWorldLighting } from './game/rules/worldCycle';
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
import { CombatFeelOverlay } from './game/ui/combatFeelOverlay';
import { CombatTargetOverlay } from './game/ui/combatTargetOverlay';
import { PhenomenonOverlay } from './game/ui/phenomenonOverlay';

async function bootstrapOstrze(): Promise<void> {
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  const unlockAudioOnce = (): void => {
    ostrzeAudio.unlock();
    window.removeEventListener('pointerdown', unlockAudioOnce);
    window.removeEventListener('keydown', unlockAudioOnce);
  };
  window.addEventListener('pointerdown', unlockAudioOnce, { passive: true });
  window.addEventListener('keydown', unlockAudioOnce, { passive: true });

  const viewportContainer = document.getElementById('viewport-container');
  const hudRoot = document.getElementById('hud-root');
  const inspectorRoot = document.getElementById('inspector-root');

  if (!viewportContainer || !hudRoot || !inspectorRoot) {
    throw new Error('Brak kontenerów DOM (#viewport-container, #hud-root, #inspector-root).');
  }

  const params = new URLSearchParams(window.location.search);
  const isDevMode = params.get('dev') === '1';
  const isDevTeleportEnabled =
    isDevMode || params.get('devTeleport') === '1' || params.get('teleport') === '1';
  const startChapter = params.get('chapter');
  const startPhenomenon = params.get('phenomenon');

  const engine = new OstrzeEngineState();

  let hud: HudOverlay | null = null;
  let inspector: { render(): void } | null = null;
  let syncPhenomenonUi: (() => void) | null = null;
  let syncHelpFabAndTips: (() => void) | null = null;
  const chronicleUx = new ChronicleUxController(hudRoot, engine);
  const combatTargetOverlay = new CombatTargetOverlay(engine, ORIGIN_DATA);
  const combatFeelOverlay = new CombatFeelOverlay();
  const phenomenonOverlay = new PhenomenonOverlay();

  const statusVignette = document.createElement('div');
  statusVignette.className = 'ostrze-status-vignette';
  statusVignette.setAttribute('aria-hidden', 'true');
  viewportContainer.appendChild(statusVignette);

  const syncStatusVignette = (): void => {
    const hideForModal = modalUi.hasOpenModal();
    const pCombat = engine.player.combat;
    const isLowHp = Boolean(
      !hideForModal &&
        pCombat &&
        pCombat.isAlive &&
        pCombat.maxHp > 0 &&
        pCombat.hp / pCombat.maxHp <= 0.3
    );
    const isStealth = Boolean(!hideForModal && engine.isStealthActive);
    viewportContainer.dataset.lowHp = isLowHp ? 'true' : 'false';
    viewportContainer.dataset.stealth = isStealth ? 'true' : 'false';
  };

  const refreshUi = (): void => {
    if (!engine.combatState.active && combatFeelOverlay.isTimedStrikeActive()) {
      combatFeelOverlay.cancelTimedStrike();
    }
    hud?.render();
    inspector?.render();
    chronicleUx.sync();
    combatTargetOverlay.sync();
    syncPhenomenonUi?.();
    syncHelpFabAndTips?.();
    syncStatusVignette();
  };

  const sceneView = new IsoSceneView(engine, refreshUi);
  sceneView.getTelegraphedIntent = (actorId) => engine.getTelegraphedIntent(actorId);
  sceneView.getActorStatuses = (actorId) => engine.getActorVisualStatuses(actorId);
  engine.onPropReaction = (propId, kind) => sceneView.triggerPropReaction(propId, kind);
  sceneView.organicTerrainBlending = true;
  sceneView.showGridInExploration = isDevMode;
  sceneView.zoom = 0.88;
  sceneView.targetZoom = 0.88;
  let zoomPunchRestoreTimer: ReturnType<typeof setTimeout> | null = null;
  let zoomPunchBaseline: number | null = null;
  const triggerCameraZoomPunch = (deltaZoom: number): void => {
    if (deltaZoom <= 0) return;
    if (zoomPunchBaseline === null) {
      zoomPunchBaseline = sceneView.targetZoom;
    }
    sceneView.targetZoom = Math.min(1.65, zoomPunchBaseline + deltaZoom);
    if (zoomPunchRestoreTimer) clearTimeout(zoomPunchRestoreTimer);
    zoomPunchRestoreTimer = setTimeout(() => {
      if (zoomPunchBaseline !== null) {
        sceneView.targetZoom = zoomPunchBaseline;
        zoomPunchBaseline = null;
      }
      zoomPunchRestoreTimer = null;
    }, 190);
  };

  engine.onJuicyImpact = (isBigImpact) => {
    sceneView.hitStopTimer = Math.max(sceneView.hitStopTimer, isBigImpact ? 0.055 : 0.03);
    sceneView.triggerScreenShake(isBigImpact ? 190 : 115, isBigImpact ? 4.6 : 2.7);
  };
  engine.onCombatFeedback = (ev) => {
    if (ev.hitStopSec) {
      sceneView.hitStopTimer = Math.max(sceneView.hitStopTimer, ev.hitStopSec);
    }
    if (ev.shakeMs && ev.shakeIntensity) {
      sceneView.triggerScreenShake(ev.shakeMs, ev.shakeIntensity);
    }
    if (ev.zoomPunch) {
      triggerCameraZoomPunch(ev.zoomPunch);
    }
    if (ev.screenFlash) {
      combatFeelOverlay.triggerFlash(ev.screenFlash);
    }
    if (ev.headline) {
      combatFeelOverlay.showCallout(ev.headline, ev.subtext, ev.screenFlash ?? 'gold');
    }
  };
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
    '.ostrze-phenomenon-badge',
    '.ostrze-dev-phenomenon-bar',
    '.ostrze-help-fab',
    '.ostrze-attack-fab',
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
  let devPhenomenonSelect: HTMLSelectElement | null = null;
  syncPhenomenonUi = () => {
    const atmosphere = getWorldAtmosphere(prologue.state, prologue.data);
    sceneView.timeOfDay = atmosphere.timeOfDay;
    viewportContainer.dataset.tod = atmosphere.timeOfDay;
    viewportContainer.dataset.outdoor = isOutdoorMap(engine.map) ? 'true' : 'false';
    viewportContainer.dataset.phenomenonActive = atmosphere.phenomenonId ? 'true' : 'false';
    phenomenonOverlay.sync(atmosphere);
    ostrzeAudio.setPhenomenonAudio(atmosphere.phenomenonId);
    if (devPhenomenonSelect) {
      devPhenomenonSelect.value = atmosphere.phenomenonId ?? '';
    }
  };
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
  modalUi.onOpenLevelUp = () => {
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
    }, 'stats');
  };

  engine.onFallbackPropInteract = (propId) => {
    const cacheRes = tryOpenSecretCache(propId, prologue.state, prologue.data);
    if (cacheRes.handled) {
      engine.addLog(cacheRes.message, cacheRes.opened ? 'important' : 'info');
      modalUi.showToast(cacheRes.message, cacheRes.opened ? 'gold' : 'info');
      if (cacheRes.opened) {
        ostrzeAudio.playQuestEvent('complete');
        engine.syncFromOstrzeState(prologue.state, prologue.data);
        performSave(true);
      }
      refreshUi();
      return true;
    }
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
    chapter2.onExportHeroKey = () => openSaveKeyModal();
    chapter2.onNewGame = () => startNewGame();
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

  if (isDevTeleportEnabled) {
    (window as unknown as Record<string, unknown>).__ostrzeDev = {
      engine,
      combatFeelOverlay,
      combatTargetOverlay,
      refreshUi,
      switchToDevLocation
    };
  }

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
      difficultyLabel: getDifficultyProfile(getOstrzeDifficulty(prologue.state)).label,
      onCycleDifficulty: () => {
        const next = cycleOstrzeDifficulty(getOstrzeDifficulty(prologue.state));
        setOstrzeDifficulty(prologue.state, next);
        engine.applyDifficultyScalingToLoadedEnemies();
        performSave(true);
        const profile = getDifficultyProfile(next);
        modalUi.showToast(`⚔️ Poziom trudności: ${profile.label} (${profile.shortDesc}).`, 'info');
        refreshUi();
        return profile.label;
      },
      onSave: () => performSave(false),
      onLoad: performLoad,
      onOpenKey: () => openSaveKeyModal(),
      onOpenHelp: () => modalUi.showHelpModal('controls', () => refreshUi()),
      onToggleMute: toggleUnifiedAudio,
      onNewGame: startNewGame,
      onClosed: () => refreshUi()
    });
  };

  hud = new HudOverlay(hudRoot, engine, sceneView, {
    devMode: isDevMode,
    showDevSelector: isDevTeleportEnabled,
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

  const helpFab = document.createElement('button');
  helpFab.type = 'button';
  helpFab.className = 'ostrze-help-fab';
  helpFab.setAttribute('data-action', 'open-help-modal');
  helpFab.setAttribute('aria-label', 'Pomoc i sterowanie [F1]');
  helpFab.title = 'Pomoc i sterowanie [F1 / ?]';
  helpFab.textContent = '?';
  helpFab.addEventListener('click', () => {
    if (modalUi.isHelpModalOpen()) {
      modalUi.closeHelpModal();
    } else if (!modalUi.hasOpenModal()) {
      modalUi.showHelpModal('controls', () => refreshUi());
    }
    refreshUi();
  });
  document.body.appendChild(helpFab);

  const attackFab = document.createElement('button');
  attackFab.type = 'button';
  attackFab.className = 'ostrze-attack-fab';
  attackFab.setAttribute('data-action', 'toggle-attack-mode');
  attackFab.setAttribute('aria-label', 'Tryb ataku z eksploracji [A]');
  attackFab.title = 'Inicjuj walkę z zaskoczenia [A] lub kliknij PPM na wroga';
  attackFab.textContent = '⚔️ Atakuj [A]';
  attackFab.addEventListener('click', () => {
    if (engine.combatState.active || modalUi.hasOpenModal()) return;
    sceneView.explorationAttackMode = !sceneView.explorationAttackMode;
    refreshUi();
  });
  document.body.appendChild(attackFab);

  syncHelpFabAndTips = () => {
    // Keep hero-card character sheet shortcut label consistent with Ostrze [K] tips
    hudRoot.querySelectorAll<HTMLButtonElement>('.hero-card button').forEach((btn) => {
      if (btn.textContent && btn.textContent.includes('Postać [I]')) {
        btn.textContent = btn.textContent.replace('Postać [I]', 'Postać [K]');
      }
    });

    const hideFab = engine.combatState.active || modalUi.hasOpenModal();
    helpFab.style.display = hideFab ? 'none' : 'inline-flex';
    const hasLivingHostile = engine.npcs.some((n) => n.combat?.isHostile && n.combat.isAlive);
    if (hideFab || !hasLivingHostile) {
      sceneView.explorationAttackMode = false;
    }
    attackFab.style.display = !hideFab && hasLivingHostile ? 'inline-flex' : 'none';
    attackFab.classList.toggle('is-active', sceneView.explorationAttackMode);
    document.body.classList.toggle('ostrze-attack-cursor', sceneView.explorationAttackMode);

    if (
      engine.combatState.active &&
      prologue.state.character &&
      !prologue.state.flags.tip_first_combat_shown &&
      !isDevMode
    ) {
      prologue.state.flags.tip_first_combat_shown = true;
      modalUi.showToast(
        'Wskazówka: Garda [3] chroni przed ciosami bossów, Pas [4]–[7] leczy i rzuca bomby. Pomoc: [F1].',
        'gold'
      );
    }
    if (
      activeChapter === 'chapter1' &&
      engine.activeCustomSceneId === 'wilczy_brod' &&
      !modalUi.hasOpenModal() &&
      !prologue.state.flags.tip_act1_map_shown &&
      !isDevMode
    ) {
      prologue.state.flags.tip_act1_map_shown = true;
      modalUi.showToast(
        'Wskazówka: naciśnij [M] dla mapy świata, [J] dla Dziennika lub [F1] dla Pomocy.',
        'info'
      );
    }

    if (prologue.state.character && !isDevMode && !modalUi.hasOpenModal()) {
      const unlocked = checkNewAchievementUnlocks(prologue.state, prologue.data);
      for (const ach of unlocked) {
        modalUi.showToast(`🏆 Dokonanie: ${ach.title}!`, 'gold');
        ostrzeAudio.playQuestEvent('complete');
      }
    }
  };

  const launchTimedPowerStrike = (): boolean => {
    if (
      !engine.combatState.active ||
      modalUi.hasOpenModal() ||
      combatFeelOverlay.isTimedStrikeActive() ||
      engine.isSequentialEnemyTurnActive ||
      engine.combatState.activeTurnActorId !== engine.player.id
    ) {
      return false;
    }
    const livingEnemies = engine.npcs.filter((n) => n.combat?.isHostile && n.combat.isAlive);
    const targetId = engine.combatState.selectedTargetId ?? livingEnemies[0]?.id ?? null;
    const target = livingEnemies.find((e) => e.id === targetId) ?? null;
    if (!target || !engine.player.combat) return false;
    const snap = engine.getActorCombatant(engine.player);
    const powerApCost = snap.derived.weaponProfile.baseApCost + 1;
    const dist = Math.hypot(target.tileX - engine.player.tileX, target.tileY - engine.player.tileY);
    if (engine.player.combat.ap < powerApCost || dist > snap.derived.weaponProfile.maxRange + 0.55) {
      return false;
    }
    engine.combatState.selectedTargetId = target.id;
    engine.combatState.selectedAttackMode = 'power';
    return combatFeelOverlay.startTimedStrike('Silny Cios', (grade) => {
      if (!engine.combatState.active) return;
      engine.setPendingTimedStrikeGrade(grade);
      engine.combatState.selectedAttackMode = 'power';
      engine.commandAttackEnemy(target.id);
      refreshUi();
    });
  };

  const launchTimedManeuver = (targetId?: string): void => {
    if (
      !engine.combatState.active ||
      modalUi.hasOpenModal() ||
      combatFeelOverlay.isTimedStrikeActive() ||
      engine.isSequentialEnemyTurnActive ||
      engine.combatState.activeTurnActorId !== engine.player.id
    ) {
      return;
    }
    const st = engine.getWeaponManeuverState(targetId);
    if (!st.canUse) {
      modalUi.showToast(st.reason ?? 'Manewr niedostępny', 'info');
      return;
    }
    combatFeelOverlay.startTimedStrike(st.maneuver.name, (grade) => {
      if (!engine.combatState.active) return;
      engine.setPendingTimedStrikeGrade(grade);
      const res = engine.performPlayerWeaponManeuver(targetId);
      if (res.ok) {
        ostrzeAudio.playManeuverSfx();
        refreshUi();
      } else {
        modalUi.showToast(res.message, 'info');
      }
    });
  };

  combatTargetOverlay.onRequestManeuver = (targetId) => {
    launchTimedManeuver(targetId);
  };

  // Capture-phase hook for [2] Silny Cios & HUD power-strike button -> Timed Strike bar
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '2' && engine.combatState.active && !modalUi.hasOpenModal()) {
        if (launchTimedPowerStrike()) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }
    },
    { capture: true }
  );

  hudRoot.addEventListener(
    'click',
    (e) => {
      const btn = (e.target as HTMLElement | null)?.closest<HTMLElement>('.quick-strike-card.strike-power');
      if (!btn || btn.classList.contains('disabled')) return;
      if (launchTimedPowerStrike()) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    { capture: true }
  );

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const key = e.key.toLowerCase();

    if (e.key === 'F1' || e.key === '?') {
      e.preventDefault();
      if (modalUi.isHelpModalOpen()) {
        modalUi.closeHelpModal();
      } else if (!modalUi.hasOpenModal()) {
        modalUi.showHelpModal('controls', () => refreshUi());
      }
      refreshUi();
      return;
    }

    if (e.key === 'Tab' && engine.combatState.active && !modalUi.hasOpenModal()) {
      e.preventDefault();
      combatTargetOverlay.cycleTarget();
      refreshUi();
      return;
    }

    if (key === 'r' && engine.combatState.active && !modalUi.hasOpenModal()) {
      e.preventDefault();
      launchTimedManeuver();
      return;
    }

    if (key === 'a') {
      if (engine.combatState.active || modalUi.hasOpenModal()) return;
      const hasLivingHostile = engine.npcs.some((n) => n.combat?.isHostile && n.combat.isAlive);
      if (!hasLivingHostile) return;
      e.preventDefault();
      sceneView.explorationAttackMode = !sceneView.explorationAttackMode;
      refreshUi();
      return;
    }

    if (key === 'k') {
      if (!prologue.state.character || modalUi.hasOpenModal()) return;
      e.preventDefault();
      modalUi.showCharacterSheet(() => {
        engine.syncFromOstrzeState(prologue.state, prologue.data);
        if (activeChapter === 'prologue') prologue.refreshObjectiveTracker();
        else if (activeChapter === 'chapter2') chapter2?.refreshHubPanel();
        else chapter1.refreshHubPanel();
        performSave(true);
        refreshUi();
      }, 'stats');
      return;
    }

    if (key === 'i') {
      if (!prologue.state.character || modalUi.hasOpenModal()) return;
      e.preventDefault();
      modalUi.showCharacterSheet(() => {
        engine.syncFromOstrzeState(prologue.state, prologue.data);
        if (activeChapter === 'prologue') prologue.refreshObjectiveTracker();
        else if (activeChapter === 'chapter2') chapter2?.refreshHubPanel();
        else chapter1.refreshHubPanel();
        performSave(true);
        refreshUi();
      }, 'gear');
      return;
    }

    if (key === 'b') {
      if (!prologue.state.character || modalUi.hasOpenModal()) return;
      e.preventDefault();
      modalUi.showCharacterSheet(() => {
        engine.syncFromOstrzeState(prologue.state, prologue.data);
        if (activeChapter === 'prologue') prologue.refreshObjectiveTracker();
        else if (activeChapter === 'chapter2') chapter2?.refreshHubPanel();
        else chapter1.refreshHubPanel();
        performSave(true);
        refreshUi();
      }, 'bestiary');
      return;
    }

    if (key === 'j') {
      if (!prologue.state.character || modalUi.hasOpenModal()) return;
      e.preventDefault();
      modalUi.showCharacterSheet(() => {
        engine.syncFromOstrzeState(prologue.state, prologue.data);
        if (activeChapter === 'prologue') prologue.refreshObjectiveTracker();
        else if (activeChapter === 'chapter2') chapter2?.refreshHubPanel();
        else chapter1.refreshHubPanel();
        performSave(true);
        refreshUi();
      }, 'journal');
      return;
    }

    if (key === 'm') {
      if (modalUi.isTravelModalOpen()) {
        e.preventDefault();
        modalUi.closeTravelModal();
        refreshUi();
        return;
      }
      if (engine.combatState.active || modalUi.hasOpenModal()) return;
      if (!prologue.state.character && !isDevMode) return;
      e.preventDefault();
      if (activeChapter === 'prologue') {
        modalUi.showWorldMapPreview(
          engine.activeCustomSceneId ?? 'brzezina_dziedziniec',
          () => refreshUi()
        );
      } else if (activeChapter === 'chapter2') {
        chapter2?.openTravelModal();
      } else {
        chapter1.openTravelModal();
      }
    }
  });

  if (isDevMode) {
    const devPhBar = document.createElement('div');
    devPhBar.className = 'ostrze-dev-phenomenon-bar';
    const label = document.createElement('span');
    label.className = 'ostrze-dev-phenomenon-label';
    label.textContent = 'DEV Zjawisko:';
    const select = document.createElement('select');
    select.className = 'ostrze-dev-phenomenon-select';
    select.setAttribute('data-action', 'dev-phenomenon-select');
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'Brak (czysta pogoda)';
    select.appendChild(noneOpt);
    for (const ph of ORIGIN_DATA.phenomena) {
      const opt = document.createElement('option');
      opt.value = ph.id;
      opt.textContent = ph.name;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      const val = select.value || null;
      prologue.state.world.activePhenomenon = val;
      prologue.state.vars.phenomenon_hours_left = val ? 4 : 0;
      syncWorldLighting(prologue.state, prologue.data, engine);
      refreshUi();
    });
    devPhBar.appendChild(label);
    devPhBar.appendChild(select);
    document.body.appendChild(devPhBar);
    devPhenomenonSelect = select;
  }

  if (startPhenomenon && ORIGIN_DATA.phenomena.some((p) => p.id === startPhenomenon)) {
    prologue.state.world.activePhenomenon = startPhenomenon;
    prologue.state.vars.phenomenon_hours_left = 4;
  }

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

  // Surface-aware footsteps & proximity environmental audio (campfire crackle, nocturnal accents)
  let lastFootstepTileX = engine.player.tileX;
  let lastFootstepTileY = engine.player.tileY;
  let lastFootstepMapId = engine.map.id;
  window.setInterval(() => {
    if ((typeof document !== 'undefined' && document.hidden) || modalUi.hasOpenModal()) return;
    if (engine.map.id !== lastFootstepMapId) {
      lastFootstepMapId = engine.map.id;
      lastFootstepTileX = engine.player.tileX;
      lastFootstepTileY = engine.player.tileY;
      return;
    }
    if (engine.player.tileX !== lastFootstepTileX || engine.player.tileY !== lastFootstepTileY) {
      lastFootstepTileX = engine.player.tileX;
      lastFootstepTileY = engine.player.tileY;
      const tile = engine.map.tiles[engine.player.tileY]?.[engine.player.tileX];
      if (tile) {
        ostrzeAudio.playFootstep(tile.terrain, engine.isStealthActive);
      }
    }
  }, 240);

  window.setInterval(() => {
    if (
      (typeof document !== 'undefined' && document.hidden) ||
      modalUi.hasOpenModal() ||
      ostrzeAudio.getMuted()
    ) {
      return;
    }
    // Proximity campfire crackle (<= 4.5 tiles from an active campfire)
    let bestCampfireDist = Infinity;
    for (const p of engine.map.props) {
      if (p.kind === 'campfire' && p.isOpen) {
        const d = Math.hypot(engine.player.x - (p.x + 0.5), engine.player.y - (p.y + 0.5));
        if (d < bestCampfireDist) bestCampfireDist = d;
      }
    }
    if (bestCampfireDist <= 4.5) {
      ostrzeAudio.playCampfireCrackle(1 - bestCampfireDist / 4.8);
    }

    // Subtle nocturnal outdoor accents (owl / crickets) during dusk & night outside combat
    if (!engine.combatState.active && isOutdoorMap(engine.map)) {
      const tod = getWorldAtmosphere(prologue.state, prologue.data).timeOfDay;
      if ((tod === 'noc' || tod === 'zmierzch') && Math.random() < 0.16) {
        ostrzeAudio.playNocturnalAccent(Math.random() < 0.35 ? 'owl' : 'crickets');
      }
    }
  }, 1900);

  // Drakensang-style ambient hub barks (Brzezina, Wilczy Bród, Osada Głuszec)
  let lastAmbientNpcId: string | null = null;
  let lastAmbientLine: string | null = null;
  window.setInterval(() => {
    if (isDevMode || !prologue.state.character) return;
    const atmosphere = getWorldAtmosphere(prologue.state, prologue.data);
    const triggered = tryTriggerAmbientBark({
      sceneId: engine.activeCustomSceneId,
      playerX: engine.player.tileX,
      playerY: engine.player.tileY,
      npcs: engine.npcs,
      combatActive: engine.combatState.active,
      modalOpen: modalUi.hasOpenModal(),
      timeOfDayId: atmosphere.timeOfDay,
      phenomenonId: atmosphere.phenomenonId,
      lastNpcId: lastAmbientNpcId,
      lastLine: lastAmbientLine
    });
    if (triggered) {
      lastAmbientNpcId = triggered.npcId;
      lastAmbientLine = triggered.text;
    }
  }, 7800);

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
