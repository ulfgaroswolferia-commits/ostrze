import { getSlavicPortrait } from '@ulf/assets/slavicPortraits';
import {
  getPixArtMeta,
  resolvePixPortraitId,
  resolveSpeakerRole
} from '../assets/pixArt';
import { ostrzeAudio } from '../audio/ostrzeAudio';
import {
  CAMP_RECIPES,
  canPerformCampRecipe
} from '../rules/campCrafting';
import {
  isQuickBeltEligible,
  pinItemToQuickBelt
} from '../rules/combatConsumables';
import { getWorldAtmosphere } from '../rules/worldCycle';
import type {
  AttributeId,
  ClassId,
  OriginGameData,
  OstrzeGameState,
  SkillId
} from '../data/originTypes';
import {
  createCharacter,
  getAvailablePerks,
  pickPerk,
  spendAttributePoint,
  spendSkillPoint,
  xpRequiredForLevel
} from '../rules/character';
import type { SeededRng } from '../rules/dice';
import {
  ActiveOstrzeDialogue,
  chooseOstrzeDialogueOption,
  getOstrzeDialogueView
} from '../rules/dialogueEngine';
import {
  canSellItemToShop,
  getShopBuyPrice,
  getShopMerchantPortraitId,
  sellInventoryItemToShop
} from '../rules/shopEconomy';
import { getStats } from '../rules/stats';

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

export class OstrzeModalUi {
  private readonly root: HTMLElement;
  private readonly hubRoot: HTMLElement;
  private readonly toastRoot: HTMLElement;
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
  private activeCharacterTab: 'stats' | 'gear' | 'journal' = 'stats';
  private activeNoticeBoard: { entries: NoticeBoardEntry[]; onClosed?: () => void } | null = null;
  private activeTravel: {
    destinations: TravelDestinationEntry[];
    onSelect: (id: string) => void;
    onClosed?: () => void;
  } | null = null;
  private hubPanel: HubPanelData | null = null;
  private hubCollapsed = false;
  private isCombatActiveFn: (() => boolean) | null = null;
  private activeCampfire: {
    onPerform: (recipeId: string) => { ok: boolean; message: string };
    onWaitHour?: (hour: number) => void;
    onClosed?: () => void;
  } | null = null;
  private activePauseMenu: {
    hasSave: boolean;
    isMuted: boolean;
    onSave: () => void;
    onLoad: () => void;
    onOpenKey: () => void;
    onToggleMute: () => boolean;
    onNewGame: () => void;
    onClosed?: () => void;
  } | null = null;
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
    this.data = data;
    this.state = state;
    this.rng = rng;

    this.root = document.createElement('div');
    this.root.id = 'ostrze-overlay-root';
    document.body.appendChild(this.root);

    this.hubRoot = document.createElement('div');
    this.hubRoot.id = 'ostrze-hub-root';
    document.body.appendChild(this.hubRoot);

    this.toastRoot = document.createElement('div');
    this.toastRoot.id = 'ostrze-toast-root';
    this.toastRoot.className = 'ostrze-toast-stack';
    document.body.appendChild(this.toastRoot);

    this.draftAttrs = this.buildInitialCreatorAttrs();

    window.addEventListener('keydown', (e) => {
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
    });
  }

  private buildInitialCreatorAttrs(): Record<AttributeId, number> {
    const c = this.data.rules.creator;
    return {
      sila: c.attributeStart + (c.gifts.sila ?? 0),
      zrecznosc: c.attributeStart + (c.gifts.zrecznosc ?? 0),
      krzepa: c.attributeStart + (c.gifts.krzepa ?? 0),
      bystrosc: c.attributeStart + (c.gifts.bystrosc ?? 0),
      rozum: c.attributeStart + (c.gifts.rozum ?? 0),
      oglada: c.attributeStart + (c.gifts.oglada ?? 0),
      fart: c.attributeStart + (c.gifts.fart ?? 0)
    };
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
    initialTab?: 'stats' | 'gear' | 'journal'
  ): void {
    // Toggle off if already open on the same tab via hotkey
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

  public showPauseMenu(opts: {
    hasSave: boolean;
    isMuted: boolean;
    onSave: () => void;
    onLoad: () => void;
    onOpenKey: () => void;
    onToggleMute: () => boolean;
    onNewGame: () => void;
    onClosed?: () => void;
  }): void {
    this.activePauseMenu = opts;
    this.render();
  }

  public showNoticeBoard(entries: NoticeBoardEntry[], onClosed?: () => void): void {
    this.activeNoticeBoard = { entries, onClosed };
    this.render();
  }

  public showTravelModal(
    destinations: TravelDestinationEntry[],
    onSelect: (id: string) => void,
    onClosed?: () => void
  ): void {
    this.activeTravel = { destinations, onSelect, onClosed };
    this.render();
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

  private getRemainingAttrPoints(): number {
    const c = this.data.rules.creator;
    const basePool =
      this.data.attributes.length * c.attributeStart +
      c.points +
      Object.values(c.gifts).reduce((s, v) => s + (v ?? 0), 0);
    const spent = Object.values(this.draftAttrs).reduce((s, v) => s + v, 0);
    return basePool - spent;
  }

  public render(): void {
    this.renderHubPanel();
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
    const prevScrollTop = this.root.querySelector<HTMLElement>('.ostrze-creator-card')?.scrollTop ?? 0;
    const c = this.data.rules.creator;
    const remaining = this.getRemainingAttrPoints();
    const cls = this.data.classes.find((cl) => cl.id === this.draftClass)!;

    // Preview skills using creator formula
    const skillRows = this.data.skills
      .map((sk) => {
        const isLocked = sk.id === cls.taggedSkill;
        const isTagged = this.draftTagged.includes(sk.id);
        const val =
          this.data.rules.skills.primaryMult * this.draftAttrs[sk.primary] +
          this.data.rules.skills.secondaryMult * this.draftAttrs[sk.secondary] +
          (isTagged ? c.taggedBonus : 0);

        return `
          <div class="ostrze-skill-tag ${isTagged ? 'tagged' : ''} ${isLocked ? 'locked' : ''}" data-skill="${sk.id}" title="${this.escape(sk.name)}${isLocked ? ' — umiejętność klasowa' : ''}">
            <span class="ostrze-skill-name">${this.escape(sk.name)} ${isLocked ? '★' : isTagged ? '★' : ''}</span>
            <strong>${val}%</strong>
          </div>
        `;
      })
      .join('');

    const attrRows = this.data.attributes
      .map((attr) => {
        const gift = c.gifts[attr.id] ?? 0;
        const min = c.attributeMin + gift;
        const max = c.attributeMax + gift;
        const val = this.draftAttrs[attr.id];
        return `
          <div class="ostrze-row ostrze-creator-attr-row">
            <div class="ostrze-attr-meta">
              <strong>${this.escape(attr.name)}</strong>
              <span class="ostrze-attr-desc">${this.escape(attr.description)}</span>
            </div>
            <div class="ostrze-stepper">
              <button type="button" class="ostrze-step-btn" data-attr-dec="${attr.id}" ${val <= min ? 'disabled' : ''}>-</button>
              <strong style="min-width:20px;text-align:center">${val}</strong>
              <button type="button" class="ostrze-step-btn" data-attr-inc="${attr.id}" ${val >= max || remaining <= 0 ? 'disabled' : ''}>+</button>
            </div>
          </div>
        `;
      })
      .join('');

    const classButtons = this.data.classes
      .map(
        (cl) => `
          <button type="button" class="ostrze-class-btn ostrze-creator-class-btn ${cl.id === this.draftClass ? 'active' : ''}" data-class="${cl.id}" title="${this.escape(cl.description)}">
            <strong>${this.escape(cl.name)}</strong>
            <div class="ostrze-creator-class-desc">${this.escape(cl.description)}</div>
          </button>
        `
      )
      .join('');

    const computeStatus = (nameVal: string): { canSubmit: boolean; hint: string } => {
      const missingAttrs = remaining > 0;
      const missingTags = c.taggedCount - this.draftTagged.length;
      const shortName = nameVal.trim().length < c.nameMin;
      const parts: string[] = [];
      if (missingAttrs) parts.push(`rozdaj wszystkie punkty atrybutów (zostało: ${remaining})`);
      if (missingTags > 0) parts.push(`oznacz jeszcze ${missingTags} umiej.`);
      if (shortName) parts.push(`wpisz imię (min. ${c.nameMin} zn.)`);
      return {
        canSubmit: !missingAttrs && missingTags === 0 && !shortName,
        hint: parts.length > 0 ? `Aby wejść do gry: ${parts.join(' · ')}.` : '✓ Postać gotowa do drogi.'
      };
    };

    const initialStatus = computeStatus(this.draftName);

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card ostrze-creator-card">
          <div class="ostrze-creator-header">
            <h2 class="ostrze-title">Kreator Adepta — Szkoła Ostrzy w Brzezinie</h2>
            <p class="ostrze-subtitle">Rozdziel <strong>${c.points} pkt</strong> atrybutów (zostało: <strong class="ostrze-creator-rem ${remaining === 0 ? 'done' : ''}">${remaining}</strong>) oraz wybierz <strong>${c.taggedCount}</strong> umiejętności oznaczone (+${c.taggedBonus}%).</p>
          </div>
          ${this.creatorError ? `<div class="ostrze-error">${this.escape(this.creatorError)}</div>` : ''}
          <div class="ostrze-creator-top">
            <div class="ostrze-creator-name-box">
              <label for="ostrze-name-input">Imię bohatera</label>
              <input class="ostrze-input" id="ostrze-name-input" maxlength="${c.nameMax}" value="${this.escape(this.draftName)}" placeholder="Imię bohatera" />
            </div>
            <div class="ostrze-creator-classes">
              ${classButtons}
            </div>
          </div>
          <div class="ostrze-creator-grid">
            <div class="ostrze-panel">
              <h3>Atrybuty <span class="ostrze-panel-badge ${remaining === 0 ? 'done' : ''}">zostało: ${remaining}</span></h3>
              ${attrRows}
            </div>
            <div class="ostrze-panel">
              <h3>Umiejętności <span class="ostrze-panel-badge ${this.draftTagged.length === c.taggedCount ? 'done' : ''}">${this.draftTagged.length}/${c.taggedCount} oznaczone</span></h3>
              <div class="ostrze-skills-grid">
                ${skillRows}
              </div>
            </div>
          </div>
          <div class="ostrze-creator-footer">
            <div class="ostrze-creator-status ${initialStatus.canSubmit ? 'ready' : ''}" id="ostrze-creator-status">${this.escape(initialStatus.hint)}</div>
            <button type="button" class="ostrze-btn ostrze-creator-submit" data-action="creator-submit" ${initialStatus.canSubmit ? '' : 'disabled'}>
              Wejdź do gry
            </button>
          </div>
        </div>
      </div>
    `;

    const cardEl = this.root.querySelector<HTMLElement>('.ostrze-creator-card');
    if (cardEl && prevScrollTop > 0) {
      cardEl.scrollTop = prevScrollTop;
    }

    const nameInput = this.root.querySelector<HTMLInputElement>('#ostrze-name-input');
    const submitBtn = this.root.querySelector<HTMLButtonElement>('[data-action="creator-submit"]');
    const statusEl = this.root.querySelector<HTMLElement>('#ostrze-creator-status');
    nameInput?.addEventListener('input', () => {
      this.draftName = nameInput.value;
      const next = computeStatus(this.draftName);
      if (submitBtn) submitBtn.disabled = !next.canSubmit;
      if (statusEl) {
        statusEl.textContent = next.hint;
        statusEl.classList.toggle('ready', next.canSubmit);
      }
    });

    this.root.querySelectorAll<HTMLElement>('[data-class]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextClass = btn.dataset.class as ClassId;
        this.draftClass = nextClass;
        const nextClsDef = this.data.classes.find((cItem) => cItem.id === nextClass)!;
        if (!this.draftTagged.includes(nextClsDef.taggedSkill)) {
          this.draftTagged = [nextClsDef.taggedSkill, ...this.draftTagged.slice(0, c.taggedCount - 1)];
        }
        this.render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-attr-inc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.attrInc as AttributeId;
        if (this.getRemainingAttrPoints() > 0) {
          this.draftAttrs[id] += 1;
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-attr-dec]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.attrDec as AttributeId;
        const min = c.attributeMin + (c.gifts[id] ?? 0);
        if (this.draftAttrs[id] > min) {
          this.draftAttrs[id] -= 1;
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-skill]').forEach((el) => {
      el.addEventListener('click', () => {
        const skId = el.dataset.skill as SkillId;
        if (skId === cls.taggedSkill) return;
        if (this.draftTagged.includes(skId)) {
          this.draftTagged = this.draftTagged.filter((id) => id !== skId);
        } else if (this.draftTagged.length < c.taggedCount) {
          this.draftTagged = [...this.draftTagged, skId];
        }
        this.render();
      });
    });

    this.root.querySelector('[data-action="creator-submit"]')?.addEventListener('click', () => {
      try {
        createCharacter(
          this.state,
          {
            name: this.draftName,
            classId: this.draftClass,
            attributes: { ...this.draftAttrs },
            tagged: [...this.draftTagged]
          },
          this.data
        );
        // Ensure derived stats compute cleanly
        getStats(this.state, this.data);
        const cb = this.onCreatorComplete;
        this.creatorOpen = false;
        this.render();
        cb?.();
      } catch (err) {
        this.creatorError = err instanceof Error ? err.message : String(err);
        this.render();
      }
    });
  }

  private resolvePortraitId(speaker: string): string {
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

  private renderDialogue(session: ActiveOstrzeDialogue): void {
    const view = getOstrzeDialogueView(session, this.state, this.data);
    const pixPortraitId = resolvePixPortraitId(view.portrait, view.speaker);
    const pixMeta = pixPortraitId ? getPixArtMeta(pixPortraitId) : null;
    const isPanoramicScene = Boolean(pixMeta && pixMeta.width > pixMeta.height);
    const isPixPortrait = Boolean(pixMeta);
    const portraitUrl = pixMeta?.dataUri ?? getSlavicPortrait(this.resolvePortraitId(view.speaker));
    const speakerRole = resolveSpeakerRole(view.speaker);

    const optionsHtml = view.options
      .map((item, displayIdx) => {
        const shortcutNum = displayIdx < 9 ? displayIdx + 1 : null;
        const badges: string[] = [];

        if (item.checkLabel) {
          if (item.alreadyFailed) {
            badges.push(
              `<span class="ostrze-check-badge ostrze-check-badge--failed">${this.escape(item.checkLabel)} · Nieudany</span>`
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
              `<span class="ostrze-check-badge ${tier}">${this.escape(item.checkLabel)} · ${chance}%</span>`
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
              <span class="ostrze-dialogue-opt-text">${this.escape(item.option.text)}</span>
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
      ? `<div class="${feedbackClass}">${this.escape(view.lastCheckFeedback)}</div>`
      : '';

    this.root.innerHTML = isPanoramicScene && pixMeta
      ? `
      <div class="ostrze-overlay">
        <div class="ostrze-card ostrze-dialogue-card ostrze-dialogue-card--scene">
          <h2 class="ostrze-title" style="margin-bottom:12px;">${this.escape(view.speaker)}</h2>
          <div class="ostrze-narrative-art-frame">
            <img
              class="ostrze-narrative-art ostrze-pix-art"
              src="${this.escape(pixMeta.dataUri)}"
              width="${pixMeta.width}"
              height="${pixMeta.height}"
              alt="${this.escape(view.speaker)}"
            />
          </div>
          ${feedbackHtml}
          <div class="ostrze-prose ostrze-dialogue-prose">${this.escape(view.text)}</div>
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
                  src="${this.escape(portraitUrl)}"
                  alt="${this.escape(view.speaker)}"
                />
              </div>
              <h2 class="ostrze-dialogue-speaker">${this.escape(view.speaker)}</h2>
              ${speakerRole ? `<div class="ostrze-dialogue-role">${this.escape(speakerRole)}</div>` : ''}
            </aside>
            <div class="ostrze-dialogue-body-col">
              ${feedbackHtml}
              <div class="ostrze-prose ostrze-dialogue-prose">${this.escape(view.text)}</div>
              <div class="ostrze-dialogue-options">${optionsHtml}</div>
              <div class="ostrze-dialogue-hint">Skróty klawiszowe: [1–9] wybierz odpowiedź</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.root.querySelectorAll<HTMLElement>('[data-opt-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.optIdx);
        const next = chooseOstrzeDialogueOption(
          session,
          idx,
          this.state,
          this.data,
          this.rng
        );

        if (next?.lastCheckFeedback) {
          ostrzeAudio.playDialogueCheck(next.lastCheckOutcome === 'success');
        } else {
          ostrzeAudio.playUiClick();
        }
        if (next?.pendingShopId && this.onOpenShop) {
          this.onOpenShop(next.pendingShopId);
        }

        if (!next) {
          const cb = this.onDialogueClosed;
          this.activeDialogue = null;
          this.render();
          cb?.();
        } else {
          this.activeDialogue = next;
          this.render();
        }
      });
    });
  }

  private renderCharacterSheet(): void {
    const ch = this.state.character;
    if (!ch) {
      this.activeCharacterSheet = null;
      this.render();
      return;
    }

    const stats = getStats(this.state, this.data);
    const cls = this.data.classes.find((c) => c.id === ch.classId);
    const curFloorXp = xpRequiredForLevel(ch.level, this.data.rules.leveling.xpStep);
    const nextLvXp = xpRequiredForLevel(ch.level + 1, this.data.rules.leveling.xpStep);
    const xpSpan = Math.max(1, nextLvXp - curFloorXp);
    const xpPct = Math.min(100, Math.max(0, Math.round(((ch.xp - curFloorXp) / xpSpan) * 100)));

    const attrMaxBase = this.data.rules.creator.attributeMax;
    const attrsHtml = this.data.attributes
      .map((attr) => {
        const val = stats.permanentAttributes[attr.id];
        const max = attrMaxBase + (this.data.rules.creator.gifts[attr.id] ?? 0);
        const canAdd = ch.freeAttributePoints > 0 && ch.attributes[attr.id] < max;
        return `
          <div class="ostrze-row">
            <span>${this.escape(attr.name)}</span>
            <span class="ostrze-stepper">
              <strong>${val}</strong>
              ${canAdd ? `<button class="ostrze-step-btn" data-cs-attr="${attr.id}">+</button>` : ''}
            </span>
          </div>
        `;
      })
      .join('');

    const skillsHtml = this.data.skills
      .map((sk) => {
        const val = stats.skills[sk.id];
        const isTagged = ch.tagged.includes(sk.id);
        const canAdd = ch.freeSkillPoints > 0 && val < 100;
        return `
          <div class="ostrze-row">
            <span>${this.escape(sk.name)}${isTagged ? ' ★' : ''}</span>
            <span class="ostrze-stepper">
              <strong>${val}%</strong>
              ${canAdd ? `<button class="ostrze-step-btn" data-cs-skill="${sk.id}">+</button>` : ''}
            </span>
          </div>
        `;
      })
      .join('');

    const availablePerks = getAvailablePerks(this.state, this.data);
    const pickedPerksHtml =
      ch.perks.length > 0
        ? ch.perks
            .map((id) => {
              const p = this.data.perks.find((x) => x.id === id);
              return `<div class="ostrze-row"><span><strong>${this.escape(p?.name ?? id)}</strong></span><span>✓</span></div>`;
            })
            .join('')
        : '<div class="ostrze-subtitle" style="margin-bottom:0">Brak wybranych talentów.</div>';

    const perkChoicesHtml =
      ch.freePerkPicks > 0
        ? availablePerks
            .map(
              (p) => `
              <div class="ostrze-notice-card">
                <div class="ostrze-notice-head">
                  <span class="ostrze-notice-title">${this.escape(p.name)}</span>
                  <button class="ostrze-hub-btn is-alert" data-cs-perk="${this.escape(p.id)}">Wybierz talent</button>
                </div>
                <div class="ostrze-subtitle" style="margin-bottom:0">${this.escape(p.description ?? '')}</div>
              </div>
            `
            )
            .join('')
        : '';

    const itemsHtml =
      this.state.inventory.items.length > 0
        ? this.state.inventory.items
            .map((entry) => {
              const item = this.data.items.find((i) => i.id === entry.id);
              const equipSlot = item?.slot ?? (item?.type === 'weapon' ? 'bron' : undefined);
              const isEquipped = Boolean(equipSlot && this.state.inventory.equipped[equipSlot] === entry.id);
              const canEquip = Boolean(equipSlot) && !isEquipped;
              const healRange = item?.heal;
              const healFlat = item?.healHp;
              const canRemoveEffect = Boolean(
                item?.removes?.some((effId) => ch.effects.some((e) => e.id === effId))
              );
              const hasHeal =
                (Array.isArray(healRange) && healRange[1] > 0) ||
                (typeof healFlat === 'number' && healFlat > 0);
              const canUse =
                (hasHeal && ch.hp < stats.derived.hpMax) || canRemoveEffect;
              const useLabel = Array.isArray(healRange)
                ? healRange[0] === healRange[1]
                  ? `Użyj (+${healRange[0]} HP)`
                  : `Użyj (+${healRange[0]}–${healRange[1]} HP)`
                : typeof healFlat === 'number' && healFlat > 0
                  ? `Użyj (+${healFlat} HP)`
                  : 'Użyj';
              const beltEligible = isQuickBeltEligible(item);
              const pinnedSlotIdx = (this.state.inventory.quickBelt ?? []).indexOf(entry.id);
              const beltPinHtml = beltEligible
                ? pinnedSlotIdx >= 0
                  ? `<button class="ostrze-hub-btn" data-cs-belt-unpin="${pinnedSlotIdx}" title="Odepnij z pasa szybkiego użycia">Pas [${pinnedSlotIdx + 4}] ✕</button>`
                  : `<select class="ostrze-belt-select" data-cs-belt-pin="${this.escape(entry.id)}" title="Przypnij do slotu pasa walki [4]–[7]">
                      <option value="">+ Pas…</option>
                      <option value="0">Slot [4]</option>
                      <option value="1">Slot [5]</option>
                      <option value="2">Slot [6]</option>
                      <option value="3">Slot [7]</option>
                    </select>`
                : '';
              return `
                <div class="ostrze-row">
                  <span>
                    ${this.escape(item?.name ?? entry.id)} ×${entry.qty}
                    ${isEquipped ? '<span style="color:#6fd18e;font-size:0.75rem"> [Założono]</span>' : ''}
                    ${pinnedSlotIdx >= 0 ? `<span style="color:#e5b869;font-size:0.75rem"> [Pas ${pinnedSlotIdx + 4}]</span>` : ''}
                  </span>
                  <span class="ostrze-stepper">
                    ${beltPinHtml}
                    ${canEquip ? `<button class="ostrze-hub-btn" data-cs-equip="${this.escape(entry.id)}">Załóż</button>` : ''}
                    ${canUse ? `<button class="ostrze-hub-btn" data-cs-use="${this.escape(entry.id)}">${useLabel}</button>` : ''}
                  </span>
                </div>
              `;
            })
            .join('')
        : '<div class="ostrze-subtitle" style="margin-bottom:0">Pusty plecak.</div>';

    const pendingPts = ch.freeAttributePoints + ch.freeSkillPoints + ch.freePerkPicks;
    const hpMax = Math.max(1, stats.derived.hpMax);
    const hpPct = Math.min(100, Math.max(0, Math.round((ch.hp / hpMax) * 100)));
    const wola = this.state.vars.wola ?? 0;
    const dlug = this.state.vars.dlug ?? 0;

    // Equipped summary for Gear tab
    const equippedEntries = Object.entries(this.state.inventory.equipped).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].length > 0
    );
    const equippedHtml =
      equippedEntries.length > 0
        ? equippedEntries
            .map(([slot, itemId]) => {
              const item = this.data.items.find((i) => i.id === itemId);
              return `<div class="ostrze-row"><span style="text-transform:capitalize;color:#9e9689">${this.escape(slot)}</span><strong>${this.escape(item?.name ?? itemId)}</strong></div>`;
            })
            .join('')
        : '<div class="ostrze-subtitle" style="margin-bottom:0">Brak założonego ekwipunku.</div>';

    // Journal & Brzezina Keepsakes for Tab 3
    const questEntries = Object.entries(this.state.quests).filter(([, st]) => st && st !== 'none');
    const activeQuests = questEntries.filter(([, st]) => st === 'active');
    const doneQuests = questEntries.filter(([, st]) => st === 'completed');

    const renderQuestList = (list: Array<[string, string]>, emptyMsg: string): string => {
      if (list.length === 0) return `<div class="ostrze-subtitle" style="margin-bottom:0">${emptyMsg}</div>`;
      return list
        .map(([qId, status]) => {
          const def = this.data.quests.find((q) => q.id === qId);
          return `
            <div class="ostrze-row">
              <div>
                <strong>${this.escape(def?.name ?? qId)}</strong>
                ${def?.description ? `<div class="ostrze-shop-desc">${this.escape(def.description)}</div>` : ''}
              </div>
              <span class="ostrze-shop-tag">${status === 'completed' ? '✓ Ukończone' : 'Aktywne'}</span>
            </div>
          `;
        })
        .join('');
    };

    const keepsakeDefs: Array<{
      id: string;
      owner: string;
      echoFlag: string;
      honoredText: string;
      pendingText: string;
    }> = [
      {
        id: 'kosc_skarimira',
        owner: 'Skarimir',
        echoFlag: 'echo_skarimir_kosc',
        honoredText: 'Uczczony rzutem kością w karczmie Wilczego Brodu.',
        pendingText: 'Czeka na ostatni rzut w karczmie „Pod Wilczym Kłem”.'
      },
      {
        id: 'miedziak_ragnoslawy',
        owner: 'Ragnosława',
        echoFlag: 'echo_ragnoslawa_toast',
        honoredText: 'Zakład spełniony — piwo postawione w Wilczym Brodzie.',
        pendingText: 'Zastaw za pierwsze piwo w karczmie Wilczego Brodu.'
      },
      {
        id: 'list_wojmira',
        owner: 'Wojmir Cienki',
        echoFlag: 'echo_wojmir_list',
        honoredText: this.state.flags.echo_wojmir_list_wyslany
          ? 'Przekazany Wrzoskowi dla gońca do Brzeziny.'
          : 'Zachowany przy sercu jako pamiątka.',
        pendingText: 'Zapieczętowany list do matki — do przekazania lub zachowania w karczmie.'
      }
    ];

    const keepsakesHtml = keepsakeDefs
      .filter((k) => {
        const hasItem = this.state.inventory.items.some((i) => i.id === k.id && i.qty > 0);
        return hasItem || Boolean(this.state.flags[k.echoFlag]);
      })
      .map((k) => {
        const item = this.data.items.find((i) => i.id === k.id);
        const honored = Boolean(this.state.flags[k.echoFlag]);
        return `
          <div class="ostrze-keepsake-card">
            <div class="ostrze-notice-head">
              <span class="ostrze-notice-title">🕯️ ${this.escape(item?.name ?? k.owner)}</span>
              <span class="ostrze-shop-tag">${honored ? '✓ Uczczono' : 'Pamiątka'}</span>
            </div>
            <div class="ostrze-shop-desc">${this.escape(honored ? k.honoredText : k.pendingText)}</div>
          </div>
        `;
      })
      .join('');

    const tabContentHtml =
      this.activeCharacterTab === 'stats'
        ? `
          ${
            pendingPts > 0
              ? `<div class="ostrze-feedback">Punkty do wydania — Cechy: ${ch.freeAttributePoints} · Umiejętności: ${ch.freeSkillPoints} · Talenty: ${ch.freePerkPicks}</div>`
              : ''
          }
          <div class="ostrze-creator-grid">
            <div class="ostrze-panel">
              <h3>Atrybuty ${ch.freeAttributePoints > 0 ? `(wolne: ${ch.freeAttributePoints})` : ''}</h3>
              ${attrsHtml}
              <h3 style="margin-top:14px">Pochodne bojowe</h3>
              <div class="ostrze-row"><span>Pancerz / Obrona</span><strong>${stats.derived.armor} / ${stats.derived.defense}</strong></div>
              <div class="ostrze-row"><span>Trafienie (wręcz / dyst.)</span><strong>+${stats.derived.meleeHitChance}% / +${stats.derived.rangedHitChance}%</strong></div>
              <div class="ostrze-row"><span>Krytyk / Inicjatywa</span><strong>${stats.derived.critChance}% / ${stats.derived.initiative}</strong></div>
            </div>
            <div class="ostrze-panel">
              <h3>Umiejętności ${ch.freeSkillPoints > 0 ? `(wolne: ${ch.freeSkillPoints})` : ''}</h3>
              ${skillsHtml}
            </div>
          </div>
          <div class="ostrze-panel" style="margin-bottom:14px">
            <h3>Talenty (${ch.perks.length}/${this.data.rules.leveling.maxPerks})</h3>
            ${pickedPerksHtml}
          </div>
          ${perkChoicesHtml ? `<div class="ostrze-panel" style="margin-bottom:14px"><h3>Wybierz nowy talent (wolne: ${ch.freePerkPicks})</h3>${perkChoicesHtml}</div>` : ''}
        `
        : this.activeCharacterTab === 'gear'
          ? `
            <div class="ostrze-creator-grid">
              <div class="ostrze-panel">
                <h3>Założony ekwipunek</h3>
                ${equippedHtml}
              </div>
              <div class="ostrze-panel">
                <h3>Plecak i Pas Szybkiego Użycia [4–7]</h3>
                ${itemsHtml}
              </div>
            </div>
          `
          : `
            <div class="ostrze-creator-grid">
              <div class="ostrze-panel">
                <h3>Aktywne zadania (${activeQuests.length})</h3>
                ${renderQuestList(activeQuests, 'Brak aktywnych zadań.')}
                <h3 style="margin-top:14px">Ukończone zadania (${doneQuests.length})</h3>
                ${renderQuestList(doneQuests, 'Brak ukończonych zadań.')}
              </div>
              <div class="ostrze-panel">
                <h3>Pamiątki z Brzeziny</h3>
                ${
                  keepsakesHtml ||
                  '<div class="ostrze-subtitle" style="margin-bottom:0">Nie niesiesz jeszcze żadnych osobistych pamiątek po towarzyszach.</div>'
                }
                <h3 style="margin-top:14px">Poznane lokacje (${this.state.world.knownPlaces.length})</h3>
                <div class="ostrze-shop-desc">${this.escape(this.state.world.knownPlaces.join(', ') || 'Brzezina')}</div>
              </div>
            </div>
          `;

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card ostrze-cs-card">
          <div class="ostrze-cs-header">
            <div>
              <h2 class="ostrze-title" style="margin-bottom:4px">${this.escape(ch.name)} — Poziom ${ch.level}</h2>
              <div class="ostrze-shop-meta">
                <span class="ostrze-shop-tag">${this.escape(cls?.name ?? ch.classId)}</span>
                <span class="ostrze-shop-tag">AP: ${stats.derived.ap}</span>
                <span class="ostrze-shop-tag">Wola: ${wola} · Dług: ${dlug}</span>
                <span class="ostrze-purse-pill">🪙 ${ch.money} gr</span>
              </div>
            </div>
            <div class="ostrze-cs-bars">
              <div class="ostrze-hp-bar">
                <div class="ostrze-hp-fill ${hpPct <= 30 ? 'is-low' : ''}" style="width:${hpPct}%"></div>
                <span class="ostrze-hp-label">${ch.hp} / ${hpMax} HP</span>
              </div>
              <div class="ostrze-xp-bar" title="XP: ${ch.xp} / ${nextLvXp}" style="margin:6px 0 0;">
                <div class="ostrze-xp-fill" style="width:${xpPct}%"></div>
              </div>
            </div>
          </div>

          <div class="ostrze-cs-tabs">
            <button class="ostrze-cs-tab ${this.activeCharacterTab === 'stats' ? 'is-active' : ''}" data-cs-tab="stats">
              Postać i Rozwój ${pendingPts > 0 ? `<span class="ostrze-cs-tab-badge">+${pendingPts}</span>` : ''}
            </button>
            <button class="ostrze-cs-tab ${this.activeCharacterTab === 'gear' ? 'is-active' : ''}" data-cs-tab="gear">
              Ekwipunek i Pas (${this.state.inventory.items.length})
            </button>
            <button class="ostrze-cs-tab ${this.activeCharacterTab === 'journal' ? 'is-active' : ''}" data-cs-tab="journal">
              Dziennik i Pamiątki
            </button>
          </div>

          ${tabContentHtml}

          <div style="display:flex;justify-content:flex-end;margin-top:8px">
            <button class="ostrze-btn" id="ostrze-cs-close">Zamknij [ESC]</button>
          </div>
        </div>
      </div>
    `;

    this.root.querySelectorAll<HTMLElement>('[data-cs-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.dataset.csTab as 'stats' | 'gear' | 'journal' | undefined;
        if (nextTab && nextTab !== this.activeCharacterTab) {
          this.activeCharacterTab = nextTab;
          ostrzeAudio.playUiClick();
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-cs-attr]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const attrId = btn.dataset.csAttr as AttributeId;
        if (spendAttributePoint(this.state, attrId, this.data)) {
          this.activeCharacterSheet?.onUpdated?.();
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-cs-skill]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const skillId = btn.dataset.csSkill as SkillId;
        if (spendSkillPoint(this.state, skillId, this.data)) {
          this.activeCharacterSheet?.onUpdated?.();
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-cs-perk]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const perkId = btn.dataset.csPerk ?? '';
        if (pickPerk(this.state, perkId, this.data)) {
          this.activeCharacterSheet?.onUpdated?.();
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-cs-equip]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.csEquip ?? '';
        const item = this.data.items.find((i) => i.id === itemId);
        const equipSlot = item?.slot ?? (item?.type === 'weapon' ? 'bron' : undefined);
        if (item && equipSlot) {
          this.state.inventory.equipped[equipSlot] = itemId;
          if (this.state.character) {
            const maxHp = getStats(this.state, this.data).derived.hpMax;
            this.state.character.hp = Math.max(1, Math.min(maxHp, this.state.character.hp));
          }
          this.showToast(`Założono: ${item.name}`, 'info');
          this.activeCharacterSheet?.onUpdated?.();
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-cs-use]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.csUse ?? '';
        const item = this.data.items.find((i) => i.id === itemId);
        const invEntry = this.state.inventory.items.find((i) => i.id === itemId);
        if (item && invEntry && invEntry.qty > 0 && this.state.character) {
          const curStats = getStats(this.state, this.data);
          const maxHp = curStats.derived.hpMax;
          let healed = 0;
          if (Array.isArray(item.heal)) {
            const [lo, hi] = item.heal;
            const skillBonus = item.healSkill ? (curStats.skills[item.healSkill] ?? 0) : 0;
            const rawHeal = Math.floor(this.rng.int(lo, hi) * (1 + skillBonus / 100));
            healed = Math.max(0, Math.min(maxHp - this.state.character.hp, rawHeal));
            this.state.character.hp += healed;
          } else if (typeof item.healHp === 'number' && item.healHp > 0) {
            healed = Math.max(0, Math.min(maxHp - this.state.character.hp, item.healHp));
            this.state.character.hp += healed;
          }
          if (Array.isArray(item.removes) && item.removes.length > 0) {
            const removeSet = new Set(item.removes);
            this.state.character.effects = this.state.character.effects.filter(
              (eff) => !removeSet.has(eff.id)
            );
          }
          invEntry.qty -= 1;
          if (invEntry.qty <= 0) {
            this.state.inventory.items = this.state.inventory.items.filter((i) => i.id !== itemId);
          }
          this.showToast(
            healed > 0 ? `Użyto ${item.name} (+${healed} HP)` : `Użyto ${item.name}`,
            'success'
          );
          this.activeCharacterSheet?.onUpdated?.();
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLSelectElement>('[data-cs-belt-pin]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const itemId = sel.dataset.csBeltPin ?? '';
        const slotIdx = Number(sel.value);
        if (itemId && !Number.isNaN(slotIdx)) {
          pinItemToQuickBelt(this.state, slotIdx, itemId);
          this.showToast(`Przypięto do pasa szybkiego użycia [Slot ${slotIdx + 4}].`, 'info');
          this.activeCharacterSheet?.onUpdated?.();
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-cs-belt-unpin]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const slotIdx = Number(btn.dataset.csBeltUnpin);
        if (!Number.isNaN(slotIdx)) {
          pinItemToQuickBelt(this.state, slotIdx, null);
          this.showToast(`Odpięto slot [${slotIdx + 4}] (powrót do auto-doboru).`, 'info');
          this.activeCharacterSheet?.onUpdated?.();
          this.render();
        }
      });
    });

    this.root.querySelector('#ostrze-cs-close')?.addEventListener('click', () => {
      const cb = this.activeCharacterSheet?.onUpdated;
      this.activeCharacterSheet = null;
      this.render();
      cb?.();
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

    const listHtml = modal.destinations
      .map(
        (d) => `
          <div class="ostrze-shop-item">
            <div>
              <strong>${this.escape(d.name)}</strong>
              <div style="font-size:0.78rem;color:#9f9585;margin-top:2px;">
                ${this.escape(d.subtitle)} · ok. ${d.travelMinutes} min drogi
              </div>
            </div>
            <div>
              ${
                d.isCurrent
                  ? '<span class="ostrze-badge">Tu jesteś</span>'
                  : `<button type="button" class="ostrze-hub-btn" data-travel-dest="${this.escape(d.id)}">Wyrusz</button>`
              }
            </div>
          </div>
        `
      )
      .join('');

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card" style="max-width:620px;">
          <h2 class="ostrze-title">Podróż — Odwiedzone lokacje</h2>
          <p class="ostrze-subtitle">
            Wybierz cel podróży spośród znanych miejsc tej krainy. Na trakcie między lokacjami możesz natrafić na przypadkowe spotkania lub zasadzkę.
          </p>
          <div style="display:flex;flex-direction:column;gap:8px;max-height:55vh;overflow:auto;margin-bottom:14px;">
            ${listHtml}
          </div>
          <div style="display:flex;justify-content:flex-end;">
            <button type="button" class="ostrze-hub-btn" id="ostrze-travel-close">Zamknij [ESC]</button>
          </div>
        </div>
      </div>
    `;

    this.root.querySelectorAll<HTMLButtonElement>('[data-travel-dest]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const destId = btn.dataset.travelDest;
        if (!destId) return;
        ostrzeAudio.playUiClick();
        this.activeTravel = null;
        this.render();
        modal.onSelect(destId);
      });
    });

    this.root.querySelector('#ostrze-travel-close')?.addEventListener('click', () => {
      ostrzeAudio.playUiClick();
      const cb = modal.onClosed;
      this.activeTravel = null;
      this.render();
      cb?.();
    });
  }

  public showCampfireModal(opts: {
    onPerform: (recipeId: string) => { ok: boolean; message: string };
    onWaitHour?: (hour: number) => void;
    onClosed?: () => void;
  }): void {
    this.activeCampfire = opts;
    this.render();
  }

  private renderPauseMenu(): void {
    const pm = this.activePauseMenu;
    if (!pm) return;
    this.root.innerHTML = `
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

    const close = (): void => {
      const cb = pm.onClosed;
      this.activePauseMenu = null;
      this.render();
      cb?.();
    };

    this.root.querySelector('#ostrze-pm-resume')?.addEventListener('click', close);
    this.root.querySelector('#ostrze-pm-save')?.addEventListener('click', () => {
      pm.onSave();
      close();
    });
    this.root.querySelector('#ostrze-pm-load')?.addEventListener('click', () => {
      this.activePauseMenu = null;
      this.render();
      pm.onLoad();
    });
    this.root.querySelector('#ostrze-pm-key')?.addEventListener('click', () => {
      this.activePauseMenu = null;
      this.render();
      pm.onOpenKey();
    });
    this.root.querySelector('#ostrze-pm-mute')?.addEventListener('click', () => {
      pm.isMuted = pm.onToggleMute();
      this.render();
    });
    this.root.querySelector('#ostrze-pm-new')?.addEventListener('click', () => {
      const ok = window.confirm('Czy na pewno chcesz zacząć nową grę? Twój obecny postęp zostanie skasowany.');
      if (!ok) return;
      this.activePauseMenu = null;
      this.render();
      pm.onNewGame();
    });
  }

  private renderCampfireModal(): void {
    const modal = this.activeCampfire;
    if (!modal) return;
    const ch = this.state.character;
    const atmo = getWorldAtmosphere(this.state, this.data);
    const stats = ch ? getStats(this.state, this.data) : null;

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
            const check = canPerformCampRecipe(this.state, this.data, recipe);
            const ingText =
              recipe.ingredients.length > 0
                ? recipe.ingredients
                    .map((ing) => {
                      const def = this.data.items.find((i) => i.id === ing.itemId);
                      const have =
                        this.state.inventory.items.find((i) => i.id === ing.itemId)?.qty ?? 0;
                      return `${def?.name ?? ing.itemId} (${have}/${ing.qty})`;
                    })
                    .join(' · ')
                : 'Bez składników';
            return `
              <div class="ostrze-row">
                <div style="flex:1;min-width:0;">
                  <div style="font-weight:600;color:#f4dfba;">${this.escape(recipe.label)}</div>
                  <div style="font-size:0.8rem;color:#9e9689;">${this.escape(recipe.description)} · <span>${this.escape(ingText)}</span></div>
                </div>
                <button
                  type="button"
                  class="ostrze-hub-btn"
                  data-camp-recipe="${this.escape(recipe.id)}"
                  ${!check.ok ? 'disabled' : ''}
                  title="${this.escape(check.reason ?? recipe.description)}"
                >
                  ${check.ok ? 'Wykonaj' : this.escape(check.reason ?? 'Brak')}
                </button>
              </div>
            `;
          })
          .join('');
        return `<div class="ostrze-panel" style="margin-bottom:10px;"><h3>${this.escape(g.title)}</h3>${rows}</div>`;
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

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card" style="max-width:720px;">
          <h2 class="ostrze-title">Przygotowanie Obozowe przy Ognisku</h2>
          <p class="ostrze-subtitle">
            ${this.escape(atmo.timeLabel)} · ${this.escape(atmo.clockText)}${
              atmo.phenomenonName ? ` · ${this.escape(atmo.phenomenonName)}` : ''
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

    this.root.querySelectorAll<HTMLButtonElement>('[data-camp-wait]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hour = Number(btn.dataset.campWait);
        if (!Number.isNaN(hour)) {
          modal.onWaitHour?.(hour);
          this.render();
        }
      });
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-camp-recipe]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const recipeId = btn.dataset.campRecipe;
        if (!recipeId) return;
        const res = modal.onPerform(recipeId);
        this.showToast(res.message, res.ok ? 'success' : 'info');
        this.render();
      });
    });

    this.root.querySelector('#ostrze-camp-close')?.addEventListener('click', () => {
      const cb = modal.onClosed;
      this.activeCampfire = null;
      this.render();
      cb?.();
    });
  }

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
