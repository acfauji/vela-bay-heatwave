// Synthesised audio only: no external files. Engine drone, heat-shimmer ambient,
// gunfire, siren, UI clicks and mission stingers are built with WebAudio oscillators.
(function (VB) {
  'use strict';

  function Audio() {
    this.ctx = null;
    this.muted = false;
    this.engine = null;
    this.gain = null;
    this.master = null;
    this.started = false;
  }

  Audio.prototype.unlock = function () {
    if (this.started) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.34;
      this.master.connect(this.ctx.destination);
      this.engine = this.ctx.createOscillator();
      this.engine.type = 'sawtooth';
      this.engine.frequency.value = 60;
      var filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.engine.connect(filter);
      filter.connect(this.gain);
      this.gain.connect(this.master);
      this.engine.start();
      this.ambient = this.ctx.createOscillator();
      this.ambient.type = 'sine';
      this.ambient.frequency.value = 92;
      var ag = this.ctx.createGain();
      ag.gain.value = 0.012;
      this.ambient.connect(ag);
      ag.connect(this.master);
      this.ambient.start();
      this.started = true;
    } catch (err) { this.started = false; }
  };

  Audio.prototype.toggle = function () {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.34;
    return this.muted;
  };

  Audio.prototype.tone = function (freq, dur, type, vol, slide) {
    if (!this.ctx || this.muted) return;
    try {
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, this.ctx.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), this.ctx.currentTime + dur);
      g.gain.setValueAtTime(vol || 0.2, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      o.connect(g); g.connect(this.master);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch (err) { /* sound is optional */ }
  };

  Audio.prototype.noise = function (dur, vol) {
    if (!this.ctx || this.muted) return;
    try {
      var len = Math.floor(this.ctx.sampleRate * dur);
      var buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      var data = buf.getChannelData(0);
      for (var i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = this.ctx.createBufferSource();
      src.buffer = buf;
      var g = this.ctx.createGain();
      g.gain.value = vol || 0.2;
      src.connect(g); g.connect(this.master);
      src.start();
    } catch (err) { /* sound is optional */ }
  };

  Audio.prototype.shot = function (kind) {
    this.noise(kind === 'FISTS' ? 0.05 : 0.12, kind === 'RIFLE' ? 0.28 : 0.18);
    this.tone(kind === 'RIFLE' ? 130 : 200, 0.09, 'square', 0.12, 60);
  };
  Audio.prototype.siren = function () { this.tone(680, 0.55, 'sine', 0.1, 420); };
  Audio.prototype.click = function () { this.tone(820, 0.05, 'square', 0.06, 640); };
  Audio.prototype.stage = function () {
    var self = this;
    [520, 660, 880].forEach(function (f, i) { setTimeout(function () { self.tone(f, 0.16, 'triangle', 0.09); }, i * 110); });
  };

  Audio.prototype.update = function (state, dt) {
    if (!this.ctx || !this.engine) return;
    var car = state.player.car;
    var speed = car ? Math.abs(car.speed) : 0;
    var target = 52 + speed * 0.9;
    this.engine.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.gain.gain.setTargetAtTime(car ? 0.075 : 0.012, this.ctx.currentTime, 0.12);
    if (state.wanted > 0 && Math.floor(state.time * 1.4) % 2 === 0 && !this._sirenAt) {
      this._sirenAt = true;
      this.tone(760, 0.28, 'sine', 0.045, 480);
    }
    if (Math.floor(state.time * 1.4) % 2 === 1) this._sirenAt = false;
  };

  VB.audio = new Audio();
})(window.VB = window.VB || {});
