import { ostrzeAudio } from '../audio/ostrzeAudio';
import {
  evaluateTimedStrikePosition,
  TIMED_STRIKE_DURATION_MS,
  TIMED_STRIKE_GOOD_HALF_WIDTH,
  TIMED_STRIKE_PERFECT_HALF_WIDTH,
  TIMED_STRIKE_SWEET_CENTER,
  type TimedStrikeGrade
} from '../rules/combatMomentum';
import { escapeHtml } from './escapeHtml';

export type ImpactFlashTone = 'gold' | 'crimson' | 'steel' | 'fire';

interface ActiveTimedStrike {
  label: string;
  startTimeMs: number;
  durationMs: number;
  rafId: number | null;
  fallbackTimer: ReturnType<typeof setTimeout> | null;
  resolved: boolean;
  onResolve: (grade: TimedStrikeGrade) => void;
}

/**
 * Tactile combat game-feel overlay:
 * - Screen edge impact flashes (gold crit/execution, crimson player hurt, steel riposte, fire blast)
 * - Dramatic non-blocking combat callout banners
 * - Active Timed Strike bar ("Aktywny Cios" — Space/Click in the gold zone for +30% dmg & +35% crit)
 */
export class CombatFeelOverlay {
  private readonly flashEl: HTMLElement;
  private readonly calloutEl: HTMLElement;
  private readonly timedRoot: HTMLElement;
  private readonly abortController = new AbortController();
  private disposed = false;

  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  private calloutTimer: ReturnType<typeof setTimeout> | null = null;
  private timedHideTimer: ReturnType<typeof setTimeout> | null = null;
  private activeStrike: ActiveTimedStrike | null = null;
  private lastStrikeEndedAtMs = 0;
  private cursorEl: HTMLElement | null = null;

  constructor() {
    document.getElementById('ostrze-combat-flash-layer')?.remove();
    document.getElementById('ostrze-combat-callout')?.remove();
    document.getElementById('ostrze-timed-strike-root')?.remove();

    this.flashEl = document.createElement('div');
    this.flashEl.id = 'ostrze-combat-flash-layer';
    this.flashEl.className = 'ostrze-combat-flash-layer';
    this.flashEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.flashEl);

    this.calloutEl = document.createElement('div');
    this.calloutEl.id = 'ostrze-combat-callout';
    this.calloutEl.className = 'ostrze-combat-callout';
    this.calloutEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.calloutEl);

    this.timedRoot = document.createElement('div');
    this.timedRoot.id = 'ostrze-timed-strike-root';
    this.timedRoot.className = 'ostrze-timed-strike-root';
    document.body.appendChild(this.timedRoot);

    window.addEventListener(
      'keydown',
      (e) => {
        const isSpace = e.code === 'Space' || e.key === ' ';
        if (!this.activeStrike || this.activeStrike.resolved) {
          // 450ms grace guard: a slightly-late Space press right after the bar expires
          // must NEVER accidentally end the player's combat turn!
          const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
          if (isSpace && this.lastStrikeEndedAtMs > 0 && nowMs - this.lastStrikeEndedAtMs < 450) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
          return;
        }
        if (isSpace || e.key === 'Enter' || e.key.toLowerCase() === 'e') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.lockInCurrentStrike();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
          this.finishStrike('miss', 1);
        } else if (!e.ctrlKey && !e.altKey && !e.metaKey) {
          // Block other combat/modal hotkeys (1, 3, 4-7, K, M, etc.) while timing bar is active
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      { capture: true, signal: this.abortController.signal }
    );

    window.addEventListener(
      'pointerdown',
      (e) => {
        if (!this.activeStrike || this.activeStrike.resolved) return;
        // Ignore the synthetic/original click frame that launched the bar (< 60ms)
        const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (nowMs - this.activeStrike.startTimeMs < 60) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        this.lockInCurrentStrike();
      },
      { capture: true, signal: this.abortController.signal }
    );
  }

  public isTimedStrikeActive(): boolean {
    return Boolean(this.activeStrike && !this.activeStrike.resolved);
  }

  public triggerFlash(tone: ImpactFlashTone): void {
    if (this.disposed) return;
    if (this.flashTimer) clearTimeout(this.flashTimer);
    this.flashEl.className = 'ostrze-combat-flash-layer';
    // Force reflow so rapid consecutive hits re-trigger CSS pulse cleanly
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add(`is-${tone}`, 'is-active');
    this.flashTimer = setTimeout(() => {
      this.flashEl.classList.remove('is-active');
    }, 340);
  }

  public showCallout(headline: string, subtext?: string, tone: ImpactFlashTone = 'gold'): void {
    if (this.disposed || !headline) return;
    if (this.calloutTimer) clearTimeout(this.calloutTimer);
    this.calloutEl.className = `ostrze-combat-callout is-${tone} is-visible`;
    this.calloutEl.innerHTML = `
      <div class="ostrze-combat-callout-title">${escapeHtml(headline)}</div>
      ${subtext ? `<div class="ostrze-combat-callout-sub">${escapeHtml(subtext)}</div>` : ''}
    `;
    this.calloutTimer = setTimeout(() => {
      this.calloutEl.classList.remove('is-visible');
    }, 1350);
  }

  /**
   * Launches the Timed Strike bar. Player presses Space / Enter / Click in the golden zone
   * for Perfect (+30% dmg, +35% crit) or Good (+12% dmg, +10% crit). Letting it finish
   * executes a normal strike with zero penalty.
   */
  public startTimedStrike(
    label: string,
    onResolve: (grade: TimedStrikeGrade) => void,
    durationMs = TIMED_STRIKE_DURATION_MS
  ): boolean {
    if (this.disposed || this.activeStrike) return false;
    if (this.timedHideTimer) {
      clearTimeout(this.timedHideTimer);
      this.timedHideTimer = null;
    }

    const goodLeftPct = Math.max(0, (TIMED_STRIKE_SWEET_CENTER - TIMED_STRIKE_GOOD_HALF_WIDTH) * 100);
    const goodWidthPct = Math.min(100 - goodLeftPct, TIMED_STRIKE_GOOD_HALF_WIDTH * 2 * 100);
    const perfectLeftPct = Math.max(
      0,
      (TIMED_STRIKE_SWEET_CENTER - TIMED_STRIKE_PERFECT_HALF_WIDTH) * 100
    );
    const perfectWidthPct = Math.min(
      100 - perfectLeftPct,
      TIMED_STRIKE_PERFECT_HALF_WIDTH * 2 * 100
    );

    this.timedRoot.innerHTML = `
      <div class="ostrze-timed-strike-wrap is-active" data-timed-strike-bar="true" data-ui-block-pan="true">
        <div class="ostrze-timed-strike-head">
          <span class="ostrze-timed-strike-label">⚔️ ${escapeHtml(label)}</span>
          <span class="ostrze-timed-strike-hint"><kbd class="ostrze-kbd">Spacja</kbd> lub klik w złote pole!</span>
        </div>
        <div class="ostrze-timed-strike-track">
          <div class="ostrze-timed-zone is-good" style="left:${goodLeftPct.toFixed(1)}%;width:${goodWidthPct.toFixed(1)}%"></div>
          <div class="ostrze-timed-zone is-perfect" style="left:${perfectLeftPct.toFixed(1)}%;width:${perfectWidthPct.toFixed(1)}%"></div>
          <div class="ostrze-timed-sweet-marker" style="left:${(TIMED_STRIKE_SWEET_CENTER * 100).toFixed(1)}%"></div>
          <div class="ostrze-timed-cursor" style="left:0%"></div>
        </div>
        <div class="ostrze-timed-strike-result" data-timed-result="true"></div>
      </div>
    `;

    this.cursorEl = this.timedRoot.querySelector<HTMLElement>('.ostrze-timed-cursor');

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const strike: ActiveTimedStrike = {
      label,
      startTimeMs: nowMs,
      durationMs,
      rafId: null,
      fallbackTimer: null,
      resolved: false,
      onResolve
    };
    this.activeStrike = strike;

    const tick = (): void => {
      if (!this.activeStrike || this.activeStrike !== strike || strike.resolved) return;
      const tNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const progress = Math.min(1, Math.max(0, (tNow - strike.startTimeMs) / strike.durationMs));
      if (this.cursorEl) {
        this.cursorEl.style.left = `${(progress * 100).toFixed(2)}%`;
      }
      if (progress >= 1) {
        this.finishStrike('miss', 1);
        return;
      }
      if (typeof requestAnimationFrame === 'function') {
        strike.rafId = requestAnimationFrame(tick);
      }
    };

    if (typeof requestAnimationFrame === 'function') {
      strike.rafId = requestAnimationFrame(tick);
    } else {
      strike.fallbackTimer = setTimeout(() => {
        this.finishStrike('miss', 1);
      }, durationMs);
    }

    return true;
  }

  public lockInCurrentStrike(): TimedStrikeGrade | null {
    const strike = this.activeStrike;
    if (!strike || strike.resolved) return null;
    const tNow = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const progress = Math.min(1, Math.max(0, (tNow - strike.startTimeMs) / strike.durationMs));
    const evalRes = evaluateTimedStrikePosition(progress);
    this.finishStrike(evalRes.grade, progress);
    return evalRes.grade;
  }

  private finishStrike(grade: TimedStrikeGrade, progress01: number): void {
    const strike = this.activeStrike;
    if (!strike || strike.resolved) return;
    strike.resolved = true;
    if (strike.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(strike.rafId);
    }
    if (strike.fallbackTimer !== null) {
      clearTimeout(strike.fallbackTimer);
    }
    this.activeStrike = null;
    this.lastStrikeEndedAtMs = typeof performance !== 'undefined' ? performance.now() : Date.now();

    if (this.cursorEl) {
      this.cursorEl.style.left = `${(Math.min(1, Math.max(0, progress01)) * 100).toFixed(2)}%`;
    }
    const wrapEl = this.timedRoot.querySelector<HTMLElement>('.ostrze-timed-strike-wrap');
    const resultEl = this.timedRoot.querySelector<HTMLElement>('[data-timed-result]');
    if (wrapEl) {
      wrapEl.classList.add(`is-grade-${grade}`);
    }
    if (resultEl) {
      resultEl.textContent =
        grade === 'perfect'
          ? '⚡ IDEALNY CIOS! (+30% obr., +35% kryt)'
          : grade === 'good'
            ? '✨ DOBRY RYTM! (+12% obr.)'
            : 'Standardowy cios';
    }

    ostrzeAudio.playTimedStrike(grade === 'none' ? 'miss' : grade);
    strike.onResolve(grade);

    this.timedHideTimer = setTimeout(() => {
      if (!this.activeStrike) {
        this.timedRoot.innerHTML = '';
        this.cursorEl = null;
      }
    }, grade === 'perfect' ? 560 : 380);
  }

  public cancelTimedStrike(): void {
    const strike = this.activeStrike;
    if (!strike) return;
    strike.resolved = true;
    if (strike.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(strike.rafId);
    }
    if (strike.fallbackTimer !== null) {
      clearTimeout(strike.fallbackTimer);
    }
    this.activeStrike = null;
    this.lastStrikeEndedAtMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.timedRoot.innerHTML = '';
    this.cursorEl = null;
  }

  public destroy(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelTimedStrike();
    if (this.flashTimer) clearTimeout(this.flashTimer);
    if (this.calloutTimer) clearTimeout(this.calloutTimer);
    if (this.timedHideTimer) clearTimeout(this.timedHideTimer);
    this.abortController.abort();
    this.flashEl.remove();
    this.calloutEl.remove();
    this.timedRoot.remove();
  }
}
