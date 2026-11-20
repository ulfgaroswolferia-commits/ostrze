import { getSlavicPortrait } from '@ulf/assets/slavicPortraits';
import {
  getPixArtMeta,
  resolvePixPortraitId,
  resolveSpeakerRole
} from '../../assets/pixArt';
import { ostrzeAudio } from '../../audio/ostrzeAudio';
import type { OriginGameData, OstrzeGameState } from '../../data/originTypes';
import type { SeededRng } from '../../rules/dice';
import {
  type ActiveOstrzeDialogue,
  chooseOstrzeDialogueOption,
  getOstrzeDialogueView
} from '../../rules/dialogueEngine';
import { escapeHtml } from '../escapeHtml';

function resolveFallbackPortraitId(speaker: string): string {
  const s = speaker.toLowerCase();
  if (s.includes('gnieworad')) return 'npc_gniewosz';
  if (s.includes('wszebor') || s.includes('komendant')) return 'npc_bogusz';
  if (s.includes('dobrogost') || s.includes('szkarad')) return 'npc_bozydar';
  if (s.includes('wrzosek') || s.includes('karczmarz')) return 'npc_dobromir';
  if (s.includes('ostromir') || s.includes('kupiec')) return 'npc_sambor';
  if (s.includes('kurier') || s.includes('goniec')) return 'npc_milosz_patrol';
  if (s.includes('ragnosława') || s.includes('wdowa') || s.includes('kobieta')) return 'npc_wislawa';
  if (s.includes('istota') || s.includes('upiór') || s.includes('szkło')) return 'npc_vaelen';
  if (s.includes('pielgrzym') || s.includes('wędrowiec') || s.includes('pustelnik')) return 'npc_radogost';
  return 'npc_gniewko';
}

export function renderDialogueView(params: {
  root: HTMLElement;
  session: ActiveOstrzeDialogue;
  state: OstrzeGameState;
  data: OriginGameData;
  rng: SeededRng;
  onOpenShop: ((shopId: string) => void) | null;
  onAdvance: (next: ActiveOstrzeDialogue | null) => void;
}): void {
  const { root, session, state, data, rng, onOpenShop, onAdvance } = params;
  const view = getOstrzeDialogueView(session, state, data);
  const pixPortraitId = resolvePixPortraitId(view.portrait, view.speaker);
  const pixMeta = pixPortraitId ? getPixArtMeta(pixPortraitId) : null;
  const isPanoramicScene = Boolean(pixMeta && pixMeta.width > pixMeta.height);
  const isPixPortrait = Boolean(pixMeta);
  const portraitUrl = pixMeta?.dataUri ?? getSlavicPortrait(resolveFallbackPortraitId(view.speaker));
  const speakerRole = resolveSpeakerRole(view.speaker);

  const optionsHtml = view.options
    .map((item, displayIdx) => {
      const shortcutNum = displayIdx < 9 ? displayIdx + 1 : null;
      const badges: string[] = [];

      if (item.checkLabel) {
        if (item.alreadyFailed) {
          badges.push(
            `<span class="ostrze-check-badge ostrze-check-badge--failed">${escapeHtml(item.checkLabel)} · Nieudany</span>`
          );
        } else {
          const chance = item.checkChance ?? 50;
          const tier =
            chance >= 70
              ? 'ostrze-check-badge--high'
              : chance >= 40
                ? 'ostrze-check-badge--mid'
                : 'ostrze-check-badge--low';
          badges.push(
            `<span class="ostrze-check-badge ${tier}">${escapeHtml(item.checkLabel)} · ${chance}%</span>`
          );
        }
      }

      const actions = item.option.actions ?? [];
      const totalCost = actions.reduce((sum, a) => sum + (a.takeMoney ?? 0), 0);
      if (totalCost > 0) {
        badges.push(`<span class="ostrze-action-badge ostrze-action-badge--cost">-${totalCost} gr</span>`);
      }
      if (actions.some((a) => Boolean(a.openShop))) {
        badges.push(`<span class="ostrze-action-badge ostrze-action-badge--shop">🛒 Sklep</span>`);
      }

      const keyBadge =
        shortcutNum !== null
          ? `<span class="ostrze-opt-key">${shortcutNum}</span>`
          : '';

      return `
        <button
          class="ostrze-dialogue-opt ${item.alreadyFailed ? 'ostrze-dialogue-opt--failed' : ''}"
          data-opt-idx="${item.index}"
          ${shortcutNum !== null ? `data-shortcut="${shortcutNum}"` : ''}
          ${item.alreadyFailed ? 'disabled' : ''}
        >
          <span class="ostrze-dialogue-opt-main">
            ${keyBadge}
            <span class="ostrze-dialogue-opt-text">${escapeHtml(item.option.text)}</span>
          </span>
          ${badges.length > 0 ? `<span class="ostrze-opt-badges">${badges.join('')}</span>` : ''}
        </button>
      `;
    })
    .join('');

  const feedbackClass =
    view.lastCheckOutcome === 'success'
      ? 'ostrze-feedback ostrze-feedback--success'
      : view.lastCheckOutcome === 'failure'
        ? 'ostrze-feedback ostrze-feedback--failure'
        : 'ostrze-feedback';

  const feedbackHtml = view.lastCheckFeedback
    ? `<div class="${feedbackClass}">${escapeHtml(view.lastCheckFeedback)}</div>`
    : '';

  root.innerHTML = isPanoramicScene && pixMeta
    ? `
    <div class="ostrze-overlay">
      <div class="ostrze-card ostrze-dialogue-card ostrze-dialogue-card--scene">
        <h2 class="ostrze-title" style="margin-bottom:12px;">${escapeHtml(view.speaker)}</h2>
        <div class="ostrze-narrative-art-frame">
          <img
            class="ostrze-narrative-art ostrze-pix-art"
            src="${escapeHtml(pixMeta.dataUri)}"
            width="${pixMeta.width}"
            height="${pixMeta.height}"
            alt="${escapeHtml(view.speaker)}"
          />
        </div>
        ${feedbackHtml}
        <div class="ostrze-prose ostrze-dialogue-prose">${escapeHtml(view.text)}</div>
        <div class="ostrze-dialogue-options">${optionsHtml}</div>
        <div class="ostrze-dialogue-hint">Skróty klawiszowe: [1–9] wybierz odpowiedź</div>
      </div>
    </div>
  `
    : `
    <div class="ostrze-overlay">
      <div class="ostrze-card ostrze-dialogue-card">
        <div class="ostrze-dialogue-layout">
          <aside class="ostrze-dialogue-portrait-col">
            <div class="ostrze-dialogue-avatar-frame">
              <img
                class="ostrze-dialogue-avatar ${isPixPortrait ? 'ostrze-pix-art' : ''}"
                src="${escapeHtml(portraitUrl)}"
                alt="${escapeHtml(view.speaker)}"
              />
            </div>
            <h2 class="ostrze-dialogue-speaker">${escapeHtml(view.speaker)}</h2>
            ${speakerRole ? `<div class="ostrze-dialogue-role">${escapeHtml(speakerRole)}</div>` : ''}
          </aside>
          <div class="ostrze-dialogue-body-col">
            ${feedbackHtml}
            <div class="ostrze-prose ostrze-dialogue-prose">${escapeHtml(view.text)}</div>
            <div class="ostrze-dialogue-options">${optionsHtml}</div>
            <div class="ostrze-dialogue-hint">Skróty klawiszowe: [1–9] wybierz odpowiedź</div>
          </div>
        </div>
      </div>
    </div>
  `;

  root.querySelectorAll<HTMLElement>('[data-opt-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.optIdx);
      const next = chooseOstrzeDialogueOption(session, idx, state, data, rng);

      if (next?.lastCheckFeedback) {
        ostrzeAudio.playDialogueCheck(next.lastCheckOutcome === 'success');
      } else {
        ostrzeAudio.playUiClick();
      }
      if (next?.pendingShopId && onOpenShop) {
        onOpenShop(next.pendingShopId);
      }

      onAdvance(next);
    });
  });
}
