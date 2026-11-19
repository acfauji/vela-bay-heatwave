// Deterministic seeded randomness for VELA BAY HEATWAVE. A tiny mulberry32 generator
// keeps the city, traffic and shot scenes identical for the same seed.
(function (VB) {
  'use strict';

  function Rng(seed) {
    this.state = (seed >>> 0) || 1;
  }

  Rng.prototype.next = function () {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    var t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  Rng.prototype.range = function (a, b) { return a + this.next() * (b - a); };
  Rng.prototype.int = function (a, b) { return Math.floor(this.range(a, b + 1)); };
  Rng.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length) % arr.length]; };
  Rng.prototype.chance = function (p) { return this.next() < p; };

  VB.Rng = Rng;
  VB.makeRng = function (seed) { return new Rng(seed); };
  VB.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  VB.lerp = function (a, b, t) { return a + (b - a) * t; };
  VB.dist = function (ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); };
  VB.wrapAngle = function (a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };
})(window.VB = window.VB || {});
