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

    this.ready = true;
    this.scheduleBird();
  },

  scheduleBird: function () {
    if (!this.ready) return;
    const self = this;
    const dt = 4500 + Math.random() * 9000;
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

  step: function (running) {
    this._noiseBurst(0.075, running ? 520 : 700 + Math.random() * 260, running ? 0.05 : 0.032);
  },

  jump: function () {
    this._noiseBurst(0.12, 300, 0.05, 'lowpass');
  },

  land: function () {
    this._noiseBurst(0.14, 200, 0.07, 'lowpass');
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
