// Sound manager for JARVIS HUD ambient loop and feedback audio effects

class SoundManager {
  private enabled: boolean = true;
  private volume: number = 0.25;
  private ambientAudio: HTMLAudioElement | null = null;
  private thinkAudio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.initAudioElements();
  }

  private initAudioElements() {
    if (typeof window === 'undefined') return;

    try {
      this.ambientAudio = new Audio('/sfx/HUD.mp3');
      this.ambientAudio.loop = true;
      this.ambientAudio.volume = this.volume;

      this.thinkAudio = new Audio('/sfx/Think.mp3');
      this.thinkAudio.loop = true;
      this.thinkAudio.volume = Math.min(1.0, this.volume * 1.2);
    } catch {
      // Audio initialization fallback
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    return this.audioContext;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopAmbient();
      this.stopThinking();
    } else {
      this.startAmbient();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.ambientAudio) {
      this.ambientAudio.volume = this.volume;
    }
    if (this.thinkAudio) {
      this.thinkAudio.volume = Math.min(1.0, this.volume * 1.2);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public startAmbient() {
    if (!this.enabled || !this.ambientAudio) return;
    this.ambientAudio.currentTime = 0;
    this.ambientAudio.volume = this.volume;
    this.ambientAudio.play().catch(() => {
      // Auto-play might be blocked until user gesture
    });
  }

  public stopAmbient() {
    if (this.ambientAudio) {
      this.ambientAudio.pause();
    }
  }

  public playStartup() {
    if (!this.enabled) return;
    this.playFile('/sfx/Start.mp3', 0.95, () => {
      this.synthBeep(520, 0.12, 'sine');
      setTimeout(() => this.synthBeep(880, 0.16, 'sine'), 100);
    });
  }

  public playSuccess() {
    if (!this.enabled) return;
    this.playFile('/sfx/Done.mp3', 0.75, () => {
      this.synthBeep(660, 0.08, 'triangle');
      setTimeout(() => this.synthBeep(990, 0.12, 'triangle'), 80);
    });
  }

  public playError() {
    if (!this.enabled) return;
    this.playFile('/sfx/Error.mp3', 0.95, () => {
      this.synthBeep(320, 0.15, 'sawtooth');
      setTimeout(() => this.synthBeep(220, 0.25, 'sawtooth'), 120);
    });
  }

  public startThinking() {
    if (!this.enabled || !this.thinkAudio) return;
    this.thinkAudio.currentTime = 0;
    this.thinkAudio.volume = Math.min(1.0, this.volume * 1.2);
    this.thinkAudio.play().catch(() => {});
  }

  public stopThinking() {
    if (this.thinkAudio) {
      this.thinkAudio.pause();
      this.thinkAudio.currentTime = 0;
    }
  }

  private playFile(url: string, volumeFactor: number = 1.0, fallbackSynth?: () => void) {
    try {
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, this.volume * volumeFactor));
      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch(() => {
          if (fallbackSynth) fallbackSynth();
        });
      }
    } catch {
      if (fallbackSynth) fallbackSynth();
    }
  }

  private synthBeep(freq: number, duration: number, type: OscillatorType = 'sine') {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(this.volume * 0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Audio synth ignored
    }
  }

  public stopAll() {
    this.stopAmbient();
    this.stopThinking();
  }
}

export const soundManager = new SoundManager();
