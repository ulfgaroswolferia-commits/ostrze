/**
 * Audio facade for Ostrze 2.5D.
 * Provides procedural Web Audio UI/dialogue/quest chimes, creature SFX, and looping ambient soundscapes.
 * Respects `ulf_crpg_audio_muted`.
 */
export type OstrzeAmbienceMood = 'none' | 'town' | 'dawn' | 'forest' | 'creepy_forest' | 'night_storm';

class OstrzeAudioManager {
  private ctx: AudioContext | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private currentMood: OstrzeAmbienceMood = 'none';

  private isMuted(): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem('ulf_crpg_audio_muted') === 'true';
    } catch {
      return false;
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined' || this.isMuted()) return null;
    try {
      if (!this.ctx) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => undefined);
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'triangle',
    gainPeak = 0.08,
    delaySec = 0,
    endFreq?: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (typeof endFreq === 'number') {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + durationSec);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationSec + 0.02);
  }

  public getMuted(): boolean {
    return this.isMuted();
  }

  public toggleMute(): boolean {
    const next = !this.isMuted();
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ulf_crpg_audio_muted', next ? 'true' : 'false');
      }
    } catch {
      // ignore storage errors
    }
    if (next) {
      this.stopAmbience();
    } else if (this.currentMood !== 'none') {
      const mood = this.currentMood;
      this.currentMood = 'none';
      this.setAmbience(mood);
    }
    return next;
  }

  public unlock(): void {
    this.ensureContext();
  }

  public playUiClick(): void {
    this.playTone(320, 0.055, 'triangle', 0.045, 0, 190);
  }

  public playDialogueCheck(success: boolean): void {
    if (success) {
      this.playTone(440, 0.14, 'triangle', 0.06, 0);
      this.playTone(659.25, 0.22, 'sine', 0.06, 0.07);
    } else {
      this.playTone(190, 0.18, 'sawtooth', 0.04, 0, 115);
    }
  }

  public playShopCoin(): void {
    this.playTone(1320, 0.08, 'sine', 0.045, 0);
    this.playTone(1760, 0.12, 'sine', 0.04, 0.05);
  }

  public playQuestEvent(kind: 'accept' | 'complete' | 'levelup' | 'save'): void {
    if (kind === 'save') {
      this.playTone(392, 0.12, 'sine', 0.04, 0);
      return;
    }
    if (kind === 'accept') {
      this.playTone(293.66, 0.16, 'triangle', 0.055, 0);
      this.playTone(440, 0.24, 'triangle', 0.055, 0.09);
      return;
    }
    if (kind === 'complete') {
      this.playTone(293.66, 0.18, 'triangle', 0.06, 0);
      this.playTone(369.99, 0.18, 'triangle', 0.06, 0.09);
      this.playTone(587.33, 0.34, 'sine', 0.07, 0.18);
      return;
    }
    // levelup
    this.playTone(261.63, 0.18, 'triangle', 0.06, 0);
    this.playTone(329.63, 0.18, 'triangle', 0.06, 0.08);
    this.playTone(392.0, 0.2, 'triangle', 0.065, 0.16);
    this.playTone(523.25, 0.42, 'sine', 0.075, 0.24);
  }

  public playCreatureSound(kind: 'witch_cackle' | 'wraith_moan' | 'ghost_breath', pitchMod = 1.0): void {
    if (this.isMuted()) return;
    if (kind === 'witch_cackle') {
      this.playTone(520 * pitchMod, 0.12, 'sawtooth', 0.045, 0, 680 * pitchMod);
      this.playTone(620 * pitchMod, 0.12, 'sawtooth', 0.045, 0.11, 460 * pitchMod);
      this.playTone(580 * pitchMod, 0.16, 'sawtooth', 0.04, 0.22, 390 * pitchMod);
      return;
    }
    if (kind === 'wraith_moan') {
      this.playTone(165 * pitchMod, 0.55, 'sine', 0.06, 0, 110 * pitchMod);
      this.playTone(247 * pitchMod, 0.48, 'triangle', 0.035, 0.05, 145 * pitchMod);
      return;
    }
    // ghost_breath
    this.playTone(210 * pitchMod, 0.36, 'sine', 0.04, 0, 130 * pitchMod);
  }

  public playCombatSfx(kind: 'start' | 'hit' | 'crit' | 'miss' | 'victory' | 'defeat'): void {
    if (this.isMuted()) return;
    switch (kind) {
      case 'start':
        this.playTone(146.83, 0.22, 'sawtooth', 0.055, 0, 110);
        this.playTone(220, 0.28, 'triangle', 0.055, 0.09, 196);
        break;
      case 'hit':
        this.playTone(170, 0.08, 'sawtooth', 0.06, 0, 72);
        this.playTone(420, 0.05, 'triangle', 0.035, 0.01, 180);
        break;
      case 'crit':
        this.playTone(130, 0.14, 'sawtooth', 0.08, 0, 58);
        this.playTone(660, 0.18, 'triangle', 0.065, 0.02, 880);
        this.playTone(990, 0.22, 'sine', 0.05, 0.06, 1320);
        break;
      case 'miss':
        this.playTone(540, 0.09, 'sine', 0.03, 0, 260);
        break;
      case 'victory':
        this.playTone(329.63, 0.14, 'triangle', 0.06, 0);
        this.playTone(440, 0.16, 'triangle', 0.06, 0.09);
        this.playTone(659.25, 0.34, 'sine', 0.07, 0.18);
        break;
      case 'defeat':
        this.playTone(220, 0.22, 'sawtooth', 0.05, 0, 174.6);
        this.playTone(146.83, 0.42, 'sine', 0.06, 0.16, 98);
        break;
    }
  }

  public setAmbience(mood: OstrzeAmbienceMood): void {
    if (this.currentMood === mood) return;
    this.currentMood = mood;
    if (mood === 'none') {
      this.stopAmbience();
      return;
    }
    if (this.isMuted()) return;

    const ctx = this.ensureContext();
    if (!ctx) return;

    try {
      this.ambienceSource?.stop();
    } catch {
      // ignore if already stopped
    }
    this.ambienceSource = null;
    this.ambienceGain?.disconnect();
    this.ambienceGain = null;

    // Subtle procedural filtered noise bed for atmosphere
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.04 * white) / 1.04;
      data[i] = last * 1.8;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mood === 'night_storm' ? 420 : mood === 'creepy_forest' ? 280 : 340;

    const gain = ctx.createGain();
    const volume = mood === 'night_storm' ? 0.08 : mood === 'town' ? 0.04 : 0.055;
    gain.gain.value = volume;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.ambienceSource = src;
    this.ambienceGain = gain;
  }

  public stopAmbience(): void {
    this.currentMood = 'none';
    try {
      this.ambienceSource?.stop();
    } catch {
      // ignore if already stopped
    }
    this.ambienceSource = null;
    this.ambienceGain?.disconnect();
    this.ambienceGain = null;
  }
}

export const ostrzeAudio = new OstrzeAudioManager();
