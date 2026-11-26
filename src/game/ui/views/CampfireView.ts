import type { OriginGameData, OstrzeGameState } from '../../data/originTypes';
import { CAMP_RECIPES, canPerformCampRecipe } from '../../rules/campCrafting';
import { getStats } from '../../rules/stats';
import { getWorldAtmosphere } from '../../rules/worldCycle';
import { escapeHtml } from '../escapeHtml';
import { mountModalCard } from '../mountModalCard';

export interface CampfireModalOptions {
  onPerform: (recipeId: string) => { ok: boolean; message: string };
  onWaitHour?: (hour: number) => void;
  onClosed?: () => void;
}

export function renderCampfireView(params: {
  root: HTMLElement;
  state: OstrzeGameState;
  data: OriginGameData;
  modal: CampfireModalOptions;
  onShowToast: (text: string, tone: 'info' | 'gold' | 'success') => void;
  onRerender: () => void;
  onClose: () => void;
}): void {
  const { root, state, data, modal, onShowToast, onRerender, onClose } = params;
  const ch = state.character;
  const atmo = getWorldAtmosphere(state, data);
  const stats = ch ? getStats(state, data) : null;

  const groups: Array<{ key: 'alchemy' | 'weapon' | 'cooking' | 'sleep'; title: string }> = [
    { key: 'alchemy', title: 'Alchemia i Opatrunki' },
    { key: 'weapon', title: 'Konserwacja Ostrza' },
    { key: 'cooking', title: 'Gotowanie nad Ogniskiem' },
    { key: 'sleep', title: 'Sen i Regeneracja' }
  ];

  const sectionsHtml = groups
    .map((g) => {
      const rows = CAMP_RECIPES.filter((r) => r.category === g.key)
        .map((recipe) => {
          const check = canPerformCampRecipe(state, data, recipe);
          const ingText =
            recipe.ingredients.length > 0
              ? recipe.ingredients
                  .map((ing) => {
                    const def = data.items.find((i) => i.id === ing.itemId);
                    const have =
                      state.inventory.items.find((i) => i.id === ing.itemId)?.qty ?? 0;
                    return `${def?.name ?? ing.itemId} (${have}/${ing.qty})`;
                  })
                  .join(' · ')
              : 'Bez składników';
          return `
            <div class="ostrze-row ostrze-camp-row ${check.ok ? 'is-ready' : 'is-locked'}">
              <div style="flex:1;min-width:0;">
                <div class="ostrze-camp-recipe-name">${escapeHtml(recipe.label)}</div>
                <div class="ostrze-camp-recipe-meta">${escapeHtml(recipe.description)} · <span>${escapeHtml(ingText)}</span></div>
              </div>
              <button
                type="button"
                class="ostrze-hub-btn ${check.ok ? 'is-alert' : ''}"
                data-camp-recipe="${escapeHtml(recipe.id)}"
                ${!check.ok ? 'disabled' : ''}
                title="${escapeHtml(check.reason ?? recipe.description)}"
              >
                ${check.ok ? 'Wykonaj' : escapeHtml(check.reason ?? 'Brak')}
              </button>
            </div>
          `;
        })
        .join('');
      return `<div class="ostrze-panel ostrze-camp-panel"><h3>${escapeHtml(g.title)}</h3>${rows}</div>`;
    })
    .join('');

  const waitSectionHtml = modal.onWaitHour
    ? `
      <div class="ostrze-camp-wait-bar">
        <span class="ostrze-camp-wait-label">Przewiń czas:</span>
        <div class="ostrze-camp-wait-btns">
          <button type="button" class="ostrze-hub-btn" data-camp-wait="6">🌅 Świt (06:00)</button>
          <button type="button" class="ostrze-hub-btn" data-camp-wait="19">🌆 Zmierzch (19:00)</button>
          <button type="button" class="ostrze-hub-btn" data-camp-wait="21">🌙 Noc (21:00)</button>
        </div>
      </div>
    `
    : '';

  mountModalCard(
    root,
    'ostrze-card ostrze-camp-card',
    `
        <div class="ostrze-modal-head">
          <div>
            <h2 class="ostrze-title" style="margin-bottom:3px;">Przygotowanie Obozowe przy Ognisku</h2>
            <p class="ostrze-subtitle" style="margin-bottom:0;">
              ${escapeHtml(atmo.timeLabel)} · ${escapeHtml(atmo.clockText)}${
                atmo.phenomenonName ? ` · ${escapeHtml(atmo.phenomenonName)}` : ''
              }${ch && stats ? ` · HP: ${ch.hp}/${stats.derived.hpMax} · Medycyna: ${stats.skills.medycyna}%` : ''}
            </p>
          </div>
          <button type="button" class="ostrze-modal-close-x" data-camp-close-top="true" aria-label="Zamknij" title="Zamknij [ESC]">×</button>
        </div>
        ${waitSectionHtml}
        <div class="ostrze-camp-grid" data-preserve-scroll="campfire">
          ${sectionsHtml}
        </div>
        <div class="ostrze-modal-footer">
          <span class="ostrze-modal-footer-hint">Sen usuwa Zmęczenie i przywraca zdrowie. Alchemia korzysta z umiejętności Medycyny.</span>
          <button type="button" class="ostrze-btn ostrze-modal-close-btn" id="ostrze-camp-close">Zamknij <kbd class="ostrze-kbd">ESC</kbd></button>
        </div>
    `,
    { onOverlayBackdropClick: onClose }
  );

  root.querySelectorAll<HTMLButtonElement>('[data-camp-wait]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const hour = Number(btn.dataset.campWait);
      if (!Number.isNaN(hour)) {
        modal.onWaitHour?.(hour);
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-camp-recipe]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const recipeId = btn.dataset.campRecipe;
      if (!recipeId) return;
      const res = modal.onPerform(recipeId);
      onShowToast(res.message, res.ok ? 'success' : 'info');
      onRerender();
    });
  });

  root.querySelector('#ostrze-camp-close')?.addEventListener('click', onClose);
  root.querySelector('[data-camp-close-top]')?.addEventListener('click', onClose);
}
