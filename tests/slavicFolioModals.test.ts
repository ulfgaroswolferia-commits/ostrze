import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createCharacter } from '../src/game/rules/character';
import { PrologueDirector } from '../src/game/scenes/PrologueDirector';
import {
  EQUIPMENT_SLOT_META,
  INVENTORY_FILTER_META,
  renderSlavicIcon
} from '../src/game/ui/slavicIcons';
import { renderCampfireView } from '../src/game/ui/views/CampfireView';
import { renderCampaignSummaryView } from '../src/game/ui/views/CampaignSummaryView';
import {
  type CharacterSheetTab,
  renderCharacterSheetView
} from '../src/game/ui/views/CharacterSheetView';
import { renderPauseMenuView } from '../src/game/ui/views/PauseMenuView';

function makeFakeRoot(): HTMLElement {
  return {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => []
  } as unknown as HTMLElement;
}

function makeTestDirector(): PrologueDirector {
  const director = new PrologueDirector({ engine: new OstrzeEngineState(), seed: 7 });
  createCharacter(
    director.state,
    {
      name: 'Mściwój',
      classId: 'miecz',
      attributes: {
        sila: 8,
        zrecznosc: 7,
        krzepa: 5,
        bystrosc: 5,
        rozum: 6,
        oglada: 5,
        fart: 5
      },
      tagged: ['sieczna', 'wymowa', 'skradanie']
    },
    ORIGIN_DATA
  );
  return director;
}

describe('Slavic Folio Modals — Character Sheet, 8-Slot Rynsztunek & SVG Iconography', () => {
  it('renders crisp SVG icons for all equipment slots and filters, and escapes dynamic class names', () => {
    expect(EQUIPMENT_SLOT_META).toHaveLength(8);
    expect(INVENTORY_FILTER_META).toHaveLength(5);
    for (const slot of EQUIPMENT_SLOT_META) {
      const svg = renderSlavicIcon(slot.icon);
      expect(svg).toContain('<svg');
      expect(svg).toContain('aria-hidden="true"');
    }
    const escaped = renderSlavicIcon('shop', 'ico" onclick="alert(1)');
    expect(escaped).toContain('class="ico&quot; onclick=&quot;alert(1)"');
    expect(escaped).not.toContain('onclick="alert');
  });

  it('renders Character Sheet portrait, accessible tabs, all 8 slots, extra custom slots, and unequip aria-labels', () => {
    const director = makeTestDirector();
    director.state.inventory.equipped.relikt = 'kosc_skarimira';

    const root = makeFakeRoot();
    renderCharacterSheetView({
      root,
      state: director.state,
      data: ORIGIN_DATA,
      rng: director.rng,
      activeTab: 'gear',
      onSelectTab: () => undefined,
      onUpdated: () => undefined,
      onShowToast: () => undefined,
      onRerender: () => undefined,
      onClose: () => undefined
    });

    expect(root.innerHTML).toContain('ostrze-cs-portrait-frame');
    expect(root.innerHTML).toContain('role="tablist" aria-label="Sekcje karty postaci"');
    expect(root.innerHTML).toContain('role="tab" aria-selected="true"');
    expect(root.innerHTML).toContain('data-cs-equip-slots="true"');
    expect(root.innerHTML).toContain('data-equip-slot="bron"');
    expect(root.innerHTML).toContain('data-equip-slot="talizman"');
    expect(root.innerHTML).toContain('data-equip-slot="relikt"');
    expect(root.innerHTML).toContain('aria-label="Zdejmij ');
    expect(root.innerHTML).toContain('Pusty slot');
    expect(root.innerHTML).not.toContain('🪙');
    expect(root.innerHTML).not.toContain('🐺');
    expect(root.innerHTML).not.toContain('🏆');
  });

  it('renders illuminated journal, bestiary, and chronicle tabs without raw emojis', () => {
    const director = makeTestDirector();
    director.state.quests.wilcza_nora = 'active';
    director.state.flags.met_wilk = true;

    const tabs: CharacterSheetTab[] = ['journal', 'bestiary', 'chronicle'];
    for (const tab of tabs) {
      const root = makeFakeRoot();
      renderCharacterSheetView({
        root,
        state: director.state,
        data: ORIGIN_DATA,
        rng: director.rng,
        activeTab: tab,
        onSelectTab: () => undefined,
        onUpdated: () => undefined,
        onShowToast: () => undefined,
        onRerender: () => undefined,
        onClose: () => undefined
      });
      expect(root.innerHTML).toContain(`role="tab" aria-selected="true"`);
      expect(root.innerHTML).not.toContain('❓');
      expect(root.innerHTML).not.toContain('💡');
    }
  });

  it('renders Campfire view with Slavic SVG icons instead of raw time emojis', () => {
    const director = makeTestDirector();
    const root = makeFakeRoot();
    renderCampfireView({
      root,
      state: director.state,
      data: ORIGIN_DATA,
      modal: {
        onPerform: () => ({ ok: true, message: 'OK' }),
        onWaitHour: () => undefined
      },
      onShowToast: () => undefined,
      onRerender: () => undefined,
      onClose: () => undefined
    });

    expect(root.innerHTML).toContain('ostrze-svg-ico');
    expect(root.innerHTML).toContain('Świt (06:00)');
    expect(root.innerHTML).not.toContain('🌅');
    expect(root.innerHTML).not.toContain('🌙');
  });

  it('renders day and info Slavic SVG icons for Exploration HUD clock and heraldic toasts', () => {
    expect(renderSlavicIcon('day')).toContain('<circle cx="8" cy="8" r="3"/>');
    expect(renderSlavicIcon('info')).toContain('aria-hidden="true"');
    expect(renderSlavicIcon('dawn')).toContain('aria-hidden="true"');
    expect(renderSlavicIcon('dusk')).toContain('aria-hidden="true"');
    expect(renderSlavicIcon('night')).toContain('aria-hidden="true"');
  });

  it('uses inline two-step confirmation in Pause Menu and Slavic SVG icons in Pause & Summary', () => {
    let newGameClicks = 0;
    let focusedSelector: string | null = null;
    const listeners = new Map<string, () => void>();
    const interactiveRoot = {
      innerHTML: '',
      querySelector(sel: string) {
        const idMatch = /^#([\w-]+)$/.exec(sel);
        if (idMatch && !interactiveRoot.innerHTML.includes(`id="${idMatch[1]}"`)) {
          return null;
        }
        return {
          addEventListener: (_ev: string, fn: () => void) => {
            listeners.set(sel, fn);
          },
          focus: () => {
            focusedSelector = sel;
          }
        };
      },
      querySelectorAll: () => []
    } as unknown as HTMLElement;

    renderPauseMenuView({
      root: interactiveRoot,
      pm: {
        hasSave: true,
        isMuted: false,
        difficultyLabel: 'Klasyczny',
        onCycleDifficulty: () => 'Wyzwanie',
        onSave: () => undefined,
        onLoad: () => undefined,
        onOpenKey: () => undefined,
        onOpenHelp: () => undefined,
        onToggleMute: () => true,
        onNewGame: () => {
          newGameClicks += 1;
        }
      },
      onRerender: () => undefined,
      onClose: () => undefined,
      onDismissForAction: () => undefined
    });

    expect(interactiveRoot.innerHTML).toContain('ostrze-svg-ico');
    expect(interactiveRoot.innerHTML).not.toContain('💾');
    expect(interactiveRoot.innerHTML).not.toContain('data-pm-confirm-box="true"');
    expect(listeners.has('#ostrze-pm-new-confirm')).toBe(false);

    // First click reveals inline confirm and focuses safe Cancel button
    listeners.get('#ostrze-pm-new')?.();
    expect(newGameClicks).toBe(0);
    expect(focusedSelector).toBe('#ostrze-pm-new-cancel');
    expect(interactiveRoot.innerHTML).toContain('data-pm-confirm-box="true"');
    expect(interactiveRoot.innerHTML).toContain('Potwierdź nową grę');

    // Cancel hides confirm box and restores focus to New Game button
    listeners.get('#ostrze-pm-new-cancel')?.();
    expect(focusedSelector).toBe('#ostrze-pm-new');
    expect(interactiveRoot.innerHTML).not.toContain('data-pm-confirm-box="true"');

    // Re-open and confirm triggers onNewGame
    listeners.get('#ostrze-pm-new')?.();
    listeners.get('#ostrze-pm-new-confirm')?.();
    expect(newGameClicks).toBe(1);

    // Campaign summary uses SVG icons and Lora epilogue prose
    const director = makeTestDirector();
    const summaryRoot = makeFakeRoot();
    renderCampaignSummaryView({
      root: summaryRoot,
      state: director.state,
      data: ORIGIN_DATA,
      opts: {
        viaOblawa: true,
        onStayFreeRoam: () => undefined,
        onExportHeroKey: () => undefined,
        onNewGame: () => undefined
      },
      onClose: () => undefined
    });
    expect(summaryRoot.innerHTML).toContain('ostrze-narrative-prose');
    expect(summaryRoot.innerHTML).toContain('ostrze-svg-ico');
    expect(summaryRoot.innerHTML).not.toContain('🏁');
    expect(summaryRoot.innerHTML).not.toContain('🗺️');
  });
});
