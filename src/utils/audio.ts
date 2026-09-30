// Web Audio API を活用した高精度・低遅延オーディオマネージャー

class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgmBuffer: AudioBuffer | null = null;
  private bgmSource: AudioBufferSourceNode | null = null;
  private bgmGain: GainNode | null = null;
  private seGain: GainNode | null = null;
  private previewSource: AudioBufferSourceNode | null = null;
  private previewGain: GainNode | null = null;

  private bufferCache: Map<string, AudioBuffer> = new Map();

  private startTime: number = 0;
  private pauseOffset: number = 0;
  private isPlaying: boolean = false;
  private isPaused: boolean = false;

  private bgmVolume: number = 0.8;
  private seVolume: number = 0.9;

  public init(): void {
    if (!this.ctx) {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtxClass();
      
      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
      this.bgmGain.connect(this.ctx.destination);

      this.seGain = this.ctx.createGain();
      this.seGain.gain.setValueAtTime(this.seVolume, this.ctx.currentTime);
      this.seGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolumes(bgm: number, se: number): void {
    this.bgmVolume = Math.max(0, Math.min(1, bgm));
    this.seVolume = Math.max(0, Math.min(1, se));
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
    }
    if (this.seGain && this.ctx) {
      this.seGain.gain.setValueAtTime(this.seVolume, this.ctx.currentTime);
    }
    if (this.previewGain && this.ctx) {
      this.previewGain.gain.setValueAtTime(this.bgmVolume, this.ctx.currentTime);
    }
  }

  public async loadAudio(url: string): Promise<AudioBuffer> {
    this.init();
    if (this.bufferCache.has(url)) {
      return this.bufferCache.get(url)!;
    }

    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.ctx!.decodeAudioData(arrayBuffer);
    this.bufferCache.set(url, audioBuffer);
    return audioBuffer;
  }

  public async prepareBgm(url: string): Promise<void> {
    this.bgmBuffer = await this.loadAudio(url);
  }

  public playBgm(startOffsetSec: number = 0): void {
    this.init();
    if (!this.ctx || !this.bgmBuffer) return;

    this.stopBgm();
    this.stopPreview();

    this.bgmSource = this.ctx.createBufferSource();
    this.bgmSource.buffer = this.bgmBuffer;
    this.bgmSource.connect(this.bgmGain!);

    this.pauseOffset = startOffsetSec;
    this.startTime = this.ctx.currentTime - startOffsetSec;
    this.bgmSource.start(0, startOffsetSec);
    this.isPlaying = true;
    this.isPaused = false;
  }

  public pauseBgm(): void {
    if (!this.ctx || !this.isPlaying || this.isPaused || !this.bgmSource) return;
    this.pauseOffset = this.ctx.currentTime - this.startTime;
    this.bgmSource.stop();
    this.bgmSource.disconnect();
    this.bgmSource = null;
    this.isPaused = true;
  }

  public resumeBgm(): void {
    if (!this.ctx || !this.bgmBuffer || !this.isPaused) return;
    this.playBgm(this.pauseOffset);
  }

  public stopBgm(): void {
    if (this.bgmSource) {
      try {
        this.bgmSource.stop();
        this.bgmSource.disconnect();
      } catch {
        // ignore
      }
      this.bgmSource = null;
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.pauseOffset = 0;
  }

  public getCurrentTime(): number {
    if (!this.ctx || !this.isPlaying) return 0;
    if (this.isPaused) return this.pauseOffset;
    return this.ctx.currentTime - this.startTime;
  }

  public getDuration(): number {
    return this.bgmBuffer ? this.bgmBuffer.duration : 0;
  }

  // プレビュー再生
  public async playPreview(url: string, startSec: number = 20, durationSec: number = 15): Promise<void> {
    this.init();
    this.stopPreview();
    this.stopBgm();

    const buffer = await this.loadAudio(url);
    if (!this.ctx) return;

    this.previewGain = this.ctx.createGain();
    this.previewGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
    this.previewGain.gain.exponentialRampToValueAtTime(Math.max(0.01, this.bgmVolume), this.ctx.currentTime + 0.8);
    this.previewGain.connect(this.ctx.destination);

    this.previewSource = this.ctx.createBufferSource();
    this.previewSource.buffer = buffer;
    this.previewSource.loop = true;
    this.previewSource.loopStart = startSec;
    this.previewSource.loopEnd = startSec + durationSec;
    this.previewSource.connect(this.previewGain);

    this.previewSource.start(0, startSec);
  }

  public stopPreview(): void {
    if (this.previewSource && this.ctx && this.previewGain) {
      try {
        const now = this.ctx.currentTime;
        this.previewGain.gain.setValueAtTime(this.previewGain.gain.value, now);
        this.previewGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        const src = this.previewSource;
        setTimeout(() => {
          try {
            src.stop();
            src.disconnect();
          } catch {
            // ignore
          }
        }, 350);
      } catch {
        // ignore
      }
      this.previewSource = null;
    }
  }

  // 超低遅延シンセ効果音 (外部ファイル不要)
  public playHitSound(type: 'PERFECT' | 'GREAT' | 'GOOD' | 'BAD' | 'MISS' | 'HOLD'): void {
    if (!this.ctx || this.seVolume <= 0) return;
    this.init();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    gain.connect(this.seGain!);
    osc.connect(gain);

    if (type === 'PERFECT') {
      // 煌びやかな2和音風ベル
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.exponentialRampToValueAtTime(1975.53, now + 0.04);
      gain.gain.setValueAtTime(0.8 * this.seVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);

      // 高域のきらめき
      const osc2 = this.ctx.createOscillator();
      const gain2 = this.ctx.createGain();
      gain2.connect(this.seGain!);
      osc2.connect(gain2);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1480, now);
      gain2.gain.setValueAtTime(0.4 * this.seVolume, now);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc2.start(now);
      osc2.stop(now + 0.08);
    } else if (type === 'GREAT') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, now); // G5
      osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.04);
      gain.gain.setValueAtTime(0.7 * this.seVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'GOOD') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      gain.gain.setValueAtTime(0.5 * this.seVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'BAD') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.08);
      gain.gain.setValueAtTime(0.4 * this.seVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.start(now);
      osc.stop(now + 0.09);
    } else if (type === 'MISS') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.1);
      gain.gain.setValueAtTime(0.3 * this.seVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === 'HOLD') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.15 * this.seVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  }

  // カウントダウン音
  public playCountdown(num: number): void {
    if (!this.ctx || this.seVolume <= 0) return;
    this.init();

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    gain.connect(this.seGain!);
    osc.connect(gain);

    if (num > 0) {
      // 3, 2, 1
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      gain.gain.setValueAtTime(0.6 * this.seVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else {
      // START (高音で抜けの良い音)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1320, now);
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);
      gain.gain.setValueAtTime(0.8 * this.seVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  }
}

export const sound = new SoundEngine();
