import { getSlavicPortrait } from '@ulf/assets/slavicPortraits';
import { ostrzeAudio } from '../audio/ostrzeAudio';
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
import { getStats } from '../rules/stats';

export interface NarrativeCardData {
  title: string;
  subtitle?: string;
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
  private activeNoticeBoard: { entries: NoticeBoardEntry[]; onClosed?: () => void } | null = null;
  private activeTravel: {
    destinations: TravelDestinationEntry[];
    onSelect: (id: string) => void;
    onClosed?: () => void;
  } | null = null;
  private hubPanel: HubPanelData | null = null;
  private hubCollapsed = false;
  private isCombatActiveFn: (() => boolean) | null = null;
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
      if (e.key !== 'Escape') return;
      if (this.activeSaveKey) {
        const cb = this.activeSaveKey.onClosed;
        this.activeSaveKey = null;
        this.render();
        cb?.();
      } else if (this.activeCharacterSheet) {
        const cb = this.activeCharacterSheet.onUpdated;
        this.activeCharacterSheet = null;
        this.render();
        cb?.();
      } else if (this.activeNoticeBoard) {
        const cb = this.activeNoticeBoard.onClosed;
        this.activeNoticeBoard = null;
      this.activeTravel = null;
        this.render();
        cb?.();
      } else if (this.activeTravel) {
        const cb = this.activeTravel.onClosed;
        this.activeTravel = null;
        this.render();
        cb?.();
      } else if (this.activeShop) {
        const cb = this.activeShop.onClosed;
        this.activeShop = null;
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

  public showCharacterSheet(onUpdated?: () => void): void {
    this.activeCharacterSheet = { onUpdated };
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
    this.activeWelcome = null;
    this.activeSaveKey = null;
    this.activeNarrative = null;
    this.activeDialogue = null;
    this.activeShop = null;
    this.activeCharacterSheet = null;
    this.activeNoticeBoard = null;
    this.activeTravel = null;
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
      this.activeTravel
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

    const muted = ostrzeAudio.getMuted();
    this.hubRoot.innerHTML = `
      <div class="ostrze-hub-bar">
        <div class="ostrze-hub-header">
          <div class="ostrze-hub-title">${this.escape(this.hubPanel.title)}</div>
          <div style="display:flex;gap:4px;">
            <button class="ostrze-hub-toggle" data-hub-mute title="${muted ? 'Włącz dźwięk' : 'Wycisz dźwięk'}">
              ${muted ? '🔇' : '🔊'}
            </button>
            <button class="ostrze-hub-toggle" data-hub-toggle title="${this.hubCollapsed ? 'Rozwiń panel' : 'Zwiń panel'}">
              ${this.hubCollapsed ? '+' : '–'}
            </button>
          </div>
        </div>
        <div class="ostrze-hub-meta">${this.escape(this.hubPanel.statusLine)}</div>
        ${
          this.hubCollapsed
            ? ''
            : `
              <div class="ostrze-hub-quests">${this.escape(this.hubPanel.questsLine)}</div>
              <div class="ostrze-hub-actions">${btns}</div>
            `
        }
      </div>
    `;

    this.hubRoot.querySelector('[data-hub-mute]')?.addEventListener('click', () => {
      ostrzeAudio.toggleMute();
      this.renderHubPanel();
    });

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
    const shop = this.data.shops.find((s) => s.id === shopId);
    const handel = this.state.character ? getStats(this.state, this.data).skills.handel : 0;
    const shopRules = (this.data.rules as { shop?: { buyBase?: number; handelBuyDivisor?: number } }).shop;
    const buyBase = shopRules?.buyBase ?? 1.5;
    const handelDiv = shopRules?.handelBuyDivisor ?? 200;
    let mult = Math.max(0.5, buyBase - handel / handelDiv);

    const mods = shop?.priceModifiers as
      | Array<{ if?: { flag?: string }; buyPercent?: number }>
      | Record<string, number>
      | undefined;
    if (Array.isArray(mods)) {
      for (const m of mods) {
        if (m.if?.flag && this.state.flags[m.if.flag] && typeof m.buyPercent === 'number') {
          mult *= 1 + m.buyPercent / 100;
        }
      }
    } else if (mods) {
      for (const [flagKey, modVal] of Object.entries(mods)) {
        if (this.state.flags[flagKey] && typeof modVal === 'number') {
          mult *= modVal;
        }
      }
    }
    return Math.max(1, Math.round(baseValue * mult));
  }

  private renderShop(shopId: string): void {
    const shop = this.data.shops.find((s) => s.id === shopId);
    const money = this.state.character?.money ?? 0;

    const rows = (shop?.stock ?? [])
      .map((entry) => {
        const item = this.data.items.find((i) => i.id === entry.id);
        const boughtKey = `${shopId}:${entry.id}`;
        const remainingQty = Math.max(0, entry.qty - (this.shopBoughtCounts.get(boughtKey) ?? 0));
        const price = this.getShopPrice(item?.value ?? 10, shopId);
        const canBuy = money >= price && remainingQty > 0;
        const desc = item?.description ? `<div style="font-size:0.75rem;color:#9e9689;margin-top:2px">${this.escape(item.description)}</div>` : '';
        return `
          <div class="ostrze-row">
            <div style="flex:1">
              <strong>${this.escape(item?.name ?? entry.id)}</strong>
              <span style="font-size:0.78rem;color:#9e9689"> (szt: ${remainingQty})</span>
              ${desc}
            </div>
            <button class="ostrze-btn" style="padding:5px 12px;font-size:0.8rem" data-buy="${this.escape(entry.id)}" ${canBuy ? '' : 'disabled'}>
              Kup (${price} gr)
            </button>
          </div>
        `;
      })
      .join('');

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card">
          <h2 class="ostrze-title">${this.escape(shop?.name ?? 'Kram')}</h2>
          <p class="ostrze-subtitle">Twoja sakiewka: <strong>${money} groszy</strong></p>
          <div class="ostrze-panel" style="margin-bottom:16px">${rows || '<p>Brak towaru.</p>'}</div>
          <button class="ostrze-btn" data-action="shop-close">Zamknij kram [ESC]</button>
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

    this.root.querySelector('[data-action="shop-close"]')?.addEventListener('click', () => {
      const cb = this.activeShop?.onClosed;
      this.activeShop = null;
      this.render();
      cb?.();
    });
  }

  private renderNarrative(card: NarrativeCardData): void {
    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card">
          <h2 class="ostrze-title">${this.escape(card.title)}</h2>
          ${card.subtitle ? `<p class="ostrze-subtitle">${this.escape(card.subtitle)}</p>` : ''}
          <div class="ostrze-prose">${this.escape(card.text)}</div>
          <button class="ostrze-btn" data-action="narrative-next">
            ${this.escape(card.buttonLabel ?? 'Dalej')}
          </button>
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
          <div class="ostrze-skill-tag ${isTagged ? 'tagged' : ''}" data-skill="${sk.id}">
            <span>${this.escape(sk.name)} ${isLocked ? '★ (Klasa)' : isTagged ? '★' : ''}</span>
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
          <div class="ostrze-row">
            <div>
              <strong>${this.escape(attr.name)}</strong>
              <div style="font-size:0.76rem;color:#938c7f">${this.escape(attr.description)}</div>
            </div>
            <div class="ostrze-stepper">
              <button class="ostrze-step-btn" data-attr-dec="${attr.id}" ${val <= min ? 'disabled' : ''}>-</button>
              <strong style="min-width:22px;text-align:center">${val}</strong>
              <button class="ostrze-step-btn" data-attr-inc="${attr.id}" ${val >= max || remaining <= 0 ? 'disabled' : ''}>+</button>
            </div>
          </div>
        `;
      })
      .join('');

    const classButtons = this.data.classes
      .map(
        (cl) => `
          <button class="ostrze-class-btn ${cl.id === this.draftClass ? 'active' : ''}" data-class="${cl.id}">
            <strong>${this.escape(cl.name)}</strong>
            <div style="font-size:0.82rem;color:#a79f91;margin-top:3px">${this.escape(cl.description)}</div>
          </button>
        `
      )
      .join('');

    const canSubmit =
      remaining === 0 &&
      this.draftTagged.length === c.taggedCount &&
      this.draftName.trim().length >= c.nameMin;

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card">
          <h2 class="ostrze-title">Kreator Adepta — Szkoła Ostrzy w Brzezinie</h2>
          <p class="ostrze-subtitle">Rozdziel ${c.points} pkt atrybutów (zostało: <strong>${remaining}</strong>) oraz wybierz 3 umiejętności oznaczone (+${c.taggedBonus}%).</p>
          ${this.creatorError ? `<div class="ostrze-error">${this.escape(this.creatorError)}</div>` : ''}
          <div class="ostrze-creator-grid">
            <div class="ostrze-panel">
              <h3>Imię i Klasa</h3>
              <input class="ostrze-input" id="ostrze-name-input" maxlength="${c.nameMax}" value="${this.escape(this.draftName)}" placeholder="Imię bohatera" />
              ${classButtons}
              <h3 style="margin-top:14px">Atrybuty (zostało: ${remaining})</h3>
              ${attrRows}
            </div>
            <div class="ostrze-panel">
              <h3>Umiejętności (${this.draftTagged.length}/${c.taggedCount} oznaczone)</h3>
              ${skillRows}
            </div>
          </div>
          <button class="ostrze-btn" data-action="creator-submit" ${canSubmit ? '' : 'disabled'}>
            Rozpocznij Sparing
          </button>
        </div>
      </div>
    `;

    const nameInput = this.root.querySelector<HTMLInputElement>('#ostrze-name-input');
    nameInput?.addEventListener('input', () => {
      this.draftName = nameInput.value;
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
    const portraitUrl = getSlavicPortrait(this.resolvePortraitId(view.speaker));

    const optionsHtml = view.options
      .map((item) => {
        const badge = item.checkLabel
          ? `<span class="ostrze-check-badge">${this.escape(item.checkLabel)} · ${item.checkChance}%</span>`
          : '';
        return `
          <button class="ostrze-dialogue-opt" data-opt-idx="${item.index}" ${item.alreadyFailed ? 'disabled' : ''}>
            <span>${this.escape(item.option.text)}</span>
            ${badge}
          </button>
        `;
      })
      .join('');

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card">
          <div class="ostrze-dialogue-header">
            <img class="ostrze-dialogue-avatar" src="${this.escape(portraitUrl)}" alt="${this.escape(view.speaker)}" />
            <div>
              <h2 class="ostrze-title" style="margin:0;">${this.escape(view.speaker)}</h2>
            </div>
          </div>
          ${view.lastCheckFeedback ? `<div class="ostrze-feedback">${this.escape(view.lastCheckFeedback)}</div>` : ''}
          <div class="ostrze-prose">${this.escape(view.text)}</div>
          <div class="ostrze-dialogue-options">${optionsHtml}</div>
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
          ostrzeAudio.playDialogueCheck(next.lastCheckFeedback.includes('udany'));
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
              return `
                <div class="ostrze-row">
                  <span>
                    ${this.escape(item?.name ?? entry.id)} ×${entry.qty}
                    ${isEquipped ? '<span style="color:#6fd18e;font-size:0.75rem"> [Założono]</span>' : ''}
                  </span>
                  <span class="ostrze-stepper">
                    ${canEquip ? `<button class="ostrze-hub-btn" data-cs-equip="${this.escape(entry.id)}">Załóż</button>` : ''}
                    ${canUse ? `<button class="ostrze-hub-btn" data-cs-use="${this.escape(entry.id)}">${useLabel}</button>` : ''}
                  </span>
                </div>
              `;
            })
            .join('')
        : '<div class="ostrze-subtitle" style="margin-bottom:0">Pusty plecak.</div>';

    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card">
          <h2 class="ostrze-title">${this.escape(ch.name)} — Poziom ${ch.level}</h2>
          <p class="ostrze-subtitle">
            ${this.escape(cls?.name ?? ch.classId)} · HP: ${ch.hp}/${stats.derived.hpMax} · AP: ${stats.derived.ap} · Złoto: ${ch.money} gr · XP: ${ch.xp}/${nextLvXp}
          </p>
          <div class="ostrze-xp-bar"><div class="ostrze-xp-fill" style="width:${xpPct}%"></div></div>

          ${
            ch.freeAttributePoints > 0 || ch.freeSkillPoints > 0 || ch.freePerkPicks > 0
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

          <div class="ostrze-creator-grid">
            <div class="ostrze-panel">
              <h3>Talenty (${ch.perks.length}/${this.data.rules.leveling.maxPerks})</h3>
              ${pickedPerksHtml}
            </div>
            <div class="ostrze-panel">
              <h3>Ekwipunek</h3>
              ${itemsHtml}
            </div>
          </div>

          ${perkChoicesHtml ? `<div class="ostrze-panel" style="margin-bottom:16px"><h3>Wybierz nowy talent (wolne: ${ch.freePerkPicks})</h3>${perkChoicesHtml}</div>` : ''}

          <div style="display:flex;justify-content:flex-end">
            <button class="ostrze-btn" id="ostrze-cs-close">Zamknij [ESC]</button>
          </div>
        </div>
      </div>
    `;

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
    this.root.innerHTML = `
      <div class="ostrze-overlay">
        <div class="ostrze-card ostrze-welcome-card">
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

  private escape(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
