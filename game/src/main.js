// Bootstrap: builds the world, wires the menus and input, renders one full frame
// synchronously, then runs the loop. ?shot=cover|city|onfoot|mission stages a scene
// immediately; otherwise the start screen is shown.
(function (VB) {
  'use strict';

  function boot() {
    var params = new URLSearchParams(window.location.search);
    var shot = params.get('shot');
    var seed = parseInt(params.get('seed') || '1337', 10);
    if (!isFinite(seed)) seed = 1337;

    var canvas = document.getElementById('game');
    var ctx = canvas.getContext('2d');
    var size = VB.render.setup(canvas, window.innerWidth || 1280, window.innerHeight || 720);
    var input = new VB.Input(canvas);

    function fresh() {
      var s = VB.world.createState(seed);
      s.pointer = input.pointer;
      s.onReward = function () { VB.ui.openReward(s); };
      s.onStage = function () { VB.hud.update(s); };
      return s;
    }

    var state = fresh();
    state.pointer = input.pointer;

    function play() {
      VB.ui.hideScreens();
      state.screen = 'play';
      state.input = input;
      state.frozen = false;
      VB.audio.unlock();
    }

    function click(id, fn) {
      var n = document.getElementById(id);
      if (n) n.addEventListener('click', function (e) { e.preventDefault(); VB.audio.unlock(); fn(); });
    }

    click('btn-new', function () { state = fresh(); state.pointer = input.pointer; play(); });
    click('btn-continue', function () {
      if (!VB.ui.load(state)) { state = fresh(); state.pointer = input.pointer; }
      play();
    });
    click('btn-controls', function () { VB.ui.openControls(state); });
    click('btn-controls-back', function () { document.getElementById('screen-controls').style.display = 'none'; });
    click('btn-resume', play);
    click('btn-pause-save', function () { VB.ui.save(state); });
    click('btn-pause-load', function () { VB.ui.load(state); play(); });
    click('btn-pause-map', function () { VB.ui.openMap(state); });
    click('btn-pause-quit', function () { VB.ui.openMenu(state); });
    click('btn-map-back', function () { VB.ui.openPause(state); });
    click('btn-reward-ok', function () { state.rewardPanel = null; play(); });
    click('btn-mute', function () {
      var muted = VB.audio.toggle();
      var n = document.getElementById('btn-mute');
      if (n) n.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
    });

    input.onKey = function (code) {
      if (code === 'Escape') {
        if (state.screen === 'play') VB.ui.openPause(state);
        else if (state.screen === 'pause' || state.screen === 'map') play();
        else if (state.screen === 'reward') { state.rewardPanel = null; play(); }
      } else if (code === 'KeyM') {
        if (state.screen === 'play') VB.ui.openMap(state);
        else if (state.screen === 'map') play();
      } else if (code === 'KeyV') {
        var muted = VB.audio.toggle();
        var n = document.getElementById('btn-mute');
        if (n) n.textContent = muted ? 'SOUND OFF' : 'SOUND ON';
      } else if (code === 'KeyC' && state.screen === 'play') {
        state.camera.chase = !state.camera.chase;
        VB.world.notify(state, state.camera.chase ? 'CHASE CAMERA ON' : 'CHASE CAMERA OFF', '#9fd8ff');
      } else if (code === 'Enter' && state.screen === 'menu') {
        play();
      }
    };

    function renderFrame(dt) {
      if (state.screen === 'play' && !state.frozen) {
        state.pointer = input.pointer;
        if (input.rmbDown) state.camera.angle += input.dx * 0.006;
        if (input.keys.KeyQ) state.camera.angle -= dt * 1.2;
        if (input.keys.KeyE) state.camera.angle += dt * 1.2;
        VB.world.step(state, dt, input);
      }
      input.endFrame();
      VB.render.draw(ctx, state, size.w, size.h);
      VB.hud.update(state);
    }

    if (shot && VB.shots.names.indexOf(shot) >= 0) {
      VB.shots.stageShot(shot, state);
      VB.ui.hideScreens();
      renderFrame(0);
    } else {
      VB.ui.openMenu(state);
      renderFrame(0);
    }

    var last = 0;
    function loop(ts) {
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      renderFrame(dt);
      window.requestAnimationFrame(loop);
    }
    window.requestAnimationFrame(loop);

    window.addEventListener('resize', function () {
      size = VB.render.setup(canvas, window.innerWidth || 1280, window.innerHeight || 720);
    });

    window.VB.game = {
      state: function () { return state; },
      newGame: function () { state = fresh(); state.pointer = input.pointer; play(); },
      play: play, renderFrame: renderFrame
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.VB = window.VB || {});
