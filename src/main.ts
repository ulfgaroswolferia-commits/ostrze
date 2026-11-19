import '@ulf/styles/main.css';
import './game/styles/ostrze.css';
import { IsoSceneView } from '@ulf/renderer/isoSceneView';
import { HudOverlay } from '@ulf/ui/hudOverlay';
import { InspectorPanel } from '@ulf/ui/inspectorPanel';
import { OstrzeEngineState } from './engine-bridge/OstrzeEngineState';
import { createCharacter, createEmptyOstrzeState, grantXp } from './game/rules/character';
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

  const refreshUi = (): void => {
    hud?.render();
    inspector?.render();
  };

  const sceneView = new IsoSceneView(engine, refreshUi);
  sceneView.organicTerrainBlending = true;
  sceneView.showGridInExploration = isDevMode;
  if (isDevMode) {
    engine.fogOfWarEnabled = false;
    engine.ambientLightIntensity = 0.85;
    sceneView.activeTool = 'paint_terrain';
    document.body.classList.add('editor-workspace-mode');
  }

  await sceneView.mount(viewportContainer);

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
