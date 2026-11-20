import type {
  AttributeId,
  ClassId,
  OriginGameData,
  OstrzeGameState,
  SkillId
} from '../../data/originTypes';
import { createCharacter } from '../../rules/character';
import { getStats } from '../../rules/stats';
import { escapeHtml } from '../escapeHtml';

export interface CharacterCreatorDraftState {
  name: string;
  classId: ClassId;
  attrs: Record<AttributeId, number>;
  tagged: SkillId[];
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

export function renderCharacterCreatorView(params: {
  root: HTMLElement;
  data: OriginGameData;
  state: OstrzeGameState;
  draft: CharacterCreatorDraftState;
  onRerender: () => void;
  onComplete: () => void;
}): void {
  const { root, data, state, draft, onRerender, onComplete } = params;
  const prevScrollTop = root.querySelector<HTMLElement>('.ostrze-creator-card')?.scrollTop ?? 0;
  const c = data.rules.creator;
  const remaining = getRemainingCreatorAttrPoints(data, draft.attrs);
  const cls = data.classes.find((cl) => cl.id === draft.classId)!;

  const skillRows = data.skills
    .map((sk) => {
      const isLocked = sk.id === cls.taggedSkill;
      const isTagged = draft.tagged.includes(sk.id);
      const val =
        data.rules.skills.primaryMult * draft.attrs[sk.primary] +
        data.rules.skills.secondaryMult * draft.attrs[sk.secondary] +
        (isTagged ? c.taggedBonus : 0);

      return `
        <div class="ostrze-skill-tag ${isTagged ? 'tagged' : ''} ${isLocked ? 'locked' : ''}" data-skill="${sk.id}" title="${escapeHtml(sk.name)}${isLocked ? ' — umiejętność klasowa' : ''}">
          <span class="ostrze-skill-name">${escapeHtml(sk.name)} ${isLocked ? '★' : isTagged ? '★' : ''}</span>
          <strong>${val}%</strong>
        </div>
      `;
    })
    .join('');

  const attrRows = data.attributes
    .map((attr) => {
      const gift = c.gifts[attr.id] ?? 0;
      const min = c.attributeMin + gift;
      const max = c.attributeMax + gift;
      const val = draft.attrs[attr.id];
      return `
        <div class="ostrze-row ostrze-creator-attr-row">
          <div class="ostrze-attr-meta">
            <strong>${escapeHtml(attr.name)}</strong>
            <span class="ostrze-attr-desc">${escapeHtml(attr.description)}</span>
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

  const classButtons = data.classes
    .map(
      (cl) => `
        <button type="button" class="ostrze-class-btn ostrze-creator-class-btn ${cl.id === draft.classId ? 'active' : ''}" data-class="${cl.id}" title="${escapeHtml(cl.description)}">
          <strong>${escapeHtml(cl.name)}</strong>
          <div class="ostrze-creator-class-desc">${escapeHtml(cl.description)}</div>
        </button>
      `
    )
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
      hint: parts.length > 0 ? `Aby wejść do gry: ${parts.join(' · ')}.` : '✓ Postać gotowa do drogi.'
    };
  };

  const initialStatus = computeStatus(draft.name);

  root.innerHTML = `
    <div class="ostrze-overlay">
      <div class="ostrze-card ostrze-creator-card">
        <div class="ostrze-creator-header">
          <h2 class="ostrze-title">Kreator Adepta — Szkoła Ostrzy w Brzezinie</h2>
          <p class="ostrze-subtitle">Rozdziel <strong>${c.points} pkt</strong> atrybutów (zostało: <strong class="ostrze-creator-rem ${remaining === 0 ? 'done' : ''}">${remaining}</strong>) oraz wybierz <strong>${c.taggedCount}</strong> umiejętności oznaczone (+${c.taggedBonus}%).</p>
        </div>
        ${draft.error ? `<div class="ostrze-error">${escapeHtml(draft.error)}</div>` : ''}
        <div class="ostrze-creator-top">
          <div class="ostrze-creator-name-box">
            <label for="ostrze-name-input">Imię bohatera</label>
            <input class="ostrze-input" id="ostrze-name-input" maxlength="${c.nameMax}" value="${escapeHtml(draft.name)}" placeholder="Imię bohatera" />
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
        <div class="ostrze-creator-footer">
          <div class="ostrze-creator-status ${initialStatus.canSubmit ? 'ready' : ''}" id="ostrze-creator-status">${escapeHtml(initialStatus.hint)}</div>
          <button type="button" class="ostrze-btn ostrze-creator-submit" data-action="creator-submit" ${initialStatus.canSubmit ? '' : 'disabled'}>
            Wejdź do gry
          </button>
        </div>
      </div>
    </div>
  `;

  const cardEl = root.querySelector<HTMLElement>('.ostrze-creator-card');
  if (cardEl && prevScrollTop > 0) {
    cardEl.scrollTop = prevScrollTop;
  }

  const nameInput = root.querySelector<HTMLInputElement>('#ostrze-name-input');
  const submitBtn = root.querySelector<HTMLButtonElement>('[data-action="creator-submit"]');
  const statusEl = root.querySelector<HTMLElement>('#ostrze-creator-status');
  nameInput?.addEventListener('input', () => {
    draft.name = nameInput.value;
    const next = computeStatus(draft.name);
    if (submitBtn) submitBtn.disabled = !next.canSubmit;
    if (statusEl) {
      statusEl.textContent = next.hint;
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
      onRerender();
    });
  });

  root.querySelectorAll<HTMLElement>('[data-attr-inc]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.attrInc as AttributeId;
      if (getRemainingCreatorAttrPoints(data, draft.attrs) > 0) {
        draft.attrs[id] += 1;
        onRerender();
      }
    });
  });

  root.querySelectorAll<HTMLElement>('[data-attr-dec]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.attrDec as AttributeId;
      const min = c.attributeMin + (c.gifts[id] ?? 0);
      if (draft.attrs[id] > min) {
        draft.attrs[id] -= 1;
        onRerender();
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
      onRerender();
    });
  });

  root.querySelector('[data-action="creator-submit"]')?.addEventListener('click', () => {
    try {
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
