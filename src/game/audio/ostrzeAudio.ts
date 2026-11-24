/**
 * Audio facade for Ostrze 2.5D.
 * Provides procedural Web Audio UI/dialogue/quest chimes, beast/creature SFX,
 * looping location ambiences with subtle accents, and a parallel atmospheric phenomenon layer.
 * Respects `ulf_crpg_audio_muted`.
 */
export type OstrzeAmbienceMood = 'none' | 'town' | 'dawn' | 'forest' | 'creepy_forest' | 'night_storm';
export type OstrzeMusicTheme = 'none' | 'town' | 'forest' | 'creepy' | 'combat';
export type FootstepSurfaceKind = 'grass' | 'dirt' | 'stone' | 'water';

export function classifyFootstepSurface(terrain: string): FootstepSurfaceKind {
  if (terrain === 'forest_grass' || terrain === 'forest_soil') return 'grass';
  if (terrain === 'dirt_path') return 'dirt';
  if (terrain === 'abyss_water') return 'water';
  return 'stone';
}

export type OstrzeCreatureSoundKind =
  | 'witch_cackle'
  | 'wraith_moan'
  | 'ghost_breath'
  | 'wolf_growl'
  | 'boar_grunt'
  | 'viper_hiss'
  | 'utopiec_gurgle'
  | 'blednik_chime'
  | 'skrzat_snicker';

const ORIGIN_ENEMY_VOICE_MAP: Record<string, OstrzeCreatureSoundKind> = {
  wilk: 'wolf_growl',
  dzik: 'boar_grunt',
  zmija_lesna: 'viper_hiss',
  utopiec: 'utopiec_gurgle',
  blednik: 'blednik_chime',
  skrzat_zlosnik: 'skrzat_snicker',
  upior_nocy: 'wraith_moan',
  upior_zwiadowca: 'wraith_moan'
};

class OstrzeAudioManager {
  private ctx: AudioContext | null = null;
  private ambienceGain: GainNode | null = null;
  private ambienceSource: AudioBufferSourceNode | null = null;
  private ambienceAccentTimer: ReturnType<typeof setInterval> | null = null;
  private currentMood: OstrzeAmbienceMood = 'none';

  private phenomenonGain: GainNode | null = null;
  private phenomenonSource: AudioBufferSourceNode | null = null;
  private phenomenonOsc: OscillatorNode | null = null;
  private phenomenonAccentTimer: ReturnType<typeof setInterval> | null = null;
  private currentPhenomenonId: string | null = null;

  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private currentMusicTheme: OstrzeMusicTheme = 'none';
  private explorationMusicTheme: OstrzeMusicTheme = 'none';
  private musicStep = 0;
  private lastFootstepMs = 0;

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

  private playNoiseBurst(
    durationSec: number,
    filterType: BiquadFilterType,
    filterFreq: number,
    q = 1.0,
    gainPeak = 0.04,
    delaySec = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delaySec;
    const sampleRate = ctx.sampleRate || 44100;
    const length = Math.max(256, Math.floor(sampleRate * durationSec));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);
    filter.Q.setValueAtTime(q, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + Math.min(0.02, durationSec * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + durationSec + 0.02);
  }

  private createFilteredNoiseBuffer(ctx: AudioContext, seconds: number, smoothFactor: number, scale: number): AudioBuffer {
    const sampleRate = ctx.sampleRate || 44100;
    const length = Math.max(1024, Math.floor(sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + smoothFactor * white) / (1 + smoothFactor);
      data[i] = last * scale;
    }
    return buffer;
  }

  public getMuted(): boolean {
    return this.isMuted();
  }

  public getActiveAmbience(): OstrzeAmbienceMood {
    return this.currentMood;
  }

  public getActivePhenomenonAudio(): string | null {
    return this.currentPhenomenonId;
  }

  public toggleMute(): boolean {
    const next = !this.isMuted();
    this.setMuted(next);
    return next;
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.currentMood !== 'none' && !this.ambienceSource) {
      const mood = this.currentMood;
      this.currentMood = 'none';
      this.setAmbience(mood);
    }
    if (this.currentPhenomenonId && !this.phenomenonSource && !this.phenomenonOsc) {
      const ph = this.currentPhenomenonId;
      this.currentPhenomenonId = null;
      this.setPhenomenonAudio(ph);
    }
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

  public playCreatureSound(kind: OstrzeCreatureSoundKind, pitchMod = 1.0): void {
    if (this.isMuted()) return;
    switch (kind) {
      case 'witch_cackle':
        this.playTone(520 * pitchMod, 0.12, 'sawtooth', 0.045, 0, 680 * pitchMod);
        this.playTone(620 * pitchMod, 0.12, 'sawtooth', 0.045, 0.11, 460 * pitchMod);
        this.playTone(580 * pitchMod, 0.16, 'sawtooth', 0.04, 0.22, 390 * pitchMod);
        return;
      case 'wraith_moan':
        this.playTone(165 * pitchMod, 0.55, 'sine', 0.06, 0, 110 * pitchMod);
        this.playTone(247 * pitchMod, 0.48, 'triangle', 0.035, 0.05, 145 * pitchMod);
        return;
      case 'ghost_breath':
        this.playTone(210 * pitchMod, 0.36, 'sine', 0.04, 0, 130 * pitchMod);
        return;
      case 'wolf_growl':
        this.playTone(118 * pitchMod, 0.26, 'sawtooth', 0.055, 0, 74 * pitchMod);
        this.playNoiseBurst(0.22, 'bandpass', 420 * pitchMod, 2.2, 0.03, 0.02);
        return;
      case 'boar_grunt':
        this.playTone(135 * pitchMod, 0.14, 'sawtooth', 0.06, 0, 82 * pitchMod);
        this.playTone(96 * pitchMod, 0.16, 'triangle', 0.05, 0.09, 64 * pitchMod);
        return;
      case 'viper_hiss':
        this.playNoiseBurst(0.32, 'highpass', 3200 * pitchMod, 2.5, 0.042, 0);
        this.playNoiseBurst(0.18, 'bandpass', 4800 * pitchMod, 3.2, 0.026, 0.08);
        return;
      case 'utopiec_gurgle':
        this.playTone(142 * pitchMod, 0.14, 'sine', 0.05, 0, 196 * pitchMod);
        this.playTone(188 * pitchMod, 0.18, 'triangle', 0.045, 0.1, 108 * pitchMod);
        this.playNoiseBurst(0.24, 'bandpass', 620 * pitchMod, 4.0, 0.032, 0.04);
        return;
      case 'blednik_chime':
        this.playTone(880 * pitchMod, 0.34, 'sine', 0.04, 0, 660 * pitchMod);
        this.playTone(1318.5 * pitchMod, 0.28, 'sine', 0.028, 0.06, 987.8 * pitchMod);
        return;
      case 'skrzat_snicker':
        this.playTone(540 * pitchMod, 0.08, 'triangle', 0.045, 0, 720 * pitchMod);
        this.playTone(680 * pitchMod, 0.08, 'triangle', 0.045, 0.07, 490 * pitchMod);
        this.playTone(610 * pitchMod, 0.1, 'sawtooth', 0.035, 0.14, 790 * pitchMod);
        return;
    }
  }

  public playEnemyAttackVoice(originId: string | null): boolean {
    if (!originId) return false;
    const voice = ORIGIN_ENEMY_VOICE_MAP[originId];
    if (!voice) return false;
    const jitter = 0.94 + Math.random() * 0.12;
    this.playCreatureSound(voice, jitter);
    return true;
  }

  public playBeltItemSfx(kind: 'heal' | 'oil' | 'fire' | 'smoke' | 'throw'): void {
    if (this.isMuted()) return;
    switch (kind) {
      case 'heal':
        this.playTone(392, 0.12, 'sine', 0.045, 0, 523.25);
        this.playTone(587.33, 0.18, 'triangle', 0.04, 0.08, 659.25);
        return;
      case 'oil':
        this.playNoiseBurst(0.18, 'bandpass', 1850, 2.0, 0.036, 0);
        this.playTone(320, 0.12, 'triangle', 0.03, 0.04, 480);
        return;
      case 'fire':
        this.playNoiseBurst(0.32, 'lowpass', 620, 0.9, 0.065, 0);
        this.playNoiseBurst(0.24, 'highpass', 2200, 1.8, 0.04, 0.03);
        return;
      case 'smoke':
        this.playNoiseBurst(0.42, 'bandpass', 920, 1.4, 0.05, 0);
        return;
      case 'throw':
        this.playTone(460, 0.09, 'sine', 0.04, 0, 190);
        this.playNoiseBurst(0.12, 'bandpass', 1200, 1.5, 0.035, 0.06);
        return;
    }
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

  private clearAmbienceNodes(): void {
    if (this.ambienceAccentTimer !== null) {
      clearInterval(this.ambienceAccentTimer);
      this.ambienceAccentTimer = null;
    }
    try {
      this.ambienceSource?.stop();
    } catch {
      // ignore if already stopped
    }
    this.ambienceSource = null;
    this.ambienceGain?.disconnect();
    this.ambienceGain = null;
  }

  private clearPhenomenonNodes(): void {
    if (this.phenomenonAccentTimer !== null) {
      clearInterval(this.phenomenonAccentTimer);
      this.phenomenonAccentTimer = null;
    }
    try {
      this.phenomenonSource?.stop();
    } catch {
      // ignore if already stopped
    }
    try {
      this.phenomenonOsc?.stop();
    } catch {
      // ignore if already stopped
    }
    this.phenomenonSource = null;
    this.phenomenonOsc = null;
    this.phenomenonGain?.disconnect();
    this.phenomenonGain = null;
  }

  public setAmbience(mood: OstrzeAmbienceMood): void {
    const mappedMusic: OstrzeMusicTheme =
      mood === 'none'
        ? 'none'
        : mood === 'town'
          ? 'town'
          : mood === 'creepy_forest' || mood === 'night_storm'
            ? 'creepy'
            : 'forest';
    if (this.currentMusicTheme !== 'combat') {
      this.setMusicTheme(mappedMusic);
    } else {
      this.explorationMusicTheme = mappedMusic;
    }

    if (this.currentMood === mood && (mood === 'none' || this.ambienceSource)) return;
    this.currentMood = mood;
    if (mood === 'none') {
      this.clearAmbienceNodes();
      return;
    }
    if (this.isMuted()) {
      this.clearAmbienceNodes();
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.clearAmbienceNodes();

    const buffer = this.createFilteredNoiseBuffer(ctx, 2, 0.04, 1.8);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mood === 'night_storm' ? 420 : mood === 'creepy_forest' ? 280 : 340;

    const gain = ctx.createGain();
    const volume = mood === 'night_storm' ? 0.075 : mood === 'town' ? 0.038 : 0.052;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.6);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.ambienceSource = src;
    this.ambienceGain = gain;

    // Subtle periodic procedural accents tailored to location mood
    const accentIntervalMs =
      mood === 'town' ? 6800 : mood === 'night_storm' ? 9200 : 7600;
    this.ambienceAccentTimer = setInterval(() => {
      if (this.isMuted() || this.currentMood !== mood) return;
      if (mood === 'dawn' || mood === 'forest') {
        const base = 1550 + Math.random() * 520;
        this.playTone(base, 0.09, 'sine', 0.016, 0, base * 1.18);
        this.playTone(base * 1.14, 0.11, 'sine', 0.014, 0.11, base * 0.92);
      } else if (mood === 'town') {
        this.playNoiseBurst(0.06, 'bandpass', 1800 + Math.random() * 700, 3.0, 0.015, 0);
      } else if (mood === 'creepy_forest') {
        this.playTone(390, 0.28, 'sine', 0.02, 0, 310);
        this.playTone(320, 0.36, 'sine', 0.018, 0.32, 270);
      } else if (mood === 'night_storm') {
        this.playNoiseBurst(0.9, 'lowpass', 140, 0.8, 0.05, 0);
      }
    }, accentIntervalMs);
  }

  /**
   * Parallel procedural audio layer for Ostrze's 9 atmospheric & magical phenomena.
   */
  public setPhenomenonAudio(phenomenonId: string | null): void {
    if (this.currentPhenomenonId === phenomenonId && (!phenomenonId || this.phenomenonSource || this.phenomenonOsc)) {
      return;
    }
    this.currentPhenomenonId = phenomenonId;
    if (!phenomenonId || this.isMuted()) {
      this.clearPhenomenonNodes();
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.clearPhenomenonNodes();

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.connect(ctx.destination);
    this.phenomenonGain = gain;

    const startNoiseBed = (
      smooth: number,
      filterType: BiquadFilterType,
      freq: number,
      q: number,
      vol: number
    ): void => {
      const buf = this.createFilteredNoiseBuffer(ctx, 2, smooth, 1.5);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = q;
      src.connect(filter);
      filter.connect(gain);
      src.start();
      this.phenomenonSource = src;
      gain.gain.linearRampToValueAtTime(vol, now + 0.7);
    };

    const startDrone = (freq: number, type: OscillatorType, vol: number): void => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gain);
      osc.start();
      this.phenomenonOsc = osc;
      gain.gain.linearRampToValueAtTime(vol, now + 0.8);
    };

    switch (phenomenonId) {
      case 'burza_iskier':
        startDrone(92, 'sine', 0.028);
        this.phenomenonAccentTimer = setInterval(() => {
          if (this.isMuted() || this.currentPhenomenonId !== 'burza_iskier') return;
          this.playNoiseBurst(0.07, 'highpass', 3600 + Math.random() * 1400, 3.0, 0.032, 0);
          this.playTone(1480 + Math.random() * 620, 0.06, 'sawtooth', 0.018, 0.02, 740);
        }, 2800);
        break;
      case 'ulewa':
        startNoiseBed(0.35, 'bandpass', 1450, 0.7, 0.055);
        break;
      case 'grad':
        startNoiseBed(0.45, 'bandpass', 1950, 0.9, 0.052);
        this.phenomenonAccentTimer = setInterval(() => {
          if (this.isMuted() || this.currentPhenomenonId !== 'grad') return;
          this.playNoiseBurst(0.035, 'highpass', 2600, 2.2, 0.032, 0);
          this.playNoiseBurst(0.03, 'highpass', 3100, 2.5, 0.026, 0.09);
        }, 1600);
        break;
      case 'wichura':
        startNoiseBed(0.12, 'bandpass', 540, 2.4, 0.062);
        this.phenomenonAccentTimer = setInterval(() => {
          if (this.isMuted() || this.currentPhenomenonId !== 'wichura') return;
          this.playNoiseBurst(0.75, 'bandpass', 420 + Math.random() * 280, 3.2, 0.038, 0);
        }, 4200);
        break;
      case 'mgla_ciszy':
        startDrone(68, 'sine', 0.034);
        break;
      case 'mgla_poranna':
        startNoiseBed(0.05, 'lowpass', 240, 0.8, 0.026);
        break;
      case 'noc_bez_gwiazd':
        startDrone(54, 'triangle', 0.026);
        this.phenomenonAccentTimer = setInterval(() => {
          if (this.isMuted() || this.currentPhenomenonId !== 'noc_bez_gwiazd') return;
          this.playTone(112, 0.65, 'sine', 0.018, 0, 82);
        }, 7200);
        break;
      case 'przymrozek':
        startNoiseBed(0.09, 'highpass', 1650, 1.4, 0.02);
        this.phenomenonAccentTimer = setInterval(() => {
          if (this.isMuted() || this.currentPhenomenonId !== 'przymrozek') return;
          this.playTone(1760 + Math.random() * 440, 0.24, 'sine', 0.014, 0, 1320);
        }, 5600);
        break;
      case 'upal':
        startNoiseBed(0.06, 'bandpass', 620, 1.2, 0.018);
        break;
      default:
        startNoiseBed(0.08, 'lowpass', 320, 1.0, 0.022);
        break;
    }
  }

  public setMuted(muted: boolean): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('ulf_crpg_audio_muted', muted ? 'true' : 'false');
      }
    } catch {
      // ignore storage errors
    }
    if (muted) {
      this.clearAmbienceNodes();
      this.clearPhenomenonNodes();
      this.clearMusicNodes();
    } else {
      if (this.currentMood !== 'none') {
        const mood = this.currentMood;
        this.currentMood = 'none';
        this.setAmbience(mood);
      }
      if (this.currentPhenomenonId) {
        const ph = this.currentPhenomenonId;
        this.currentPhenomenonId = null;
        this.setPhenomenonAudio(ph);
      }
      if (this.currentMusicTheme !== 'none') {
        const theme = this.currentMusicTheme;
        this.currentMusicTheme = 'none';
        this.setMusicTheme(theme);
      }
    }
  }

  private clearMusicNodes(): void {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  public getMusicTheme(): OstrzeMusicTheme {
    return this.currentMusicTheme;
  }

  /**
   * Subtle procedural Slavic Dorian/pentatonic Web Audio music bed
   * (town lute/harp, forest flute-harp, creepy drone, combat war drums).
   */
  public setMusicTheme(theme: OstrzeMusicTheme): void {
    if (theme !== 'combat') {
      this.explorationMusicTheme = theme;
    }
    if (this.currentMusicTheme === theme && this.musicTimer !== null) return;
    this.clearMusicNodes();
    this.currentMusicTheme = theme;
    this.musicStep = 0;
    if (theme === 'none') return;
    if (!this.ensureContext()) return;

    // D Dorian medieval Slavic motifs (Hz)
    const townLute = [293.66, 329.63, 349.23, 440.0, 392.0, 349.23, 329.63, 293.66];
    const forestHarp = [220.0, 293.66, 349.23, 440.0, 523.25, 440.0, 349.23, 293.66];
    const creepyDrone = [146.83, 155.56, 146.83, 130.81];
    const combatBass = [110.0, 110.0, 130.81, 98.0, 110.0, 146.83, 130.81, 98.0];

    const stepMs =
      theme === 'combat' ? 460 : theme === 'creepy' ? 1850 : theme === 'forest' ? 1150 : 880;

    this.musicTimer = setInterval(() => {
      if (this.isMuted() || this.currentMusicTheme !== theme) return;
      const idx = this.musicStep++;
      if (theme === 'town') {
        const note = townLute[idx % townLute.length];
        this.playTone(note, 0.52, 'triangle', 0.018, 0, note * 0.996);
        if (idx % 4 === 0) {
          this.playTone(note / 2, 1.1, 'sine', 0.015, 0.02);
        }
      } else if (theme === 'forest') {
        const note = forestHarp[idx % forestHarp.length];
        this.playTone(note, 0.78, 'sine', 0.015, 0);
        if (idx % 3 === 0) {
          this.playTone(note * 1.5, 0.42, 'triangle', 0.009, 0.18);
        }
      } else if (theme === 'creepy') {
        const note = creepyDrone[idx % creepyDrone.length];
        this.playTone(note, 1.55, 'sine', 0.016, 0, note * 0.985);
      } else if (theme === 'combat') {
        const bass = combatBass[idx % combatBass.length];
        // War drum pulse + low string bass
        this.playTone(96, 0.16, 'sine', 0.042, 0, 44);
        if (idx % 2 === 0) {
          this.playTone(bass, 0.36, 'sawtooth', 0.014, 0.03);
        } else {
          this.playNoiseBurst(0.04, 'bandpass', 920, 1.8, 0.018, 0.02);
        }
      }
    }, stepMs);
  }

  public restoreExplorationMusic(): void {
    this.setMusicTheme(this.explorationMusicTheme);
  }

  public stopMusic(): void {
    this.currentMusicTheme = 'none';
    this.explorationMusicTheme = 'none';
    this.clearMusicNodes();
  }

  public playManeuverSfx(): void {
    // Steel whoosh + sharp resonant chime for [R] weapon maneuvers
    this.playNoiseBurst(0.14, 'bandpass', 1800, 1.4, 0.055, 0);
    this.playTone(520, 0.14, 'triangle', 0.06, 0.02, 780);
    this.playTone(220, 0.18, 'sawtooth', 0.04, 0.05, 110);
  }

  public playExplosionSfx(): void {
    // Deep barrel blast + fiery crackle
    this.playTone(130, 0.42, 'sine', 0.11, 0, 36);
    this.playNoiseBurst(0.38, 'lowpass', 720, 0.9, 0.09, 0);
    this.playNoiseBurst(0.24, 'bandpass', 2400, 1.8, 0.045, 0.08);
  }

  public playFootstep(terrain: string, isStealth = false): void {
    if (this.isMuted()) return;
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastFootstepMs < 290) return;
    this.lastFootstepMs = nowMs;

    const surface = classifyFootstepSurface(terrain);
    const vol = isStealth ? 0.42 : 1.0;
    const jitter = 0.92 + Math.random() * 0.16;

    if (surface === 'grass') {
      this.playNoiseBurst(0.055, 'bandpass', 1050 * jitter, 1.4, 0.022 * vol, 0);
      this.playTone(95 * jitter, 0.04, 'sine', 0.014 * vol, 0, 62);
    } else if (surface === 'dirt') {
      this.playNoiseBurst(0.05, 'bandpass', 1750 * jitter, 1.8, 0.026 * vol, 0);
      this.playTone(112 * jitter, 0.042, 'triangle', 0.015 * vol, 0, 70);
    } else if (surface === 'water') {
      this.playNoiseBurst(0.085, 'bandpass', 680 * jitter, 2.2, 0.028 * vol, 0);
    } else {
      // stone / cobble / marble / dungeon
      this.playNoiseBurst(0.032, 'highpass', 1900 * jitter, 1.2, 0.026 * vol, 0);
      this.playTone(155 * jitter, 0.048, 'triangle', 0.02 * vol, 0, 76);
    }
  }

  public playCampfireCrackle(proximity01 = 1): void {
    if (this.isMuted()) return;
    const scale = Math.max(0.15, Math.min(1, proximity01));
    const f1 = 2600 + Math.random() * 1600;
    this.playNoiseBurst(0.022, 'bandpass', f1, 3.2, 0.022 * scale, 0);
    if (Math.random() < 0.65) {
      const f2 = 2200 + Math.random() * 1900;
      this.playNoiseBurst(0.018, 'bandpass', f2, 3.6, 0.016 * scale, 0.08 + Math.random() * 0.14);
    }
  }

  public playNocturnalAccent(kind: 'owl' | 'crickets'): void {
    if (this.isMuted()) return;
    if (kind === 'owl') {
      this.playTone(368, 0.24, 'sine', 0.022, 0, 338);
      this.playTone(352, 0.36, 'sine', 0.02, 0.34, 286);
      return;
    }
    // crickets: 3 soft rapid high-pitched chirps
    this.playTone(4180, 0.028, 'sine', 0.01, 0, 4240);
    this.playTone(4210, 0.028, 'sine', 0.01, 0.06, 4260);
    this.playTone(4170, 0.03, 'sine', 0.009, 0.12, 4220);
  }

  public stopAmbience(): void {
    this.currentMood = 'none';
    this.clearAmbienceNodes();
    this.stopMusic();
  }

  public stopPhenomenonAudio(): void {
    this.currentPhenomenonId = null;
    this.clearPhenomenonNodes();
  }
}

export const ostrzeAudio = new OstrzeAudioManager();
