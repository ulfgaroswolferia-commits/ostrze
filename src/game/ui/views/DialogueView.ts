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
import { mountModalCard } from '../mountModalCard';

/**
 * Optional registry for custom hand-painted portraits (keyed by lowercase speaker fragment).
 * When custom painterly portraits are added in src/game/assets/portraits/, register them here.
 */
export const CUSTOM_PAINTERLY_PORTRAITS: Readonly<Record<string, string>> = {};

export function resolveDialoguePortraitId(speaker: string): string {
  const s = speaker.toLowerCase();

  // Mystic / supernatural entities
  if (s.includes('istota') || s.includes('upiór') || s.includes('zmora') || s.includes('szkło') || s.includes('echo')) {
    return 'npc_lyra';
  }

  // Women / herbalists / widows / daughters
  if (
    s.includes('ragnosława') ||
    s.includes('znachorka') ||
    s.includes('zielarka') ||
    s.includes('halina') ||
    s.includes('wdowa') ||
    s.includes('jaga') ||
    s.includes('żona') ||
    s.includes('córka') ||
    s.includes('kobieta')
  ) {
    return 'npc_wislawa';
  }

  // Blacksmiths / armorers / quartermasters
  if (s.includes('kowal') || s.includes('zbych') || s.includes('bogdan') || s.includes('dobrogost')) {
    return 'npc_bozydar';
  }

  // Shady gunsmiths, bandits, mercenaries, informers
  if (
    s.includes('szkarad') ||
    s.includes('rusznikarz') ||
    s.includes('najemnik') ||
    s.includes('bandyt') ||
    s.includes('maruder') ||
    s.includes('herszt') ||
    s.includes('donosiciel')
  ) {
    return 'npc_gniewosz';
  }

  // Foresters, rangers, poachers, scouts (before generic guard so "Gajowy (Strażnik Boru)" gets ranger hood)
  if (
    s.includes('gajowy') ||
    s.includes('leśnicz') ||
    s.includes('kłusownik') ||
    s.includes('stach') ||
    s.includes('zwiadowc') ||
    s.includes('myśliw')
  ) {
    return 'npc_bogusz';
  }

  // Guards, commanders, instructors, couriers, adepts
  if (
    s.includes('wszebor') ||
    s.includes('komendant') ||
    s.includes('dozorca') ||
    s.includes('wincenty') ||
    s.includes('wartownik') ||
    s.includes('strażnik') ||
    s.includes('instruktor') ||
    s.includes('kurier') ||
    s.includes('goniec') ||
    s.includes('skarimir') ||
    s.includes('wojmir')
  ) {
    return 'npc_milosz_patrol';
  }

  // Innkeepers, merchants, peddlers
  if (
    s.includes('wrzosek') ||
    s.includes('karczmarz') ||
    s.includes('kogut') ||
    s.includes('ostromir') ||
    s.includes('kupiec') ||
    s.includes('kramarz') ||
    s.includes('handlarz')
  ) {
    return 'npc_dobromir';
  }

  // Elders, masters, village headmen, pilgrims, hermits, scribes
  if (
    s.includes('gnieworad') ||
    s.includes('mistrz') ||
    s.includes('sołtys') ||
    s.includes('pielgrzym') ||
    s.includes('wędrowiec') ||
    s.includes('pustelnik') ||
    s.includes('pisarz')
  ) {
    return 'npc_radogost';
  }

  // Farmers, millers, gravediggers, miners, carters, survivors (default grounded peasant)
  if (
    s.includes('młynarz') ||
    s.includes('radosz') ||
    s.includes('kopacz') ||
    s.includes('jerzy') ||
    s.includes('górnik') ||
    s.includes('furman') ||
    s.includes('sieciech') ||
    s.includes('pogorzelec') ||
    s.includes('chwalisław') ||
    s.includes('kmieć')
  ) {
    return 'npc_sambor';
  }

  return 'npc_sambor';
}

function resolveCustomPainterlyPortrait(speaker: string): string | null {
  const s = speaker.toLowerCase();
  for (const [needle, url] of Object.entries(CUSTOM_PAINTERLY_PORTRAITS)) {
    if (s.includes(needle)) return url;
  }
  return null;
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
  const customPortraitUrl = resolveCustomPainterlyPortrait(view.speaker);
  const portraitUrl =
    customPortraitUrl ??
    pixMeta?.dataUri ??
    getSlavicPortrait(resolveDialoguePortraitId(view.speaker));
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

  if (isPanoramicScene && pixMeta) {
    mountModalCard(
      root,
      'ostrze-card ostrze-dialogue-card ostrze-dialogue-card--scene',
      `
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
      `
    );
  } else {
    mountModalCard(
      root,
      'ostrze-card ostrze-dialogue-card',
      `
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
      `
    );
  }

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
