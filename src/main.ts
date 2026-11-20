import '@ulf/styles/main.css';
import './game/styles/ostrze.css';
import { IsoSceneView } from '@ulf/renderer/isoSceneView';
import { HudOverlay } from '@ulf/ui/hudOverlay';
import { InspectorPanel } from '@ulf/ui/inspectorPanel';
import { OstrzeEngineState } from './engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from './game/data/originData';
import { createCharacter, createEmptyOstrzeState, grantXp } from './game/rules/character';
import { forageWorldProp, performCampRecipe } from './game/rules/campCrafting';
import { resolveQuickBeltSlots, useCombatBeltItem } from './game/rules/combatConsumables';
import { rollStealthCheck } from './game/rules/stealth';
import { syncWorldLighting } from './game/rules/worldCycle';
import { Chapter1Director } from './game/scenes/Chapter1Director';
import { PrologueDirector, type ProloguePhase } from './game/scenes/PrologueDirector';
import {
  exportSaveKey,
  hasOstrzeSave,
  importSaveKey,
  loadOstrzeGame,
  saveOstrzeGame,
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
  let inspector: InspectorPanel | null = null;
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

  hud = new HudOverlay(hudRoot, engine, sceneView, { devMode: isDevMode });
  if (isDevMode) {
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

  const chapter1 = new Chapter1Director({
    engine,
    state: prologue.state,
    rng: prologue.rng,
    ui: modalUi,
    data: prologue.data,
    onUiRefresh: refreshUi
  });

  let activeChapter: 'prologue' | 'chapter1' = startChapter === '1' ? 'chapter1' : 'prologue';

  const performSave = (silent = false): void => {
    prologue.state.rngState = prologue.rng.getState();
    const ok = saveOstrzeGame({
      chapter: activeChapter,
      sceneId: engine.activeCustomSceneId ?? (activeChapter === 'chapter1' ? 'wilczy_brod' : 'brzezina_dziedziniec'),
      prologueStep: activeChapter === 'prologue' ? prologue.phase : undefined,
      state: prologue.state
    });
    if (!silent) {
      modalUi.showToast(ok ? 'Gra zapisana.' : 'Nie udało się zapisać gry.', ok ? 'success' : 'info');
    }
    if (activeChapter === 'prologue') {
      prologue.refreshObjectiveTracker();
    } else {
      chapter1.refreshHubPanel();
    }
  };

  const applyLoadedPayload = (loaded: OstrzeSavePayload): void => {
    const clonedState = JSON.parse(JSON.stringify(loaded.state)) as typeof prologue.state;
    Object.assign(prologue.state, clonedState);
    prologue.rng.setState(clonedState.rngState);
    activeChapter = loaded.chapter;
    if (loaded.chapter === 'chapter1') {
      chapter1.restoreFromSave(loaded.sceneId);
    } else {
      prologue.restoreFromSave((loaded.prologueStep as ProloguePhase) ?? 'brzezina_gnieworad', loaded.sceneId);
    }
  };

  const performLoad = (): void => {
    const loaded = loadOstrzeGame();
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
        });
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

  prologue.hasSave = hasOstrzeSave;
  prologue.onSaveRequested = () => performSave(false);
  prologue.onAutoSave = () => performSave(true);
  prologue.onLoadRequested = performLoad;
  prologue.onKeyRequested = () => openSaveKeyModal();
  prologue.onDefeatToPrologue = returnToPrologueStart;

  chapter1.hasSave = hasOstrzeSave;
  chapter1.onSaveRequested = () => performSave(false);
  chapter1.onAutoSave = () => performSave(true);
  chapter1.onLoadRequested = performLoad;
  chapter1.onKeyRequested = () => openSaveKeyModal();
  chapter1.onDefeatToPrologue = returnToPrologueStart;

  prologue.onPrologueCompleted = () => {
    activeChapter = 'chapter1';
    chapter1.enterWilczyBrod();
    performSave(true);
  };

  if (isDevMode) {
    engine.loadCustomScene('brzezina_dziedziniec');
    engine.addLog('Tryb deweloperski (?dev=1): załadowano scenę Brzezina — Dziedziniec.', 'info');
  } else if (startChapter === '1') {
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
