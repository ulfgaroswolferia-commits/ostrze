import { describe, expect, it } from 'vitest';
import {
  computeExpandedChronicleTop,
  DEFAULT_CHRONICLE_TIMING,
  evaluateChronicleEnvelope
} from '../src/game/ui/chronicleUxController';

describe('Chronicle ambient cRPG UX', () => {
  it('stays in ghost state when idle and transitions through fast fade-in -> hold -> slow fade-out', () => {
    const timing = DEFAULT_CHRONICLE_TIMING;
    expect(timing.fadeInMs).toBeLessThan(timing.fadeOutMs);

    // 1. Idle (no recent trigger)
    const idle = evaluateChronicleEnvelope({
      nowMs: 1000,
      triggerMs: null,
      startVis: 0,
      severity: 'info',
      isExpanded: false,
      timing
    });
    expect(idle).toEqual({ phase: 'ghost', visibility: 0 });

    // 2. Mid fast fade-in
    const midFadeIn = evaluateChronicleEnvelope({
      nowMs: 1000 + timing.fadeInMs / 2,
      triggerMs: 1000,
      startVis: 0,
      severity: 'info',
      isExpanded: false,
      timing
    });
    expect(midFadeIn.phase).toBe('fade-in');
    expect(midFadeIn.visibility).toBeGreaterThan(0.5); // exponential ease-out rises fast
    expect(midFadeIn.visibility).toBeLessThan(1);

    // 3. Reading hold
    const hold = evaluateChronicleEnvelope({
      nowMs: 1000 + timing.fadeInMs + 1500,
      triggerMs: 1000,
      startVis: 0,
      severity: 'info',
      isExpanded: false,
      timing
    });
    expect(hold).toEqual({ phase: 'visible', visibility: 1 });

    // 4. Slow fade-out
    const midFadeOut = evaluateChronicleEnvelope({
      nowMs: 1000 + timing.fadeInMs + timing.holdInfoMs + timing.fadeOutMs / 2,
      triggerMs: 1000,
      startVis: 0,
      severity: 'info',
      isExpanded: false,
      timing
    });
    expect(midFadeOut.phase).toBe('fade-out');
    expect(midFadeOut.visibility).toBeCloseTo(0.5, 2);

    // 5. Back to ghost after fade-out completes
    const afterFadeOut = evaluateChronicleEnvelope({
      nowMs: 1000 + timing.fadeInMs + timing.holdInfoMs + timing.fadeOutMs + 50,
      triggerMs: 1000,
      startVis: 0,
      severity: 'info',
      isExpanded: false,
      timing
    });
    expect(afterFadeOut).toEqual({ phase: 'ghost', visibility: 0 });
  });

  it('holds important/critical/combat alerts longer than standard info entries', () => {
    const timing = DEFAULT_CHRONICLE_TIMING;
    const probeTime = 1000 + timing.fadeInMs + timing.holdInfoMs + 400;

    const infoSample = evaluateChronicleEnvelope({
      nowMs: probeTime,
      triggerMs: 1000,
      startVis: 0,
      severity: 'info',
      isExpanded: false,
      timing
    });
    const importantSample = evaluateChronicleEnvelope({
      nowMs: probeTime,
      triggerMs: 1000,
      startVis: 0,
      severity: 'important',
      isExpanded: false,
      timing
    });

    expect(infoSample.phase).toBe('fade-out');
    expect(importantSample.phase).toBe('visible');
    expect(importantSample.visibility).toBe(1);
  });

  it('forces full visibility when expanded regardless of fade state', () => {
    const expanded = evaluateChronicleEnvelope({
      nowMs: 50000,
      triggerMs: null,
      startVis: 0,
      severity: 'info',
      isExpanded: true
    });
    expect(expanded).toEqual({ phase: 'expanded', visibility: 1 });
  });

  it('positions expanded Chronicle directly below the top-right hub panel without hiding underneath it', () => {
    // Standard desktop viewport with visible hub bar ending at y=312px
    expect(
      computeExpandedChronicleTop({
        viewportHeight: 900,
        hubBottomPx: 312
      })
    ).toBe(322);

    // No hub bar visible -> falls back cleanly below top bar
    expect(
      computeExpandedChronicleTop({
        viewportHeight: 900,
        hubBottomPx: null
      })
    ).toBe(64);

    // Very short viewport with tall hub bar -> clamps to preserve minimum readable height
    expect(
      computeExpandedChronicleTop({
        viewportHeight: 600,
        hubBottomPx: 460,
        minHeightPx: 240,
        bottomMarginPx: 14
      })
    ).toBe(346);
  });
});
