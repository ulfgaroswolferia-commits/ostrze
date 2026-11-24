import { describe, expect, it, vi } from 'vitest';
import {
  BLOCKING_MODAL_SELECTOR,
  getTelegraphThreatTiles,
  keyOutWhiteBackgroundRgba,
  registerCustomPropSprite,
  resolveCustomPropSprite
} from '@ulf/renderer/isoSceneView';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { PAINTERLY_PROP_SPECS } from '../src/game/assets/painterlyProps';
import { ORIGIN_DATA } from '../src/game/data/originData';
import { createBrzezinaYardScene } from '../src/game/maps/prologueMaps';
import { createCharacter, createEmptyOstrzeState } from '../src/game/rules/character';

describe('Drakensang × Fallout Vertical Slice (Brzezina + Trakt)', () => {
  it('registers painterly 2.5D prop sprites for Brzezina and Trakt landmarks', () => {
    const engine = new OstrzeEngineState();
    expect(engine.enemyCombatMoveSpeed).toBeGreaterThan(4);
    expect(PAINTERLY_PROP_SPECS.length).toBeGreaterThanOrEqual(6);

    expect(resolveCustomPropSprite({ id: 'brzezina_dwor_szkoly', kind: 'slavic_cottage' })?.url).toContain(
      'brzezina_dwor'
    );
    expect(resolveCustomPropSprite({ id: 'brzezina_zbrojownia_szkoly', kind: 'slavic_cottage' })?.url).toContain(
      'brzezina_kuznia'
    );
    expect(resolveCustomPropSprite({ id: 'brzezina_baszta_szkoly', kind: 'watchtower' })?.url).toContain(
      'brzezina_brama'
    );
    expect(resolveCustomPropSprite({ id: 'brzezina_kapliczka', kind: 'slavic_shrine' })?.url).toContain(
      'trakt_kapliczka'
    );
    expect(resolveCustomPropSprite({ id: 'trakt_woz_rozbity', kind: 'dungeon_crate' })?.url).toContain(
      'trakt_woz'
    );
    expect(resolveCustomPropSprite({ id: 'brzezina_dab', kind: 'ancient_oak' })?.url).toContain(
      'drzewo_brzoza'
    );
    expect(resolveCustomPropSprite({ id: 'trakt_martwe_drzewo', kind: 'dead_tree' })?.url).toContain(
      'drzewo_martwe'
    );
  });

  it('registers painterly 2.5D prop sprites across Act I and Act II landmarks', () => {
    new OstrzeEngineState();
    expect(PAINTERLY_PROP_SPECS.length).toBeGreaterThanOrEqual(25);

    // Act I landmarks
    expect(resolveCustomPropSprite({ id: 'wb_karczma', kind: 'slavic_cottage' })?.url).toContain('karczma');
    expect(resolveCustomPropSprite({ id: 'wb_kuznia', kind: 'slavic_cottage' })?.url).toContain('brzezina_kuznia');
    expect(resolveCustomPropSprite({ id: 'wb_koszary_straznicy', kind: 'slavic_cottage' })?.url).toContain(
      'koszary_drewniane'
    );
    expect(resolveCustomPropSprite({ id: 'brzezina_dormitorium_1', kind: 'slavic_cottage' })?.url).toContain(
      'koszary_drewniane'
    );
    expect(resolveCustomPropSprite({ id: 'brzezina_chata', kind: 'slavic_cottage' })?.url).toContain('chata_lesna');
    expect(resolveCustomPropSprite({ id: 'wb_kramik', kind: 'market_stall' })?.url).toContain('stragan_kupiecki');
    expect(resolveCustomPropSprite({ id: 'wb_woz_ostromira', kind: 'market_stall' })?.url).toContain('woz_kupiecki');
    expect(resolveCustomPropSprite({ id: 'wb_studnia', kind: 'slavic_well' })?.url).toContain('studnia_slowianska');
    expect(resolveCustomPropSprite({ id: 'wb_namiot_zwiadowcow', kind: 'ranger_tent' })?.url).toContain(
      'namiot_zwiadowcow'
    );
    expect(resolveCustomPropSprite({ id: 'mlyn_budynek', kind: 'slavic_cottage' })?.url).toContain('stary_mlyn');
    expect(resolveCustomPropSprite({ id: 'lesniczowka_chata', kind: 'slavic_cottage' })?.url).toContain('chata_lesna');
    expect(resolveCustomPropSprite({ id: 'ruiny_mur_znak', kind: 'runic_altar' })?.url).toContain('oltarz_runiczny');
    expect(resolveCustomPropSprite({ id: 'krypta_sarkofag', kind: 'sarcophagus' })?.url).toContain('sarkofag');
    expect(resolveCustomPropSprite({ id: 'trakt_drogowskaz', kind: 'travel_signpost' })?.url).toContain('drogowskaz');
    expect(resolveCustomPropSprite({ id: 'las_sosna', kind: 'pine_tree' })?.url).toContain('drzewo_sosna');
    expect(resolveCustomPropSprite({ id: 'las_sosna', kind: 'pine_tree' })?.allowMirrorX).toBe(true);
    expect(resolveCustomPropSprite({ id: 'skala_1', kind: 'rock_cliff' })?.url).toContain('skala_klif');
    expect(resolveCustomPropSprite({ id: 'skala_1', kind: 'rock_cliff' })?.allowMirrorX).toBe(true);
    expect(resolveCustomPropSprite({ id: 'wb_palisada_s_l1', kind: 'wattle_fence' })?.url).toContain('plot_pleciony');
    expect(resolveCustomPropSprite({ id: 'wb_palisada_s_l1', kind: 'wattle_fence' })?.allowMirrorX).toBeUndefined();

    // Act II landmarks
    expect(resolveCustomPropSprite({ id: 'gluszec_karczma', kind: 'slavic_cottage' })?.url).toContain('karczma');
    expect(resolveCustomPropSprite({ id: 'gluszec_dom_soltysa', kind: 'slavic_cottage' })?.url).toContain(
      'brzezina_dwor'
    );
    expect(resolveCustomPropSprite({ id: 'kapliczka_oltarz', kind: 'travel_signpost' })?.url).toContain(
      'trakt_kapliczka'
    );
    expect(resolveCustomPropSprite({ id: 'spalona_chata_zachod', kind: 'slavic_cottage' })?.url).toContain(
      'ruiny_spalone'
    );
    expect(resolveCustomPropSprite({ id: 'kopalnia_wejscie_glowne', kind: 'rock_cliff' })?.url).toContain(
      'wejscie_kopalni'
    );
    expect(resolveCustomPropSprite({ id: 'kamieniolom_wejscie_sztolni', kind: 'rock_cliff' })?.url).toContain(
      'wejscie_kopalni'
    );
    expect(resolveCustomPropSprite({ id: 'wzgorze_wieza', kind: 'watchtower' })?.url).toContain('wieza_straznicza');

    // Phase 2 global kind painterly props
    expect(resolveCustomPropSprite({ id: 'oboz_ognisko', kind: 'campfire' })?.url).toContain('ognisko');
    expect(resolveCustomPropSprite({ id: 'skrzynia_1', kind: 'chest', isOpen: false })?.url).toContain(
      'skrzynia_zamknieta'
    );
    expect(resolveCustomPropSprite({ id: 'brzezina_manekin_1', kind: 'training_dummy' })?.url).toContain(
      'manekin_treningowy'
    );
    expect(resolveCustomPropSprite({ id: 'brzezina_sztandar', kind: 'school_banner' })?.url).toContain(
      'sztandar_szkoly'
    );
    expect(resolveCustomPropSprite({ id: 'las_pniak', kind: 'tree_stump' })?.url).toContain('pien_drzewa');
    expect(resolveCustomPropSprite({ id: 'las_pniak', kind: 'tree_stump' })?.allowMirrorX).toBe(true);
    expect(resolveCustomPropSprite({ id: 'las_zwalony', kind: 'fallen_log' })?.url).toContain('zwalony_pien');
    expect(resolveCustomPropSprite({ id: 'las_zwalony', kind: 'fallen_log' })?.allowMirrorX).toBe(true);
    expect(resolveCustomPropSprite({ id: 'las_krzak', kind: 'berry_bush' })?.url).toContain('krzak_jagod');
    expect(resolveCustomPropSprite({ id: 'las_krzak', kind: 'berry_bush' })?.allowMirrorX).toBe(true);
    expect(resolveCustomPropSprite({ id: 'krypta_krysztal', kind: 'arcane_crystal' })?.url).toContain(
      'krysztal_runiczny'
    );
    expect(resolveCustomPropSprite({ id: 'krypta_krysztal', kind: 'arcane_crystal' })?.allowMirrorX).toBe(true);
    expect(resolveCustomPropSprite({ id: 'cmentarz_plot', kind: 'graveyard_fence' })?.url).toContain('plot_cmentarny');
  });

  it('keys out both outer white margins and enclosed white pockets while preserving warm highlights', () => {
    const w = 9;
    const h = 9;
    const px = new Uint8ClampedArray(w * h * 4);
    const setPx = (x: number, y: number, r: number, g: number, b: number, a = 255) => {
      const i = (y * w + x) * 4;
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      px[i + 3] = a;
    };

    // Pure white background everywhere
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) setPx(x, y, 255, 255, 255, 255);
    }
    // Dark outline ring (x=1..7, y=1..7) enclosing an interior pocket (x=2..6, y=2..6)
    for (let i = 1; i <= 7; i++) {
      setPx(i, 1, 35, 30, 25);
      setPx(i, 7, 35, 30, 25);
      setPx(1, i, 35, 30, 25);
      setPx(7, i, 35, 30, 25);
    }
    // Place a warm bright candle/canvas highlight inside the outline (should be preserved)
    setPx(2, 2, 255, 225, 160);
    // Center (4,4) and surrounding (3..5,3..5) remain pure white enclosed pocket (should be keyed out)

    keyOutWhiteBackgroundRgba(px, w, h);

    // Outer corner keyed out
    expect(px[(0 * w + 0) * 4 + 3]).toBe(0);
    // Enclosed white pocket keyed out
    expect(px[(4 * w + 4) * 4 + 3]).toBe(0);
    // Dark outline preserved
    expect(px[(1 * w + 4) * 4 + 3]).toBe(255);
    // Warm highlight preserved
    expect(px[(2 * w + 2) * 4 + 3]).toBe(255);
  });

  it('resolves distinct custom prop sprites for closed vs open states when isOpen is configured', () => {
    registerCustomPropSprite({
      id: 'test_stateful_chest',
      isOpen: false,
      url: 'skrzynia_zamknieta.jpg'
    });
    registerCustomPropSprite({
      id: 'test_stateful_chest',
      isOpen: true,
      url: 'skrzynia_otwarta.jpg'
    });

    expect(
      resolveCustomPropSprite({ id: 'test_stateful_chest', kind: 'chest', isOpen: false })?.url
    ).toBe('skrzynia_zamknieta.jpg');
    expect(
      resolveCustomPropSprite({ id: 'test_stateful_chest', kind: 'chest', isOpen: true })?.url
    ).toBe('skrzynia_otwarta.jpg');
  });

  it('blocks canvas input for all engine and Ostrze modal overlays', () => {
    for (const sel of [
      '.credits-modal-backdrop',
      '.character-backdrop',
      '.dialogue-backdrop',
      '.combat-confirm-backdrop',
      '.combat-report-modal-backdrop',
      '.item-details-backdrop',
      '.ostrze-overlay'
    ]) {
      expect(BLOCKING_MODAL_SELECTOR).toContain(sel);
    }
  });

  it('computes accurate 2.5D threat zones for telegraphed enemy attacks', () => {
    const cleave = getTelegraphThreatTiles(5, 5, 'heavy_cleave', 12, 12);
    expect(cleave).toHaveLength(8);
    expect(cleave.some((t) => t.x === 5 && t.y === 5)).toBe(false);

    const howl = getTelegraphThreatTiles(5, 5, 'terror_howl', 12, 12);
    expect(howl).toHaveLength(12); // Manhattan radius 2 excluding center
    expect(howl.every((t) => Math.abs(t.x - 5) + Math.abs(t.y - 5) <= 2)).toBe(true);

    // Corner clamping
    const cornerCleave = getTelegraphThreatTiles(0, 0, 'heavy_cleave', 12, 12);
    expect(cornerCleave).toHaveLength(3);
  });

  it('opens combat with a Surprise Attack bonus from real-time exploration while protecting Prologue allies', () => {
    const state = createEmptyOstrzeState(ORIGIN_DATA, 33);
    createCharacter(
      state,
      {
        name: 'Mściwój',
        classId: 'miecz',
        attributes: {
          sila: 7,
          zrecznosc: 6,
          krzepa: 7,
          bystrosc: 5,
          rozum: 8,
          oglada: 4,
          fart: 4
        },
        tagged: ['sieczna', 'skradanie', 'wymowa']
      },
      ORIGIN_DATA
    );

    const engine = new OstrzeEngineState();
    engine.registerCustomScene(createBrzezinaYardScene({ sparingHostile: true }));
    engine.loadCustomScene('brzezina_dziedziniec');
    engine.syncFromOstrzeState(state, ORIGIN_DATA);

    const impactSpy = vi.fn();
    engine.onJuicyImpact = impactSpy;

    // Friendly story NPC (e.g. Gnieworad) cannot be attacked in Prologue
    const ally = engine.npcs.find((n) => !n.combat?.isHostile);
    expect(ally).toBeDefined();
    expect(engine.commandAttackEnemyFromExploration(ally!.id)).toBe(false);

    // Hostile sparring instructor can be initiated with Surprise Attack from exploration
    const hostile = engine.npcs.find((n) => n.combat?.isHostile && n.combat.isAlive);
    expect(hostile).toBeDefined();
    hostile!.combat!.hp = 80;
    hostile!.combat!.maxHp = 80;
    hostile!.tileX = engine.player.tileX + 1;
    hostile!.tileY = engine.player.tileY;
    hostile!.x = hostile!.tileX + 0.5;
    hostile!.y = hostile!.tileY + 0.5;
    engine.isStealthActive = true;

    const ok = engine.commandAttackEnemyFromExploration(hostile!.id);
    expect(ok).toBe(true);
    expect(engine.combatState.active).toBe(true);
    expect(engine.combatLogs.some((l) => l.includes('ATAK Z ZASKOCZENIA'))).toBe(true);
    expect(engine.pendingSurpriseAttack).toBe(false);
  });
});
