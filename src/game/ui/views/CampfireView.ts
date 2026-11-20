import type { OriginGameData, OstrzeGameState } from '../../data/originTypes';
import { CAMP_RECIPES, canPerformCampRecipe } from '../../rules/campCrafting';
import { getStats } from '../../rules/stats';
import { getWorldAtmosphere } from '../../rules/worldCycle';
import { escapeHtml } from '../escapeHtml';

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
    { key: 'alchemy', title: 'Alchemia i Opatrunki (Medycyna)' },
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
            <div class="ostrze-row">
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;color:#f4dfba;">${escapeHtml(recipe.label)}</div>
                <div style="font-size:0.8rem;color:#9e9689;">${escapeHtml(recipe.description)} · <span>${escapeHtml(ingText)}</span></div>
              </div>
              <button
                type="button"
                class="ostrze-hub-btn"
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
      return `<div class="ostrze-panel" style="margin-bottom:10px;"><h3>${escapeHtml(g.title)}</h3>${rows}</div>`;
    })
    .join('');

  const waitSectionHtml = modal.onWaitHour
    ? `
      <div class="ostrze-panel" style="margin-bottom:10px;">
        <h3>Czekanie przy Ognisku (Przewiń czas)</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button type="button" class="ostrze-hub-btn" data-camp-wait="6">🌅 Czekaj do świtu (06:00)</button>
          <button type="button" class="ostrze-hub-btn" data-camp-wait="19">🌆 Czekaj do zmierzchu (19:00)</button>
          <button type="button" class="ostrze-hub-btn" data-camp-wait="21">🌙 Czekaj do nocy (21:00)</button>
        </div>
      </div>
    `
    : '';

  root.innerHTML = `
    <div class="ostrze-overlay">
      <div class="ostrze-card" style="max-width:720px;">
        <h2 class="ostrze-title">Przygotowanie Obozowe przy Ognisku</h2>
        <p class="ostrze-subtitle">
          ${escapeHtml(atmo.timeLabel)} · ${escapeHtml(atmo.clockText)}${
            atmo.phenomenonName ? ` · ${escapeHtml(atmo.phenomenonName)}` : ''
          }${ch && stats ? ` · HP: ${ch.hp}/${stats.derived.hpMax} · Medycyna: ${stats.skills.medycyna}` : ''}
        </p>
        <div style="max-height:58vh;overflow-y:auto;padding-right:4px;margin-bottom:14px;">
          ${waitSectionHtml}
          ${sectionsHtml}
        </div>
        <div style="display:flex;justify-content:flex-end;">
          <button type="button" class="ostrze-hub-btn" id="ostrze-camp-close">Zamknij [ESC]</button>
        </div>
      </div>
    </div>
  `;

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

  root.querySelector('#ostrze-camp-close')?.addEventListener('click', () => {
    onClose();
  });
}
