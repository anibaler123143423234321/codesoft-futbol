// Web Audio API zero-dependency sound generator for sports effects

class SoundEngine {
  constructor() {
    this.muted = false;
    this.ctx = null;
  }

  init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playWhistle() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(3200, this.ctx.currentTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(2200, this.ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  playGoalChime() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.value = freq;

        const startTime = this.ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.12, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  playClick() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    } catch { /* el navegador bloqueó el audio: se ignora */ }
  }

  // ---------------------------------------------------------------- Sonidos de partido

  // Ruido blanco reutilizable (base de la hinchada)
  noiseBuffer() {
    if (this._noise) return this._noise;
    const len = this.ctx.sampleRate * 3;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._noise = buf;
    return buf;
  }

  ready() {
    if (this.muted) return false;
    this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  // Silbato de árbitro: tono agudo con el trino de la bolita
  whistle(start, duration, volume = 0.12) {
    const t = this.ctx.currentTime + start;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2750, t);
    lfo.frequency.value = 32;
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.setValueAtTime(volume, t + duration - 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(this.ctx.destination);
    osc.start(t); lfo.start(t);
    osc.stop(t + duration); lfo.stop(t + duration);
  }

  // Gol: la hinchada crece y explota, bocina de estadio y campanita final
  playGoal() {
    if (!this.ready()) return;
    try {
      const t = this.ctx.currentTime;
      const crowd = this.ctx.createBufferSource();
      crowd.buffer = this.noiseBuffer();
      const band = this.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.setValueAtTime(500, t);
      band.frequency.linearRampToValueAtTime(1100, t + 0.6);
      band.Q.value = 0.7;
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.0001, t);
      cg.gain.exponentialRampToValueAtTime(0.35, t + 0.45);
      cg.gain.setValueAtTime(0.35, t + 1.3);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      crowd.connect(band).connect(cg).connect(this.ctx.destination);
      crowd.start(t);
      crowd.stop(t + 2.7);

      // Bocina: acorde mayor en diente de sierra, filtrado
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      const hg = this.ctx.createGain();
      hg.gain.setValueAtTime(0.0001, t + 0.15);
      hg.gain.exponentialRampToValueAtTime(0.09, t + 0.25);
      hg.gain.setValueAtTime(0.09, t + 0.95);
      hg.gain.exponentialRampToValueAtTime(0.0001, t + 1.25);
      lp.connect(hg).connect(this.ctx.destination);
      [220, 277.18, 329.63].forEach(f => {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.connect(lp);
        o.start(t + 0.15);
        o.stop(t + 1.3);
      });
      setTimeout(() => this.playGoalChime(), 1150);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Tarjeta: dos pitazos cortos (amarilla) o uno largo con golpe grave (roja)
  playCard(color = 'yellow') {
    if (!this.ready()) return;
    try {
      const t = this.ctx.currentTime;
      if (color === 'red') {
        this.whistle(0, 0.75, 0.13);
      } else {
        this.whistle(0, 0.16);
        this.whistle(0.22, 0.16);
      }
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const start = t + (color === 'red' ? 0.8 : 0.42);
      o.type = 'triangle';
      o.frequency.setValueAtTime(color === 'red' ? 220 : 440, start);
      o.frequency.exponentialRampToValueAtTime(color === 'red' ? 110 : 330, start + 0.35);
      g.gain.setValueAtTime(0.16, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      o.connect(g).connect(this.ctx.destination);
      o.start(start);
      o.stop(start + 0.42);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Córner: un pitazo corto y suave
  playCorner() {
    if (!this.ready()) return;
    try {
      this.whistle(0, 0.12, 0.07);
    } catch { /* el navegador bloqueó el audio: se ignora */ }
  }
}

export const sounds = new SoundEngine();
