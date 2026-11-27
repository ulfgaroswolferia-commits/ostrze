import { getSlavicPortrait } from '@ulf/assets/slavicPortraits';
import type {
  AttributeId,
  ClassId,
  OriginGameData,
  OstrzeGameState,
  SkillId
} from '../../data/originTypes';
import { createCharacter } from '../../rules/character';
import {
  DIFFICULTY_ORDER,
  DIFFICULTY_PROFILES,
  getOstrzeDifficulty,
  setOstrzeDifficulty,
  type OstrzeDifficultyId
} from '../../rules/difficulty';
import { type ComputedStats, getStats } from '../../rules/stats';
import { escapeHtml } from '../escapeHtml';
import { mountModalCard } from '../mountModalCard';
import { renderSlavicIcon } from '../slavicIcons';

export interface CharacterCreatorDraftState {
  name: string;
  classId: ClassId;
  attrs: Record<AttributeId, number>;
  tagged: SkillId[];
  difficulty?: OstrzeDifficultyId;
  error: string | null;
}

export function buildInitialCreatorAttrs(data: OriginGameData): Record<AttributeId, number> {
  const c = data.rules.creator;
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

export function getRemainingCreatorAttrPoints(
  data: OriginGameData,
  attrs: Record<AttributeId, number>
): number {
  const c = data.rules.creator;
  const basePool =
    data.attributes.length * c.attributeStart +
    c.points +
    Object.values(c.gifts).reduce((s, v) => s + (v ?? 0), 0);
  const spent = Object.values(attrs).reduce((s, v) => s + v, 0);
  return basePool - spent;
}

/**
 * Pure non-mutating live preview of derived combat stats for the current creator draft.
 */
export function computeCreatorPreviewStats(
  draft: CharacterCreatorDraftState,
  state: OstrzeGameState,
  data: OriginGameData
): ComputedStats {
  const cls = data.classes.find((cl) => cl.id === draft.classId) ?? data.classes[0];
  const previewState: OstrzeGameState = {
    ...state,
    character: {
      name: draft.name.trim() || 'Mściwój',
      classId: draft.classId,
      level: 1,
      xp: 0,
      hp: 1,
      money: cls?.startMoney ?? 0,
      attributes: { ...draft.attrs },
      tagged: [...draft.tagged],
      skillPoints: {},
      perks: [],
      freeAttributePoints: 0,
      freeSkillPoints: 0,
      freePerkPicks: 0,
      mastery: { ...(cls?.masteryStart ?? {}) },
      effects: []
    },
    inventory: {
      ...state.inventory,
      equipped: { ...(cls?.startEquipped ?? {}) }
    }
  };
  return getStats(previewState, data);
}

let pendingCreatorFocusSelector: string | null = null;

export function renderCharacterCreatorView(params: {
  root: HTMLElement;
  data: OriginGameData;
  state: OstrzeGameState;
  draft: CharacterCreatorDraftState;
  onRerender: () => void;
  onComplete: () => void;
}): void {
  const { root, data, state, draft, onRerender, onComplete } = params;
  const c = data.rules.creator;
  const remaining = getRemainingCreatorAttrPoints(data, draft.attrs);
  const cls = data.classes.find((cl) => cl.id === draft.classId)!;
  const previewStats = computeCreatorPreviewStats(draft, state, data);
  const heroPortraitUrl = getSlavicPortrait('player');

  const skillRows = data.skills
    .map((sk) => {
      const isLocked = sk.id === cls.taggedSkill;
      const isTagged = draft.tagged.includes(sk.id);
      const val =
        data.rules.skills.primaryMult * draft.attrs[sk.primary] +
        data.rules.skills.secondaryMult * draft.attrs[sk.secondary] +
        (isTagged ? c.taggedBonus : 0);

      const badgeIcon = isLocked
        ? renderSlavicIcon('lock', 'ostrze-svg-ico ostrze-skill-ico')
        : isTagged
          ? renderSlavicIcon('star', 'ostrze-svg-ico ostrze-skill-ico')
          : '';

      return `
        <button
          type="button"
          class="ostrze-skill-tag ${isTagged ? 'tagged' : ''} ${isLocked ? 'locked' : ''}"
          data-skill="${sk.id}"
          aria-pressed="${isTagged}"
          ${isLocked ? 'aria-disabled="true"' : ''}
          title="${escapeHtml(sk.name)}${isLocked ? ' — umiejętność klasowa (zawsze oznaczona)' : ''}"
        >
          <span class="ostrze-skill-name">${badgeIcon}<span>${escapeHtml(sk.name)}</span></span>
          <strong class="ostrze-num">${val}%</strong>
        </button>
      `;
    })
    .join('');

  const attrRows = data.attributes
    .map((attr) => {
      const gift = c.gifts[attr.id] ?? 0;
      const min = c.attributeMin + gift;
      const max = c.attributeMax + gift;
      const val = draft.attrs[attr.id];
      const pipsHtml = Array.from({ length: max }, (_, idx) => {
        const filled = idx < val;
        const isBase = idx < min;
        return `<span class="ostrze-attr-pip ${filled ? 'is-filled' : ''} ${isBase ? 'is-base' : ''}" aria-hidden="true"></span>`;
      }).join('');

      return `
        <div class="ostrze-row ostrze-creator-attr-row">
          <div class="ostrze-attr-meta">
            <div class="ostrze-attr-head-line">
              <strong>${escapeHtml(attr.name)}</strong>
              <span class="ostrze-attr-pips">${pipsHtml}</span>
            </div>
            <span class="ostrze-attr-desc">${escapeHtml(attr.description)}</span>
          </div>
          <div class="ostrze-stepper">
            <button type="button" class="ostrze-step-btn" data-attr-dec="${attr.id}" aria-label="Zmniejsz ${escapeHtml(attr.name)}" ${val <= min ? 'disabled' : ''}>−</button>
            <strong class="ostrze-attr-val ostrze-num">${val}</strong>
            <button type="button" class="ostrze-step-btn" data-attr-inc="${attr.id}" aria-label="Zwiększ ${escapeHtml(attr.name)}" ${val >= max || remaining <= 0 ? 'disabled' : ''}>+</button>
          </div>
        </div>
      `;
    })
    .join('');

  const classButtons = data.classes
    .map((cl) => {
      const startWeaponId = cl.startEquipped.bron;
      const startWeapon = startWeaponId
        ? data.items.find((it) => it.id === startWeaponId)
        : undefined;
      const taggedSkillDef = data.skills.find((s) => s.id === cl.taggedSkill);
      return `
        <button
          type="button"
          class="ostrze-class-btn ostrze-creator-class-btn ${cl.id === draft.classId ? 'active' : ''}"
          data-class="${cl.id}"
          aria-pressed="${cl.id === draft.classId}"
          title="${escapeHtml(cl.description)}"
        >
          <div class="ostrze-creator-class-head">
            <strong>${escapeHtml(cl.name)}</strong>
            ${
              taggedSkillDef
                ? `<span class="ostrze-creator-class-pill">${renderSlavicIcon('star')}<span>${escapeHtml(taggedSkillDef.name)}</span></span>`
                : ''
            }
          </div>
          <div class="ostrze-creator-class-desc">${escapeHtml(cl.description)}</div>
          ${
            startWeapon
              ? `<div class="ostrze-creator-class-gear">${renderSlavicIcon('weapon')}<span>${escapeHtml(startWeapon.name)}</span></div>`
              : ''
          }
        </button>
      `;
    })
    .join('');

  const computeStatus = (nameVal: string): { canSubmit: boolean; hint: string } => {
    const missingAttrs = remaining > 0;
    const missingTags = c.taggedCount - draft.tagged.length;
    const shortName = nameVal.trim().length < c.nameMin;
    const parts: string[] = [];
    if (missingAttrs) parts.push(`rozdaj wszystkie punkty atrybutów (zostało: ${remaining})`);
    if (missingTags > 0) parts.push(`oznacz jeszcze ${missingTags} umiej.`);
    if (shortName) parts.push(`wpisz imię (min. ${c.nameMin} zn.)`);
    return {
      canSubmit: !missingAttrs && missingTags === 0 && !shortName,
      hint: parts.length > 0 ? `Aby wejść do gry: ${parts.join(' · ')}.` : 'Postać gotowa do drogi.'
    };
  };

  const activeDifficulty = draft.difficulty ?? getOstrzeDifficulty(state);
  const difficultyButtons = DIFFICULTY_ORDER.map((id) => {
    const p = DIFFICULTY_PROFILES[id];
    return `
      <button type="button" class="ostrze-diff-btn ${id === activeDifficulty ? 'active' : ''}" data-creator-diff="${id}" aria-pressed="${id === activeDifficulty}" title="${escapeHtml(p.shortDesc)}">
        <strong>${escapeHtml(p.label)}</strong>
        <span>${escapeHtml(p.shortDesc)}</span>
      </button>
    `;
  }).join('');

  const initialStatus = computeStatus(draft.name);

  const cardInnerHtml = `
        <div class="ostrze-modal-head ostrze-creator-header">
          <div>
            <h2 class="ostrze-title">Kreator Adepta — Szkoła Ostrzy w Brzezinie</h2>
            <p class="ostrze-subtitle">Rozdziel <strong>${c.points} pkt</strong> atrybutów (zostało: <strong class="ostrze-creator-rem ${remaining === 0 ? 'done' : ''}">${remaining}</strong>) oraz wybierz <strong>${c.taggedCount}</strong> umiejętności oznaczone (+${c.taggedBonus}%).</p>
          </div>
          <div class="ostrze-creator-preview-strip" data-creator-preview="true" aria-label="Podgląd statystyk bojowych">
            <div class="ostrze-creator-stat-chip"><span>HP</span><strong class="ostrze-num">${previewStats.derived.hpMax}</strong></div>
            <div class="ostrze-creator-stat-chip"><span>AP</span><strong class="ostrze-num">${previewStats.derived.ap}</strong></div>
            <div class="ostrze-creator-stat-chip"><span>Obrona</span><strong class="ostrze-num">${previewStats.derived.defense}</strong></div>
            <div class="ostrze-creator-stat-chip"><span>Inic.</span><strong class="ostrze-num">${previewStats.derived.initiative}</strong></div>
            <div class="ostrze-creator-stat-chip"><span>Krytyk</span><strong class="ostrze-num">${previewStats.derived.critChance}%</strong></div>
          </div>
        </div>
        ${draft.error ? `<div class="ostrze-error">${escapeHtml(draft.error)}</div>` : ''}
        <div class="ostrze-creator-top">
          <div class="ostrze-creator-identity-box">
            <div class="ostrze-creator-portrait-frame">
              <img class="ostrze-creator-portrait" src="${escapeHtml(heroPortraitUrl)}" alt="Portret adepta" />
            </div>
            <div class="ostrze-creator-name-wrap">
              <label for="ostrze-name-input">Imię bohatera</label>
              <input class="ostrze-input" id="ostrze-name-input" maxlength="${c.nameMax}" value="${escapeHtml(draft.name)}" placeholder="Imię bohatera" />
            </div>
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
            <h3>Umiejętności <span class="ostrze-panel-badge ${draft.tagged.length === c.taggedCount ? 'done' : ''}">${draft.tagged.length}/${c.taggedCount} oznaczone</span></h3>
            <div class="ostrze-skills-grid">
              ${skillRows}
            </div>
          </div>
        </div>
        <div class="ostrze-creator-diff-bar">
          <span class="ostrze-creator-diff-label">Poziom trudności:</span>
          <div class="ostrze-creator-diff-options">${difficultyButtons}</div>
        </div>
        <div class="ostrze-creator-footer">
          <div class="ostrze-creator-status ${initialStatus.canSubmit ? 'ready' : ''}" id="ostrze-creator-status" aria-live="polite">
            ${initialStatus.canSubmit ? renderSlavicIcon('check') : ''}
            <span>${escapeHtml(initialStatus.hint)}</span>
          </div>
          <button type="button" class="ostrze-btn ostrze-creator-submit" data-action="creator-submit" ${initialStatus.canSubmit ? '' : 'disabled'}>
            Wejdź do gry
          </button>
        </div>
  `;

  mountModalCard(root, 'ostrze-card ostrze-creator-card', cardInnerHtml);

  if (pendingCreatorFocusSelector) {
    const focusSel = pendingCreatorFocusSelector;
    pendingCreatorFocusSelector = null;
    const focusTarget = root.querySelector<HTMLElement>(focusSel);
    if (focusTarget && !focusTarget.hasAttribute('disabled')) {
      focusTarget.focus();
    }
  }

  const rerenderKeepingFocus = (selector: string): void => {
    pendingCreatorFocusSelector = selector;
    onRerender();
  };

  const nameInput = root.querySelector<HTMLInputElement>('#ostrze-name-input');
  const submitBtn = root.querySelector<HTMLButtonElement>('[data-action="creator-submit"]');
  const statusEl = root.querySelector<HTMLElement>('#ostrze-creator-status');
  nameInput?.addEventListener('input', () => {
    draft.name = nameInput.value;
    const next = computeStatus(draft.name);
    if (submitBtn) submitBtn.disabled = !next.canSubmit;
    if (statusEl) {
      statusEl.innerHTML = `${next.canSubmit ? renderSlavicIcon('check') : ''}<span>${escapeHtml(next.hint)}</span>`;
      statusEl.classList.toggle('ready', next.canSubmit);
    }
  });

  root.querySelectorAll<HTMLElement>('[data-class]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextClass = btn.dataset.class as ClassId;
      draft.classId = nextClass;
      const nextClsDef = data.classes.find((cItem) => cItem.id === nextClass)!;
      if (!draft.tagged.includes(nextClsDef.taggedSkill)) {
        draft.tagged = [nextClsDef.taggedSkill, ...draft.tagged.slice(0, c.taggedCount - 1)];
      }
      rerenderKeepingFocus(`[data-class="${nextClass}"]`);
    });
  });

  root.querySelectorAll<HTMLElement>('[data-attr-inc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.attrInc as AttributeId;
      if (getRemainingCreatorAttrPoints(data, draft.attrs) > 0) {
        draft.attrs[id] += 1;
        rerenderKeepingFocus(`[data-attr-inc="${id}"]`);
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-attr-dec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.attrDec as AttributeId;
      const min = c.attributeMin + (c.gifts[id] ?? 0);
      if (draft.attrs[id] > min) {
        draft.attrs[id] -= 1;
        rerenderKeepingFocus(`[data-attr-dec="${id}"]`);
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-skill]').forEach((el) => {
    el.addEventListener('click', () => {
      const skId = el.dataset.skill as SkillId;
      if (skId === cls.taggedSkill) return;
      if (draft.tagged.includes(skId)) {
        draft.tagged = draft.tagged.filter((id) => id !== skId);
      } else if (draft.tagged.length < c.taggedCount) {
        draft.tagged = [...draft.tagged, skId];
      }
      rerenderKeepingFocus(`[data-skill="${skId}"]`);
    });
  });

  root.querySelectorAll<HTMLElement>('[data-creator-diff]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextDiff = btn.dataset.creatorDiff as OstrzeDifficultyId;
      draft.difficulty = nextDiff;
      rerenderKeepingFocus(`[data-creator-diff="${nextDiff}"]`);
    });
  });

  root.querySelector('[data-action="creator-submit"]')?.addEventListener('click', () => {
    try {
      setOstrzeDifficulty(state, activeDifficulty);
      createCharacter(
        state,
        {
          name: draft.name,
          classId: draft.classId,
          attributes: { ...draft.attrs },
          tagged: [...draft.tagged]
        },
        data
      );
      getStats(state, data);
      draft.error = null;
      onComplete();
    } catch (err) {
      draft.error = err instanceof Error ? err.message : String(err);
      onRerender();
    }
  });
}
