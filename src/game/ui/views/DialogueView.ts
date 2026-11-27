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
import { renderStoryVistaBannerHtml } from '../storyVistaBanner';

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

const SVG_DICE = `<svg class="ostrze-dlg-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="8,1.5 14,5 14,11 8,14.5 2,11 2,5"/><path d="M8 1.5V8M14 5L8 8M2 5L8 8M8 8V14.5" opacity="0.65"/></svg>`;
const SVG_COIN = `<svg class="ostrze-dlg-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="5.5"/><path d="M8 5.2v5.6M6.4 6.6h3.2" opacity="0.85"/></svg>`;
const SVG_SHOP = `<svg class="ostrze-dlg-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6.5h10l-.8 7H3.8l-.8-7Z"/><path d="M5.5 6.5V5a2.5 2.5 0 0 1 5 0v1.5"/></svg>`;
const SVG_QUEST = `<svg class="ostrze-dlg-ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 1.8l1.6 4.1 4.4.4-3.3 2.9 1 4.3L8 11.2 4.3 13.5l1-4.3L2 6.3l4.4-.4L8 1.8Z"/></svg>`;
const SVG_EXIT = `<svg class="ostrze-dlg-ico ostrze-dlg-ico--exit" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4.5 2.5 8 6 11.5"/><path d="M2.5 8h8a3 3 0 0 1 3 3v1"/></svg>`;
const SVG_ORNAMENT = `<svg class="ostrze-dlg-ornament-svg" viewBox="0 0 120 10" fill="none" aria-hidden="true"><line x1="0" y1="5" x2="46" y2="5" stroke="currentColor" stroke-opacity="0.38"/><polygon points="60,1 65,5 60,9 55,5" fill="currentColor" fill-opacity="0.72"/><circle cx="49" cy="5" r="1.2" fill="currentColor" fill-opacity="0.5"/><circle cx="71" cy="5" r="1.2" fill="currentColor" fill-opacity="0.5"/><line x1="74" y1="5" x2="120" y2="5" stroke="currentColor" stroke-opacity="0.38"/></svg>`;

const QUOTE_SEGMENT_RE = /(„[^”]+”|"[^"]+")/g;

function formatInlineSpeechSegments(rawSegment: string): string {
  const parts = rawSegment.split(QUOTE_SEGMENT_RE);
  const hasQuote = parts.some((p, idx) => idx % 2 === 1 && p.length > 0);
  if (!hasQuote) {
    return `<span class="ostrze-dlg-plain">${escapeHtml(rawSegment)}</span>`;
  }

  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      const isQuoted =
        (part.startsWith('„') && part.endsWith('”')) ||
        (part.startsWith('"') && part.endsWith('"'));
      if (isQuoted) {
        return `<span class="ostrze-dlg-quote">${escapeHtml(part)}</span>`;
      }
      return `<span class="ostrze-dlg-narration">${escapeHtml(part)}</span>`;
    })
    .join('');
}

/**
 * Formats cRPG dialogue prose into paragraphs with distinct visual voices for
 * narrator stage directions (warm italic) and spoken lines inside „...” quotes.
 */
export function formatDialogueProseHtml(rawText: string): string {
  const paragraphs = rawText
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length === 0) {
    return '';
  }

  return paragraphs
    .map((para) => `<p class="ostrze-dlg-para">${formatInlineSpeechSegments(para)}</p>`)
    .join('');
}

/**
 * Formats player response text so action prefixes (e.g. "Roześmiej się:") subtly
 * contrast against the spoken line in „...”.
 */
export function formatDialogueChoiceHtml(rawText: string): string {
  const parts = rawText.split(QUOTE_SEGMENT_RE);
  const hasQuote = parts.some((p, idx) => idx % 2 === 1 && p.length > 0);
  if (!hasQuote) {
    return escapeHtml(rawText);
  }
  return parts
    .filter((p) => p.length > 0)
    .map((part) => {
      const isQuoted =
        (part.startsWith('„') && part.endsWith('”')) ||
        (part.startsWith('"') && part.endsWith('"'));
      if (isQuoted) {
        return `<span class="ostrze-dlg-opt-quote">${escapeHtml(part)}</span>`;
      }
      return `<span class="ostrze-dlg-opt-action">${escapeHtml(part)}</span>`;
    })
    .join('');
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
  const playerName = state.character?.name?.trim() || 'Ty';

  const optionsHtml = view.options
    .map((item, displayIdx) => {
      const shortcutNum = displayIdx < 9 ? displayIdx + 1 : null;
      const badges: string[] = [];

      if (item.checkLabel) {
        if (item.alreadyFailed) {
          badges.push(
            `<span class="ostrze-check-badge ostrze-check-badge--failed">${SVG_DICE}<span>${escapeHtml(item.checkLabel)} · Nieudany</span></span>`
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
            `<span class="ostrze-check-badge ${tier}">${SVG_DICE}<span>${escapeHtml(item.checkLabel)}</span><strong class="ostrze-check-pct">${chance}%</strong></span>`
          );
        }
      }

      const actions = item.option.actions ?? [];
      const totalCost = actions.reduce((sum, a) => sum + (a.takeMoney ?? 0), 0);
      if (totalCost > 0) {
        badges.push(
          `<span class="ostrze-action-badge ostrze-action-badge--cost">${SVG_COIN}<span>-${totalCost} gr</span></span>`
        );
      }
      if (actions.some((a) => Boolean(a.openShop))) {
        badges.push(
          `<span class="ostrze-action-badge ostrze-action-badge--shop">${SVG_SHOP}<span>Handel</span></span>`
        );
      }
      if (actions.some((a) => Boolean(a.startQuest || a.completeQuest))) {
        badges.push(
          `<span class="ostrze-action-badge ostrze-action-badge--quest">${SVG_QUEST}<span>Zadanie</span></span>`
        );
      }

      const keyBadge =
        shortcutNum !== null
          ? `<span class="ostrze-opt-key" aria-hidden="true">${shortcutNum}</span>`
          : '';

      const optClasses = [
        'ostrze-dialogue-opt',
        item.alreadyFailed ? 'ostrze-dialogue-opt--failed' : '',
        item.alreadyVisited && !item.alreadyFailed ? 'ostrze-dialogue-opt--visited' : '',
        item.checkLabel && !item.alreadyFailed ? 'ostrze-dialogue-opt--check' : '',
        item.isFarewell ? 'ostrze-dialogue-opt--farewell' : ''
      ]
        .filter(Boolean)
        .join(' ');

      const farewellGlyph = item.isFarewell && badges.length === 0 ? SVG_EXIT : '';

      return `
        <button
          type="button"
          class="${optClasses}"
          data-opt-idx="${item.index}"
          ${shortcutNum !== null ? `data-shortcut="${shortcutNum}"` : ''}
          ${item.alreadyFailed ? 'disabled' : ''}
        >
          <span class="ostrze-dialogue-opt-main">
            ${keyBadge}
            <span class="ostrze-dialogue-opt-text">${formatDialogueChoiceHtml(item.option.text)}</span>
          </span>
          ${
            badges.length > 0
              ? `<span class="ostrze-opt-badges">${badges.join('')}</span>`
              : farewellGlyph
          }
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
    ? `
      <div class="${feedbackClass}" role="status">
        <span class="ostrze-feedback-seal">${SVG_DICE}</span>
        <span class="ostrze-feedback-body">
          ${view.lastCheckSkillLabel ? `<strong class="ostrze-feedback-skill">${escapeHtml(view.lastCheckSkillLabel)}</strong>` : ''}
          <span class="ostrze-feedback-text">${escapeHtml(view.lastCheckFeedback)}</span>
        </span>
      </div>
    `
    : '';

  const historyHtml =
    view.history.length > 0
      ? `
        <div class="ostrze-dialogue-history" aria-label="Historia rozmowy">
          ${view.history
            .map(
              (entry) => `
                <div class="ostrze-dialogue-hist-turn">
                  <div class="ostrze-dialogue-hist-speaker">${escapeHtml(entry.speaker)}</div>
                  <div class="ostrze-dialogue-hist-text">${formatDialogueProseHtml(entry.text)}</div>
                  <div class="ostrze-dialogue-hist-reply">
                    <span class="ostrze-dialogue-hist-actor">${escapeHtml(playerName)}:</span>
                    <span>${escapeHtml(entry.playerChoiceText)}</span>
                  </div>
                </div>
              `
            )
            .join('')}
        </div>
        <div class="ostrze-dialogue-turn-rule" aria-hidden="true">${SVG_ORNAMENT}</div>
      `
      : '';

  const speechPaneHtml = `
    <div class="ostrze-dialogue-speech-pane" data-dialogue-speech>
      ${historyHtml}
      <div class="ostrze-dialogue-active-turn" data-turn="${view.turnNumber}">
        ${feedbackHtml}
        <div class="ostrze-prose ostrze-dialogue-prose">${formatDialogueProseHtml(view.text)}</div>
      </div>
    </div>
  `;

  const choicesPaneHtml = `
    <div class="ostrze-dialogue-choices-pane">
      <div class="ostrze-dialogue-choices-divider" aria-hidden="true">${SVG_ORNAMENT}</div>
      <div class="ostrze-dialogue-options">${optionsHtml}</div>
      <div class="ostrze-dialogue-hint">
        <span><kbd class="ostrze-kbd">1–9</kbd> wybierz odpowiedź</span>
        <span class="ostrze-dialogue-hint-sep" aria-hidden="true">·</span>
        <span><kbd class="ostrze-kbd">↑↓</kbd> nawigacja</span>
        ${view.history.length > 0 ? `<span class="ostrze-dialogue-hint-sep" aria-hidden="true">·</span><span>Przewiń kronikę u góry</span>` : ''}
      </div>
    </div>
  `;

  if (isPanoramicScene && pixMeta) {
    const sceneVistaHtml = renderStoryVistaBannerHtml(
      pixMeta.id,
      view.speaker,
      'ostrze-narrative-art-frame'
    );
    mountModalCard(
      root,
      'ostrze-card ostrze-dialogue-card ostrze-dialogue-card--scene',
      `
        <div class="ostrze-dialogue-scene-head">
          <h2 class="ostrze-title ostrze-dialogue-scene-title">${escapeHtml(view.speaker)}</h2>
          ${speakerRole ? `<div class="ostrze-dialogue-role">${escapeHtml(speakerRole)}</div>` : ''}
        </div>
        ${sceneVistaHtml}
        ${speechPaneHtml}
        ${choicesPaneHtml}
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
            <div class="ostrze-dialogue-nameplate">
              <h2 class="ostrze-dialogue-speaker">${escapeHtml(view.speaker)}</h2>
              <div class="ostrze-dialogue-name-rule" aria-hidden="true"></div>
              ${speakerRole ? `<div class="ostrze-dialogue-role">${escapeHtml(speakerRole)}</div>` : ''}
            </div>
          </aside>
          <div class="ostrze-dialogue-body-col">
            ${speechPaneHtml}
            ${choicesPaneHtml}
          </div>
        </div>
      `
    );
  }

  // Keep latest speech in view while preserving ability to scroll up through transcript
  const speechPane = root.querySelector<HTMLElement>('[data-dialogue-speech]');
  if (speechPane) {
    speechPane.scrollTop = speechPane.scrollHeight;
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
