export interface PauseMenuOptions {
  devMode?: boolean;
  hasSave: boolean;
  isMuted: boolean;
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
  root.innerHTML = `
    <div class="ostrze-overlay">
      <div class="ostrze-card" style="max-width:400px;text-align:center;">
        <h2 class="ostrze-title" style="margin-bottom:4px;">Menu Gry</h2>
        <p class="ostrze-subtitle" style="margin-bottom:16px;">Voided: na przekór gwiazdom</p>
        ${pm.devMode ? `<p class="ostrze-subtitle" style="margin-bottom:16px;color:#f0c674;"><strong>DEV:</strong> Reset testu nie kasuje zapisu.${pm.hasSave ? ' „Wczytaj zapis” przywróci zapisaną postać i ostatnią lokację.' : ' Brak zapisu — użyj „Zapisz grę”, aby zachować postać i lokację przed resetem.'}</p>` : ''}
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button type="button" class="ostrze-btn" id="ostrze-pm-resume">▶ Wznów grę [ESC]</button>
          <button type="button" class="ostrze-hub-btn" id="ostrze-pm-save">💾 Zapisz grę [Ctrl+S]</button>
          ${pm.hasSave ? `<button type="button" class="ostrze-hub-btn" id="ostrze-pm-load">📂 Wczytaj zapis</button>` : ''}
          <button type="button" class="ostrze-hub-btn" id="ostrze-pm-key">🔑 Klucz rozgrywki</button>
          ${pm.onOpenHelp ? `<button type="button" class="ostrze-hub-btn" id="ostrze-pm-help">❓ Pomoc i sterowanie [F1]</button>` : ''}
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
  root.querySelector('#ostrze-pm-help')?.addEventListener('click', () => {
    onDismissForAction();
    pm.onOpenHelp?.();
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
