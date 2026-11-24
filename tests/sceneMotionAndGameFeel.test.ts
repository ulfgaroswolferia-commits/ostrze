import { describe, expect, it, vi } from 'vitest';
import {
  classifyCombatImpact,
  computeArcanePulseScale,
  computeDeathCollapsePose,
  computeDodgeGhostOffset,
  computeFearTrembleOffset,
  computeIdleBreathingTransform,
  computePropReactionTransform,
  computeWindSwaySkew,
  resolveNonOverlappingLabelPosition,
  type LabelRect
} from '@ulf/renderer/sceneMotion';
import { OstrzeEngineState } from '../src/engine-bridge/OstrzeEngineState';
import { createBrzezinaYardScene } from '../src/game/maps/prologueMaps';

describe('2.5D Living World & Combat Game Feel (sceneMotion)', () => {
  it('applies organic wind sway only to foliage/banners with spatial phase and respects reducedMotion', () => {
    const oakA = computeWindSwaySkew('ancient_oak', 4, 6, 1.2, false);
    const oakB = computeWindSwaySkew('ancient_oak', 12, 10, 1.2, false);
    const banner = computeWindSwaySkew('school_banner', 4, 6, 0.7, false);

    expect(Math.abs(oakA)).toBeGreaterThan(0);
    expect(Math.abs(oakA)).toBeLessThan(0.06);
    expect(oakA).not.toBeCloseTo(oakB, 4);
    expect(Math.abs(banner)).toBeGreaterThan(0);

    // Rigid structures never sway
    expect(computeWindSwaySkew('slavic_cottage', 4, 6, 1.2, false)).toBe(0);
    expect(computeWindSwaySkew('chest', 4, 6, 1.2, false)).toBe(0);
    expect(computeWindSwaySkew('rock_cliff', 4, 6, 1.2, false)).toBe(0);

    // Reduced motion disables wind sway completely
    expect(computeWindSwaySkew('pine_tree', 4, 6, 1.2, true)).toBe(0);
    expect(computeWindSwaySkew('school_banner', 4, 6, 0.7, true)).toBe(0);
  });

  it('pulses arcane crystals subtly while keeping non-arcane props neutral', () => {
    const pulse1 = computeArcanePulseScale('arcane_crystal', 3, 5, 0.2, false);
    const pulse2 = computeArcanePulseScale('arcane_crystal', 3, 5, 1.1, false);
    expect(pulse1.glowAlpha).toBeGreaterThan(0.1);
    expect(pulse1.scale).not.toBeCloseTo(pulse2.scale, 4);

    const reduced = computeArcanePulseScale('arcane_crystal', 3, 5, 1.1, true);
    expect(reduced.scale).toBe(1);
    expect(reduced.glowAlpha).toBeGreaterThan(0);

    expect(computeArcanePulseScale('campfire', 3, 5, 1.1, false)).toEqual({
      scale: 1,
      glowAlpha: 0
    });
  });

  it('computes reactive prop transforms for training dummy rock and chest pop', () => {
    const rockMid = computePropReactionTransform('rock', 0.15, false);
    expect(Math.abs(rockMid.skewX)).toBeGreaterThan(0.05);
    expect(rockMid.offsetY).toBe(0);

    const popMid = computePropReactionTransform('pop', 0.5, false);
    expect(popMid.offsetY).toBeLessThan(-4);

    expect(computePropReactionTransform('rock', 0.2, true)).toEqual({
      offsetY: 0,
      skewX: 0,
      scaleX: 1,
      scaleY: 1
    });
    expect(computePropReactionTransform('pop', 1.0, false)).toEqual({
      offsetY: 0,
      skewX: 0,
      scaleX: 1,
      scaleY: 1
    });
  });

  it('computes idle breathing, stealth crouch, and suppresses bob while moving or reducedMotion', () => {
    const calm = computeIdleBreathingTransform('hero', 0.8, false, false, false, false);
    const stealth = computeIdleBreathingTransform('hero', 0.8, false, false, true, false);
    const moving = computeIdleBreathingTransform('hero', 0.8, false, true, false, false);
    const reduced = computeIdleBreathingTransform('hero', 0.8, true, false, false, true);

    expect(calm.scaleY).not.toBe(1);
    expect(stealth.scaleY).toBeLessThan(calm.scaleY);
    expect(moving).toEqual({ offsetY: 0, scaleX: 1, scaleY: 1 });
    expect(reduced).toEqual({ offsetY: 0, scaleX: 1, scaleY: 1 });
  });

  it('classifies combat attack outcomes into dodge, parry, hit, and critical categories', () => {
    expect(
      classifyCombatImpact({
        hit: false,
        critical: false,
        rawDamage: 10,
        mitigatedByArmor: 0,
        damageDealt: 0
      })
    ).toBe('dodge');

    expect(
      classifyCombatImpact({
        hit: true,
        critical: false,
        rawDamage: 10,
        mitigatedByArmor: 7,
        damageDealt: 3
      })
    ).toBe('parry');

    expect(
      classifyCombatImpact({
        hit: true,
        critical: false,
        rawDamage: 10,
        mitigatedByArmor: 2,
        damageDealt: 8
      })
    ).toBe('hit');

    expect(
      classifyCombatImpact({
        hit: true,
        critical: true,
        rawDamage: 18,
        mitigatedByArmor: 2,
        damageDealt: 16
      })
    ).toBe('critical');
  });

  it('interpolates death collapse smoothly and snaps immediately under reducedMotion', () => {
    const start = computeDeathCollapsePose(0, false);
    const mid = computeDeathCollapsePose(0.5, false);
    const end = computeDeathCollapsePose(1, false);
    const reduced = computeDeathCollapsePose(0.1, true);

    expect(start.scaleY).toBe(1);
    expect(start.rotation).toBe(0);
    expect(mid.scaleY).toBeLessThan(start.scaleY);
    expect(mid.scaleY).toBeGreaterThan(end.scaleY);
    expect(mid.bloodPoolScale).toBeGreaterThan(start.bloodPoolScale);
    expect(end.scaleY).toBeCloseTo(0.38, 2);
    expect(end.rotation).toBeCloseTo(0.42, 2);
    expect(reduced).toEqual(end);
  });

  it('computes dodge sidestep ghost offset and fear tremble with reducedMotion gating', () => {
    const dodge = computeDodgeGhostOffset(0.5, 1, 0, false);
    expect(Math.hypot(dodge.offsetX, dodge.offsetY)).toBeGreaterThan(4);
    expect(dodge.ghostAlpha).toBeGreaterThan(0.15);
    expect(computeDodgeGhostOffset(0.5, 1, 0, true)).toEqual({
      offsetX: 0,
      offsetY: 0,
      ghostAlpha: 0
    });

    expect(Math.abs(computeFearTrembleOffset('hero', 0.25, false))).toBeGreaterThan(0);
    expect(computeFearTrembleOffset('hero', 0.25, true)).toBe(0);
  });

  it('exposes visual statuses and triggers prop reactions from OstrzeEngineState', () => {
    const engine = new OstrzeEngineState();
    engine.registerCustomScene(createBrzezinaYardScene({ sparingHostile: false }));
    engine.loadCustomScene('brzezina_dziedziniec');

    const reactionSpy = vi.fn();
    engine.onPropReaction = reactionSpy;

    const dummy = engine.map.props.find((p) => p.kind === 'training_dummy');
    const chest = engine.map.props.find((p) => p.kind === 'chest');
    expect(dummy).toBeDefined();
    expect(chest).toBeDefined();

    engine.togglePropInteraction(dummy!.id);
    expect(reactionSpy).toHaveBeenCalledWith(dummy!.id, 'rock');

    engine.togglePropInteraction(chest!.id);
    expect(reactionSpy).toHaveBeenCalledWith(chest!.id, 'pop');

    engine.applyEnemyBurn('enemy_1', 2);
    expect(engine.getActorVisualStatuses('enemy_1')).toEqual(['podpalenie']);
    expect(engine.getActorVisualStatuses(engine.player.id)).toEqual([]);
  });

  it('de-overlaps adjacent prop and NPC labels (e.g. SKARIMIR next to Obozowe Ognisko)', () => {
    const placed: LabelRect[] = [];
    const propPos = resolveNonOverlappingLabelPosition(
      200,
      300,
      110,
      16,
      [
        { x: 0, y: -42 },
        { x: 0, y: -64 }
      ],
      placed
    );
    const npcPos = resolveNonOverlappingLabelPosition(
      195,
      335,
      80,
      16,
      [
        { x: 0, y: -79 },
        { x: 0, y: -105 }
      ],
      placed
    );

    expect(propPos).toEqual({ x: 200, y: 258 });
    // First NPC candidate (335 - 79 = 256) collides with prop label (258), so it shifts cleanly upward
    expect(npcPos).toEqual({ x: 195, y: 230 });
    expect(placed).toHaveLength(2);
  });
});
