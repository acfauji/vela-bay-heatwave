// Keyboard and pointer capture. `pressed` holds one-frame key events; `keys` is the
// held state; `dx` is mouse travel for mouse-look camera rotation.
(function (VB) {
  'use strict';

  function Input(canvas) {
    var self = this;
    this.keys = {};
    this.pressed = {};
    this.pointer = { x: 640, y: 360 };
    this.pointerDown = false;
    this.rmbDown = false;
    this.dx = 0;
    this.dy = 0;
    this.onKey = null;

    window.addEventListener('keydown', function (e) {
      if (!self.keys[e.code]) self.pressed[e.code] = true;
      self.keys[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
      if (self.onKey) self.onKey(e.code, e);
    });
    window.addEventListener('keyup', function (e) { self.keys[e.code] = false; });
    window.addEventListener('blur', function () { self.keys = {}; self.pointerDown = false; self.rmbDown = false; });
    var target = canvas || window;
    target.addEventListener('mousemove', function (e) {
      self.dx += e.movementX || 0;
      self.dy += e.movementY || 0;
      var r = target.getBoundingClientRect ? target.getBoundingClientRect() : { left: 0, top: 0 };
      self.pointer.x = e.clientX - r.left;
      self.pointer.y = e.clientY - r.top;
    });
    target.addEventListener('mousedown', function (e) {
      if (e.button === 0) self.pointerDown = true;
      if (e.button === 2) self.rmbDown = true;
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 0) self.pointerDown = false;
      if (e.button === 2) self.rmbDown = false;
    });
    target.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  }

  Input.prototype.endFrame = function () {
    this.pressed = {};
    this.dx = 0;
    this.dy = 0;
  };

  VB.Input = Input;
})(window.VB = window.VB || {});
