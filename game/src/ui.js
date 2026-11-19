// Menus, pause screen, pause-map, reward panel and localStorage save/load. Every
// screen is DOM over the canvas and can be shown or hidden without resetting the world.
(function (VB) {
  'use strict';

  var KEY = VB.CFG.SAVE_KEY;

  function el(id) { return document.getElementById(id); }
  function set(id, text) { var n = el(id); if (n) n.textContent = String(text); }
  function show(id, on) {
    var n = el(id);
    if (n) n.style.display = on ? (n.classList.contains('screen') ? 'flex' : 'block') : 'none';
  }

  function hideScreens() {
    ['screen-menu', 'screen-pause', 'screen-map', 'screen-reward', 'screen-controls'].forEach(function (id) { show(id, false); });
  }

  function saveData(state) {
    return {
      v: 1, game: 'VELA BAY HEATWAVE',
      percent: VB.missions.progressPercent(state),
      cash: state.cash, rep: state.rep, day: state.day, clock: Math.round(state.clock * 100) / 100,
      chapter: state.missionIndex, chapterTitle: VB.missions.current(state).title,
      missionDone: state.missionDone.slice(),
      stolen: state.stats.stolen, takedowns: state.stats.takedowns, escapes: state.stats.escapes,
      tapes: state.tapes.map(function (t) { return t.got ? 1 : 0; })
    };
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(saveData(state)));
      var d = saveData(state);
      set('save-line', 'SAVED  \u2022  SLOT 1  \u2022  ' + d.percent + '% COMPLETE  \u2022  $' + d.cash);
      VB.world.notify(state, 'GAME SAVED - SLOT 1', '#8fe3a8');
      return true;
    } catch (err) {
      set('save-line', 'SAVE UNAVAILABLE IN THIS BROWSER');
      return false;
    }
  }

  function readSave() {
    try {
      var raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) { return null; }
  }

  function load(state) {
    var d = readSave();
    if (!d || d.v !== 1) return false;
    state.cash = d.cash || 0;
    state.rep = d.rep || 0;
    state.day = d.day || 1;
    state.clock = d.clock || 17.15;
    state.phase = VB.world.phaseFor(state.clock);
    state.missionIndex = VB.clamp(d.chapter || 1, 1, VB.missions.total());
    state.missionDone = d.missionDone || state.missionDone;
    state.missionStage = 0;
    state.missionProgress = 0;
    state.stats.stolen = d.stolen || 0;
    state.stats.takedowns = d.takedowns || 0;
    state.stats.escapes = d.escapes || 0;
    if (d.tapes && d.tapes.length === state.tapes.length) {
      state.tapes.forEach(function (t, i) { t.got = !!d.tapes[i]; });
      state.stats.tapes = d.tapes.filter(function (v) { return !!v; }).length;
    }
    state.unlocked.PISTOL = state.missionIndex > 1;
    state.unlocked.SMG = state.missionIndex > 2;
    state.unlocked.RIFLE = state.missionIndex > 4;
    state.wanted = 0;
    state.police.length = 0;
    return true;
  }

  function continueLine() {
    var d = readSave();
    if (!d) return 'CONTINUE  \u2014  NO SAVE YET  \u2014  START A NEW GAME';
    return 'CONTINUE  \u2014  CH ' + d.chapter + '/5 ' + d.chapterTitle + '  \u2014  $' + d.cash + '  \u2014  DAY ' + d.day + ' ' + VB.world.clockText(d.clock) + '  \u2014  ' + d.percent + '% COMPLETE';
  }

  function openMenu(state) {
    hideScreens();
    state.screen = 'menu';
    show('screen-menu', true);
    set('continue-line', continueLine());
    set('save-line', readSave() ? 'SAVE SLOT 1  \u2022  ' + readSave().percent + '% COMPLETE  \u2022  $' + readSave().cash : 'SAVE SLOT 1  \u2022  EMPTY');
  }

  function openPause(state) {
    hideScreens();
    state.screen = 'pause';
    show('screen-pause', true);
    set('pause-summary', 'DAY ' + state.day + '  \u2022  ' + VB.city.districtAt(state.player.x, state.player.y) + '  \u2022  $' + state.cash + '  \u2022  MISSION ' + VB.missions.formatMissionNumber(state));
  }

  function openMap(state) {
    hideScreens();
    state.screen = 'map';
    show('screen-map', true);
    drawMap(state);
    var list = '';
    for (var i = 0; i < VB.MISSIONS.length; i += 1) {
      var done = state.missionDone[i];
      var active = !done && state.missionIndex === i + 1;
      list += '<div class="mrow ' + (active ? 'act' : '') + '"><span class="mnum">' + (i + 1) + '/5</span><span class="mtitle">' + VB.MISSIONS[i].title + '</span><span class="mstate">' + (done ? 'COMPLETE' : active ? 'IN PROGRESS' : 'LOCKED') + '</span></div>';
    }
    var ml = el('map-missions'); if (ml) ml.innerHTML = list;
    set('map-stats', 'CASH $' + state.cash + '   \u2022   RESPECT ' + state.rep + ' ' + VB.repRank(state.rep) +
      '   \u2022   CARS ' + state.stats.stolen + '   \u2022   TAKEDOWNS ' + state.stats.takedowns +
      '   \u2022   ESCAPES ' + state.stats.escapes + '   \u2022   SUNSET TAPES ' + state.stats.tapes + '/12' +
      '   \u2022   SAVE SLOT 1 ' + VB.missions.progressPercent(state) + '%');
  }

  function drawMap(state) {
    var cv = el('map-canvas');
    if (!cv) return;
    var ctx = cv.getContext('2d');
    var w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#1d2a35'; ctx.fillRect(0, 0, w, h);
    var pad = 26, iw = w - pad * 2, ih = h - pad * 2;
    var scale = iw / VB.CFG.WORLD;
    for (var b = 0; b < state.city.blocks.length; b += 1) {
      var q = state.city.blocks[b];
      ctx.fillStyle = q.marina ? '#2c5b70' : '#34484a';
      ctx.fillRect(pad + q.x * scale, pad + q.y * scale, q.w * scale, q.h * scale);
    }
    ctx.strokeStyle = '#6f8a94'; ctx.lineWidth = 1.6;
    for (var k = 0; k <= VB.CFG.GRID; k += 1) {
      var p = pad + k * VB.CFG.CELL * scale;
      ctx.beginPath(); ctx.moveTo(p, pad); ctx.lineTo(p, pad + ih); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, p); ctx.lineTo(pad + iw, p); ctx.stroke();
    }
    ctx.font = 'bold 10px ui-monospace, monospace';
    ctx.fillStyle = '#93b3bd';
    for (var d = 0; d < VB.DISTRICTS.length; d += 1) {
      var di = VB.DISTRICTS[d];
      var c = VB.city.centerOfBlock(di.x, di.y);
      ctx.fillText(di.name, pad + c.x * scale - 34, pad + c.y * scale - 18);
    }
    var a = state.city.anchors;
    var points = [
      { p: a.safe, c: '#6fd3e8', label: 'S' },
      { p: a.warehouse, c: '#ffd45e', label: 'M' },
      { p: a.docks, c: '#ff8a5c', label: 'D' },
      { p: a.station, c: '#ff5b4a', label: 'P' }
    ];
    for (var i = 0; i < points.length; i += 1) {
      var pt = points[i];
      var x = pad + pt.p.x * scale, y = pad + pt.p.y * scale;
      ctx.fillStyle = pt.c;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#162029'; ctx.font = 'bold 9px ui-monospace, monospace'; ctx.textAlign = 'center';
      ctx.fillText(pt.label, x, y + 3); ctx.textAlign = 'left';
    }
    ctx.fillStyle = '#8fe3ff';
    for (var tp = 0; tp < state.tapes.length; tp += 1) {
      var tape = state.tapes[tp];
      if (tape.got) continue;
      ctx.fillRect(pad + tape.x * scale - 3, pad + tape.y * scale - 3, 6, 6);
    }
    var goal = VB.missions.targetPos(state);
    ctx.strokeStyle = '#ffd45e'; ctx.lineWidth = 2;
    var gx = pad + goal.x * scale, gy = pad + goal.y * scale;
    ctx.beginPath(); ctx.arc(gx, gy, 12, 0, 6.28); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(pad + state.player.x * scale, pad + state.player.y * scale, 5, 0, 6.28); ctx.fill();
  }

  function openReward(state) {
    var r = state.rewardPanel;
    if (!r) return;
    hideScreens();
    state.screen = 'reward';
    show('screen-reward', true);
    set('reward-title', r.title);
    set('reward-mission', 'MISSION ' + state.missionIndex + '/5  \u2022  ' + r.mission);
    set('reward-money', '+$' + r.cash.toLocaleString('en-US'));
    set('reward-rep', '+' + r.rep + ' REP');
    set('reward-unlock', 'UNLOCKED: ' + r.unlock);
    set('reward-next', 'UP NEXT: ' + r.next);
  }

  function openControls(state) {
    show('screen-controls', true);
  }

  VB.ui = {
    hideScreens: hideScreens, openMenu: openMenu, openPause: openPause,
    openMap: openMap, openReward: openReward, openControls: openControls,
    save: save, load: load, readSave: readSave, saveData: saveData,
    continueLine: continueLine, drawMap: drawMap
  };
})(window.VB = window.VB || {});
