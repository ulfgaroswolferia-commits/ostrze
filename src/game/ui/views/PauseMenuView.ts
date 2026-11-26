import { mountModalCard } from '../mountModalCard';

export interface PauseMenuOptions {
  devMode?: boolean;
  hasSave: boolean;
  isMuted: boolean;
  difficultyLabel?: string;
  onCycleDifficulty?: () => string;
  onSave: () => void;
  onLoad: () => void;
  onOpenKey: () => void;
  onOpenHelp?: () => void;
  onToggleMute: () => boolean;
  onNewGame: () => void;
  onClosed?: () => void;
}

export function renderPauseMenuView(params: {
  root: HTMLElement;
  pm: PauseMenuOptions;
  onRerender: () => void;
  onClose: () => void;
  onDismissForAction: () => void;
}): void {
  const { root, pm, onRerender, onClose, onDismissForAction } = params;
  mountModalCard(
    root,
    'ostrze-card ostrze-pause-card',
    `
        <div class="ostrze-modal-head" style="margin-bottom:8px;">
          <div style="text-align:left;">
            <h2 class="ostrze-title" style="margin-bottom:2px;">Menu Gry</h2>
            <p class="ostrze-subtitle" style="margin-bottom:0;">Voided: na przekór gwiazdom</p>
          </div>
          <button type="button" class="ostrze-modal-close-x" data-pm-close-top="true" aria-label="Zamknij" title="Zamknij [ESC]">×</button>
        </div>
        ${pm.devMode ? `<p class="ostrze-subtitle" style="margin-bottom:10px;text-align:left;color:#f0c674;font-size:0.8rem;"><strong>DEV:</strong> Reset testu nie kasuje zapisu.${pm.hasSave ? ' „Wczytaj zapis” przywróci zapisaną postać i ostatnią lokację.' : ' Brak zapisu — użyj „Zapisz grę”, aby zachować postać i lokację przed resetem.'}</p>` : ''}
        <div class="ostrze-pause-stack">
          <button type="button" class="ostrze-btn ostrze-pause-btn" id="ostrze-pm-resume">
            <span>▶ Wznów grę</span><kbd class="ostrze-kbd">ESC</kbd>
          </button>
          <div class="ostrze-pause-row-2">
            <button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-save">
              <span>💾 Zapisz</span><kbd class="ostrze-kbd">Ctrl+S</kbd>
            </button>
            ${
              pm.hasSave
                ? `<button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-load"><span>📂 Wczytaj</span></button>`
                : `<button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-key"><span>🔑 Klucz</span></button>`
            }
          </div>
          ${pm.hasSave ? `<button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-key"><span>🔑 Klucz rozgrywki (eksport / import)</span></button>` : ''}
          ${pm.onOpenHelp ? `<button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-help"><span>❓ Pomoc i sterowanie</span><kbd class="ostrze-kbd">F1</kbd></button>` : ''}
          <div class="ostrze-pause-divider"></div>
          ${pm.onCycleDifficulty ? `<button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-diff"><span>⚔️ Trudność</span><strong>${pm.difficultyLabel ?? 'Klasyczny'}</strong></button>` : ''}
          <button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-mute"><span>${pm.isMuted ? '🔇 Dźwięk' : '🔊 Dźwięk'}</span><strong>${pm.isMuted ? 'Wyciszony' : 'Włączony'}</strong></button>
          <div class="ostrze-pause-divider"></div>
          <button type="button" class="ostrze-hub-btn ostrze-pause-btn is-danger" id="ostrze-pm-new"><span>🔄 Nowa gra</span></button>
        </div>
    `,
    { onOverlayBackdropClick: onClose }
  );

  root.querySelector('#ostrze-pm-resume')?.addEventListener('click', onClose);
  root.querySelector('[data-pm-close-top]')?.addEventListener('click', onClose);
  root.querySelector('#ostrze-pm-save')?.addEventListener('click', () => {
    pm.onSave();
    onClose();
  });
  root.querySelector('#ostrze-pm-load')?.addEventListener('click', () => {
    onDismissForAction();
    pm.onLoad();
  });
  root.querySelector('#ostrze-pm-key')?.addEventListener('click', () => {
    onDismissForAction();
    pm.onOpenKey();
  });
  root.querySelector('#ostrze-pm-help')?.addEventListener('click', () => {
    onDismissForAction();
    pm.onOpenHelp?.();
  });
  root.querySelector('#ostrze-pm-diff')?.addEventListener('click', () => {
    if (pm.onCycleDifficulty) {
      pm.difficultyLabel = pm.onCycleDifficulty();
      onRerender();
    }
  });
  root.querySelector('#ostrze-pm-mute')?.addEventListener('click', () => {
    pm.isMuted = pm.onToggleMute();
    onRerender();
  });
  root.querySelector('#ostrze-pm-new')?.addEventListener('click', () => {
    const confirmation = pm.devMode
      ? pm.hasSave
        ? 'Tryb DEV: rozpocząć od prologu testowego? Zapis postaci i lokacji pozostanie dostępny przez „Wczytaj zapis”.'
        : 'Tryb DEV: rozpocząć od prologu testowego? Nie ma teraz zapisu do przywrócenia.'
      : 'Czy na pewno chcesz zacząć nową grę? Twój obecny postęp zostanie skasowany.';
    const ok = window.confirm(confirmation);
    if (!ok) return;
    onDismissForAction();
    pm.onNewGame();
  });
}
