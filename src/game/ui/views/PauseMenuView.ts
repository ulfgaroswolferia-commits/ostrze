import { escapeHtml } from '../escapeHtml';
import { mountModalCard } from '../mountModalCard';
import { renderSlavicIcon } from '../slavicIcons';

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
  let confirmingNewGame = false;

  const draw = (focusSelector?: string): void => {
    const confirmText = pm.devMode
      ? pm.hasSave
        ? 'Tryb DEV: rozpocząć od prologu testowego? Zapis postaci i lokacji pozostanie dostępny przez „Wczytaj”.'
        : 'Tryb DEV: rozpocząć od prologu testowego? Nie ma teraz zapisu do przywrócenia.'
      : 'Czy na pewno chcesz zacząć nową grę? Twój obecny postęp zostanie skasowany.';

    const newGameSectionHtml = confirmingNewGame
      ? `
        <div class="ostrze-pause-confirm" data-pm-confirm-box="true" role="alert">
          <div class="ostrze-pause-confirm-text ostrze-ico-title">
            ${renderSlavicIcon('warn')}
            <span>${escapeHtml(confirmText)}</span>
          </div>
          <div class="ostrze-pause-row-2">
            <button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-new-cancel">
              <span>Anuluj</span>
            </button>
            <button type="button" class="ostrze-hub-btn ostrze-pause-btn is-danger" id="ostrze-pm-new-confirm">
              <span class="ostrze-ico-title">${renderSlavicIcon('refresh')}<span>Potwierdź nową grę</span></span>
            </button>
          </div>
        </div>
      `
      : `
        <button type="button" class="ostrze-hub-btn ostrze-pause-btn is-danger" id="ostrze-pm-new">
          <span class="ostrze-ico-title">${renderSlavicIcon('refresh')}<span>Nowa gra</span></span>
        </button>
      `;

    mountModalCard(
      root,
      'ostrze-card ostrze-pause-card',
      `
        <div class="ostrze-modal-head" style="margin-bottom:10px;">
          <div style="text-align:left;">
            <h2 class="ostrze-title" style="margin-bottom:2px;">Menu Gry</h2>
            <p class="ostrze-subtitle ostrze-lore-copy" style="margin-bottom:0;font-style:italic;">Voided: na przekór gwiazdom</p>
          </div>
          <button type="button" class="ostrze-modal-close-x" data-pm-close-top="true" aria-label="Zamknij" title="Zamknij [ESC]">×</button>
        </div>
        ${pm.devMode ? `<p class="ostrze-subtitle" style="margin-bottom:10px;text-align:left;color:#f0c674;font-size:0.8rem;"><strong>DEV:</strong> Reset testu nie kasuje zapisu.${pm.hasSave ? ' „Wczytaj” przywróci zapisaną postać i ostatnią lokację.' : ' Brak zapisu — użyj „Zapisz”, aby zachować postać i lokację przed resetem.'}</p>` : ''}
        <div class="ostrze-pause-stack">
          <button type="button" class="ostrze-btn ostrze-pause-btn" id="ostrze-pm-resume">
            <span class="ostrze-ico-title">${renderSlavicIcon('play')}<span>Wznów grę</span></span><kbd class="ostrze-kbd">ESC</kbd>
          </button>
          <div class="ostrze-pause-row-2">
            <button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-save">
              <span class="ostrze-ico-title">${renderSlavicIcon('save')}<span>Zapisz</span></span><kbd class="ostrze-kbd">Ctrl+S</kbd>
            </button>
            ${
              pm.hasSave
                ? `<button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-load"><span class="ostrze-ico-title">${renderSlavicIcon('load')}<span>Wczytaj</span></span></button>`
                : `<button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-key"><span class="ostrze-ico-title">${renderSlavicIcon('key')}<span>Klucz</span></span></button>`
            }
          </div>
          ${pm.hasSave ? `<button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-key"><span class="ostrze-ico-title">${renderSlavicIcon('key')}<span>Klucz rozgrywki (eksport / import)</span></span></button>` : ''}
          ${pm.onOpenHelp ? `<button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-help"><span class="ostrze-ico-title">${renderSlavicIcon('help')}<span>Pomoc i sterowanie</span></span><kbd class="ostrze-kbd">F1</kbd></button>` : ''}
          <div class="ostrze-pause-divider"></div>
          ${pm.onCycleDifficulty ? `<button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-diff"><span class="ostrze-ico-title">${renderSlavicIcon('weapon')}<span>Trudność</span></span><strong>${escapeHtml(pm.difficultyLabel ?? 'Klasyczny')}</strong></button>` : ''}
          <button type="button" class="ostrze-hub-btn ostrze-pause-btn" id="ostrze-pm-mute"><span class="ostrze-ico-title">${renderSlavicIcon(pm.isMuted ? 'soundOff' : 'soundOn')}<span>Dźwięk</span></span><strong>${pm.isMuted ? 'Wyciszony' : 'Włączony'}</strong></button>
          <div class="ostrze-pause-divider"></div>
          ${newGameSectionHtml}
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
        draw('#ostrze-pm-diff');
      }
    });
    root.querySelector('#ostrze-pm-mute')?.addEventListener('click', () => {
      pm.isMuted = pm.onToggleMute();
      draw('#ostrze-pm-mute');
    });
    root.querySelector('#ostrze-pm-new')?.addEventListener('click', () => {
      confirmingNewGame = true;
      draw('#ostrze-pm-new-cancel');
    });
    root.querySelector('#ostrze-pm-new-cancel')?.addEventListener('click', () => {
      confirmingNewGame = false;
      draw('#ostrze-pm-new');
    });
    root.querySelector('#ostrze-pm-new-confirm')?.addEventListener('click', () => {
      onDismissForAction();
      pm.onNewGame();
    });

    if (focusSelector) {
      const target = root.querySelector<HTMLElement>(focusSelector);
      target?.focus?.();
    }
  };

  void onRerender;
  draw();
}
