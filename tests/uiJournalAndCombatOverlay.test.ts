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

  it('shows live synergy/guard-break callouts, tactical [2]/[R] tip, separated status sections, and cycles targets', () => {
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

      const hostiles = engine.npcs.filter((n) => n.combat?.isHostile && n.combat.isAlive);
      expect(hostiles.length).toBeGreaterThanOrEqual(2);
      const first = hostiles[0]!;
      engine.startCombatWithEnemy(first.id);

      // Apply Burn + Guard to target, and Guard to player
      engine.applyEnemyBurn(first.id, 2);
      first.combat!.defending = true;
      engine.player.combat!.defending = true;
      engine.combatState.selectedAttackMode = 'quick';

      const overlay = new CombatTargetOverlay(engine, ORIGIN_DATA);
      overlay.sync();

      const card = elements.get('ostrze-combat-target-root')!;
      // Normal mode shows tactical tip to switch to [2] or [R]
      expect(card.innerHTML).toContain('data-combat-tactical-tip="true"');
      expect(card.innerHTML).toContain('Przełamanie Gardy');
      expect(card.innerHTML).toContain('Wybuch Żaru');
      // Separated enemy vs player status labels + Riposte Ready indicator
      expect(card.innerHTML).toContain('Statusy celu');
      expect(card.innerHTML).toContain('Twój stan');
      expect(card.innerHTML).toContain('Garda aktywna · Riposta');

      // Switching to power mode [2] activates live synergy & guard break pills
      engine.combatState.selectedAttackMode = 'power';
      overlay.sync();
      expect(card.innerHTML).toContain('data-combat-synergies="true"');
      expect(card.innerHTML).toContain('PRZEŁAMANIE GARDY');
      expect(card.innerHTML).toContain('WYBUCH ŻARU');
      expect(card.innerHTML).not.toContain('data-combat-tactical-tip="true"');

      // Tab target cycling updates engine.combatState.selectedTargetId
      const beforeId = engine.combatState.selectedTargetId;
      expect(overlay.cycleTarget()).toBe(true);
      expect(engine.combatState.selectedTargetId).not.toBe(beforeId);

      overlay.destroy();
    } finally {
      (globalThis as { document?: unknown }).document = origDoc;
    }
  });
});
