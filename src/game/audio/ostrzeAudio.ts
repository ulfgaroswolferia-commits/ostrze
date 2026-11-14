/**
 * Audio facade for Ostrze 2.5D.
 * Delegates looping ambient soundscapes (/audio/ambience/*) and creature/combat SFX (/audio/sfx/*)
 * to ulfRPG's `CombatAudioEngine`, while providing crisp procedural Web Audio UI/dialogue/quest chimes.
 * Respects `ulf_crpg_audio_muted`.
 */
import { CombatAudioEngine, type AmbienceMood } from '@ulf/audio/combatAudio';

export type OstrzeAmbienceMood = AmbienceMood;

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
    CombatAudioEngine.getInstance().playSound(kind, pitchMod);
  }

  public setAmbience(mood: OstrzeAmbienceMood): void {
    if (this.currentMood === mood) return;
    this.currentMood = mood;
    if (mood === 'none') {
      this.stopAmbience();
      return;
    }
    if (this.isMuted()) return;
    const volume = mood === 'night_storm' ? 0.28 : mood === 'town' ? 0.2 : 0.24;
    CombatAudioEngine.getInstance().playAmbience(mood, volume);
  }

  public stopAmbience(): void {
    this.currentMood = 'none';
    CombatAudioEngine.getInstance().stopAmbience();
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
