import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { PrologueDirector } from '../src/game/scenes/PrologueDirector';
import {
  buildInitialCreatorAttrs,
  computeCreatorPreviewStats,
  renderCharacterCreatorView
} from '../src/game/ui/views/CharacterCreatorView';

function makeFakeRoot(): HTMLElement {
  return {
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => []
  } as unknown as HTMLElement;
}

describe('Opening Sequence — Character Creator Live Preview, Pips & Accessibility', () => {
  it('computes live derived combat stats without mutating game state and reacts to attribute changes', () => {
    const director = new PrologueDirector({ engine: new OstrzeEngineState(), seed: 11 });
    const baseAttrs = buildInitialCreatorAttrs(ORIGIN_DATA);

    const lowDraft = {
      name: 'Mściwój',
      classId: 'miecz' as const,
      attrs: { ...baseAttrs },
      tagged: ['sieczna' as const, 'wymowa' as const, 'skradanie' as const],
      error: null
    };
    const highDraft = {
      ...lowDraft,
      attrs: { ...baseAttrs, krzepa: baseAttrs.krzepa + 4, zrecznosc: baseAttrs.zrecznosc + 3 }
    };

    const lowStats = computeCreatorPreviewStats(lowDraft, director.state, ORIGIN_DATA);
    const highStats = computeCreatorPreviewStats(highDraft, director.state, ORIGIN_DATA);

    expect(director.state.character).toBeNull();
    expect(highStats.derived.hpMax).toBeGreaterThan(lowStats.derived.hpMax);
    expect(highStats.derived.initiative).toBeGreaterThan(lowStats.derived.initiative);
  });

  it('renders creator portrait, live stats strip, attribute pips, class starting gear, and accessible skill buttons', () => {
    const director = new PrologueDirector({ engine: new OstrzeEngineState(), seed: 12 });
    const draft = {
      name: 'Mściwój',
      classId: 'miecz' as const,
      attrs: buildInitialCreatorAttrs(ORIGIN_DATA),
      tagged: ['sieczna' as const, 'wymowa' as const, 'skradanie' as const],
      error: null
    };
    const root = makeFakeRoot();

    renderCharacterCreatorView({
      root,
      data: ORIGIN_DATA,
      state: director.state,
      draft,
      onRerender: () => undefined,
      onComplete: () => undefined
    });

    expect(root.innerHTML).toContain('data-creator-preview="true"');
    expect(root.innerHTML).toContain('ostrze-creator-portrait-frame');
    expect(root.innerHTML).toContain('ostrze-attr-pips');
    expect(root.innerHTML).toContain('ostrze-creator-class-gear');
    expect(root.innerHTML).toContain('aria-label="Zwiększ Siła"');
    expect(root.innerHTML).toContain('aria-pressed="true"');
    expect(root.innerHTML).toContain('aria-live="polite"');
    expect(root.innerHTML).toContain('ostrze-svg-ico');
  });
});
