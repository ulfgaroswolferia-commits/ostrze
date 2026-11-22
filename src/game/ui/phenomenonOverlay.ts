import type { WorldAtmosphereSnapshot } from '../rules/worldCycle';

export interface PhenomenonVisualMeta {
  id: string;
  icon: string;
  kind: 'magiczne' | 'pogodowe';
  accentColor: string;
}

const PHENOMENON_META: Record<string, PhenomenonVisualMeta> = {
  burza_iskier: { id: 'burza_iskier', icon: '⚡', kind: 'magiczne', accentColor: '#7dd3fc' },
  noc_bez_gwiazd: { id: 'noc_bez_gwiazd', icon: '🌑', kind: 'magiczne', accentColor: '#94a3b8' },
  mgla_ciszy: { id: 'mgla_ciszy', icon: '🌫️', kind: 'pogodowe', accentColor: '#cbd5e1' },
  mgla_poranna: { id: 'mgla_poranna', icon: '🌁', kind: 'pogodowe', accentColor: '#e2e8f0' },
  ulewa: { id: 'ulewa', icon: '🌧️', kind: 'pogodowe', accentColor: '#60a5fa' },
  grad: { id: 'grad', icon: '🧊', kind: 'pogodowe', accentColor: '#bae6fd' },
  wichura: { id: 'wichura', icon: '💨', kind: 'pogodowe', accentColor: '#d6d3d1' },
  przymrozek: { id: 'przymrozek', icon: '❄️', kind: 'pogodowe', accentColor: '#a5f3fc' },
  upal: { id: 'upal', icon: '☀️', kind: 'pogodowe', accentColor: '#fbbf24' }
};

export function getPhenomenonVisualMeta(phenomenonId: string | null): PhenomenonVisualMeta | null {
  if (!phenomenonId) return null;
  return (
    PHENOMENON_META[phenomenonId] ?? {
      id: phenomenonId,
      icon: '✨',
      kind: 'pogodowe',
      accentColor: '#e5b869'
    }
  );
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
  tint: number;
}

/**
 * Full-viewport non-interactive (`pointer-events: none`) atmospheric overlay
 * for Ostrze's 9 weather and magic phenomena, paired with a compact HUD badge.
 */
export class PhenomenonOverlay {
  private readonly layerEl: HTMLDivElement;
  private readonly tintEl: HTMLDivElement;
  private readonly canvasEl: HTMLCanvasElement;
  private readonly badgeEl: HTMLDivElement;
  private readonly host: HTMLElement;
  private activePhenomenonId: string | null = null;
  private rafId: number | null = null;
  private lastTickMs = 0;
  private flashAlpha = 0;
  private nextFlashMs = 0;
  private particles: Particle[] = [];
  private readonly reducedMotion: boolean;
  private readonly onResizeBound: () => void;

  constructor(host?: HTMLElement) {
    this.host = host ?? document.body;
    this.reducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.layerEl = document.createElement('div');
    this.layerEl.className = 'ostrze-phenomenon-layer';
    this.layerEl.setAttribute('aria-hidden', 'true');
    this.layerEl.style.display = 'none';

    this.tintEl = document.createElement('div');
    this.tintEl.className = 'ostrze-phenomenon-tint';
    this.layerEl.appendChild(this.tintEl);

    this.canvasEl = document.createElement('canvas');
    this.canvasEl.className = 'ostrze-phenomenon-canvas';
    this.layerEl.appendChild(this.canvasEl);

    this.badgeEl = document.createElement('div');
    this.badgeEl.className = 'ostrze-phenomenon-badge';
    this.badgeEl.setAttribute('data-phenomenon-badge', 'true');
    this.badgeEl.style.display = 'none';

    this.host.appendChild(this.layerEl);
    this.host.appendChild(this.badgeEl);

    this.onResizeBound = () => this.resizeCanvas();
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', this.onResizeBound);
    }
    this.resizeCanvas();
  }

  public getActivePhenomenonId(): string | null {
    return this.activePhenomenonId;
  }

  public sync(snapshot: WorldAtmosphereSnapshot): void {
    const nextId = snapshot.phenomenonId;
    const meta = getPhenomenonVisualMeta(nextId);

    if (!nextId || !meta) {
      this.activePhenomenonId = null;
      this.layerEl.style.display = 'none';
      this.layerEl.removeAttribute('data-phenomenon');
      this.badgeEl.style.display = 'none';
      this.badgeEl.removeAttribute('data-phenomenon');
      this.stopLoop();
      return;
    }

    const changed = this.activePhenomenonId !== nextId;
    this.activePhenomenonId = nextId;

    this.layerEl.style.display = 'block';
    this.layerEl.setAttribute('data-phenomenon', nextId);

    const summary = snapshot.phenomenonSummary ? ` · ${snapshot.phenomenonSummary}` : '';
    const titleName = snapshot.phenomenonName ?? nextId;
    this.badgeEl.style.display = 'inline-flex';
    this.badgeEl.setAttribute('data-phenomenon', nextId);
    this.badgeEl.setAttribute('data-kind', meta.kind);
    this.badgeEl.title = `${titleName}${summary}`;
    this.badgeEl.textContent = `${meta.icon} ${titleName}${summary}`;

    if (changed) {
      this.resizeCanvas();
      this.seedParticles(nextId);
      this.flashAlpha = nextId === 'burza_iskier' ? 0.22 : 0;
      this.nextFlashMs = 1800;
    }

    if (this.reducedMotion) {
      this.renderFrame(0);
    } else {
      this.startLoop();
    }
  }

  private resizeCanvas(): void {
    const width =
      typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth > 0
        ? window.innerWidth
        : 1280;
    const height =
      typeof window !== 'undefined' && typeof window.innerHeight === 'number' && window.innerHeight > 0
        ? window.innerHeight
        : 720;
    this.canvasEl.width = width;
    this.canvasEl.height = height;
  }

  private seedParticles(phenomenonId: string): void {
    const w = this.canvasEl.width || 1280;
    const h = this.canvasEl.height || 720;
    const countMap: Record<string, number> = {
      burza_iskier: 65,
      mgla_ciszy: 18,
      mgla_poranna: 14,
      ulewa: 115,
      grad: 90,
      wichura: 64,
      noc_bez_gwiazd: 26,
      przymrozek: 56,
      upal: 34
    };
    const count = countMap[phenomenonId] ?? 32;
    this.particles = [];
    for (let i = 0; i < count; i++) {
      const seed = (i * 2654435761) >>> 0;
      const r1 = (seed % 1000) / 1000;
      const r2 = ((seed >>> 10) % 1000) / 1000;
      const r3 = ((seed >>> 20) % 1000) / 1000;
      this.particles.push({
        x: r1 * w,
        y: r2 * h,
        vx: 0,
        vy: 0,
        size: 1 + r3 * 2.5,
        alpha: 0.25 + r3 * 0.55,
        phase: r1 * Math.PI * 2,
        tint: r2
      });
    }
  }

  private startLoop(): void {
    if (this.rafId !== null) return;
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      this.renderFrame(0.016);
      return;
    }
    this.lastTickMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const step = (now: number): void => {
      if (!this.activePhenomenonId) {
        this.rafId = null;
        return;
      }
      const dt = Math.min(0.08, Math.max(0.008, (now - this.lastTickMs) / 1000));
      this.lastTickMs = now;
      this.renderFrame(dt);
      this.rafId = window.requestAnimationFrame(step);
    };
    this.rafId = window.requestAnimationFrame(step);
  }

  private stopLoop(): void {
    if (
      this.rafId !== null &&
      typeof window !== 'undefined' &&
      typeof window.cancelAnimationFrame === 'function'
    ) {
      window.cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
  }

  private renderFrame(dt: number): void {
    if (typeof this.canvasEl.getContext !== 'function') return;
    const ctx = this.canvasEl.getContext('2d');
    if (!ctx) return;
    const w = this.canvasEl.width;
    const h = this.canvasEl.height;
    ctx.clearRect(0, 0, w, h);

    const id = this.activePhenomenonId;
    if (!id) return;

    if (id === 'burza_iskier') {
      if (this.flashAlpha > 0) {
        ctx.fillStyle = `rgba(186, 230, 253, ${this.flashAlpha.toFixed(3)})`;
        ctx.fillRect(0, 0, w, h);
        this.flashAlpha = Math.max(0, this.flashAlpha - dt * 1.1);
      }
      this.nextFlashMs -= dt * 1000;
      if (this.nextFlashMs <= 0 && !this.reducedMotion) {
        this.flashAlpha = 0.24;
        this.nextFlashMs = 3400 + Math.random() * 4200;
      }
      for (const p of this.particles) {
        p.phase += dt * 3.8;
        p.x += (Math.sin(p.phase) * 32 + 18) * dt;
        p.y -= (34 + p.size * 18) * dt;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = (p.x + w * 0.37) % w;
        }
        if (p.x > w + 10) p.x = -10;
        const isGold = p.tint > 0.48;
        const glow = 0.45 + 0.55 * Math.abs(Math.sin(p.phase * 1.7));
        ctx.fillStyle = isGold
          ? `rgba(253, 212, 112, ${(p.alpha * glow).toFixed(3)})`
          : `rgba(125, 211, 252, ${(p.alpha * glow).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 1.15, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (id === 'mgla_ciszy' || id === 'mgla_poranna') {
      const isSilence = id === 'mgla_ciszy';
      for (const p of this.particles) {
        p.phase += dt * 0.25;
        p.x += (isSilence ? 14 : 22) * dt;
        if (p.x > w + 260) p.x = -260;
        const rx = 180 + p.size * 95;
        const ry = 55 + p.size * 26;
        const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, rx);
        const rgb = isSilence ? '194, 210, 224' : '232, 236, 240';
        const peak = isSilence ? 0.16 : 0.12;
        grad.addColorStop(0, `rgba(${rgb}, ${(peak * (0.6 + p.alpha * 0.4)).toFixed(3)})`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (id === 'ulewa' || id === 'grad') {
      const isHail = id === 'grad';
      ctx.lineWidth = isHail ? 2 : 1.2;
      for (const p of this.particles) {
        const speedY = isHail ? 520 + p.size * 110 : 440 + p.size * 95;
        const speedX = isHail ? -95 : -130;
        p.x += speedX * dt;
        p.y += speedY * dt;
        if (p.y > h + 20) {
          p.y = -20;
          p.x = (p.x + w * 0.61 + w) % w;
        }
        if (p.x < -20) p.x = w + 20;
        if (isHail) {
          ctx.fillStyle = `rgba(224, 242, 254, ${(p.alpha * 0.85).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(1.6, p.size * 0.9), 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = `rgba(165, 206, 248, ${(p.alpha * 0.55).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 7, p.y + 18 + p.size * 4);
          ctx.stroke();
        }
      }
      return;
    }

    if (id === 'wichura') {
      ctx.lineWidth = 1.4;
      for (const p of this.particles) {
        p.phase += dt * 4.2;
        p.x += (310 + p.size * 90) * dt;
        p.y += Math.sin(p.phase) * 42 * dt;
        if (p.x > w + 40) {
          p.x = -40;
          p.y = (p.y + h * 0.29) % h;
        }
        if (p.tint > 0.65) {
          ctx.fillStyle = `rgba(180, 146, 98, ${(p.alpha * 0.72).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * 1.8, p.size * 0.9, p.phase, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = `rgba(226, 232, 240, ${(p.alpha * 0.34).toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + 28 + p.size * 10, p.y + Math.sin(p.phase) * 3);
          ctx.stroke();
        }
      }
      return;
    }

    if (id === 'przymrozek') {
      for (const p of this.particles) {
        p.phase += dt * 1.6;
        p.x += Math.sin(p.phase) * 16 * dt;
        p.y += (22 + p.size * 12) * dt;
        if (p.y > h + 10) {
          p.y = -10;
          p.x = (p.x + w * 0.41) % w;
        }
        ctx.fillStyle = `rgba(207, 250, 254, ${(p.alpha * 0.68).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    if (id === 'noc_bez_gwiazd') {
      for (const p of this.particles) {
        p.phase += dt * 0.9;
        p.x += Math.cos(p.phase) * 10 * dt;
        p.y -= (8 + p.size * 4) * dt;
        if (p.y < -15) {
          p.y = h + 15;
          p.x = (p.x + w * 0.53) % w;
        }
        ctx.fillStyle = `rgba(15, 23, 42, ${(p.alpha * 0.45).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 12 + p.size * 8, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    // upal — warm sunlit drifting dust/heat motes
    for (const p of this.particles) {
      p.phase += dt * 1.4;
      p.x += Math.sin(p.phase) * 12 * dt;
      p.y -= (12 + p.size * 6) * dt;
      if (p.y < -10) {
        p.y = h + 10;
        p.x = (p.x + w * 0.31) % w;
      }
      ctx.fillStyle = `rgba(253, 224, 134, ${(p.alpha * 0.34).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  public destroy(): void {
    this.stopLoop();
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('resize', this.onResizeBound);
    }
    this.layerEl.remove();
    this.badgeEl.remove();
  }
}
