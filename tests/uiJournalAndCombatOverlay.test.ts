import { describe, expect, it } from 'vitest';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createBorKlusownikowScene } from '../src/game/maps/chapter2Maps';
import { createCharacter, createEmptyOstrzeState, grantXp } from '../src/game/rules/character';
import { createRng } from '../src/game/rules/dice';
import { CombatTargetOverlay } from '../src/game/ui/combatTargetOverlay';
import { renderCharacterSheetView } from '../src/game/ui/views/CharacterSheetView';

function createHeroState() {
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
  grantXp(state, 200, ORIGIN_DATA);
  return state;
}

function makeFakeElement() {
  return {
    id: '',
    innerHTML: '',
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    remove: () => {}
  };
}

describe('Journal Objectives & Enhanced CombatTargetOverlay', () => {
  it('renders active quest objectives checklist (✓ / ○) with location hints in Journal tab', () => {
    const state = createHeroState();
    state.quests.przyjecie_w_osadzie = 'active';
    state.flags.soltys_przyjal = true;

    const root = makeFakeElement();
    renderCharacterSheetView({
      root: root as unknown as HTMLElement,
      data: ORIGIN_DATA,
      state,
      rng: createRng(2026),
      activeTab: 'journal',
      onSelectTab: () => {},
      onUpdated: () => {},
      onShowToast: () => {},
      onClose: () => {},
      onRerender: () => {}
    });

    expect(root.innerHTML).toContain('ostrze-quest-objectives');
    expect(root.innerHTML).toContain('ostrze-quest-obj is-done');
    expect(root.innerHTML).toContain('✓');
    expect(root.innerHTML).toContain('○');
    expect(root.innerHTML).toContain('Głuszec');
  });

  it('displays archetype badge, weapon damageType multiplier, and Gwiezdne Ostrze override', () => {
    const origDoc = (globalThis as { document?: unknown }).document;
    const elements = new Map<string, ReturnType<typeof makeFakeElement>>();
    (globalThis as { document?: unknown }).document = {
      getElementById: (id: string) => elements.get(id) ?? null,
      createElement: () => makeFakeElement(),
      body: {
        appendChild: (el: ReturnType<typeof makeFakeElement>) => {
          if (el.id) elements.set(el.id, el);
        }
      }
    };

    try {
      const engine = new OstrzeEngineState();
      const state = createHeroState();
      state.inventory.equipped.bron = 'miecz_krotki';
      engine.registerCustomScene(createBorKlusownikowScene({ withHunt: true }));
      engine.loadCustomScene('bor_klusownikow');
      engine.syncFromOstrzeState(state, ORIGIN_DATA);

      const boss = engine.npcs.find((n) => n.id === 'enemy_bor_herszt')!;
      boss.id = 'upior_nocy_boss';
      boss.recipe.name = 'Upiór nocy';
      engine.startCombatWithEnemy(boss.id);

      const overlay = new CombatTargetOverlay(engine, ORIGIN_DATA);
      overlay.sync();

      const card = elements.get('ostrze-combat-target-root')!;
      expect(card.innerHTML).toContain('👑 Boss');
      expect(card.innerHTML).toContain('Twój atak (cięte)');
      expect(card.innerHTML).toContain('×0.1 ODPORNOŚĆ');

      state.flags.bogdan_gwiezdne_ostrze = true;
      overlay.sync();
      expect(card.innerHTML).toContain('✨ Gwiezdne (×1.0)');

      overlay.destroy();
    } finally {
      (globalThis as { document?: unknown }).document = origDoc;
    }
  });
});
