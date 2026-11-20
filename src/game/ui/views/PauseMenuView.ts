export interface PauseMenuOptions {
  hasSave: boolean;
  isMuted: boolean;
  onSave: () => void;
  onLoad: () => void;
  onOpenKey: () => void;
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
  root.innerHTML = `
    <div class="ostrze-overlay">
      <div class="ostrze-card" style="max-width:400px;text-align:center;">
        <h2 class="ostrze-title" style="margin-bottom:4px;">Menu Gry</h2>
        <p class="ostrze-subtitle" style="margin-bottom:16px;">Voided: na przekór gwiazdom</p>
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button type="button" class="ostrze-btn" id="ostrze-pm-resume">▶ Wznów grę [ESC]</button>
          <button type="button" class="ostrze-hub-btn" id="ostrze-pm-save">💾 Zapisz grę [Ctrl+S]</button>
          ${pm.hasSave ? `<button type="button" class="ostrze-hub-btn" id="ostrze-pm-load">📂 Wczytaj zapis</button>` : ''}
          <button type="button" class="ostrze-hub-btn" id="ostrze-pm-key">🔑 Klucz rozgrywki</button>
          <button type="button" class="ostrze-hub-btn" id="ostrze-pm-mute">${pm.isMuted ? '🔇 Dźwięk: Wyciszony' : '🔊 Dźwięk: Włączony'}</button>
          <button type="button" class="ostrze-hub-btn" id="ostrze-pm-new" style="border-color:rgba(239,68,68,0.45);color:#fca5a5;">🔄 Nowa gra</button>
        </div>
      </div>
    </div>
  `;

  root.querySelector('#ostrze-pm-resume')?.addEventListener('click', onClose);
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
  root.querySelector('#ostrze-pm-mute')?.addEventListener('click', () => {
    pm.isMuted = pm.onToggleMute();
    onRerender();
  });
  root.querySelector('#ostrze-pm-new')?.addEventListener('click', () => {
    const ok = window.confirm('Czy na pewno chcesz zacząć nową grę? Twój obecny postęp zostanie skasowany.');
    if (!ok) return;
    onDismissForAction();
    pm.onNewGame();
  });
}
