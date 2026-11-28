import { getPixArtMeta } from '../assets/pixArt';
import { ostrzeAudio } from '../audio/ostrzeAudio';
import type {
  AttributeId,
  ClassId,
  OriginGameData,
  OstrzeGameState,
  SkillId
} from '../data/originTypes';
import type { SeededRng } from '../rules/dice';
import type { ActiveOstrzeDialogue } from '../rules/dialogueEngine';
import {
  canSellItemToShop,
  getShopBuyPrice,
  getShopMerchantPortraitId,
  sellInventoryItemToShop
} from '../rules/shopEconomy';
import {
  classifyInventoryItem,
  type InventoryCategoryFilter
} from '../rules/inventoryFilter';
import { renderItemStatPillsHtml } from '../rules/itemComparison';
import { getStats } from '../rules/stats';
import { getWorldAtmosphere } from '../rules/worldCycle';
import { escapeHtml } from './escapeHtml';
import { mountModalCard } from './mountModalCard';
import {
  INVENTORY_FILTER_META,
  renderSlavicIcon,
  SLAVIC_ORNAMENT_SVG,
  type SlavicIconId
} from './slavicIcons';
import { renderStoryVistaBannerHtml } from './storyVistaBanner';
import {
  type CampfireModalOptions,
  renderCampfireView
} from './views/CampfireView';
import type { OstrzeDifficultyId } from '../rules/difficulty';
import {
  buildInitialCreatorAttrs,
  renderCharacterCreatorView
} from './views/CharacterCreatorView';
import {
  type CharacterSheetTab,
  hasUnspentPickablePerk,
  renderCharacterSheetView
} from './views/CharacterSheetView';
import {
  formatDialogueProseHtml,
  renderDialogueView
} from './views/DialogueView';
import {
  type HelpModalTab,
  renderHelpModalView
} from './views/HelpModalView';
import {
  type CampaignSummaryOptions,
  renderCampaignSummaryView
} from './views/CampaignSummaryView';
import {
  type PauseMenuOptions,
  renderPauseMenuView
} from './views/PauseMenuView';
import { renderWorldMapView } from './views/WorldMapView';

export interface NarrativeCardData {
  title: string;
  subtitle?: string;
  artId?: string;
  text: string;
  buttonLabel?: string;
  onContinue: () => void;
}

export interface TravelDestinationEntry {
  id: string;
  name: string;
  subtitle: string;
  travelMinutes: number;
  isCurrent: boolean;
}

export interface HubPanelData {
  title: string;
  statusLine: string;
  questsLine: string;
  actions: Array<{ id: string; label: string; disabled?: boolean; alert?: boolean; onClick: () => void }>;
}

export interface NoticeBoardEntry {
  id: string;
  title: string;
  author: string;
  reward: string;
  body: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
}

export interface WelcomeScreenData {
  initialName?: string;
  hasSave: boolean;
  savedSummary?: string;
  onStartNew: (playerName: string) => void;
  onContinue?: () => void;
  onOpenImportKey?: () => void;
}

let activeModalUi: OstrzeModalUi | null = null;

const TOAST_TONE_ICON: Readonly<Record<'info' | 'gold' | 'success', SlavicIconId>> = {
  info: 'info',
  gold: 'star',
  success: 'check'
};

const TIME_OF_DAY_ICON: Readonly<Record<'swit' | 'dzien' | 'zmierzch' | 'noc', SlavicIconId>> = {
  swit: 'dawn',
  dzien: 'day',
  zmierzch: 'dusk',
  noc: 'night'
};

export class OstrzeModalUi {
  private readonly root: HTMLElement;
  private readonly hubRoot: HTMLElement;
  private readonly toastRoot: HTMLElement;
  private readonly abortController = new AbortController();
  private disposed = false;
  private readonly data: OriginGameData;
  private readonly state: OstrzeGameState;
  private readonly rng: SeededRng;

  private activeWelcome: WelcomeScreenData | null = null;
  private activeSaveKey: {
    currentKey: string | null;
    onImport: (key: string) => boolean;
    onClosed?: () => void;
  } | null = null;
  private activeNarrative: NarrativeCardData | null = null;
  private activeDialogue: ActiveOstrzeDialogue | null = null;
  private activeShop: { shopId: string; onClosed?: () => void } | null = null;
  private activeShopCategoryFilter: InventoryCategoryFilter = 'all';
  private activeCharacterSheet: { onUpdated?: () => void } | null = null;
  private activeCharacterTab: CharacterSheetTab = 'stats';
  private characterSheetCloseGuard = false;
  private activeNoticeBoard: { entries: NoticeBoardEntry[]; onClosed?: () => void } | null = null;
  private activeTravel: {
    destinations: TravelDestinationEntry[];
    onSelect: (id: string) => void;
    onClosed?: () => void;
    readOnly?: boolean;
    currentLocationId?: string;
  } | null = null;
  private hubPanel: HubPanelData | null = null;
  private hubCollapsed = false;
  private lastHubHtml = '';
  private isCombatActiveFn: (() => boolean) | null = null;
  private activeCampfire: CampfireModalOptions | null = null;
  private activePauseMenu: PauseMenuOptions | null = null;
  private activeCampaignSummary: CampaignSummaryOptions | null = null;
  private activeHelp: { initialTab?: HelpModalTab; onClosed?: () => void } | null = null;
  private lastEscapeClosedAt = 0;
  public onOpenCampfire?: () => void;
  public onOpenLevelUp?: () => void;
  private readonly shopBoughtCounts = new Map<string, number>();
  private onDialogueClosed: (() => void) | null = null;
  private onOpenShop: ((shopId: string) => void) | null = null;
  private creatorOpen = false;
  private onCreatorComplete: (() => void) | null = null;

  // Draft state for character creator
  private draftName = 'Mściwój';
  private draftClass: ClassId = 'miecz';
  private draftAttrs: Record<AttributeId, number>;
  private draftTagged: SkillId[] = ['sieczna', 'wymowa', 'skradanie'];
  private draftDifficulty: OstrzeDifficultyId | undefined = undefined;
  private creatorError: string | null = null;

  constructor(data: OriginGameData, state: OstrzeGameState, rng: SeededRng) {
    activeModalUi?.destroy();
    this.data = data;
    this.state = state;
    this.rng = rng;

    this.root = this.createOrReuseRoot('ostrze-overlay-root');
    this.hubRoot = this.createOrReuseRoot('ostrze-hub-root');
    this.toastRoot = this.createOrReuseRoot('ostrze-toast-root', 'ostrze-toast-stack');
    this.toastRoot.setAttribute?.('aria-live', 'polite');

    // Isolate pointer, mouse, and wheel events while any Ostrze modal overlay is open
    // (leave pointermove/mousemove bubbling so IsoSceneView's window handler immediately
    // clears hoveredWorldTile, edge-pan, and canvas cursor under BLOCKING_MODAL_SELECTOR)
    if (typeof this.root.addEventListener === 'function') {
      const { signal } = this.abortController;
      const isolateIfOverlayOpen = (e: Event): void => {
        if (this.root.querySelector('.ostrze-overlay')) {
          e.stopPropagation();
        }
      };
      this.root.addEventListener('pointerdown', isolateIfOverlayOpen, { signal });
      this.root.addEventListener('mousedown', isolateIfOverlayOpen, { signal });
      this.root.addEventListener(
        'wheel',
        (e) => {
          const overlay = this.root.querySelector<HTMLElement>('.ostrze-overlay');
          if (!overlay) return;
          e.stopPropagation();
          const candidates = [
            overlay.querySelector<HTMLElement>('.ostrze-help-body'),
            overlay.querySelector<HTMLElement>('.ostrze-cs-body'),
            overlay.querySelector<HTMLElement>('.ostrze-camp-grid'),
            overlay.querySelector<HTMLElement>('.ostrze-dialogue-speech-pane'),
            overlay.querySelector<HTMLElement>('.ostrze-dialogue-choices-pane'),
            overlay.querySelector<HTMLElement>('.ostrze-dialogue-body'),
            overlay.querySelector<HTMLElement>('.ostrze-card'),
            overlay
          ];
          const scrollTarget =
            candidates.find((el): el is HTMLElement => Boolean(el && el.scrollHeight > el.clientHeight)) ??
            overlay;
          if (scrollTarget && !scrollTarget.contains(e.target as Node)) {
            e.preventDefault();
            scrollTarget.scrollTop += e.deltaY;
          }
        },
        { passive: false, signal }
      );
    }

    this.draftAttrs = buildInitialCreatorAttrs(this.data);
    activeModalUi = this;

    window.addEventListener(
      'keydown',
      (e) => {
        if (this.disposed) return;
        const target = e.target as HTMLElement | null;
        const isTyping =
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

        if (!isTyping && this.activeDialogue && /^[1-9]$/.test(e.key)) {
          const btn = this.root.querySelector<HTMLButtonElement>(
            `[data-shortcut="${e.key}"]:not(:disabled)`
          );
          if (btn) {
            e.preventDefault();
            btn.click();
            return;
          }
        }

        if (!isTyping && this.activeDialogue && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          const enabledBtns = Array.from(
            this.root.querySelectorAll<HTMLButtonElement>('.ostrze-dialogue-opt:not(:disabled)')
          );
          if (enabledBtns.length > 0) {
            e.preventDefault();
            const currentIdx = enabledBtns.indexOf(document.activeElement as HTMLButtonElement);
            const delta = e.key === 'ArrowDown' ? 1 : -1;
            const nextIdx =
              currentIdx < 0
                ? delta > 0
                  ? 0
                  : enabledBtns.length - 1
                : (currentIdx + delta + enabledBtns.length) % enabledBtns.length;
            enabledBtns[nextIdx]?.focus();
            return;
          }
        }

        if (!isTyping && this.activeNarrative && (e.key === 'Enter' || e.key === ' ')) {
          const nextBtn = this.root.querySelector<HTMLButtonElement>('[data-action="narrative-next"]');
          if (nextBtn) {
            e.preventDefault();
            nextBtn.click();
            return;
          }
        }

        if (e.key !== 'Escape') return;
        if (this.activeHelp) {
          e.stopImmediatePropagation();
          const cb = this.activeHelp.onClosed;
          this.activeHelp = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
          return;
        }
        if (this.activePauseMenu) {
          e.stopImmediatePropagation();
          const cb = this.activePauseMenu.onClosed;
          this.activePauseMenu = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
          return;
        }
        if (this.activeCampfire) {
          e.stopImmediatePropagation();
          const cb = this.activeCampfire.onClosed;
          this.activeCampfire = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
          return;
        }
        if (this.activeSaveKey) {
          e.stopImmediatePropagation();
          const cb = this.activeSaveKey.onClosed;
          this.activeSaveKey = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
        } else if (this.activeCharacterSheet) {
          e.stopImmediatePropagation();
          this.lastEscapeClosedAt = performance.now();
          this.attemptCloseCharacterSheet();
        } else if (this.activeNoticeBoard) {
          e.stopImmediatePropagation();
          const cb = this.activeNoticeBoard.onClosed;
          this.activeNoticeBoard = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
        } else if (this.activeTravel) {
          e.stopImmediatePropagation();
          const cb = this.activeTravel.onClosed;
          this.activeTravel = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
        } else if (this.activeShop) {
          e.stopImmediatePropagation();
          const cb = this.activeShop.onClosed;
          this.activeShop = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
        }
      },
      { signal: this.abortController.signal }
    );
  }

  private createOrReuseRoot(id: string, className?: string): HTMLElement {
    document.getElementById(id)?.remove();
    const el = document.createElement('div');
    el.id = id;
    if (className) {
      el.className = className;
    }
    document.body.appendChild(el);
    return el;
  }

  public destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController.abort();
    this.root.remove();
    this.hubRoot.remove();
    this.toastRoot.remove();
    if (activeModalUi === this) {
      activeModalUi = null;
    }
  }

  public showWelcome(welcome: WelcomeScreenData): void {
    this.activeWelcome = welcome;
    if (welcome.initialName) {
      this.draftName = welcome.initialName;
    }
    this.render();
  }

  public showSaveKeyModal(
    currentKey: string | null,
    onImport: (key: string) => boolean,
    onClosed?: () => void
  ): void {
    this.activeSaveKey = { currentKey, onImport, onClosed };
    this.render();
  }

  public setCombatChecker(fn: () => boolean): void {
    this.isCombatActiveFn = fn;
  }

  public resetShopStock(): void {
    this.shopBoughtCounts.clear();
  }

  public setDraftName(name: string): void {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      this.draftName = trimmed;
    }
  }

  public showNarrative(card: NarrativeCardData): void {
    this.activeNarrative = card;
    this.render();
  }

  public showCharacterCreator(onComplete: () => void): void {
    this.creatorOpen = true;
    this.onCreatorComplete = onComplete;
    this.creatorError = null;
    this.render();
  }

  public showDialogue(
    session: ActiveOstrzeDialogue,
    opts?: {
      onClosed?: () => void;
      onOpenShop?: (shopId: string) => void;
    }
  ): void {
    this.activeDialogue = session;
    this.onDialogueClosed = opts?.onClosed ?? null;
    this.onOpenShop = opts?.onOpenShop ?? null;
    this.render();
  }

  public showShop(shopId: string, onClosed?: () => void): void {
    this.activeShopCategoryFilter = 'all';
    this.activeShop = { shopId, onClosed };
    this.render();
  }

  public showCharacterSheet(
    onUpdated?: () => void,
    initialTab?: CharacterSheetTab
  ): void {
    if (this.activeCharacterSheet && initialTab && this.activeCharacterTab === initialTab) {
      this.attemptCloseCharacterSheet();
      return;
    }
    if (initialTab) {
      this.activeCharacterTab = initialTab;
    }
    this.characterSheetCloseGuard = false;
    this.activeCharacterSheet = { onUpdated };
    this.render();
  }

  private attemptCloseCharacterSheet(): void {
    if (!this.activeCharacterSheet) return;
    if (hasUnspentPickablePerk(this.state, this.data) && !this.characterSheetCloseGuard) {
      this.characterSheetCloseGuard = true;
      this.render();
      const perksPanel = this.root.querySelector<HTMLElement>('[data-cs-perks-panel]');
      perksPanel?.classList?.add('is-pulse-highlight');
      window.setTimeout(() => perksPanel?.classList?.remove('is-pulse-highlight'), 900);
      return;
    }
    this.forceCloseCharacterSheet();
  }

  private forceCloseCharacterSheet(): void {
    if (!this.activeCharacterSheet) return;
    const cb = this.activeCharacterSheet.onUpdated;
    this.characterSheetCloseGuard = false;
    this.activeCharacterSheet = null;
    this.render();
    cb?.();
  }

  public isCharacterSheetOpen(): boolean {
    return Boolean(this.activeCharacterSheet);
  }

  public hasOpenModal(): boolean {
    return Boolean(
      this.activeHelp ||
        this.activePauseMenu ||
        this.activeCampaignSummary ||
        this.activeSaveKey ||
        this.activeWelcome ||
        this.activeNarrative ||
        this.activeDialogue ||
        this.activeShop ||
        this.activeCharacterSheet ||
        this.activeNoticeBoard ||
        this.activeTravel ||
        this.activeCampfire ||
        this.creatorOpen
    );
  }

  public wasEscapeJustConsumed(): boolean {
    return performance.now() - this.lastEscapeClosedAt < 80;
  }

  public showPauseMenu(opts: PauseMenuOptions): void {
    this.activePauseMenu = opts;
    this.render();
  }

  public showCampaignSummary(opts: CampaignSummaryOptions): void {
    this.activeCampaignSummary = opts;
    this.render();
  }

  public showHelpModal(initialTab: HelpModalTab = 'controls', onClosed?: () => void): void {
    this.activeHelp = { initialTab, onClosed };
    this.render();
  }

  public isHelpModalOpen(): boolean {
    return this.activeHelp !== null;
  }

  public closeHelpModal(): void {
    if (!this.activeHelp) return;
    const cb = this.activeHelp.onClosed;
    this.activeHelp = null;
    this.render();
    cb?.();
  }

  public showNoticeBoard(entries: NoticeBoardEntry[], onClosed?: () => void): void {
    this.activeNoticeBoard = { entries, onClosed };
    this.render();
  }

  public showTravelModal(
    destinations: TravelDestinationEntry[],
    onSelect: (id: string) => void,
    onClosed?: () => void,
    options?: { readOnly?: boolean; currentLocationId?: string }
  ): void {
    this.activeTravel = {
      destinations,
      onSelect,
      onClosed,
      readOnly: options?.readOnly,
      currentLocationId: options?.currentLocationId
    };
    this.render();
  }

  public showWorldMapPreview(currentLocationId: string, onClosed?: () => void): void {
    this.showTravelModal([], () => undefined, onClosed, {
      readOnly: true,
      currentLocationId
    });
  }

  public isTravelModalOpen(): boolean {
    return this.activeTravel !== null;
  }

  public closeTravelModal(): void {
    if (!this.activeTravel) return;
    const cb = this.activeTravel.onClosed;
    this.activeTravel = null;
    this.render();
    cb?.();
  }

  public showToast(text: string, tone: 'info' | 'gold' | 'success' = 'info'): void {
    if (tone === 'gold' && /awans/i.test(text)) {
      ostrzeAudio.playLevelUpFanfare();
    }
    const el = document.createElement('div');
    el.className = `ostrze-toast ${tone === 'gold' ? 'is-gold' : tone === 'success' ? 'is-success' : ''}`;
    el.setAttribute('role', 'status');
    const iconId = TOAST_TONE_ICON[tone];
    el.innerHTML = `<span class="ostrze-toast-seal">${renderSlavicIcon(iconId)}</span><span class="ostrze-toast-text">${this.escape(text)}</span>`;
    this.toastRoot.appendChild(el);
    window.setTimeout(() => {
      el.classList?.add('is-leaving');
    }, 2940);
    window.setTimeout(() => {
      el.remove();
    }, 3220);
  }

  public setHubPanel(panel: HubPanelData | null): void {
    this.hubPanel = panel;
    this.renderHubPanel();
  }

  public closeAll(): void {
    this.activeHelp = null;
    this.activePauseMenu = null;
    this.activeCampaignSummary = null;
    this.activeWelcome = null;
    this.activeSaveKey = null;
    this.activeNarrative = null;
    this.activeDialogue = null;
    this.activeShop = null;
    this.activeCharacterSheet = null;
    this.activeNoticeBoard = null;
    this.activeTravel = null;
    this.activeCampfire = null;
    this.creatorOpen = false;
    this.render();
  }

  public render(): void {
    this.renderHubPanel();
    if (this.activeHelp) {
      this.renderHelpModal();
      return;
    }
    if (this.activePauseMenu) {
      this.renderPauseMenu();
      return;
    }
    if (this.activeCampaignSummary) {
      const opts = this.activeCampaignSummary;
      renderCampaignSummaryView({
        root: this.root,
        state: this.state,
        data: this.data,
        opts,
        onClose: () => {
          this.activeCampaignSummary = null;
          this.render();
        }
      });
      return;
    }
    if (this.activeSaveKey) {
      this.renderSaveKeyModal();
      return;
    }
    if (this.activeWelcome) {
      this.renderWelcome(this.activeWelcome);
      return;
    }
    if (this.activeNarrative) {
      this.renderNarrative(this.activeNarrative);
      return;
    }
    if (this.creatorOpen) {
      this.renderCreator();
      return;
    }
    if (this.activeCharacterSheet) {
      this.renderCharacterSheet();
      return;
    }
    if (this.activeNoticeBoard) {
      this.renderNoticeBoard();
      return;
    }
    if (this.activeCampfire) {
      this.renderCampfireModal();
      return;
    }
    if (this.activeTravel) {
      this.renderTravelModal();
      return;
    }
    if (this.activeShop) {
      this.renderShop(this.activeShop.shopId);
      return;
    }
    if (this.activeDialogue) {
      this.renderDialogue(this.activeDialogue);
      return;
    }
    this.root.innerHTML = '';
  }

  private renderHubPanel(): void {
    if (
      !this.hubPanel ||
      this.isCombatActiveFn?.() ||
      this.activeHelp ||
      this.activePauseMenu ||
      this.activeCampaignSummary ||
      this.activeWelcome ||
      this.activeSaveKey ||
      this.activeNarrative ||
      this.creatorOpen ||
      this.activeDialogue ||
      this.activeShop ||
      this.activeCharacterSheet ||
      this.activeNoticeBoard ||
      this.activeTravel ||
      this.activeCampfire
    ) {
      this.lastHubHtml = '';
      this.hubRoot.innerHTML = '';
      return;
    }
    const ch = this.state.character;
    const pendingPts = ch
      ? ch.freeAttributePoints + ch.freeSkillPoints + ch.freePerkPicks
      : 0;
    const hasFreePerk = Boolean(ch && ch.freePerkPicks > 0);
    const levelUpBtnHtml =
      pendingPts > 0
        ? `<button type="button" class="ostrze-hub-btn is-alert ostrze-hub-levelup-btn ostrze-ico-btn" data-hub-levelup="true" title="Otwórz Kartę Postaci [K] i rozdaj punkty rozwoju">${renderSlavicIcon('star')}<span>Awans (+${pendingPts})${hasFreePerk ? ' · Talent!' : ''}</span> <kbd class="ostrze-kbd">K</kbd></button>`
        : '';

    const btns = this.hubPanel.actions
      .map(
        (act) => `
          <button class="ostrze-hub-btn ${act.alert ? 'is-alert' : ''}" data-hub-act="${this.escape(act.id)}" ${act.disabled ? 'disabled' : ''}>
            ${this.formatActionLabelWithKbd(act.label)}
          </button>
        `
      )
      .join('');

    const atmo = getWorldAtmosphere(this.state, this.data);
    const chEffects = ch?.effects ?? [];
    const formatEffectTooltip = (effId: string): string => {
      const def = this.data.effects.find((d) => d.id === effId) as
        | (typeof this.data.effects[number] & {
            description?: string;
            modifiers?: Record<string, number>;
          })
        | undefined;
      if (!def) return effId;
      const parts: string[] = [];
      if (def.description) parts.push(def.description);
      const mods = def.modifiers;
      if (mods && typeof mods === 'object') {
        const modText = Object.entries(mods)
          .filter(([, v]) => typeof v === 'number' && v !== 0)
          .map(([k, v]) => `${v > 0 ? '+' : ''}${v} ${k}`)
          .join(', ');
        if (modText) parts.push(`(${modText})`);
      }
      return parts.join(' ') || def.name;
    };
    const effectPillsHtml = chEffects
      .slice(0, 4)
      .map((eff) => {
        const def = this.data.effects.find((d) => d.id === eff.id);
        const isBuff =
          eff.id === 'najedzony' || eff.id === 'mocny_napar' || eff.id === 'natluszczone_ostrze';
        const tip = formatEffectTooltip(eff.id);
        return `<span class="ostrze-atmo-pill ${isBuff ? 'is-buff' : 'is-debuff'}" title="${this.escape(tip)}">${this.escape(def?.name ?? eff.id)}</span>`;
      })
      .join('');
    const phenomPillHtml = atmo.phenomenonName
      ? `<span class="ostrze-atmo-pill is-phenom" title="${this.escape(atmo.phenomenonSummary ?? '')}">${this.escape(atmo.phenomenonName)}</span>`
      : '';
    const hasAtmoPills = Boolean(phenomPillHtml || effectPillsHtml);

    const timeIconId = TIME_OF_DAY_ICON[atmo.timeOfDay] ?? 'night';
    const toggleLabel = this.hubCollapsed ? 'Rozwiń tracker celu' : 'Zwiń tracker celu';

    const nextHubHtml = `
      <div class="ostrze-hub-bar ${this.hubCollapsed ? 'is-collapsed' : ''}">
        <div class="ostrze-hub-header">
          <div class="ostrze-hub-title">${this.escape(this.hubPanel.title)}</div>
          <div class="ostrze-hub-head-right">
            <span class="ostrze-hub-clock ostrze-ico-pill" title="Pora dnia i godzina">${renderSlavicIcon(timeIconId)}<span class="ostrze-num">${this.escape(atmo.timeLabel)} · ${this.escape(atmo.clockText)}</span></span>
            ${
              this.hubCollapsed && pendingPts > 0
                ? `<button type="button" class="ostrze-hub-mini-lvl ostrze-ico-pill" data-hub-levelup="true" title="Awans postaci (+${pendingPts})">${renderSlavicIcon('star')}<span>+${pendingPts}</span></button>`
                : ''
            }
            <button type="button" class="ostrze-hub-toggle" data-hub-toggle aria-expanded="${!this.hubCollapsed}" aria-label="${toggleLabel}" title="${toggleLabel}">
              ${this.hubCollapsed ? '+' : '–'}
            </button>
          </div>
        </div>
        ${
          this.hubCollapsed
            ? ''
            : `
              ${hasAtmoPills ? `<div class="ostrze-atmo-strip">${phenomPillHtml}${effectPillsHtml}</div>` : ''}
              <div class="ostrze-hub-meta">${this.escape(this.hubPanel.statusLine)}</div>
              <div class="ostrze-hub-quests">${this.escape(this.hubPanel.questsLine)}</div>
              ${levelUpBtnHtml || btns ? `<div class="ostrze-hub-actions">${levelUpBtnHtml}${btns}</div>` : ''}
            `
        }
      </div>
    `;
    if (nextHubHtml === this.lastHubHtml && this.hubRoot.firstElementChild) {
      return;
    }
    this.lastHubHtml = nextHubHtml;
    this.hubRoot.innerHTML = nextHubHtml;

    this.hubRoot.querySelector('[data-hub-toggle]')?.addEventListener('click', () => {
      this.hubCollapsed = !this.hubCollapsed;
      this.renderHubPanel();
    });

    this.hubRoot.querySelectorAll<HTMLElement>('[data-hub-levelup]').forEach((btn) => {
      btn.addEventListener('click', () => {
        ostrzeAudio.playUiClick();
        if (this.onOpenLevelUp) {
          this.onOpenLevelUp();
        } else {
          this.showCharacterSheet(undefined, 'stats');
        }
      });
    });

    if (!this.hubCollapsed) {
      this.hubPanel.actions.forEach((act) => {
        this.hubRoot
          .querySelector(`[data-hub-act="${act.id}"]`)
          ?.addEventListener('click', () => act.onClick());
      });
    }
  }

  private getShopPrice(baseValue: number, shopId: string): number {
    return getShopBuyPrice(baseValue, shopId, this.state, this.data);
  }

  private renderShop(shopId: string): void {
    const shop = this.data.shops.find((s) => s.id === shopId);
    const money = this.state.character?.money ?? 0;
    const handel = this.state.character ? getStats(this.state, this.data).skills.handel : 0;
    const merchantMeta = getPixArtMeta(getShopMerchantPortraitId(shopId));

    const stockEntries = shop?.stock ?? [];
    const invEntries = this.state.inventory.items;

    const categoryCounts: Record<InventoryCategoryFilter, number> = {
      all: stockEntries.length + invEntries.length,
      weapon: 0,
      armor: 0,
      consumable: 0,
      other: 0
    };
    for (const e of stockEntries) {
      const cat = classifyInventoryItem(this.data.items.find((i) => i.id === e.id));
      categoryCounts[cat] += 1;
    }
    for (const e of invEntries) {
      const cat = classifyInventoryItem(this.data.items.find((i) => i.id === e.id));
      categoryCounts[cat] += 1;
    }
    if (
      this.activeShopCategoryFilter !== 'all' &&
      categoryCounts[this.activeShopCategoryFilter] === 0
    ) {
      this.activeShopCategoryFilter = 'all';
    }

    const matchesShopFilter = (itemId: string): boolean => {
      if (this.activeShopCategoryFilter === 'all') return true;
      const item = this.data.items.find((i) => i.id === itemId);
      return classifyInventoryItem(item) === this.activeShopCategoryFilter;
    };

    const shopFiltersHtml = `
      <div class="ostrze-gear-filters ostrze-shop-filters" role="tablist" aria-label="Filtr kategorii w kramie" data-shop-filters="true">
        ${INVENTORY_FILTER_META
          .map(
            (f) => `
            <button
              type="button"
              class="ostrze-gear-filter-btn ${this.activeShopCategoryFilter === f.id ? 'is-active' : ''}"
              data-shop-filter="${f.id}"
              ${f.id !== 'all' && categoryCounts[f.id] === 0 ? 'disabled' : ''}
            >
              ${renderSlavicIcon(f.icon)}<span>${f.label}</span> <span class="ostrze-gear-filter-count">${categoryCounts[f.id]}</span>
            </button>
          `
          )
          .join('')}
      </div>
    `;

    const buyRows = stockEntries
      .filter((entry) => matchesShopFilter(entry.id))
      .map((entry) => {
        const item = this.data.items.find((i) => i.id === entry.id);
        const boughtKey = `${shopId}:${entry.id}`;
        const remainingQty = Math.max(0, entry.qty - (this.shopBoughtCounts.get(boughtKey) ?? 0));
        const price = this.getShopPrice(item?.value ?? 10, shopId);
        const canBuy = money >= price && remainingQty > 0;
        const desc = item?.description
          ? `<div class="ostrze-shop-desc">${this.escape(item.description)}</div>`
          : '';
        const statPills = renderItemStatPillsHtml(item, this.state, this.data);
        return `
          <div class="ostrze-row ostrze-shop-row">
            <div style="flex:1;min-width:0;">
              <div class="ostrze-gear-item-line">
                <strong>${this.escape(item?.name ?? entry.id)}</strong>
                <span class="ostrze-shop-qty ostrze-num">(szt: ${remainingQty})</span>
              </div>
              ${statPills}
              ${desc}
            </div>
            <button type="button" class="ostrze-btn ostrze-shop-btn" data-buy="${this.escape(entry.id)}" ${canBuy ? '' : 'disabled'}>
              Kup (${price} gr)
            </button>
          </div>
        `;
      })
      .join('');

    const equippedValues = new Set(Object.values(this.state.inventory.equipped));
    const sellRows = invEntries
      .filter((entry) => matchesShopFilter(entry.id))
      .map((entry) => {
        const item = this.data.items.find((i) => i.id === entry.id);
        const check = canSellItemToShop(entry.id, shopId, this.state, this.data);
        const isEquipped = equippedValues.has(entry.id);
        const statPills = renderItemStatPillsHtml(item, this.state, this.data);
        return `
          <div class="ostrze-row ostrze-shop-row">
            <div style="flex:1;min-width:0;">
              <div class="ostrze-gear-item-line">
                <strong>${this.escape(item?.name ?? entry.id)}</strong>
                <span class="ostrze-shop-qty ostrze-num">×${entry.qty}</span>
                ${isEquipped ? '<span class="ostrze-gear-equipped-tag">Założono</span>' : ''}
              </div>
              ${statPills}
            </div>
            ${
              check.ok
                ? `<button type="button" class="ostrze-hub-btn" data-sell="${this.escape(entry.id)}">Sprzedaj (+${check.price} gr)</button>`
                : `<span class="ostrze-shop-tag">${this.escape(check.reason ?? 'Niedostępne')}</span>`
            }
          </div>
        `;
      })
      .join('');

    const portraitHtml = merchantMeta
      ? `
        <div class="ostrze-shop-portrait-frame ${merchantMeta.width > merchantMeta.height ? 'is-wide' : ''}">
          <img
            class="ostrze-shop-portrait ostrze-pix-art"
            src="${this.escape(merchantMeta.dataUri)}"
            width="${merchantMeta.width}"
            height="${merchantMeta.height}"
            alt="${this.escape(shop?.name ?? 'Kram')}"
          />
        </div>
      `
      : '';

    const closeShop = (): void => {
      const cb = this.activeShop?.onClosed;
      this.activeShop = null;
      this.render();
      cb?.();
    };

    mountModalCard(
      this.root,
      'ostrze-card ostrze-shop-card',
      `
          <div class="ostrze-shop-header">
            ${portraitHtml}
            <div style="flex:1;min-width:0;">
              <h2 class="ostrze-title ostrze-ico-title" style="margin-bottom:4px;">${renderSlavicIcon('shop')}<span>${this.escape(shop?.name ?? 'Kram')}</span></h2>
              <div class="ostrze-shop-meta">
                <span class="ostrze-purse-pill ostrze-ico-pill">${renderSlavicIcon('coin')}<span>Sakiewka:</span> <strong class="ostrze-num">${money} gr</strong></span>
                <span class="ostrze-shop-tag">Handel: ${handel}%</span>
              </div>
            </div>
            <button type="button" class="ostrze-modal-close-x" data-action="shop-close-top" aria-label="Zamknij" title="Zamknij [ESC]">×</button>
          </div>

          ${shopFiltersHtml}

          <div class="ostrze-shop-grid">
            <div class="ostrze-panel ostrze-shop-col">
              <h3>Towar kramarza</h3>
              ${buyRows || '<p class="ostrze-subtitle" style="margin-bottom:0;">Brak towaru w tej kategorii.</p>'}
            </div>
            <div class="ostrze-panel ostrze-shop-col">
              <h3>Twój plecak (sprzedaż)</h3>
              ${sellRows || '<p class="ostrze-subtitle" style="margin-bottom:0;">Brak przedmiotów w tej kategorii.</p>'}
            </div>
          </div>

          <div class="ostrze-modal-footer">
            <span class="ostrze-modal-footer-hint">Wyższy poziom umiejętności Handel obniża ceny zakupu i podnosi wycenę sprzedaży.</span>
            <button type="button" class="ostrze-btn ostrze-modal-close-btn" data-action="shop-close">Zamknij kram <kbd class="ostrze-kbd">ESC</kbd></button>
          </div>
      `,
      { onOverlayBackdropClick: closeShop }
    );

    this.root.querySelectorAll<HTMLElement>('[data-shop-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextFilter = btn.dataset.shopFilter as InventoryCategoryFilter | undefined;
        if (nextFilter && nextFilter !== this.activeShopCategoryFilter) {
          ostrzeAudio.playUiClick();
          this.activeShopCategoryFilter = nextFilter;
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.buy ?? '';
        const stockEntry = shop?.stock.find((s) => s.id === itemId);
        const item = this.data.items.find((i) => i.id === itemId);
        const boughtKey = `${shopId}:${itemId}`;
        const remainingQty = stockEntry ? Math.max(0, stockEntry.qty - (this.shopBoughtCounts.get(boughtKey) ?? 0)) : 0;
        const price = this.getShopPrice(item?.value ?? 10, shopId);
        if (stockEntry && remainingQty > 0 && this.state.character && this.state.character.money >= price) {
          this.state.character.money -= price;
          this.shopBoughtCounts.set(boughtKey, (this.shopBoughtCounts.get(boughtKey) ?? 0) + 1);
          const invEntry = this.state.inventory.items.find((i) => i.id === itemId);
          if (invEntry) invEntry.qty += 1;
          else this.state.inventory.items.push({ id: itemId, qty: 1 });
          this.showToast(`Kupiono: ${item?.name ?? itemId} (-${price} gr)`, 'gold');
          ostrzeAudio.playShopCoin();
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-sell]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.sell ?? '';
        const res = sellInventoryItemToShop(itemId, shopId, this.state, this.data);
        if (res.sold) {
          this.showToast(`Sprzedano: ${res.itemName} (+${res.price} gr)`, 'success');
          ostrzeAudio.playShopCoin();
          this.render();
        }
      });
    });

    this.root.querySelector('[data-action="shop-close"]')?.addEventListener('click', closeShop);
    this.root.querySelector('[data-action="shop-close-top"]')?.addEventListener('click', closeShop);
  }

  private renderNarrative(card: NarrativeCardData): void {
    const artHtml = card.artId
      ? renderStoryVistaBannerHtml(card.artId, card.title, 'ostrze-narrative-art-frame')
      : '';

    mountModalCard(
      this.root,
      `ostrze-card ostrze-narrative-card ${card.artId ? 'has-vista' : ''}`,
      `
          ${artHtml}
          <div class="ostrze-narrative-body">
            <div class="ostrze-narrative-head">
              <h2 class="ostrze-title ostrze-narrative-title">${this.escape(card.title)}</h2>
              ${card.subtitle ? `<p class="ostrze-subtitle ostrze-narrative-subtitle">${this.escape(card.subtitle)}</p>` : ''}
            </div>
            <div class="ostrze-prose ostrze-narrative-prose">${formatDialogueProseHtml(card.text)}</div>
            <div class="ostrze-narrative-ornament" aria-hidden="true">${SLAVIC_ORNAMENT_SVG}</div>
            <div class="ostrze-narrative-footer">
              <button type="button" class="ostrze-btn ostrze-narrative-btn" data-action="narrative-next">
                ${this.escape(card.buttonLabel ?? 'Dalej')}
              </button>
              <span class="ostrze-shortcut-hint"><kbd class="ostrze-kbd">Enter</kbd> / <kbd class="ostrze-kbd">Spacja</kbd></span>
            </div>
          </div>
      `
    );
    this.root
      .querySelector('[data-action="narrative-next"]')
      ?.addEventListener('click', () => {
        const cb = card.onContinue;
        this.activeNarrative = null;
        cb();
        if (!this.hasOpenModal()) {
          this.render();
        }
      });
  }

  private renderCreator(): void {
    const draft = {
      name: this.draftName,
      classId: this.draftClass,
      attrs: this.draftAttrs,
      tagged: this.draftTagged,
      difficulty: this.draftDifficulty,
      error: this.creatorError
    };
    renderCharacterCreatorView({
      root: this.root,
      data: this.data,
      state: this.state,
      draft,
      onRerender: () => {
        this.draftName = draft.name;
        this.draftClass = draft.classId;
        this.draftAttrs = draft.attrs;
        this.draftTagged = draft.tagged;
        this.draftDifficulty = draft.difficulty;
        this.creatorError = draft.error;
        this.render();
      },
      onComplete: () => {
        this.draftName = draft.name;
        this.draftClass = draft.classId;
        this.draftAttrs = draft.attrs;
        this.draftTagged = draft.tagged;
        this.draftDifficulty = draft.difficulty;
        this.creatorError = null;
        const cb = this.onCreatorComplete;
        this.creatorOpen = false;
        this.render();
        cb?.();
      }
    });
  }

  private renderDialogue(session: ActiveOstrzeDialogue): void {
    renderDialogueView({
      root: this.root,
      session,
      state: this.state,
      data: this.data,
      rng: this.rng,
      onOpenShop: this.onOpenShop,
      onAdvance: (next) => {
        if (!next) {
          const cb = this.onDialogueClosed;
          this.activeDialogue = null;
          this.render();
          cb?.();
        } else {
          this.activeDialogue = next;
          this.render();
        }
      }
    });
  }

  private renderCharacterSheet(): void {
    renderCharacterSheetView({
      root: this.root,
      state: this.state,
      data: this.data,
      rng: this.rng,
      activeTab: this.activeCharacterTab,
      closeGuardActive: this.characterSheetCloseGuard,
      onSelectTab: (tab) => {
        this.activeCharacterTab = tab;
        this.render();
      },
      onUpdated: () => {
        if (!hasUnspentPickablePerk(this.state, this.data)) {
          this.characterSheetCloseGuard = false;
        }
        this.activeCharacterSheet?.onUpdated?.();
      },
      onShowToast: (text, tone) => this.showToast(text, tone),
      onRerender: () => this.render(),
      onAttemptClose: () => this.attemptCloseCharacterSheet(),
      onCancelCloseGuard: () => {
        this.characterSheetCloseGuard = false;
        this.render();
      },
      onClose: () => this.forceCloseCharacterSheet()
    });
  }

  private renderNoticeBoard(): void {
    const board = this.activeNoticeBoard;
    if (!board) return;

    const cardsHtml = board.entries
      .map(
        (entry) => `
          <div class="ostrze-notice-card">
            <div class="ostrze-notice-head">
              <span class="ostrze-notice-title ostrze-ico-title">${renderSlavicIcon('scroll')}<span>${this.escape(entry.title)}</span></span>
              <span class="ostrze-seal-tag is-active">${this.escape(entry.reward)}</span>
            </div>
            <div class="ostrze-subtitle ostrze-lore-copy" style="margin-bottom:6px;font-style:italic;">${this.escape(entry.author)}</div>
            <div class="ostrze-prose ostrze-lore-copy" style="font-size:0.9rem;margin-bottom:10px">${this.escape(entry.body)}</div>
            ${
              entry.actionLabel
                ? `<button type="button" class="ostrze-hub-btn" data-nb-act="${this.escape(entry.id)}" ${entry.actionDisabled ? 'disabled' : ''}>${this.escape(entry.actionLabel)}</button>`
                : ''
            }
          </div>
        `
      )
      .join('');

    const closeNoticeBoard = (): void => {
      const cb = board.onClosed;
      this.activeNoticeBoard = null;
      this.activeTravel = null;
      this.render();
      cb?.();
    };

    mountModalCard(
      this.root,
      'ostrze-card ostrze-notice-board-card',
      `
          <div class="ostrze-modal-head">
            <div>
              <h2 class="ostrze-title ostrze-ico-title" style="margin-bottom:3px;">${renderSlavicIcon('scroll')}<span>Tablica Zleceń — Wilczy Bród</span></h2>
              <p class="ostrze-subtitle" style="margin-bottom:0;">Ogłoszenia strażnicy, kontrakty łowieckie i wieści z pogórza.</p>
            </div>
            <button type="button" class="ostrze-modal-close-x" id="ostrze-nb-close-top" aria-label="Zamknij" title="Zamknij [ESC]">×</button>
          </div>
          <div class="ostrze-notice-grid">
            ${cardsHtml}
          </div>
          <div class="ostrze-modal-footer">
            <span class="ostrze-modal-footer-hint">Przyjęte zlecenia trafiają do Dziennika <kbd class="ostrze-kbd">J</kbd>.</span>
            <button type="button" class="ostrze-btn ostrze-modal-close-btn" id="ostrze-nb-close">Odejdź od tablicy <kbd class="ostrze-kbd">ESC</kbd></button>
          </div>
      `,
      { onOverlayBackdropClick: closeNoticeBoard }
    );

    board.entries.forEach((entry) => {
      if (entry.actionLabel && entry.onAction) {
        this.root.querySelector(`[data-nb-act="${entry.id}"]`)?.addEventListener('click', () => {
          entry.onAction?.();
        });
      }
    });

    this.root.querySelector('#ostrze-nb-close')?.addEventListener('click', closeNoticeBoard);
    this.root.querySelector('#ostrze-nb-close-top')?.addEventListener('click', closeNoticeBoard);
  }

  private renderWelcome(welcome: WelcomeScreenData): void {
    const bannerHtml = renderStoryVistaBannerHtml(
      'wstep_gwiazdy',
      'Voided — Na przekór gwiazdom',
      'ostrze-welcome-art-frame'
    );

    mountModalCard(
      this.root,
      'ostrze-card ostrze-welcome-card',
      `
          ${bannerHtml}
          <div class="ostrze-welcome-body">
            <h1 class="ostrze-welcome-title">VOIDED</h1>
            <div class="ostrze-welcome-ornament" aria-hidden="true">${SLAVIC_ORNAMENT_SVG}</div>
            <p class="ostrze-welcome-subtitle">Na przekór gwiazdom</p>

            <form class="ostrze-welcome-form" id="ostrze-welcome-form">
              <label class="ostrze-sr-only" for="ostrze-welcome-name">Imię bohatera</label>
              <input
                id="ostrze-welcome-name"
                class="ostrze-welcome-input"
                type="text"
                maxlength="${this.data.rules.creator.nameMax}"
                placeholder="Wpisz imię wędrowca..."
                value="${this.escape(this.draftName)}"
                autocomplete="off"
              />
              <button type="submit" class="ostrze-btn ostrze-welcome-cta">
                Zaczynamy
              </button>
            </form>

            <div class="ostrze-welcome-secondary">
              ${
                welcome.hasSave && welcome.onContinue
                  ? `<button type="button" class="ostrze-hub-btn is-alert" id="ostrze-welcome-continue">Kontynuuj (${this.escape(welcome.savedSummary ?? 'zapis')})</button>`
                  : ''
              }
              ${
                welcome.onOpenImportKey
                  ? `<button type="button" class="ostrze-hub-btn ostrze-ico-btn" id="ostrze-welcome-key">${renderSlavicIcon('key')}<span>Klucz rozgrywki</span></button>`
                  : ''
              }
            </div>

            <div class="ostrze-welcome-credits">
              <div>Pomysł świata i gry: Twiist · Fabuła i dialogi: Twiist</div>
              <div>Port 2,5D, silnik i wykonanie: Ulfgaros</div>
            </div>
          </div>
      `
    );

    const inputEl = this.root.querySelector<HTMLInputElement>('#ostrze-welcome-name');
    inputEl?.focus();

    this.root.querySelector('#ostrze-welcome-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      ostrzeAudio.unlock();
      ostrzeAudio.playUiClick();
      const rawName = inputEl?.value.trim() ?? '';
      const finalName = rawName.length >= this.data.rules.creator.nameMin ? rawName : 'Mściwój';
      this.draftName = finalName;
      this.activeWelcome = null;
      welcome.onStartNew(finalName);
      if (!this.hasOpenModal()) {
        this.render();
      }
    });

    this.root.querySelector('#ostrze-welcome-continue')?.addEventListener('click', () => {
      ostrzeAudio.unlock();
      ostrzeAudio.playUiClick();
      this.activeWelcome = null;
      this.render();
      welcome.onContinue?.();
    });

    this.root.querySelector('#ostrze-welcome-key')?.addEventListener('click', () => {
      welcome.onOpenImportKey?.();
    });
  }

  private renderSaveKeyModal(): void {
    const modal = this.activeSaveKey;
    if (!modal) return;

    const closeSaveKey = (): void => {
      const cb = modal.onClosed;
      this.activeSaveKey = null;
      this.render();
      cb?.();
    };

    mountModalCard(
      this.root,
      'ostrze-card',
      `
          <div class="ostrze-modal-head">
            <h2 class="ostrze-title ostrze-ico-title" style="margin-bottom:0;">${renderSlavicIcon('key')}<span>Klucz rozgrywki</span></h2>
            <button type="button" class="ostrze-modal-close-x" id="ostrze-key-close-top" aria-label="Zamknij" title="Zamknij [ESC]">×</button>
          </div>
          <p class="ostrze-subtitle" style="margin-bottom:12px;">
            Zapis lokalny działa w tej przeglądarce. Skopiuj swój klucz, aby przenieść postęp na inne urządzenie, lub wklej otrzymany klucz i kliknij „Wczytaj”.
          </p>
          ${
            modal.currentKey
              ? `
                <div style="margin-bottom:12px;">
                  <div class="ostrze-subtitle" style="margin-bottom:4px;font-size:0.82rem;">Twój aktualny klucz zapisu:</div>
                  <textarea class="ostrze-key-textarea" id="ostrze-key-export" readonly>${this.escape(modal.currentKey)}</textarea>
                  <button type="button" class="ostrze-hub-btn ostrze-ico-btn" id="ostrze-key-copy">${renderSlavicIcon('copy')}<span>Kopiuj klucz</span></button>
                </div>
              `
              : ''
          }
          <div>
            <div class="ostrze-subtitle" style="margin-bottom:4px;font-size:0.82rem;">Wklej klucz rozgrywki do wczytania:</div>
            <textarea class="ostrze-key-textarea" id="ostrze-key-import" placeholder="OSTRZE1:..."></textarea>
            <div id="ostrze-key-err" class="ostrze-error" style="display:none;"></div>
          </div>
          <div class="ostrze-modal-footer">
            <button type="button" class="ostrze-btn ostrze-ico-btn" id="ostrze-key-load">${renderSlavicIcon('load')}<span>Wczytaj z klucza</span></button>
            <button type="button" class="ostrze-hub-btn" id="ostrze-key-close">Zamknij <kbd class="ostrze-kbd">ESC</kbd></button>
          </div>
      `,
      { styleText: 'max-width:560px;', onOverlayBackdropClick: closeSaveKey }
    );

    this.root.querySelector('#ostrze-key-copy')?.addEventListener('click', () => {
      const el = this.root.querySelector<HTMLTextAreaElement>('#ostrze-key-export');
      if (!el) return;
      el.select();
      navigator.clipboard?.writeText(el.value).catch(() => undefined);
      this.showToast('Skopiowano klucz rozgrywki.', 'success');
    });

    this.root.querySelector('#ostrze-key-load')?.addEventListener('click', () => {
      const val = this.root.querySelector<HTMLTextAreaElement>('#ostrze-key-import')?.value ?? '';
      const errEl = this.root.querySelector<HTMLElement>('#ostrze-key-err');
      if (modal.onImport(val)) {
        this.activeSaveKey = null;
        this.activeWelcome = null;
        this.render();
      } else if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = 'Nieprawidłowy klucz rozgrywki.';
      }
    });

    this.root.querySelector('#ostrze-key-close')?.addEventListener('click', closeSaveKey);
    this.root.querySelector('#ostrze-key-close-top')?.addEventListener('click', closeSaveKey);
  }

  private renderTravelModal(): void {
    const modal = this.activeTravel;
    if (!modal) return;

    const currentLoc =
      modal.currentLocationId ??
      modal.destinations.find((d) => d.isCurrent)?.id ??
      this.state.world.location ??
      'wilczy_brod';

    renderWorldMapView({
      root: this.root,
      state: this.state,
      data: this.data,
      destinations: modal.destinations,
      currentLocationId: currentLoc,
      readOnly: modal.readOnly,
      onSelectDestination: (destId) => {
        ostrzeAudio.playUiClick();
        this.activeTravel = null;
        this.render();
        modal.onSelect(destId);
      },
      onClose: () => {
        ostrzeAudio.playUiClick();
        const cb = modal.onClosed;
        this.activeTravel = null;
        this.render();
        cb?.();
      }
    });
  }

  public showCampfireModal(opts: CampfireModalOptions): void {
    this.activeCampfire = opts;
    this.render();
  }

  private renderHelpModal(): void {
    const help = this.activeHelp;
    if (!help) return;
    renderHelpModalView({
      root: this.root,
      initialTab: help.initialTab,
      onClose: () => {
        ostrzeAudio.playUiClick();
        const cb = help.onClosed;
        this.activeHelp = null;
        this.render();
        cb?.();
      }
    });
  }

  private renderPauseMenu(): void {
    const pm = this.activePauseMenu;
    if (!pm) return;
    renderPauseMenuView({
      root: this.root,
      pm,
      onRerender: () => this.render(),
      onClose: () => {
        const cb = pm.onClosed;
        this.activePauseMenu = null;
        this.render();
        cb?.();
      },
      onDismissForAction: () => {
        this.activePauseMenu = null;
        this.render();
      }
    });
  }

  private renderCampfireModal(): void {
    const modal = this.activeCampfire;
    if (!modal) return;
    renderCampfireView({
      root: this.root,
      state: this.state,
      data: this.data,
      modal,
      onShowToast: (text, tone) => this.showToast(text, tone),
      onRerender: () => this.render(),
      onClose: () => {
        const cb = modal.onClosed;
        this.activeCampfire = null;
        this.render();
        cb?.();
      }
    });
  }

  private escape(str: string): string {
    return escapeHtml(str);
  }

  private formatActionLabelWithKbd(label: string): string {
    const escaped = this.escape(label);
    return escaped.replace(/\[([A-Za-z0-9–\-]{1,4})\]/g, '<kbd class="ostrze-kbd">$1</kbd>');
  }
}
