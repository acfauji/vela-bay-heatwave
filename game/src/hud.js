// Dense but tidy heads-up display. All panels are regular DOM over the canvas so text
// stays crisp; this module only writes values into the markup defined in index.html.
(function (VB) {
  'use strict';

  function el(id) { return document.getElementById(id); }
  function set(id, text) { var n = el(id); if (n && n.textContent !== String(text)) n.textContent = String(text); }
  function show(id, on) { var n = el(id); if (n) n.style.display = on ? '' : 'none'; }

  function stars(state) {
    var html = '';
    for (var i = 0; i < 5; i += 1) {
      html += '<span class="star ' + (i < state.wanted ? 'lit' : '') + '">' + (i < state.wanted ? '\u2605' : '\u2606') + '</span>';
    }
    return html;
  }

  function dispatch(state) {
    var rows = '';
    var units = state.police.slice(0, 6);
    for (var i = 0; i < units.length; i += 1) {
      var u = units[i];
      var cls = u.disabled ? 'off' : u.status === 'RAMMING' || u.status === 'ENGAGED' ? 'hot' : 'norm';
      var d = Math.round(VB.dist(u.x, u.y, state.player.x, state.player.y));
      rows += '<div class="unit ' + cls + '"><span class="call">' + u.callsign + '</span><span class="st">' + u.status + '</span><span class="dst">' + d + 'm</span></div>';
    }
    if (!units.length) rows = '<div class="unit idle">NO UNITS RESPONDING</div>';
    return rows;
  }

  function weapons(state) {
    var html = '';
    for (var i = 0; i < VB.WEAPONS.length; i += 1) {
      var w = VB.WEAPONS[i];
      var locked = w.locked && !state.unlocked[w.id];
      var a = state.player.ammo[w.id] || { mag: 0, reserve: 0 };
      var ammo = locked ? 'LOCKED' : w.mag ? a.mag + '/' + a.reserve : 'INF';
      html += '<div class="slot ' + (state.weapon === i ? 'active ' : '') + (locked ? 'locked' : '') + '">' +
        '<span class="k">' + (i + 1) + '</span><span class="n">' + w.label + '</span><span class="a">' + ammo + '</span></div>';
    }
    return html;
  }

  function notices(state) {
    var html = '';
    for (var i = 0; i < state.notifications.length; i += 1) {
      var n = state.notifications[i];
      html += '<div class="notice" style="opacity:' + VB.clamp(n.life / 1.2, 0, 1) + ';color:' + n.color + '">' + n.text + '</div>';
    }
    return html;
  }

  function clock(clock) {
    var h = Math.floor(clock) % 24;
    var m = Math.floor((clock - Math.floor(clock)) * 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  function update(state) {
    var m = VB.missions.current(state);
    var p = state.player;
    set('hud-mode', p.onFoot ? 'ON FOOT' : 'DRIVING');
    set('hud-speed', p.car ? Math.round(Math.abs(p.car.speed) * 1.6) : 0);
    set('hud-gear', p.car ? (p.car.speed < -2 ? 'R' : Math.min(5, 1 + Math.floor(Math.abs(p.car.speed) / 52))) : '-');
    set('hud-mission-num', 'MISSION ' + VB.missions.formatMissionNumber(state));
    set('hud-mission-title', m.title);
    set('hud-stage', 'STAGE ' + VB.missions.formatStage(state) + '  \u2022  ' + m.tag + '  \u2022  ' + m.contact);
    set('hud-objective', VB.missions.formatObjective(state));
    set('hud-next', VB.missions.nextTitle(state));
    var goal = VB.missions.targetPos(state);
    set('hud-distance', Math.round(VB.dist(p.x, p.y, goal.x, goal.y)) + 'm TO OBJECTIVE');

    var st = el('hud-wanted-stars');
    if (st && st.dataset.v !== String(state.wanted)) { st.innerHTML = stars(state); st.dataset.v = String(state.wanted); }
    set('hud-wanted-state', state.wanted === 0 ? 'CLEAN' : state.inSight ? 'IN SIGHT' : 'EVADING');
    set('hud-cash', '$' + state.cash.toLocaleString('en-US'));
    set('hud-rep', state.rep);
    set('hud-rank', VB.repRank(state.rep));
    var nextAt = 0;
    for (var r = 0; r < VB.REP_RANKS.length; r += 1) if (state.rep >= VB.REP_RANKS[r].at) nextAt = VB.REP_RANKS[r].at;
    var rank = VB.repRank(state.rep);
    var curAt = 0;
    for (var q = 0; q < VB.REP_RANKS.length; q += 1) if (VB.REP_RANKS[q].name === rank) curAt = VB.REP_RANKS[q].at;
    var nextRank = VB.REP_RANKS[VB.REP_RANKS.indexOf(VB.REP_RANKS.filter(function (x) { return x.name === rank; })[0]) + 1];
    var frac = nextRank ? VB.clamp((state.rep - curAt) / Math.max(1, nextRank.at - curAt), 0, 1) : 1;
    var bar = el('hud-rep-bar');
    if (bar) bar.style.width = Math.round(frac * 100) + '%';
    set('hud-rep-target', nextRank ? state.rep + '/' + nextRank.at + ' XP' : 'MAX XP');

    set('hud-day', 'DAY ' + state.day + '  ' + clock(state.clock));
    set('hud-time', state.phase.toUpperCase());
    set('hud-location', VB.city.districtAt(p.x, p.y) + ' \u2022 ' + VB.city.streetAt(p.x, p.y));
    set('hud-heat', Math.round(state.heat * 100) + '%');
    var hb = el('hud-heat-bar');
    if (hb) hb.style.width = Math.round(state.heat * 100) + '%';
    var curfew = state.phase === 'night' && state.heat > 0.85;
    set('hud-heat-label', curfew ? 'HEATWAVE CURFEW ACTIVE' : 'HEAT INDEX / ' + (state.phase === 'night' ? 'COOLING' : 'RISING'));
    set('hud-tapes', 'SUNSET TAPES ' + state.stats.tapes + '/' + state.tapes.length);

    var dr = el('hud-dispatch');
    var key = state.police.map(function (u) { return u.callsign + u.status + Math.round(VB.dist(u.x, u.y, p.x, p.y)); }).join('|');
    if (dr && dr.dataset.v !== key) { dr.innerHTML = dispatch(state); dr.dataset.v = key; }
    set('hud-dispatch-count', state.police.length + ' UNITS');

    show('p-vehicle', !!p.car);
    if (p.car) {
      set('hud-vmodel', p.car.model);
      set('hud-vcond', Math.round(p.car.condition) + '%');
      set('hud-vspeed', Math.round(Math.abs(p.car.speed) * 1.6) + ' KM/H');
      set('hud-vgear', 'G' + (p.car.speed < -2 ? 'R' : Math.min(5, 1 + Math.floor(Math.abs(p.car.speed) / 52))));
      set('hud-vplate', p.car.plate);
      var cb = el('hud-vcond-bar');
      if (cb) { cb.style.width = Math.round(p.car.condition) + '%'; cb.style.background = p.car.condition < 35 ? '#ff6b52' : '#6fd3e8'; }
    }
    set('hud-radio', state.radio.station + ' \u00b7 ' + state.radio.genre);
    set('hud-radio-track', 'NOW: ' + state.radio.track);

    set('hud-health', Math.max(0, Math.round(p.health)));
    set('hud-armor', Math.round(p.armor));
    set('hud-stamina', Math.round(p.stamina));
    var hpb = el('hud-health-bar'); if (hpb) hpb.style.width = VB.clamp(p.health, 0, 100) + '%';
    var apb = el('hud-armor-bar'); if (apb) apb.style.width = VB.clamp(p.armor, 0, 100) + '%';
    var spb = el('hud-stamina-bar'); if (spb) spb.style.width = VB.clamp(p.stamina, 0, 100) + '%';

    var ws = el('hud-weapons');
    if (ws && ws.dataset.v !== String(state.weapon) + state.unlocked.SMG + state.unlocked.RIFLE + p.ammo.PISTOL.mag) {
      ws.innerHTML = weapons(state);
      ws.dataset.v = String(state.weapon) + state.unlocked.SMG + state.unlocked.RIFLE + p.ammo.PISTOL.mag;
    }

    var nt = el('hud-notices');
    if (nt) nt.innerHTML = notices(state);

    var mm = el('minimap');
    if (mm) VB.minimap.draw(mm.getContext('2d'), state, mm.width);
  }

  VB.hud = { update: update };
})(window.VB = window.VB || {});
