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
import { getStats } from '../rules/stats';
import { getWorldAtmosphere } from '../rules/worldCycle';
import { escapeHtml } from './escapeHtml';
import {
  type CampfireModalOptions,
  renderCampfireView
} from './views/CampfireView';
import {
  buildInitialCreatorAttrs,
  renderCharacterCreatorView
} from './views/CharacterCreatorView';
import {
  type CharacterSheetTab,
  renderCharacterSheetView
} from './views/CharacterSheetView';
import { renderDialogueView } from './views/DialogueView';
import {
  type HelpModalTab,
  renderHelpModalView
} from './views/HelpModalView';
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
  private activeCharacterSheet: { onUpdated?: () => void } | null = null;
  private activeCharacterTab: CharacterSheetTab = 'stats';
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
  private isCombatActiveFn: (() => boolean) | null = null;
  private activeCampfire: CampfireModalOptions | null = null;
  private activePauseMenu: PauseMenuOptions | null = null;
  private activeHelp: { initialTab?: HelpModalTab; onClosed?: () => void } | null = null;
  private lastEscapeClosedAt = 0;
  public onOpenCampfire?: () => void;
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
  private creatorError: string | null = null;

  constructor(data: OriginGameData, state: OstrzeGameState, rng: SeededRng) {
    activeModalUi?.destroy();
    this.data = data;
    this.state = state;
    this.rng = rng;

    this.root = this.createOrReuseRoot('ostrze-overlay-root');
    this.hubRoot = this.createOrReuseRoot('ostrze-hub-root');
    this.toastRoot = this.createOrReuseRoot('ostrze-toast-root', 'ostrze-toast-stack');

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
          const cb = this.activeHelp.onClosed;
          this.activeHelp = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
          return;
        }
        if (this.activePauseMenu) {
          const cb = this.activePauseMenu.onClosed;
          this.activePauseMenu = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
          return;
        }
        if (this.activeCampfire) {
          const cb = this.activeCampfire.onClosed;
          this.activeCampfire = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
          return;
        }
        if (this.activeSaveKey) {
          const cb = this.activeSaveKey.onClosed;
          this.activeSaveKey = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
        } else if (this.activeCharacterSheet) {
          const cb = this.activeCharacterSheet.onUpdated;
          this.activeCharacterSheet = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
        } else if (this.activeNoticeBoard) {
          const cb = this.activeNoticeBoard.onClosed;
          this.activeNoticeBoard = null;
          this.activeTravel = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
        } else if (this.activeTravel) {
          const cb = this.activeTravel.onClosed;
          this.activeTravel = null;
          this.lastEscapeClosedAt = performance.now();
          this.render();
          cb?.();
        } else if (this.activeShop) {
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
    this.activeShop = { shopId, onClosed };
    this.render();
  }

  public showCharacterSheet(
    onUpdated?: () => void,
    initialTab?: CharacterSheetTab
  ): void {
    if (this.activeCharacterSheet && initialTab && this.activeCharacterTab === initialTab) {
      const cb = this.activeCharacterSheet.onUpdated;
      this.activeCharacterSheet = null;
      this.render();
      cb?.();
      return;
    }
    if (initialTab) {
      this.activeCharacterTab = initialTab;
    }
    this.activeCharacterSheet = { onUpdated };
    this.render();
  }

  public hasOpenModal(): boolean {
    return Boolean(
      this.activeHelp ||
        this.activePauseMenu ||
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
    const el = document.createElement('div');
    el.className = `ostrze-toast ${tone === 'gold' ? 'is-gold' : tone === 'success' ? 'is-success' : ''}`;
    el.textContent = text;
    this.toastRoot.appendChild(el);
    window.setTimeout(() => {
      el.remove();
    }, 3200);
  }

  public setHubPanel(panel: HubPanelData | null): void {
    this.hubPanel = panel;
    this.renderHubPanel();
  }

  public closeAll(): void {
    this.activeHelp = null;
    this.activePauseMenu = null;
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
      this.hubRoot.innerHTML = '';
      return;
    }
    const btns = this.hubPanel.actions
      .map(
        (act) => `
          <button class="ostrze-hub-btn ${act.alert ? 'is-alert' : ''}" data-hub-act="${this.escape(act.id)}" ${act.disabled ? 'disabled' : ''}>
            ${this.escape(act.label)}
          </button>
        `
      )
      .join('');

    const atmo = getWorldAtmosphere(this.state, this.data);
    const chEffects = this.state.character?.effects ?? [];
    const effectPillsHtml = chEffects
      .slice(0, 4)
      .map((eff) => {
        const def = this.data.effects.find((d) => d.id === eff.id);
        const isBuff =
          eff.id === 'najedzony' || eff.id === 'mocny_napar' || eff.id === 'natluszczone_ostrze';
        return `<span class="ostrze-atmo-pill ${isBuff ? 'is-buff' : 'is-debuff'}">${this.escape(def?.name ?? eff.id)}</span>`;
      })
      .join('');
    const phenomPillHtml = atmo.phenomenonName
      ? `<span class="ostrze-atmo-pill is-phenom" title="${this.escape(atmo.phenomenonSummary ?? '')}">${this.escape(atmo.phenomenonName)}</span>`
      : '';

    this.hubRoot.innerHTML = `
      <div class="ostrze-hub-bar">
        <div class="ostrze-hub-header">
          <div class="ostrze-hub-title">${this.escape(this.hubPanel.title)}</div>
          <button class="ostrze-hub-toggle" data-hub-toggle title="${this.hubCollapsed ? 'Rozwiń tracker celu' : 'Zwiń tracker celu'}">
            ${this.hubCollapsed ? '+' : '–'}
          </button>
        </div>
        <div class="ostrze-atmo-strip">
          <span class="ostrze-atmo-pill is-time">${this.escape(atmo.timeLabel)} · ${this.escape(atmo.clockText)}</span>
          ${phenomPillHtml}
          ${effectPillsHtml}
        </div>
        ${
          this.hubCollapsed
            ? ''
            : `
              <div class="ostrze-hub-meta">${this.escape(this.hubPanel.statusLine)}</div>
              <div class="ostrze-hub-quests">${this.escape(this.hubPanel.questsLine)}</div>
              ${btns ? `<div class="ostrze-hub-actions">${btns}</div>` : ''}
            `
        }
      </div>
    `;

    this.hubRoot.querySelector('[data-hub-toggle]')?.addEventListener('click', () => {
      this.hubCollapsed = !this.hubCollapsed;
      this.renderHubPanel();
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

    const buyRows = (shop?.stock ?? [])
      .map((entry) => {
        const item = this.data.items.find((i) => i.id === entry.id);
        const boughtKey = `${shopId}:${entry.id}`;
        const remainingQty = Math.max(0, entry.qty - (this.shopBoughtCounts.get(boughtKey) ?? 0));
        const price = this.getShopPrice(item?.value ?? 10, shopId);
        const canBuy = money >= price && remainingQty > 0;
        const desc = item?.description
          ? `<div class="ostrze-shop-desc">${this.escape(item.description)}</div>`
          : '';
        return `
          <div class="ostrze-row">
            <div style="flex:1;min-width:0;">
              <strong>${this.escape(item?.name ?? entry.id)}</strong>
              <span class="ostrze-shop-qty"> (szt: ${remainingQty})</span>
              ${desc}
            </div>
            <button class="ostrze-btn ostrze-shop-btn" data-buy="${this.escape(entry.id)}" ${canBuy ? '' : 'disabled'}>
              Kup (${price} gr)
            </button>
          </div>
        `;
      })
      .join('');

    const sellRows = this.state.inventory.items
      .map((entry) => {
        const item = this.data.items.find((i) => i.id === entry.id);
        const check = canSellItemToShop(entry.id, shopId, this.state, this.data);
        return `
          <div class="ostrze-row">
            <div style="flex:1;min-width:0;">
              <strong>${this.escape(item?.name ?? entry.id)}</strong>
              <span class="ostrze-shop-qty"> ×${entry.qty}</span>
            </div>
            ${
              check.ok
                ? `<button class="ostrze-hub-btn" data-sell="${this.escape(entry.id)}">Sprzedaj (+${check.price} gr)</button>`
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

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card ostrze-shop-card">
          <div class="ostrze-shop-header">
            ${portraitHtml}
            <div style="flex:1;min-width:0;">
              <h2 class="ostrze-title" style="margin-bottom:4px;">${this.escape(shop?.name ?? 'Kram')}</h2>
              <div class="ostrze-shop-meta">
                <span class="ostrze-purse-pill">🪙 Sakiewka: <strong>${money} gr</strong></span>
                <span class="ostrze-shop-tag">Handel: ${handel}%</span>
              </div>
            </div>
          </div>

          <div class="ostrze-shop-grid">
            <div class="ostrze-panel ostrze-shop-col">
              <h3>Towar kramarza</h3>
              ${buyRows || '<p class="ostrze-subtitle">Brak towaru.</p>'}
            </div>
            <div class="ostrze-panel ostrze-shop-col">
              <h3>Twój plecak (sprzedaż)</h3>
              ${sellRows || '<p class="ostrze-subtitle">Pusty plecak.</p>'}
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;margin-top:14px;">
            <button class="ostrze-btn" data-action="shop-close">Zamknij kram [ESC]</button>
          </div>
        </div>
      </div>
    `;

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

    this.root.querySelector('[data-action="shop-close"]')?.addEventListener('click', () => {
      const cb = this.activeShop?.onClosed;
      this.activeShop = null;
      this.render();
      cb?.();
    });
  }

  private renderNarrative(card: NarrativeCardData): void {
    const artMeta = getPixArtMeta(card.artId);
    const artHtml = artMeta
      ? `
        <div class="ostrze-narrative-art-frame">
          <img
            class="ostrze-narrative-art ostrze-pix-art"
            src="${this.escape(artMeta.dataUri)}"
            width="${artMeta.width}"
            height="${artMeta.height}"
            alt="${this.escape(card.title)}"
          />
        </div>
      `
      : '';

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card ostrze-narrative-card">
          <h2 class="ostrze-title">${this.escape(card.title)}</h2>
          ${card.subtitle ? `<p class="ostrze-subtitle">${this.escape(card.subtitle)}</p>` : ''}
          ${artHtml}
          <div class="ostrze-prose">${this.escape(card.text)}</div>
          <div class="ostrze-narrative-footer">
            <button class="ostrze-btn" data-action="narrative-next">
              ${this.escape(card.buttonLabel ?? 'Dalej')}
            </button>
            <span class="ostrze-shortcut-hint">Enter / Spacja</span>
          </div>
        </div>
      </div>
    `;
    this.root
      .querySelector('[data-action="narrative-next"]')
      ?.addEventListener('click', () => {
        const cb = card.onContinue;
        this.activeNarrative = null;
        this.render();
        cb();
      });
  }

  private renderCreator(): void {
    const draft = {
      name: this.draftName,
      classId: this.draftClass,
      attrs: this.draftAttrs,
      tagged: this.draftTagged,
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
        this.creatorError = draft.error;
        this.render();
      },
      onComplete: () => {
        this.draftName = draft.name;
        this.draftClass = draft.classId;
        this.draftAttrs = draft.attrs;
        this.draftTagged = draft.tagged;
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
      onSelectTab: (tab) => {
        this.activeCharacterTab = tab;
        this.render();
      },
      onUpdated: () => {
        this.activeCharacterSheet?.onUpdated?.();
      },
      onShowToast: (text, tone) => this.showToast(text, tone),
      onRerender: () => this.render(),
      onClose: () => {
        const cb = this.activeCharacterSheet?.onUpdated;
        this.activeCharacterSheet = null;
        this.render();
        cb?.();
      }
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
              <span class="ostrze-notice-title">${this.escape(entry.title)}</span>
              <span class="ostrze-check-badge">${this.escape(entry.reward)}</span>
            </div>
            <div class="ostrze-subtitle" style="margin-bottom:6px">${this.escape(entry.author)}</div>
            <div class="ostrze-prose" style="font-size:0.92rem;margin-bottom:10px">${this.escape(entry.body)}</div>
            ${
              entry.actionLabel
                ? `<button class="ostrze-hub-btn" data-nb-act="${this.escape(entry.id)}" ${entry.actionDisabled ? 'disabled' : ''}>${this.escape(entry.actionLabel)}</button>`
                : ''
            }
          </div>
        `
      )
      .join('');

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card">
          <h2 class="ostrze-title">Tablica Zleceń — Wilczy Bród</h2>
          <p class="ostrze-subtitle">Ogłoszenia strażnicy, kontrakty łowieckie i wieści z pogórza.</p>
          ${cardsHtml}
          <div style="display:flex;justify-content:flex-end;margin-top:12px">
            <button class="ostrze-btn" id="ostrze-nb-close">Odejdź od tablicy [ESC]</button>
          </div>
        </div>
      </div>
    `;

    board.entries.forEach((entry) => {
      if (entry.actionLabel && entry.onAction) {
        this.root.querySelector(`[data-nb-act="${entry.id}"]`)?.addEventListener('click', () => {
          entry.onAction?.();
        });
      }
    });

    this.root.querySelector('#ostrze-nb-close')?.addEventListener('click', () => {
      const cb = board.onClosed;
      this.activeNoticeBoard = null;
      this.activeTravel = null;
      this.render();
      cb?.();
    });
  }

  private renderWelcome(welcome: WelcomeScreenData): void {
    const heroBanner = getPixArtMeta('wstep_gwiazdy');
    const bannerHtml = heroBanner
      ? `
        <div class="ostrze-welcome-art-frame">
          <img
            class="ostrze-narrative-art ostrze-pix-art"
            src="${this.escape(heroBanner.dataUri)}"
            width="${heroBanner.width}"
            height="${heroBanner.height}"
            alt="Voided — Na przekór gwiazdom"
          />
        </div>
      `
      : '';

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card ostrze-welcome-card">
          ${bannerHtml}
          <h1 class="ostrze-welcome-title">VOIDED</h1>
          <p class="ostrze-welcome-subtitle">Na przekór gwiazdom</p>

          <form class="ostrze-welcome-form" id="ostrze-welcome-form">
            <input
              id="ostrze-welcome-name"
              class="ostrze-welcome-input"
              type="text"
              maxlength="${this.data.rules.creator.nameMax}"
              placeholder="Wpisz imię"
              value="${this.escape(this.draftName)}"
              autocomplete="off"
            />
            <button type="submit" class="ostrze-btn" style="width:100%;font-size:1.05rem;">
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
                ? `<button type="button" class="ostrze-hub-btn" id="ostrze-welcome-key">🔑 Klucz rozgrywki</button>`
                : ''
            }
          </div>

          <div class="ostrze-welcome-credits">
            <div>Pomysł świata i gry: Twiist</div>
            <div>Jest to port gry terminalowej typu HUD na silnik 2,5D.</div>
            <div>Fabuła, dialogi etc.: Twiist</div>
            <div>Silnik gry, port i wykonanie: Ulfgaros</div>
          </div>
        </div>
      </div>
    `;

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
      this.render();
      welcome.onStartNew(finalName);
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

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card" style="max-width:600px;">
          <h2 class="ostrze-title">Klucz rozgrywki</h2>
          <p class="ostrze-subtitle">
            Zapis lokalny działa w tej przeglądarce. Aby przenieść postęp na inny komputer lub przeglądarkę, skopiuj poniższy klucz lub wklej otrzymany klucz i kliknij „Wczytaj z klucza”.
          </p>
          ${
            modal.currentKey
              ? `
                <div style="margin-bottom:14px;">
                  <div class="ostrze-subtitle" style="margin-bottom:6px;">Twój aktualny klucz zapisu:</div>
                  <textarea class="ostrze-key-textarea" id="ostrze-key-export" readonly>${this.escape(modal.currentKey)}</textarea>
                  <button type="button" class="ostrze-hub-btn" id="ostrze-key-copy">Kopiuj klucz</button>
                </div>
              `
              : ''
          }
          <div>
            <div class="ostrze-subtitle" style="margin-bottom:6px;">Wklej klucz rozgrywki do wczytania:</div>
            <textarea class="ostrze-key-textarea" id="ostrze-key-import" placeholder="OSTRZE1:..."></textarea>
            <div id="ostrze-key-err" class="ostrze-error" style="display:none;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;gap:10px;margin-top:8px;">
            <button type="button" class="ostrze-btn" id="ostrze-key-load">Wczytaj z klucza</button>
            <button type="button" class="ostrze-hub-btn" id="ostrze-key-close">Zamknij [ESC]</button>
          </div>
        </div>
      </div>
    `;

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

    this.root.querySelector('#ostrze-key-close')?.addEventListener('click', () => {
      const cb = modal.onClosed;
      this.activeSaveKey = null;
      this.render();
      cb?.();
    });
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
}
