import { describe, expect, it } from 'vitest';
import { resolveCharacterArchetypeTag } from '@ulf/assets/characterBakery';
import { generatePropPbrBuffers } from '@ulf/assets/proceduralForge';
import { computeEdgePanState } from '@ulf/core/isoMath';
import { createBrzezinaYardScene } from '../src/game/maps/prologueMaps';
import { createWilczyBrodScene } from '../src/game/maps/chapter1Maps';
import { createTestBrzezinaYardScene } from '../src/game/maps/testYardMap';

describe('Prologue fixes: training dummies, standing NPCs, exit gate, and cRPG edge panning', () => {
  it('uses training_dummy props instead of totems/pillars for all training dummies', () => {
    const brzezina = createBrzezinaYardScene();
    const dummies = brzezina.map.props.filter((p) => p.id.startsWith('brzezina_kukla_'));
    expect(dummies.length).toBe(3);
    for (const d of dummies) {
      expect(d.kind).toBe('training_dummy');
    }

    const wb = createWilczyBrodScene();
    const wbDummy = wb.map.props.find((p) => p.id === 'wb_kukla_garnizonu');
    expect(wbDummy?.kind).toBe('training_dummy');

    const testYard = createTestBrzezinaYardScene().scene;
    const testDummies = testYard.map.props.filter((p) => p.id.startsWith('test_kukla_'));
    expect(testDummies.length).toBe(2);
    for (const d of testDummies) {
      expect(d.kind).toBe('training_dummy');
    }

    // Verify proceduralForge generates non-empty PBR buffers for all 3 dummy variants
    for (const variant of [0, 1, 2]) {
      const buf = generatePropPbrBuffers('training_dummy', false, 1, 1, variant);
      let opaquePixels = 0;
      for (let i = 3; i < buf.albedoRGBA.length; i += 4) {
        if (buf.albedoRGBA[i] > 128) opaquePixels++;
      }
      expect(opaquePixels).toBeGreaterThan(200);
    }
  });

  it('assigns standing idle NPC archetypes to Prologue NPCs so they are not frozen mid-run', () => {
    const brzezina = createBrzezinaYardScene({ withCourier: true });
    const byId = new Map((brzezina.actors ?? []).map((a) => [a.id, a]));

    expect(resolveCharacterArchetypeTag(byId.get('npc_dobrogost')!.recipe)).toBe('trader');
    expect(resolveCharacterArchetypeTag(byId.get('npc_ragnoslawa')!.recipe)).toBe('peasant_woman');
    expect(resolveCharacterArchetypeTag(byId.get('npc_gnieworad')!.recipe)).toBe('knight');
    expect(resolveCharacterArchetypeTag(byId.get('npc_skarimir')!.recipe)).toBe('knight');
    expect(resolveCharacterArchetypeTag(byId.get('npc_radogost')!.recipe)).toBe('knight');
    expect(resolveCharacterArchetypeTag(byId.get('npc_wojmir')!.recipe)).toBe('peasant_man');
    expect(resolveCharacterArchetypeTag(byId.get('npc_kurier')!.recipe)).toBe('noble');
  });

  it('spans the Brzezina exit gate across the full exit corridor with clear unobstructed access', () => {
    const brzezina = createBrzezinaYardScene();
    const gate = brzezina.map.props.find((p) => p.id === 'brzezina_drogowskaz');
    expect(gate).toBeDefined();
    expect(gate?.kind).toBe('exit_path');
    expect(gate?.x).toBe(10);
    expect(gate?.y).toBe(19);
    expect(gate?.sizeX).toBe(2);
    expect(gate?.sizeY).toBe(1);
    expect(gate?.blocksMovement).toBe(false);
    expect(gate?.interactive).toBe(true);

    // Gate torches flank the exit
    expect(brzezina.map.props.some((p) => p.id === 'brzezina_filar_bramy_l' && p.x === 9 && p.y === 19)).toBe(true);
    expect(brzezina.map.props.some((p) => p.id === 'brzezina_filar_bramy_p' && p.x === 12 && p.y === 19)).toBe(true);

    // No blocking props obstruct the south gate exit tiles (x=10..11, y=18..21)
    const blockingInExit = brzezina.map.props.filter(
      (p) =>
        p.blocksMovement &&
        p.x <= 11 &&
        p.x + p.sizeX - 1 >= 10 &&
        p.y <= 21 &&
        p.y + p.sizeY - 1 >= 18
    );
    expect(blockingInExit).toEqual([]);
  });

  it('triggers cRPG edge panning strictly near viewport edges and never over UI or mid-screen', () => {
    const base = {
      viewportWidth: 1920,
      viewportHeight: 1080,
      marginPx: 24,
      enabled: true,
      isPointerInside: true,
      isOverUi: false,
      forcedDirection: null
    };

    // 60px from edge must NOT trigger panning (no intrusive elliptical ring)
    expect(computeEdgePanState({ ...base, pointerX: 60, pointerY: 540 }).direction).toBeNull();
    expect(computeEdgePanState({ ...base, pointerX: 1860, pointerY: 540 }).direction).toBeNull();
    expect(computeEdgePanState({ ...base, pointerX: 960, pointerY: 60 }).direction).toBeNull();
    expect(computeEdgePanState({ ...base, pointerX: 300, pointerY: 120 }).direction).toBeNull();

    // Hovering UI near the edge must NOT pan
    expect(computeEdgePanState({ ...base, pointerX: 5, pointerY: 540, isOverUi: true }).direction).toBeNull();

    // Top edge (off-center horizontally) pans cleanly straight North (N)
    const north = computeEdgePanState({ ...base, pointerX: 400, pointerY: 6 });
    expect(north.direction).toBe('N');
    expect(north.offsetDeltaX).toBe(0);
    expect(north.offsetDeltaY).toBeGreaterThan(0);

    // Corner triggers diagonal NW
    const nw = computeEdgePanState({ ...base, pointerX: 4, pointerY: 4 });
    expect(nw.direction).toBe('NW');
    expect(nw.offsetDeltaX).toBeGreaterThan(0);
    expect(nw.offsetDeltaY).toBeGreaterThan(0);
  });
});
