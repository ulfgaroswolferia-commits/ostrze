import type { CrpgGameState, LogSeverity } from '@ulf/rpg/gameLoop';

export type ChroniclePhase = 'ghost' | 'fade-in' | 'visible' | 'fade-out' | 'expanded';

export interface ChronicleTimingConfig {
  /** Fast fade-in duration in ms when a new entry arrives */
  fadeInMs: number;
  /** Hold duration in ms for standard info entries */
  holdInfoMs: number;
  /** Hold duration in ms for important / critical / combat entries */
  holdImportantMs: number;
  /** Slow fade-out duration in ms back to ghost outline */
  fadeOutMs: number;
}

export const DEFAULT_CHRONICLE_TIMING: ChronicleTimingConfig = {
  fadeInMs: 260,
  holdInfoMs: 4000,
  holdImportantMs: 5200,
  fadeOutMs: 2600
};

export interface ChronicleVisibilitySample {
  phase: ChroniclePhase;
  /** Normalized visibility 0 (ghost outline) .. 1 (fully visible) */
  visibility: number;
}

/**
 * Pure, deterministic evaluator for the Chronicle's fade-in -> hold -> fade-out envelope.
 * Used both by the live RAF controller and unit tests.
 */
export function evaluateChronicleEnvelope(params: {
  nowMs: number;
  triggerMs: number | null;
  startVis: number;
  severity: LogSeverity;
  isExpanded: boolean;
  timing?: ChronicleTimingConfig;
}): ChronicleVisibilitySample {
  if (params.isExpanded) {
    return { phase: 'expanded', visibility: 1 };
  }
  if (params.triggerMs === null) {
    return { phase: 'ghost', visibility: 0 };
  }

  const timing = params.timing ?? DEFAULT_CHRONICLE_TIMING;
  const elapsed = Math.max(0, params.nowMs - params.triggerMs);
  const holdMs =
    params.severity === 'info' ? timing.holdInfoMs : timing.holdImportantMs;

  if (elapsed < timing.fadeInMs) {
    const t = elapsed / Math.max(1, timing.fadeInMs);
    // Exponential ease-out for crisp, attention-catching entrance
    const eased = 1 - Math.pow(1 - t, 3);
    const vis = params.startVis + (1 - params.startVis) * eased;
    return { phase: 'fade-in', visibility: Math.max(0, Math.min(1, vis)) };
  }

  if (elapsed < timing.fadeInMs + holdMs) {
    return { phase: 'visible', visibility: 1 };
  }

  const fadeOutElapsed = elapsed - (timing.fadeInMs + holdMs);
  if (fadeOutElapsed < timing.fadeOutMs) {
    const t = fadeOutElapsed / Math.max(1, timing.fadeOutMs);
    // Smooth sine-like ease-in-out for unobtrusive dissolution
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const vis = 1 - eased;
    return { phase: 'fade-out', visibility: Math.max(0, Math.min(1, vis)) };
  }

  return { phase: 'ghost', visibility: 0 };
}

/**
 * Computes the optimal `top` CSS pixel offset for the expanded Chronicle so it
 * never hides beneath the top-right hub panel (.ostrze-hub-bar) and always retains
 * comfortable reading height.
 */
export function computeExpandedChronicleTop(params: {
  viewportHeight: number;
  hubBottomPx: number | null;
  gapPx?: number;
  defaultTopPx?: number;
  bottomMarginPx?: number;
  minHeightPx?: number;
}): number {
  const gap = params.gapPx ?? 10;
  const defaultTop = params.defaultTopPx ?? 64;
  const bottomMargin = params.bottomMarginPx ?? 14;
  const minHeight = params.minHeightPx ?? 240;

  const desiredTop =
    params.hubBottomPx !== null && params.hubBottomPx > 0
      ? Math.round(params.hubBottomPx + gap)
      : defaultTop;

  const maxAllowedTop = Math.max(defaultTop, params.viewportHeight - bottomMargin - minHeight);
  return Math.max(defaultTop, Math.min(desiredTop, maxAllowedTop));
}

/**
 * Orchestrates the cRPG ambient Chronicle UX on top of the engine's HudOverlay
 * without modifying any files inside `engine/`:
 * - Ghosted idle outline with click-through & native map edge-panning
 * - Proximity hover detection that highlights & glints the "Rozwiń" button
 * - Fast fade-in -> reading hold -> slow fade-out on new Chronicle entries
 * - Dynamic expanded positioning directly below the top-right hub bar
 */
export class ChronicleUxController {
  private readonly hudRoot: HTMLElement;
  private readonly engine: CrpgGameState;
  private readonly timing: ChronicleTimingConfig;

  private lastSeenEntryKey: string | null = null;
  private triggerMs: number | null = null;
  private startVis = 0;
  private currentVis = 0;
  private currentPhase: ChroniclePhase = 'ghost';
  private activeSeverity: LogSeverity = 'info';
  private wasExpanded = false;
  private isPointerNear = false;
  private rafId: number | null = null;
  private hubResizeObserver: ResizeObserver | null = null;
  private hudMutationObserver: MutationObserver | null = null;
  private observedHubEl: Element | null = null;
  private disposed = false;

  private readonly handleMouseMove = (e: MouseEvent): void => {
    this.updatePointerProximity(e.clientX, e.clientY);
  };

  private readonly handleMouseLeave = (): void => {
    this.setPointerNear(false);
  };

  private readonly handleResize = (): void => {
    this.syncExpandedTopOffset();
  };

  constructor(
    hudRoot: HTMLElement,
    engine: CrpgGameState,
    timing: ChronicleTimingConfig = DEFAULT_CHRONICLE_TIMING
  ) {
    this.hudRoot = hudRoot;
    this.engine = engine;
    this.timing = timing;

    // Seed initial key so an already-empty or initial bootstrap state starts quietly in ghost mode
    this.lastSeenEntryKey = this.readLatestEntryKey();
    this.applyCssState('ghost', 0);
    this.hudRoot.dataset.chronicleNear = '0';

    window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', this.handleMouseLeave);
    window.addEventListener('resize', this.handleResize, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      this.hubResizeObserver = new ResizeObserver(() => {
        this.syncExpandedTopOffset();
      });
    }

    if (typeof MutationObserver !== 'undefined') {
      this.hudMutationObserver = new MutationObserver(() => {
        this.sync();
      });
      this.hudMutationObserver.observe(this.hudRoot, { childList: true });
    }

    this.sync();
  }

  /**
   * Call after HUD renders or game log updates to detect new Chronicle entries,
   * expand/collapse transitions, and hub panel layout changes.
   */
  public sync(): void {
    if (this.disposed) return;

    const chronicleEl = this.hudRoot.querySelector<HTMLElement>('.chronicle-log');
    const isExpanded = Boolean(chronicleEl?.classList.contains('expanded'));

    // Observe the top-right hub panel if it appeared or changed
    const hubEl = document.querySelector('.ostrze-hub-bar');
    if (this.hubResizeObserver && hubEl !== this.observedHubEl) {
      if (this.observedHubEl) {
        this.hubResizeObserver.unobserve(this.observedHubEl);
      }
      this.observedHubEl = hubEl;
      if (hubEl) {
        this.hubResizeObserver.observe(hubEl);
      }
    }

    this.syncExpandedTopOffset();

    // Detect collapse transition: smoothly return to ghost state instead of staying opaque
    if (this.wasExpanded && !isExpanded) {
      this.triggerMs = null;
      this.currentVis = 0;
      this.applyCssState('ghost', 0);
    }
    this.wasExpanded = isExpanded;

    // Detect new Chronicle entry
    const latestKey = this.readLatestEntryKey();
    if (latestKey !== null && latestKey !== this.lastSeenEntryKey) {
      this.lastSeenEntryKey = latestKey;
      this.activeSeverity = this.engine.lastLogSeverity ?? 'info';
      if (!isExpanded) {
        this.triggerMs = performance.now();
        this.startVis = this.currentVis;
        this.ensureAnimationLoop();
      }
    }

    if (isExpanded) {
      this.stopAnimationLoop();
      this.currentVis = 1;
      this.applyCssState('expanded', 1);
      this.setPointerNear(false);
    } else if (this.triggerMs !== null) {
      this.ensureAnimationLoop();
    } else {
      this.applyCssState('ghost', 0);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.stopAnimationLoop();
    window.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseleave', this.handleMouseLeave);
    window.removeEventListener('resize', this.handleResize);
    this.hubResizeObserver?.disconnect();
    this.hubResizeObserver = null;
    this.hudMutationObserver?.disconnect();
    this.hudMutationObserver = null;
  }

  private readLatestEntryKey(): string | null {
    const head = this.engine.chronicleEntries[0];
    if (head) {
      return `${head.id}|${head.timestamp}`;
    }
    if (this.engine.logs.length > 0) {
      return `log|${this.engine.lastLogTimestamp}|${this.engine.logs[0]}`;
    }
    return null;
  }

  private updatePointerProximity(clientX: number, clientY: number): void {
    const chronicleEl = this.hudRoot.querySelector<HTMLElement>('.chronicle-log');
    if (!chronicleEl || chronicleEl.classList.contains('expanded')) {
      this.setPointerNear(false);
      return;
    }

    const rect = chronicleEl.getBoundingClientRect();
    const inside =
      rect.width > 0 &&
      rect.height > 0 &&
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;

    this.setPointerNear(inside);
  }

  private setPointerNear(near: boolean): void {
    if (this.isPointerNear === near) return;
    this.isPointerNear = near;
    this.hudRoot.dataset.chronicleNear = near ? '1' : '0';
  }

  private syncExpandedTopOffset(): void {
    const hubEl = document.querySelector<HTMLElement>('.ostrze-hub-bar');
    let hubBottomPx: number | null = null;
    if (hubEl) {
      const style = window.getComputedStyle(hubEl);
      if (style.display !== 'none' && style.visibility !== 'hidden') {
        const rect = hubEl.getBoundingClientRect();
        if (rect.height > 0 && rect.bottom > 0) {
          hubBottomPx = rect.bottom;
        }
      }
    }

    const topPx = computeExpandedChronicleTop({
      viewportHeight: window.innerHeight,
      hubBottomPx
    });
    this.hudRoot.style.setProperty('--chronicle-expanded-top', `${topPx}px`);
  }

  private ensureAnimationLoop(): void {
    if (this.rafId !== null) return;
    const step = (now: number): void => {
      this.rafId = null;
      if (this.disposed) return;

      const chronicleEl = this.hudRoot.querySelector<HTMLElement>('.chronicle-log');
      const isExpanded = Boolean(chronicleEl?.classList.contains('expanded'));

      const sample = evaluateChronicleEnvelope({
        nowMs: now,
        triggerMs: this.triggerMs,
        startVis: this.startVis,
        severity: this.activeSeverity,
        isExpanded,
        timing: this.timing
      });

      this.currentVis = sample.visibility;
      this.applyCssState(sample.phase, sample.visibility);

      if (sample.phase === 'ghost' || sample.phase === 'expanded') {
        if (sample.phase === 'ghost') {
          this.triggerMs = null;
        }
        return;
      }

      this.rafId = window.requestAnimationFrame(step);
    };

    this.rafId = window.requestAnimationFrame(step);
  }

  private stopAnimationLoop(): void {
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private applyCssState(phase: ChroniclePhase, visibility: number): void {
    if (this.currentPhase !== phase) {
      this.currentPhase = phase;
      this.hudRoot.dataset.chroniclePhase = phase;
    }
    this.hudRoot.style.setProperty('--chronicle-vis', visibility.toFixed(3));
  }
}
