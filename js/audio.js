/* =============================================================
 *  紫禁城 · 数字复原  —  环境声（WebAudio 合成，无外部资源）
 *  风声 / 鸟鸣 / 脚步 / 跳跃落地；首次交互后开始
 * ============================================================= */
const AUDIO = {
  ctx: null,
  master: null,
  ready: false,
  muted: false,
  birdTimer: null,

  init: function () {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    if (c.state === 'suspended' && c.resume) { try { c.resume(); } catch (e) { /* ignore */ } }
    this.master = c.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(c.destination);

    /* 风声：低通过滤的噪声，缓慢起伏 */
    const len = Math.floor(c.sampleRate * 2.5);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      v = v * 0.995 + w * 0.005;
      data[i] = v * 4;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 360;
    lp.Q.value = 0.5;
    const g = c.createGain();
    g.gain.value = 0.05;
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start();
    this.wind = g;

    /* 风缓慢起伏 */
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.06;
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain); lfoGain.connect(g.gain);
    lfo.start();

    /* 殿内 room tone：两个低频正弦叠加，进殿时淡入 */
    this.roomGain = c.createGain();
    this.roomGain.gain.value = 0.0;
    const lp2 = c.createBiquadFilter();
    lp2.type = 'lowpass';
    lp2.frequency.value = 240;
    this.roomGain.connect(lp2);
    lp2.connect(this.master);
    this.roomOscs = [];
    for (const fq of [86, 129]) {
      const o2 = c.createOscillator();
      o2.type = 'sine';
      o2.frequency.value = fq;
      const g2 = c.createGain();
      g2.gain.value = 0.5;
      o2.connect(g2); g2.connect(this.roomGain);
      o2.start();
      this.roomOscs.push(o2);
    }
    this.zone = 'plaza';

    /* 雨声：带通噪声循环 */
    const rl = Math.floor(c.sampleRate * 2);
    const rbuf = c.createBuffer(1, rl, c.sampleRate);
    const rdata = rbuf.getChannelData(0);
    for (let ri = 0; ri < rl; ri++) rdata[ri] = (Math.random() * 2 - 1) * 0.6;
    const rsrc = c.createBufferSource();
    rsrc.buffer = rbuf;
    rsrc.loop = true;
    const rbp = c.createBiquadFilter();
    rbp.type = 'bandpass';
    rbp.frequency.value = 2400;
    rbp.Q.value = 0.55;
    this.rainGain = c.createGain();
    this.rainGain.gain.value = 0;
    rsrc.connect(rbp); rbp.connect(this.rainGain); this.rainGain.connect(this.master);
    rsrc.start();

    this.ready = true;
    this.scheduleBird();
  },

  scheduleBird: function () {
    if (!this.ready) return;
    const self = this;
    let dt;
    if (this.zone === 'garden') dt = 2200 + Math.random() * 4200;
    else if (this.zone === 'interior') dt = 14000 + Math.random() * 14000;
    else dt = 4500 + Math.random() * 9000;
    this.birdTimer = setTimeout(function () {
      self.chirp();
      self.scheduleBird();
    }, dt);
  },

  chirp: function () {
    if (!this.ready || this.muted) return;
    const c = this.ctx;
    const t = c.currentTime + 0.02;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      const f = 1900 + Math.random() * 900;
      const t0 = t + i * 0.085;
      o.frequency.setValueAtTime(f, t0);
      o.frequency.exponentialRampToValueAtTime(f * 1.4, t0 + 0.045);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.045, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + 0.09);
    }
  },

  _noiseBurst: function (dur, freq, vol, type) {
    if (!this.ready || this.muted) return;
    const c = this.ctx;
    const len = Math.max(32, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = 1 - i / len;
      d[i] = (Math.random() * 2 - 1) * env * env;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type || 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.1;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  },

  step: function (running, surface) {
    const s = surface || 'stone';
    const v = running ? 1.25 : 1.0;
    if (s === 'marble') {
      this._noiseBurst(0.05, (running ? 1400 : 1650) + Math.random() * 400, 0.03 * v, 'bandpass');
    } else if (s === 'grass') {
      this._noiseBurst(0.11, 260 + Math.random() * 120, 0.036 * v, 'lowpass');
    } else if (s === 'stairs') {
      this._noiseBurst(0.045, 1150 + Math.random() * 250, 0.03 * v, 'bandpass');
    } else if (s === 'wet') {
      this._noiseBurst(0.1, 700 + Math.random() * 300, 0.05 * v, 'bandpass');
      this._noiseBurst(0.06, 1800 + Math.random() * 500, 0.018 * v, 'bandpass');
    } else if (s === 'snow') {
      this._noiseBurst(0.13, 900 + Math.random() * 500, 0.042 * v, 'bandpass');
    } else {
      this._noiseBurst(0.075, running ? 520 : 700 + Math.random() * 260, (running ? 0.05 : 0.032));
    }
  },

  jump: function () {
    this._noiseBurst(0.12, 300, 0.05, 'lowpass');
  },

  land: function (surface) {
    const s = surface || 'stone';
    if (s === 'stairs') this._noiseBurst(0.1, 1200, 0.05, 'bandpass');
    else if (s === 'snow') this._noiseBurst(0.2, 700, 0.075, 'lowpass');
    else if (s === 'marble') this._noiseBurst(0.12, 1500, 0.06, 'bandpass');
    else if (s === 'grass') this._noiseBurst(0.16, 240, 0.065, 'lowpass');
    else this._noiseBurst(0.14, 200, 0.07, 'lowpass');
  },

  /* 区域切换：广场 / 御花园 / 殿内 */
  setZone: function (zone) {
    if (!this.ready) { this.zone = zone || 'plaza'; return; }
    this.zone = zone || 'plaza';
    const c = this.ctx;
    const now = c.currentTime;
    if (this.wind) {
      let windTarget = 0.05;
      if (this.zone === 'garden') windTarget = 0.038;
      if (this.zone === 'interior') windTarget = 0.012;
      try { this.wind.gain.setTargetAtTime(windTarget, now, 0.6); } catch (e) { this.wind.gain.value = windTarget; }
    }
    if (this.roomGain) {
      const roomTarget = this.zone === 'interior' ? 0.055 : 0.0;
      try { this.roomGain.gain.setTargetAtTime(roomTarget, now, 0.8); } catch (e) { this.roomGain.gain.value = roomTarget; }
    }
  },

  /* 互动提示音：柔和双音（磬） */
  chime: function () {
    if (!this.ready || this.muted) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.01;
    const notes = [880, 1174.7];
    for (let i = 0; i < notes.length; i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = notes[i];
      const s = t0 + i * 0.09;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(0.05, s + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.55);
      o.connect(g); g.connect(this.master);
      o.start(s); o.stop(s + 0.6);
    }
  },

  /* 发现地标：上行三音 */
  discover: function () {
    if (!this.ready || this.muted) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.01;
    const notes = [659.3, 880, 1318.5];
    for (let i = 0; i < notes.length; i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = notes[i];
      const s = t0 + i * 0.1;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(0.045, s + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.7);
      o.connect(g); g.connect(this.master);
      o.start(s); o.stop(s + 0.75);
    }
  },

  /* 风铃：高频清脆分音 */
  windchime: function () {
    if (!this.ready || this.muted) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.02;
    const notes = [1567.98, 1760, 1975.53, 2349.32, 2637.02];
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const f = notes[Math.floor(Math.random() * notes.length)];
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const s = t0 + i * (0.08 + Math.random() * 0.18);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(0.016, s + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 1.4 + Math.random() * 0.8);
      o.connect(g); g.connect(this.master);
      o.start(s); o.stop(s + 2.3);
    }
  },

  /* 钟声：低频多分音，长衰减 */
  bell: function () {
    if (!this.ready || this.muted) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.02;
    const partials = [[110, 0.12], [164.8, 0.07], [220, 0.05], [277.2, 0.03], [329.6, 0.018]];
    for (let i = 0; i < partials.length; i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = partials[i][0];
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(partials[i][1], t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 5.5 + i * 0.4);
      o.connect(g); g.connect(this.master);
      o.start(t0); o.stop(t0 + 6.2);
    }
  },

  /* 鸽哨：短促上扬哨音 */
  pigeon: function () {
    if (!this.ready || this.muted) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.02;
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      const f = 900 + Math.random() * 500;
      const s = t0 + i * (0.16 + Math.random() * 0.1);
      o.frequency.setValueAtTime(f, s);
      o.frequency.exponentialRampToValueAtTime(f * 1.5, s + 0.1);
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(0.022, s + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.16);
      o.connect(g); g.connect(this.master);
      o.start(s); o.stop(s + 0.2);
    }
  },

  /* 猫叫：下滑音 + 轻微颤音 */
  meow: function () {
    if (!this.ready || this.muted) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.02;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(720, t0);
    o.frequency.linearRampToValueAtTime(520, t0 + 0.32);
    o.frequency.linearRampToValueAtTime(380, t0 + 0.55);
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 7;
    lg.gain.value = 14;
    lfo.connect(lg); lg.connect(o.frequency);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 2.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.035, t0 + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    o.connect(bp); bp.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.65);
    lfo.start(t0); lfo.stop(t0 + 0.65);
  },

  /* 雨停滴水：高频短促 */
  drip: function () {
    if (!this.ready || this.muted) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.01;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    const f = 900 + Math.random() * 700;
    o.frequency.setValueAtTime(f, t0);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t0 + 0.09);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.03, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + 0.14);
  },

  setRain: function (v) {
    this.rainAmt = v;
    if (!this.ready || !this.rainGain) return;
    const target = Math.max(0, Math.min(1, v)) * 0.16;
    try { this.rainGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.5); } catch (e) { this.rainGain.gain.value = target; }
  },

  setMuted: function (m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
  },

  toggleMute: function () {
    this.setMuted(!this.muted);
    return this.muted;
  }
};
