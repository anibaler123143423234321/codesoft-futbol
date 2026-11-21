// Sonidos del partido generados con Web Audio (sin archivos). Todo pasa por un bus con
// compresor para que ningún sonido sature y el volumen quede parejo entre ellos.

const MUTE_KEY = 'codesoft:muted';
// Sonido de gol propio (opcional): si existe este archivo se usa en vez del generado
const GOAL_FILE = '/sounds/gol.mp3';

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

class SoundEngine {
  constructor() {
    this.muted = typeof window !== 'undefined' ? readMuted() : false;
    this.ctx = null;
    this.out = null;
    this.lastDanger = 0;
    this.files = {};
  }

  /** Carga un audio de /public; si no existe (el servidor devuelve la página), se ignora. */
  async loadFile(name, url) {
    try {
      const res = await fetch(url);
      if (!res.ok || !/^audio\//.test(res.headers.get('content-type') || '')) return;
      this.files[name] = await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch {
      /* sin archivo: se usa el sonido generado */
    }
  }

  playFile(name, volume = 0.9) {
    const buf = this.files[name];
    if (!buf) return false;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    g.gain.value = volume;
    src.connect(g).connect(this.out);
    src.start();
    return true;
  }

  init() {
    if (this.ctx || typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.25;
    const master = this.ctx.createGain();
    master.gain.value = 0.85;
    master.connect(comp).connect(this.ctx.destination);
    this.out = master;
    this.loadFile('goal', GOAL_FILE);
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* almacenamiento bloqueado: el silencio dura esta sesión */
    }
    return this.muted;
  }

  ready() {
    if (this.muted) return false;
    this.init();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return true;
  }

  /** Ejecuta un sonido sin que un fallo del navegador rompa la app. */
  safe(fn) {
    if (!this.ready()) return;
    try {
      fn(this.ctx.currentTime);
    } catch {
      /* el navegador bloqueó el audio: se ignora */
    }
  }

  // ---------------------------------------------------------------- Piezas

  noiseBuffer() {
    if (this._noise) return this._noise;
    // Ruido rosado aproximado (Paul Kellet): suena a gente, no a radio sin sintonizar
    const len = this.ctx.sampleRate * 4;
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + w * 0.099046;
        b1 = 0.963 * b1 + w * 0.2965164;
        b2 = 0.57 * b2 + w * 1.0526913;
        d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18;
      }
    }
    this._noise = buf;
    return buf;
  }

  /** Envolvente: puntos [segundos desde t, ganancia]. */
  env(gain, t, points) {
    gain.gain.setValueAtTime(0.0001, t);
    for (const [at, v] of points) gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, v), t + at);
  }

  /**
   * Hinchada: ruido rosado filtrado en dos capas con un vaivén lento.
   * `shape` = envolvente, `from`/`to` = centro del filtro al empezar y al terminar.
   */
  crowd(t, { shape, from = 600, to = 900, q = 0.6, sway = 0.25 }) {
    const end = shape[shape.length - 1][0];
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer();
    src.loop = true;
    const g = this.ctx.createGain();
    this.env(g, t, shape);
    [1, 1.9].forEach((mul, i) => {
      const band = this.ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = q;
      band.frequency.setValueAtTime(from * mul, t);
      band.frequency.exponentialRampToValueAtTime(to * mul, t + end * 0.7);
      const layer = this.ctx.createGain();
      layer.gain.value = i ? 0.45 : 1;
      src.connect(band).connect(layer).connect(g);
    });
    // Vaivén: la tribuna respira
    if (sway > 0) {
      const lfo = this.ctx.createOscillator();
      const depth = this.ctx.createGain();
      const am = this.ctx.createGain();
      lfo.frequency.value = 1.6;
      depth.gain.value = sway;
      am.gain.value = 1 - sway;
      lfo.connect(depth).connect(am.gain);
      g.connect(am).connect(this.out);
      lfo.start(t);
      lfo.stop(t + end + 0.05);
    } else {
      g.connect(this.out);
    }
    src.start(t, Math.random() * 2);
    src.stop(t + end + 0.05);
  }

  /** Silbato de árbitro: dos tonos casi iguales, trino de la bolita y un poco de aire. */
  whistle(start, duration, volume = 0.16) {
    const t = this.ctx.currentTime + start;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.018);
    g.gain.setValueAtTime(volume, t + Math.max(0.03, duration - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    const trill = this.ctx.createOscillator();
    const trillDepth = this.ctx.createGain();
    trill.frequency.value = 26 + Math.random() * 8;
    trillDepth.gain.value = 120;
    const tremolo = this.ctx.createGain();
    const tremDepth = this.ctx.createGain();
    tremolo.gain.value = 0.7;
    tremDepth.gain.value = 0.3;
    trill.connect(trillDepth);
    trill.connect(tremDepth).connect(tremolo.gain);

    [2860, 2875].forEach((f) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * 0.97, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      trillDepth.connect(o.frequency);
      o.connect(tremolo);
      o.start(t);
      o.stop(t + duration + 0.02);
    });

    const air = this.ctx.createBufferSource();
    air.buffer = this.noiseBuffer();
    const airBand = this.ctx.createBiquadFilter();
    airBand.type = 'bandpass';
    airBand.frequency.value = 3200;
    airBand.Q.value = 1.4;
    const airGain = this.ctx.createGain();
    airGain.gain.value = 0.35;
    air.connect(airBand).connect(airGain).connect(tremolo);

    tremolo.connect(g).connect(this.out);
    trill.start(t);
    trill.stop(t + duration + 0.02);
    air.start(t, Math.random() * 2);
    air.stop(t + duration + 0.02);
  }

  /** Nota con envolvente de campana. */
  tone(t, freq, { type = 'sine', dur = 0.4, vol = 0.12, attack = 0.008 } = {}) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /** Golpe grave corto (pelota contra el guante o el cuerpo). */
  thud(t, vol = 0.3) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + 0.18);
  }

  // ---------------------------------------------------------------- Interfaz

  playClick() {
    this.safe((t) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(1500, t);
      o.frequency.exponentialRampToValueAtTime(700, t + 0.035);
      g.gain.setValueAtTime(0.06, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + 0.06);
    });
  }

  playWhistle() {
    this.safe(() => this.whistle(0, 0.3, 0.12));
  }

  playGoalChime() {
    this.safe((t) => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        this.tone(t + i * 0.08, f, { type: 'triangle', dur: 0.45, vol: 0.1 });
        this.tone(t + i * 0.08, f * 2, { dur: 0.3, vol: 0.025 });
      });
    });
  }

  // ---------------------------------------------------------------- Partido

  /** Gol: la tribuna explota y sigue cantando, bocina de estadio y campanita al final. */
  playGoal() {
    if (!this.ready()) return;
    if (this.playFile('goal')) return;
    this.safe((t) => {
      this.crowd(t, { shape: [[0.12, 0.25], [0.5, 0.9], [2.2, 0.75], [4.2, 0.0001]], from: 520, to: 1000, sway: 0.18 });
      // Bocina: acorde en diente de sierra, con un leve vibrato
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1500;
      const hg = this.ctx.createGain();
      this.env(hg, t + 0.2, [[0.08, 0.08], [0.9, 0.07], [1.3, 0.0001]]);
      lp.connect(hg).connect(this.out);
      const vib = this.ctx.createOscillator();
      const vibDepth = this.ctx.createGain();
      vib.frequency.value = 5;
      vibDepth.gain.value = 2.5;
      vib.connect(vibDepth);
      [220, 277.18, 329.63].forEach((f) => {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        vibDepth.connect(o.frequency);
        o.connect(lp);
        o.start(t + 0.2);
        o.stop(t + 1.55);
      });
      vib.start(t + 0.2);
      vib.stop(t + 1.55);
    });
    setTimeout(() => this.playGoalChime(), 1350);
  }

  /** Tiro: "uuuh" de la tribuna. Al arco, además, el golpe en el arquero. */
  playShot(onTarget = false) {
    this.safe((t) => {
      if (onTarget) this.thud(t + 0.05, 0.22);
      this.crowd(t, { shape: [[0.25, 0.5], [0.7, 0.4], [1.6, 0.0001]], from: 820, to: 430, q: 1.1, sway: 0 });
    });
  }

  /** Palo: golpe metálico con parciales inarmónicos y el "uuuh" más fuerte. */
  playWoodwork() {
    this.safe((t) => {
      [[523, 0.12], [1307, 0.07], [2213, 0.05], [3221, 0.03]].forEach(([f, v]) => this.tone(t, f, { dur: 1.1, vol: v, attack: 0.002 }));
      this.crowd(t + 0.1, { shape: [[0.25, 0.7], [0.8, 0.55], [1.9, 0.0001]], from: 860, to: 420, q: 1.1, sway: 0 });
    });
  }

  /** Tarjeta: amarilla, dos pitazos cortos; roja, uno largo y silbidos de la tribuna. */
  playCard(color = 'yellow') {
    this.safe((t) => {
      if (color === 'red') {
        this.whistle(0, 0.8, 0.15);
        this.crowd(t + 0.7, { shape: [[0.3, 0.35], [1.2, 0.3], [2, 0.0001]], from: 300, to: 260, q: 1.4, sway: 0.4 });
      } else {
        this.whistle(0, 0.15, 0.14);
        this.whistle(0.22, 0.15, 0.14);
        this.tone(t + 0.45, 880, { type: 'triangle', dur: 0.18, vol: 0.06 });
      }
    });
  }

  playCorner() {
    this.safe((t) => {
      this.whistle(0, 0.14, 0.08);
      this.crowd(t + 0.1, { shape: [[0.4, 0.22], [1.2, 0.0001]], from: 650, to: 800, sway: 0 });
    });
  }

  playOffside() {
    this.safe(() => this.whistle(0, 0.24, 0.12));
  }

  /** Penal: pitazo largo y la tribuna que se tensa. */
  playPenalty() {
    this.safe((t) => {
      this.whistle(0, 0.65, 0.15);
      this.crowd(t + 0.5, { shape: [[0.6, 0.45], [1.8, 0.5], [2.6, 0.0001]], from: 500, to: 700, sway: 0.12 });
    });
  }

  /** VAR: dos tonos electrónicos, dos veces. */
  playVar() {
    this.safe((t) => {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      lp.connect(this.out);
      [[0, 880], [0.16, 660], [0.42, 880], [0.58, 660]].forEach(([at, f]) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'square';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + at);
        g.gain.exponentialRampToValueAtTime(0.045, t + at + 0.01);
        g.gain.setValueAtTime(0.045, t + at + 0.11);
        g.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.14);
        o.connect(g).connect(lp);
        o.start(t + at);
        o.stop(t + at + 0.15);
      });
    });
  }

  /** Cambio: el timbre del tablero electrónico. */
  playSub() {
    this.safe((t) => {
      this.tone(t, 659.25, { dur: 0.35, vol: 0.08 });
      this.tone(t + 0.14, 880, { dur: 0.5, vol: 0.08 });
    });
  }

  /** Comienzo y final: uno largo; descanso, dos; final del partido, dos cortos y uno largo. */
  playPeriod(kind = 'start') {
    this.safe(() => {
      if (kind === 'half') {
        this.whistle(0, 0.45);
        this.whistle(0.65, 0.9);
      } else if (kind === 'end') {
        this.whistle(0, 0.28);
        this.whistle(0.45, 0.28);
        this.whistle(0.9, 1.1);
      } else {
        this.whistle(0, 0.7);
      }
    });
  }

  /** Ataque peligroso: la tribuna empieza a levantarse (como mucho cada 25 s). */
  playDanger() {
    const now = Date.now();
    if (now - this.lastDanger < 25000) return;
    this.lastDanger = now;
    this.safe((t) => {
      this.crowd(t, { shape: [[0.9, 0.28], [1.6, 0.0001]], from: 480, to: 760, sway: 0.15 });
    });
  }
}

export const sounds = new SoundEngine();
