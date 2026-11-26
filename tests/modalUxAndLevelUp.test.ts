import { describe, expect, it } from 'vitest';
import { ostrzeAudio } from '../src/game/audio/ostrzeAudio';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter, createEmptyOstrzeState, grantXp } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import { startOstrzeDialogue } from '../src/game/rules/dialogueEngine';
import { OstrzeModalUi } from '../src/game/ui/OstrzeModalUi';
import { renderCampfireView } from '../src/game/ui/views/CampfireView';
import {
  formatPerkModifiers,
  formatPerkRequirements,
  hasUnspentPickablePerk,
  renderCharacterSheetView,
  resolveTargetQuickBeltSlot
} from '../src/game/ui/views/CharacterSheetView';
import { renderDialogueView } from '../src/game/ui/views/DialogueView';

function makeHero() {
  const state = createEmptyOstrzeState(ORIGIN_DATA, 2026);
  createCharacter(
    state,
    {
      name: 'Mściwój',
      classId: 'miecz',
      attributes: {
        sila: 7,
        zrecznosc: 7,
        krzepa: 6,
        bystrosc: 5,
        rozum: 6,
        oglada: 5,
        fart: 5
      },
      tagged: ['sieczna', 'wymowa', 'skradanie']
    },
    ORIGIN_DATA
  );
  return state;
}

function makeFakeRoot() {
  return {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => []
  } as unknown as HTMLElement;
}

describe('Compact Modal UX & cRPG Level-Up Perk Visibility', () => {
  it('formats perk mechanical modifiers and prerequisite checks accurately', () => {
    const state = makeHero();
    const lekkiKrok = ORIGIN_DATA.perks.find((p) => p.id === 'lekki_krok')!;
    const finta = ORIGIN_DATA.perks.find((p) => p.id === 'finta')!;

    expect(formatPerkModifiers(lekkiKrok, ORIGIN_DATA)).toContain('+1 AP');
    expect(formatPerkModifiers(finta, ORIGIN_DATA)).toContain('Odblokowuje: Finta (przełamuje Gardę)');

    const lekkiReqs = formatPerkRequirements(lekkiKrok, state, ORIGIN_DATA);
    expect(lekkiReqs).toEqual([{ label: 'Zręczność 6', met: true }]);

    const fintaReqs = formatPerkRequirements(finta, state, ORIGIN_DATA);
    expect(fintaReqs).toEqual([
      { label: 'Poz. 4', met: false },
      { label: 'Rozum 8', met: false }
    ]);
  });

  it('renders Level-Up Action Ribbon, 3-column layout, and prominent Perk Picker on level up', () => {
    const state = makeHero();
    // Level 2 grants freeSkillPoints + freePerkPicks (perkEveryLevels = 2)
    grantXp(state, 160, ORIGIN_DATA);
    expect(state.character!.level).toBe(2);
    expect(state.character!.freePerkPicks).toBe(1);
    expect(hasUnspentPickablePerk(state, ORIGIN_DATA)).toBe(true);

    const root = makeFakeRoot();
    renderCharacterSheetView({
      root,
      state,
      data: ORIGIN_DATA,
      rng: createRng(1),
      activeTab: 'stats',
      onSelectTab: () => undefined,
      onUpdated: () => undefined,
      onShowToast: () => undefined,
      onRerender: () => undefined,
      onClose: () => undefined
    });

    expect(root.innerHTML).toContain('data-cs-levelup-banner="true"');
    expect(root.innerHTML).toContain('★ Wybierz Talent');
    expect(root.innerHTML).toContain('ostrze-cs-stats-grid');
    expect(root.innerHTML).toContain('data-cs-perks-panel="true"');
    expect(root.innerHTML).toContain('is-perk-ready');
    expect(root.innerHTML).toContain('data-cs-perk-picker="true"');
    expect(root.innerHTML).toContain('+1 AP');
    expect(root.innerHTML).toContain('>+2<');
  });

  it('shows inline close-guardrail warning when attempting to close with an unspent pickable perk', () => {
    const state = makeHero();
    grantXp(state, 160, ORIGIN_DATA);
    const root = makeFakeRoot();

    renderCharacterSheetView({
      root,
      state,
      data: ORIGIN_DATA,
      rng: createRng(1),
      activeTab: 'stats',
      closeGuardActive: true,
      onSelectTab: () => undefined,
      onUpdated: () => undefined,
      onShowToast: () => undefined,
      onRerender: () => undefined,
      onClose: () => undefined
    });

    expect(root.innerHTML).toContain('data-cs-perk-guard="true"');
    expect(root.innerHTML).toContain('Masz jeszcze niewybrany Talent');
    expect(root.innerHTML).toContain('data-cs-guard-go-perks="true"');
    expect(root.innerHTML).toContain('data-cs-guard-force-close="true"');
  });

  it('renders visual Quick-Belt [4-7] strip without select dropdowns and resolves target slots', () => {
    expect(resolveTargetQuickBeltSlot([null, null, null, null], null)).toBe(0);
    expect(resolveTargetQuickBeltSlot(['bandaz', null, null, null], null)).toBe(1);
    expect(resolveTargetQuickBeltSlot(['bandaz', 'ziola', 'olej', 'bomba'], null)).toBe(3);
    expect(resolveTargetQuickBeltSlot(['bandaz', null, null, null], 2)).toBe(2);

    const state = makeHero();
    const consumable = ORIGIN_DATA.items.find(
      (i) => i.type === 'consumable' && Array.isArray(i.heal) && i.heal[1] > 0
    )!;
    state.inventory.items.push({ id: consumable.id, qty: 2 });

    const root = makeFakeRoot();
    renderCharacterSheetView({
      root,
      state,
      data: ORIGIN_DATA,
      rng: createRng(1),
      activeTab: 'gear',
      onSelectTab: () => undefined,
      onUpdated: () => undefined,
      onShowToast: () => undefined,
      onRerender: () => undefined,
      onClose: () => undefined
    });

    expect(root.innerHTML).toContain('data-cs-quickbelt-strip="true"');
    expect(root.innerHTML).toContain('data-cs-belt-slot-select="0"');
    expect(root.innerHTML).toContain('data-cs-belt-quickpin=');
    expect(root.innerHTML).not.toContain('<select class="ostrze-belt-select"');
  });

  it('renders locked perk build-planner catalog even when no perk pick is pending', () => {
    const state = makeHero();
    const root = makeFakeRoot();

    renderCharacterSheetView({
      root,
      state,
      data: ORIGIN_DATA,
      rng: createRng(1),
      activeTab: 'stats',
      onSelectTab: () => undefined,
      onUpdated: () => undefined,
      onShowToast: () => undefined,
      onRerender: () => undefined,
      onClose: () => undefined
    });

    expect(root.innerHTML).not.toContain('data-cs-levelup-banner="true"');
    expect(root.innerHTML).toContain('Katalog talentów i wymagania');
    expect(root.innerHTML).toContain('Nast. poz. 2');
  });

  it('renders Campfire modal with compact 2-column grid and inline wait bar', () => {
    const state = makeHero();
    const root = makeFakeRoot();

    renderCampfireView({
      root,
      state,
      data: ORIGIN_DATA,
      modal: {
        onPerform: () => ({ ok: true, message: 'OK' }),
        onWaitHour: () => undefined
      },
      onShowToast: () => undefined,
      onRerender: () => undefined,
      onClose: () => undefined
    });

    expect(root.innerHTML).toContain('ostrze-camp-grid');
    expect(root.innerHTML).toContain('ostrze-camp-wait-bar');
    expect(root.innerHTML).toContain('data-camp-close-top="true"');
  });

  it('renders Dialogue modal with separated speech and choices panes', () => {
    const state = makeHero();
    const session = startOstrzeDialogue('brzezina_skarimir', state, ORIGIN_DATA);
    const root = makeFakeRoot();

    renderDialogueView({
      root,
      session,
      state,
      data: ORIGIN_DATA,
      rng: createRng(1),
      onOpenShop: null,
      onAdvance: () => undefined
    });

    expect(root.innerHTML).toContain('ostrze-dialogue-speech-pane');
    expect(root.innerHTML).toContain('ostrze-dialogue-choices-pane');
  });

  it('renders Shop modal with category filter bar', () => {
    const state = makeHero();
    const shopId = ORIGIN_DATA.shops[0]?.id;
    expect(shopId).toBeTruthy();

    const origDoc = (globalThis as { document?: unknown }).document;
    const origWin = (globalThis as { window?: unknown }).window;
    const createdEls: Array<{ id: string; innerHTML: string }> = [];
    (globalThis as { document?: unknown }).document = {
      getElementById: () => null,
      createElement: () => {
        const el = {
          id: '',
          className: '',
          innerHTML: '',
          querySelector: () => null,
          querySelectorAll: () => [],
          addEventListener: () => {},
          remove: () => {}
        };
        createdEls.push(el);
        return el;
      },
      body: { appendChild: () => {} }
    };
    (globalThis as { window?: unknown }).window = {
      addEventListener: () => {},
      setTimeout: () => 0
    };

    try {
      const ui = new OstrzeModalUi(ORIGIN_DATA, state, createRng(1));
      ui.showShop(shopId!);
      const overlayRoot = createdEls.find((e) => e.id === 'ostrze-overlay-root')!;
      expect(overlayRoot.innerHTML).toContain('data-shop-filters="true"');
      expect(overlayRoot.innerHTML).toContain('data-shop-filter="all"');
      ui.destroy();
    } finally {
      (globalThis as { document?: unknown }).document = origDoc;
      (globalThis as { window?: unknown }).window = origWin;
    }
  });

  it('renders compact exploration hub bar with inline clock, Level-Up CTA, and effect tooltips', () => {
    const state = makeHero();
    grantXp(state, 160, ORIGIN_DATA); // Level 2 with freeSkillPoints + freePerkPicks
    state.character!.effects.push({ id: 'zmeczenie', stacks: 1 });

    const origDoc = (globalThis as { document?: unknown }).document;
    const origWin = (globalThis as { window?: unknown }).window;
    const createdEls: Array<{ id: string; innerHTML: string }> = [];
    (globalThis as { document?: unknown }).document = {
      getElementById: () => null,
      createElement: () => {
        const el = {
          id: '',
          className: '',
          innerHTML: '',
          querySelector: () => null,
          querySelectorAll: () => [],
          addEventListener: () => {},
          remove: () => {}
        };
        createdEls.push(el);
        return el;
      },
      body: { appendChild: () => {} }
    };
    (globalThis as { window?: unknown }).window = {
      addEventListener: () => {},
      setTimeout: () => 0
    };

    try {
      const ui = new OstrzeModalUi(ORIGIN_DATA, state, createRng(1));
      ui.setHubPanel({
        title: 'Wilczy Bród',
        statusLine: 'Strażnica na pogórzu',
        questsLine: 'Porozmawiaj z komendantem',
        actions: []
      });
      const hubRoot = createdEls.find((e) => e.id === 'ostrze-hub-root')!;
      expect(hubRoot.innerHTML).toContain('ostrze-hub-clock');
      expect(hubRoot.innerHTML).toContain('data-hub-levelup="true"');
      expect(hubRoot.innerHTML).toContain('Talent!');
      expect(hubRoot.innerHTML).toContain('title="');
      ui.destroy();
    } finally {
      (globalThis as { document?: unknown }).document = origDoc;
      (globalThis as { window?: unknown }).window = origWin;
    }
  });

  it('exposes procedural SFX for Level-Up, Perk Pick, Guard Break, Riposte, and Synergy cleanly', () => {
    expect(() => ostrzeAudio.playLevelUpFanfare()).not.toThrow();
    expect(() => ostrzeAudio.playPerkPick()).not.toThrow();
    expect(() => ostrzeAudio.playGuardBreak()).not.toThrow();
    expect(() => ostrzeAudio.playRiposte()).not.toThrow();
    expect(() => ostrzeAudio.playSynergyProc()).not.toThrow();
  });
});
