// The simulation: one step advances the whole city. Input is read from VB.Input keys and
// pointer state; everything else (time of day, traffic, police response, combat, mission
// stages, floaters and the camera) is updated here in a fixed, deterministic order.
(function (VB) {
  'use strict';

  var CFG = VB.CFG;
  var E = VB.entities;
  var DAY_SECONDS = 420;

  function placeNear(city, x, y) {
    if (!VB.city.solidAt(city, x, y)) return { x: x, y: y };
    for (var r = 30; r < 320; r += 26) {
      for (var a = 0; a < 16; a += 1) {
        var ang = (a / 16) * Math.PI * 2;
        var px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r;
        if (!VB.city.solidAt(city, px, py)) return { x: px, y: py };
      }
    }
    return { x: x, y: y };
  }

  function roadside(city, x, y, rng) {
    var cx = Math.round(x / CFG.CELL) * CFG.CELL;
    var cy = Math.round(y / CFG.CELL) * CFG.CELL;
    var lane = CFG.ROAD * 0.22;
    if (Math.abs(x - cx) < Math.abs(y - cy)) {
      return { x: cx + (rng.chance(0.5) ? lane : -lane), y: y, angle: Math.PI / 2 };
    }
    return { x: x, y: cy + (rng.chance(0.5) ? lane : -lane), angle: 0 };
  }

  function createState(seed) {
    seed = seed || 1337;
    var rng = VB.makeRng(seed);
    var city = VB.city.generate(seed);
    var a = city.anchors;
    var start = placeNear(city, a.start.x, a.start.y);
    var player = E.createPlayer(start.x, start.y);
    player.ammo = { FISTS: { mag: 0, reserve: 0 }, PISTOL: { mag: 14, reserve: 84 }, SMG: { mag: 32, reserve: 192 }, RIFLE: { mag: 24, reserve: 144 }, LAUNCHER: { mag: 1, reserve: 4 } };

    var state = {
      seed: seed, rng: rng, city: city, player: player,
      screen: 'menu', time: 0, clock: 17.15, day: 1, phase: 'dusk', heat: 0.68,
      cars: [], peds: [], police: [], enemies: [], bullets: [], floaters: [], notifications: [],
      wanted: 0, inSight: false, decay: 0, search: { x: start.x, y: start.y, r: 0 },
      cash: 2400, rep: 0, respect: 0, weapon: 1, unlocked: { FISTS: true, PISTOL: false, SMG: false, RIFLE: false, LAUNCHER: false },
      missionIndex: 1, missionStage: 0, missionProgress: 0, missionDone: [false, false, false, false, false],
      missionFlags: { enteredMissionCar: false, stoleAny: false, guardsSpawned: false, rivalsSpawned: false, exitMade: false },
      missionCar: null, tailCar: null, rewardPanel: null, storyComplete: false,
      stats: { stolen: 0, takedowns: 0, escapes: 0, distance: 0, shots: 0, drift: 0, tapes: 0 },
      tapes: city.tapes.map(function (t) { return { x: t.x, y: t.y, got: false }; }),
      camera: { x: start.x, y: start.y, zoom: 0.92, angle: 0, chase: false, shake: 0 },
      pointer: { x: CFG.SHOT_W / 2, y: CFG.SHOT_H / 2, down: false },
      input: null, audio: null, onReward: null, onStage: null,
      driveTime: 0, nearMissCd: 0, driftTimer: 0, driftCombo: 0, muzzle: 0,
      sirenPulse: 0, radio: { station: 'SOLAR FM 101.9', genre: 'SUNSET POP', track: 'Rook On The Run' }
    };

    var m1 = roadside(city, a.m1car.x, a.m1car.y, rng);
    state.missionCar = E.createCar(city, rng, m1.x, m1.y, m1.angle, 0, 0, { driver: 'parked', targetSpeed: 0 });
    state.cars.push(state.missionCar);

    var tail = roadside(city, a.tail.x, a.tail.y, rng);
    state.tailCar = E.createCar(city, rng, tail.x, tail.y, tail.angle, 5, 3, { driver: 'courier', targetSpeed: 128 });
    state.cars.push(state.tailCar);

    var parked = [
      [a.safe.x + 70, a.safe.y - 50], [a.meet.x - 60, a.meet.y + 40],
      [a.warehouse.x + 90, a.warehouse.y - 70], [a.start.x + 120, a.start.y + 80]
    ];
    for (var i = 0; i < parked.length; i += 1) {
      var pp = roadside(city, parked[i][0], parked[i][1], rng);
      state.cars.push(E.createCar(city, rng, pp.x, pp.y, pp.angle, rng.int(2, 7), rng.int(0, 7), { driver: 'parked', targetSpeed: 0 }));
    }
    var traffic = E.spawnTraffic(city, rng, 20);
    for (var t = 0; t < traffic.length; t += 1) state.cars.push(traffic[t]);
    state.peds = E.spawnPeds(city, rng, 30);

    return state;
  }

  function addFloater(state, text, x, y, color, size) {
    state.floaters.push(E.createFloater(text, x, y, color, size));
    if (state.floaters.length > 28) state.floaters.shift();
  }

  function notify(state, text, color) {
    state.notifications.push({ text: text, color: color || '#ffd45e', life: 3.4, max: 3.4 });
    if (state.notifications.length > 5) state.notifications.shift();
  }

  function addWanted(state, amount, reason) {
    var before = state.wanted;
    state.wanted = VB.clamp(state.wanted + amount, 0, CFG.MAX_WANTED);
    state.decay = 13;
    if (state.wanted > before) {
      notify(state, 'WANTED ' + state.wanted + '/5 - ' + reason, '#ff6b52');
      if (state.audio && state.audio.siren) state.audio.siren();
    }
  }

  function anyWitness(state, x, y, radius) {
    for (var i = 0; i < state.peds.length; i += 1) {
      if (VB.dist(state.peds[i].x, state.peds[i].y, x, y) < (radius || 240)) return true;
    }
    return false;
  }

  function phaseFor(clock) {
    if (clock >= 6 && clock < 17) return 'day';
    if (clock >= 17 && clock < 19.6) return 'dusk';
    return 'night';
  }

  function stepClock(state, dt) {
    state.time += dt;
    state.clock += dt / DAY_SECONDS * 24;
    if (state.clock >= 24) { state.clock -= 24; state.day += 1; }
    state.phase = phaseFor(state.clock);
    var target = state.phase === 'night' ? 0.94 : state.phase === 'dusk' ? 0.7 : 0.42;
    state.heat = VB.lerp(state.heat, target, Math.min(1, dt * 0.35));
  }

  function nearestCar(state, x, y, maxDist) {
    var best = null, bd = maxDist || 66;
    for (var i = 0; i < state.cars.length; i += 1) {
      var c = state.cars[i];
      if (c.disabled) continue;
      var d = VB.dist(c.x, c.y, x, y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function enterCar(state) {
    var p = state.player;
    var car = nearestCar(state, p.x, p.y, 72);
    if (!car) { notify(state, 'NO VEHICLE IN RANGE', '#9fb6c8'); return; }
    var wasTheft = car.driver !== 'player' && !car.owned;
    p.onFoot = false;
    p.car = car;
    car.driver = 'player';
    car.owned = true;
    p.x = car.x; p.y = car.y;
    if (car === state.missionCar) state.missionFlags.enteredMissionCar = true;
    if (wasTheft) {
      state.missionFlags.stoleAny = true;
      state.stats.stolen += 1;
      notify(state, 'VEHICLE STOLEN - ' + car.model + ' / ' + car.plate, '#ffb347');
      addFloater(state, '+' + car.model, car.x, car.y - 26, '#ffd45e', 16);
      if (anyWitness(state, car.x, car.y, 230)) addWanted(state, 1, 'GRAND THEFT');
    } else {
      notify(state, 'ENTERED ' + car.model, '#8fe3a8');
    }
    if (state.audio && state.audio.click) state.audio.click();
  }

  function exitCar(state) {
    var p = state.player;
    if (p.onFoot || !p.car) return;
    var car = p.car;
    car.driver = 'parked';
    car.targetSpeed = 0;
    var side = car.angle + Math.PI / 2;
    var spot = placeNear(state.city, car.x + Math.cos(side) * 46, car.y + Math.sin(side) * 46);
    p.x = spot.x; p.y = spot.y;
    p.onFoot = true;
    p.car = null;
    notify(state, 'ON FOOT', '#8fe3a8');
  }

  function switchWeapon(state, idx) {
    if (idx < 0 || idx >= VB.WEAPONS.length) return;
    var w = VB.WEAPONS[idx];
    if (w.locked && !state.unlocked[w.id]) { notify(state, w.label + ' LOCKED', '#ff6b52'); return; }
    state.weapon = idx;
    if (state.audio && state.audio.click) state.audio.click();
  }

  function reload(state) {
    var w = VB.WEAPONS[state.weapon];
    var a = state.player.ammo[w.id];
    if (!a || !w.mag) return;
    var need = w.mag - a.mag;
    var give = Math.min(need, a.reserve);
    a.mag += give; a.reserve -= give;
    notify(state, 'RELOADED ' + w.label, '#9fd8ff');
  }

  function fire(state, dirX, dirY) {
    var p = state.player;
    if (!p.onFoot || p.fireCd > 0) return;
    var w = VB.WEAPONS[state.weapon];
    if (w.locked && !state.unlocked[w.id]) return;
    var a = p.ammo[w.id];
    if (w.mag && a.mag <= 0) { reload(state); return; }
    p.fireCd = w.rate;
    state.muzzle = 0.08;
    if (w.mag) a.mag -= 1;
    state.stats.shots += 1;
    var ang = Math.atan2(dirY, dirX) + (state.rng.next() - 0.5) * 0.06;
    state.bullets.push({
      x: p.x + Math.cos(ang) * 16, y: p.y + Math.sin(ang) * 16,
      vx: Math.cos(ang) * 720, vy: Math.sin(ang) * 720,
      life: w.range / 720, dmg: w.dmg, from: 'player', color: '#ffe08a'
    });
    if (state.audio && state.audio.shot) state.audio.shot(w.id);
    for (var i = 0; i < state.peds.length; i += 1) {
      var ped = state.peds[i];
      if (VB.dist(ped.x, ped.y, p.x, p.y) < 200) ped.flee = 4;
    }
    if (w.id !== 'FISTS' || anyWitness(state, p.x, p.y, 230)) addWanted(state, w.id === 'FISTS' ? 1 : 2, 'SHOOTING HEARD');
  }

  function stepPlayer(state, dt, input) {
    var p = state.player;
    p.fireCd = Math.max(0, p.fireCd - dt);
    p.hitFlash = Math.max(0, p.hitFlash - dt);
    state.muzzle = Math.max(0, state.muzzle - dt);
    p.stamina = VB.clamp(p.stamina + dt * (input.keys.ShiftLeft ? -7 : 12), 0, 100);

    var mx = (input.keys.KeyD ? 1 : 0) - (input.keys.KeyA ? 1 : 0);
    var my = (input.keys.KeyS ? 1 : 0) - (input.keys.KeyW ? 1 : 0);
    var len = Math.hypot(mx, my) || 1;
    var ang = state.camera.angle;
    var wx = (mx * Math.cos(ang) - my * Math.sin(ang)) / len;
    var wy = (mx * Math.sin(ang) + my * Math.cos(ang)) / len;

    if (p.onFoot) {
      var speed = CFG.FOOT_SPEED * (input.keys.ShiftLeft && p.stamina > 4 ? 1.6 : 1);
      if (p.dodge > 0) { p.dodge -= dt; speed *= 2.1; }
      var ox = p.x, oy = p.y;
      VB.city.moveBody(state.city, p, wx * speed * dt, wy * speed * dt);
      state.stats.distance += VB.dist(ox, oy, p.x, p.y);
      if (mx || my) p.angle = Math.atan2(wy, wx);
      p.walkPhase += dt * speed * 0.07;
    } else {
      var car = p.car;
      if (!car || car.disabled) { exitCar(state); return; }
      var throttle = (input.keys.KeyW ? 1 : 0) - (input.keys.KeyS ? 1 : 0);
      var steer = (input.keys.KeyD ? 1 : 0) - (input.keys.KeyA ? 1 : 0);
      var hand = !!input.keys.Space;
      if (throttle > 0) car.speed += car.accel * dt;
      else if (throttle < 0) car.speed -= car.accel * (car.speed > 0 ? 1.5 : 0.55) * dt;
      else car.speed -= car.speed * 1.1 * dt;
      if (hand) car.speed -= car.speed * 2.2 * dt;
      car.speed = VB.clamp(car.speed, -car.max * 0.42, car.max);
      var grip = VB.clamp(Math.abs(car.speed) / 55, 0.18, 1) * (hand ? 1.45 : 1);
      car.angle += steer * car.turn * grip * dt * (car.speed < 0 ? -1 : 1);
      var bx = car.x, by = car.y;
      var body = { x: car.x, y: car.y, r: car.h * 0.62 };
      var hit = VB.city.moveBody(state.city, body, Math.cos(car.angle) * car.speed * dt, Math.sin(car.angle) * car.speed * dt);
      car.x = body.x; car.y = body.y;
      p.x = car.x; p.y = car.y;
      state.stats.distance += VB.dist(bx, by, car.x, car.y);
      state.driveTime += dt;
      if (hit) {
        var impact = Math.abs(car.speed);
        car.condition = VB.clamp(car.condition - impact * 0.09, 0, 100);
        car.speed *= -0.22;
        state.camera.shake = Math.min(9, impact * 0.05);
        addFloater(state, 'COLLISION -' + Math.round(impact * 0.09), car.x, car.y - 20, '#ff7a5c', 14);
        if (car.condition <= 0) {
          car.disabled = true;
          notify(state, 'VEHICLE WRECKED', '#ff6b52');
          exitCar(state);
        }
      }
      if (hand && Math.abs(car.speed) > 130 && steer) {
        state.driftTimer += dt;
        if (state.driftTimer > 1.1) {
          state.driftTimer = 0;
          state.driftCombo += 1;
          state.stats.drift += 1;
          addFloater(state, 'DRIFT x' + state.driftCombo + ' +$120', car.x, car.y - 28, '#ffd45e', 16);
          state.cash += 120;
        }
      } else if (!hand) { state.driftCombo = 0; state.driftTimer = 0; }
      state.nearMissCd = Math.max(0, state.nearMissCd - dt);
      if (Math.abs(car.speed) > 150 && state.nearMissCd <= 0) {
        for (var i = 0; i < state.cars.length; i += 1) {
          var o = state.cars[i];
          if (o === car || o.disabled) continue;
          if (VB.dist(o.x, o.y, car.x, car.y) < 44) {
            state.nearMissCd = 2;
            addFloater(state, 'NEAR MISS +$250', car.x, car.y - 30, '#8fe3ff', 16);
            state.cash += 250;
            break;
          }
        }
      }
    }

    if (input.pressed.Space && p.onFoot && p.stamina > 20) {
      p.dodge = 0.22;
      p.stamina -= 20;
    }
    if (input.pressed.KeyF) { if (p.onFoot) enterCar(state); else exitCar(state); }
    if (input.pressed.KeyR) reload(state);
    for (var wi = 0; wi < 5; wi += 1) {
      if (input.pressed['Digit' + (wi + 1)]) switchWeapon(state, wi);
    }
    if (input.pointerDown && p.onFoot) {
      var cam = state.camera;
      var sx = state.pointer.x - CFG.SHOT_W / 2;
      var sy = state.pointer.y - CFG.SHOT_H / 2;
      var scale = 1 / Math.max(0.2, cam.zoom);
      var dx = sx * scale, dy = sy * scale;
      var cs = Math.cos(cam.angle), sn = Math.sin(cam.angle);
      var wdx = dx * cs - dy * sn, wdy = dx * sn + dy * cs;
      fire(state, wdx, wdy);
    }
  }

  function stepCourier(state, dt) {
    var car = state.tailCar;
    if (!car || car.disabled) return;
    car.driver = 'courier';
    var target = state.city.anchors.meet;
    var p = state.player;
    var dist = VB.dist(car.x, car.y, p.x, p.y);
    car.targetSpeed = dist < 120 ? 165 : 124;
    E.steerToward(car, target.x, target.y, dt, 0.4);
    car.speed += VB.clamp(car.targetSpeed - car.speed, -80 * dt, 70 * dt);
    var nx = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (!VB.city.solidAt(state.city, nx, ny)) { car.x = nx; car.y = ny; }
    else { car.angle += 1.2; car.speed *= 0.7; }
    if (VB.dist(car.x, car.y, target.x, target.y) < 80) { car.x = state.city.anchors.tail.x; car.y = state.city.anchors.tail.y; car.angle = 0; }
  }

  function spawnPolice(state) {
    var want = state.wanted;
    if (want <= 0) return;
    var desired = Math.min(6, want + (state.heat > 0.85 && state.phase === 'night' ? 1 : 0));
    var active = 0;
    for (var i = 0; i < state.police.length; i += 1) if (!state.police[i].disabled) active += 1;
    if (active >= desired) return;
    var n = state.police.length;
    var callsigns = ['VBD-01', 'VBD-12', 'GULL-4', 'VBD-27', 'TARPON-9', 'AIR-3'];
    var idx = n % callsigns.length;
    var ang = (n * 2.39 + state.time * 0.1) % 6.28;
    var dist = 520 + (n % 3) * 130;
    var px = VB.clamp(state.player.x + Math.cos(ang) * dist, 60, CFG.WORLD - 60);
    var py = VB.clamp(state.player.y + Math.sin(ang) * dist, 60, CFG.WORLD - 60);
    var spot = placeNear(state.city, px, py);
    var car = E.createCar(state.city, state.rng, spot.x, spot.y, ang + Math.PI, 2, 0, {
      driver: 'police', targetSpeed: 180, callsign: callsigns[idx], status: 'EN ROUTE', hp: 100
    });
    car.siren = state.rng.range(0, 6.28);
    state.police.push(car);
    state.cars.push(car);
  }

  function stepPolice(state, dt) {
    var p = state.player;
    spawnPolice(state);
    var sight = false;
    for (var i = 0; i < state.police.length; i += 1) {
      var u = state.police[i];
      if (u.disabled) { u.status = 'DISABLED'; continue; }
      var d = VB.dist(u.x, u.y, p.x, p.y);
      if (d < 340) { sight = true; u.status = d < 90 ? 'RAMMING' : d < 210 ? 'ENGAGED' : 'PURSUING'; }
      else u.status = d < 700 ? 'SEARCHING' : 'PATROL';
      E.steerToward(u, p.x, p.y, dt, 1.15);
      var want = d < 70 ? 55 : (p.car ? Math.max(150, Math.abs(p.car.speed) + 26) : 156);
      u.speed += VB.clamp(want - u.speed, -140 * dt, u.accel * 1.3 * dt);
      u.speed = VB.clamp(u.speed, 0, u.max + 30);
      var body = { x: u.x, y: u.y, r: u.h * 0.62 };
      VB.city.moveBody(state.city, body, Math.cos(u.angle) * u.speed * dt, Math.sin(u.angle) * u.speed * dt);
      u.x = body.x; u.y = body.y;
      if (d < 66 && u.speed > 45 && p.car && u.hitCd <= 0) {
        u.hitCd = 0.9;
        p.car.condition = VB.clamp(p.car.condition - 7, 0, 100);
        p.car.speed *= 0.94;
        state.camera.shake = 6;
        addFloater(state, 'RAMMED -$', u.x, u.y - 20, '#ff6b52', 15);
        state.cash = Math.max(0, state.cash - 60);
      }
      u.hitCd = Math.max(0, u.hitCd - dt);
      u.siren += dt * 9;
      if (state.wanted >= 3 && d < 260 && d > 60 && u.fireCd === undefined) u.fireCd = 1.4;
      if (state.wanted >= 3 && d < 260 && d > 60) {
        u.fireCd -= dt;
        if (u.fireCd <= 0) {
          u.fireCd = 1.5 + (i % 3) * 0.35;
          var ang = Math.atan2(p.y - u.y, p.x - u.x) + (state.rng.next() - 0.5) * 0.16;
          state.bullets.push({ x: u.x + Math.cos(ang) * 20, y: u.y + Math.sin(ang) * 20, vx: Math.cos(ang) * 560, vy: Math.sin(ang) * 560, life: 0.6, dmg: 7, from: 'police', color: '#ff8a7a' });
        }
      }
    }
    state.inSight = sight || anyWitness(state, p.x, p.y, 190);
    if (state.inSight) { state.search.x = p.x; state.search.y = p.y; state.decay = state.phase === 'night' && state.heat > 0.85 ? 17 : 12; }
    else {
      state.decay -= dt * (state.heat > 0.85 ? 0.7 : 1);
      if (state.decay <= 0 && state.wanted > 0) {
        state.wanted -= 1;
        state.decay = 8;
        state.stats.escapes += 1;
        notify(state, 'WANTED DROPPED - ' + state.wanted + ' STAR(S)', '#8fe3a8');
      }
    }
    state.search.r = state.inSight ? 150 + Math.sin(state.time * 3) * 14 : 105;
    for (var j = state.police.length - 1; j >= 0; j -= 1) {
      var unit = state.police[j];
      if (state.wanted === 0 && VB.dist(unit.x, unit.y, p.x, p.y) > 900) {
        state.police.splice(j, 1);
        var ci = state.cars.indexOf(unit);
        if (ci >= 0) state.cars.splice(ci, 1);
      }
    }
  }

  function spawnEnemies(state, kind, count, center, spread) {
    for (var i = 0; i < count; i += 1) {
      var ang = (i / count) * Math.PI * 2;
      var pos = placeNear(state.city, center.x + Math.cos(ang) * spread, center.y + Math.sin(ang) * spread);
      var enemy = E.createEnemy(pos.x, pos.y, kind, kind === 'rival' ? 70 : 60);
      enemy.angle = ang + Math.PI;
      state.enemies.push(enemy);
    }
    notify(state, kind === 'rival' ? 'DOCK CREW INCOMING' : 'WAREHOUSE GUARDS ALERTED', '#ff8a5c');
  }

  function stepEnemies(state, dt) {
    var p = state.player;
    for (var i = 0; i < state.enemies.length; i += 1) {
      var e = state.enemies[i];
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      var d = VB.dist(e.x, e.y, p.x, p.y);
      if (d < 520) e.alert = true;
      if (!e.alert) continue;
      if (d > 90) {
        e.angle = Math.atan2(p.y - e.y, p.x - e.x);
        var body = { x: e.x, y: e.y, r: 9 };
        VB.city.moveBody(state.city, body, Math.cos(e.angle) * e.speed * dt, Math.sin(e.angle) * e.speed * dt);
        e.x = body.x; e.y = body.y;
      } else e.strafe = -e.strafe;
      e.phase += dt * 6;
      e.fireCd -= dt;
      if (d < 420 && e.fireCd <= 0) {
        e.fireCd = 1.1 + (i % 3) * 0.4;
        var ang = Math.atan2(p.y - e.y, p.x - e.x) + (state.rng.next() - 0.5) * 0.2;
        state.bullets.push({ x: e.x + Math.cos(ang) * 14, y: e.y + Math.sin(ang) * 14, vx: Math.cos(ang) * 500, vy: Math.sin(ang) * 500, life: 0.85, dmg: 9, from: 'enemy', color: '#ff9a6a' });
      }
    }
  }

  function hurtPlayer(state, dmg) {
    var p = state.player;
    if (p.hitFlash > 0.35) return;
    p.hitFlash = 0.8;
    if (p.armor > 0) {
      var absorbed = Math.min(p.armor, dmg * 0.65);
      p.armor -= absorbed; dmg -= absorbed;
    }
    p.health -= dmg;
    state.camera.shake = 4;
    addFloater(state, '-' + Math.round(dmg) + ' HIT', p.x, p.y - 22, '#ff6b52', 15);
    if (p.health <= 0) respawn(state);
  }

  function respawn(state) {
    var p = state.player;
    if (p.car) { p.car.driver = 'parked'; p.car = null; }
    var a = state.city.anchors;
    var spot = placeNear(state.city, a.safe.x, a.safe.y);
    p.x = spot.x; p.y = spot.y; p.onFoot = true;
    p.health = 100; p.armor = 25; p.hitFlash = 0;
    state.wanted = 0; state.police.length = 0;
    state.camera.x = p.x; state.camera.y = p.y;
    notify(state, 'BUSTED - WOKE UP AT THE SAFEHOUSE', '#ff6b52');
  }

  function stepBullets(state, dt) {
    for (var i = state.bullets.length - 1; i >= 0; i -= 1) {
      var b = state.bullets[i];
      var nx = b.x + b.vx * dt, ny = b.y + b.vy * dt;
      b.life -= dt;
      var remove = b.life <= 0 || VB.city.solidAt(state.city, nx, ny);
      if (!remove && b.from === 'player') {
        for (var j = 0; j < state.enemies.length; j += 1) {
          var e = state.enemies[j];
          if (!e.dead && VB.dist(nx, ny, e.x, e.y) < 14) {
            e.health -= b.dmg; e.hitFlash = 0.3; e.alert = true;
            addFloater(state, '-' + b.dmg, e.x, e.y - 18, '#ffe08a', 14);
            if (e.health <= 0) {
              e.dead = true;
              state.stats.takedowns += 1;
              state.cash += 75;
              state.rep += 8;
              addFloater(state, 'DOWN +$75', e.x, e.y - 26, '#8fe3a8', 15);
            }
            remove = true; break;
          }
        }
        if (!remove) {
          for (var k = 0; k < state.police.length; k += 1) {
            var u = state.police[k];
            if (!u.disabled && VB.dist(nx, ny, u.x, u.y) < 20) {
              u.hp -= b.dmg; u.flash = 0.25;
              addFloater(state, '-' + b.dmg + ' ' + u.callsign, u.x, u.y - 22, '#ffe08a', 13);
              if (u.hp <= 0) {
                u.disabled = true; u.status = 'DISABLED'; u.speed = 0;
                state.stats.takedowns += 1;
                state.rep += 14;
                addFloater(state, u.callsign + ' DOWN', u.x, u.y - 36, '#8fe3a8', 15);
                notify(state, u.callsign + ' OFFLINE', '#8fe3a8');
              }
              remove = true; break;
            }
          }
        }
        if (!remove) {
          for (var q = 0; q < state.peds.length; q += 1) {
            var ped = state.peds[q];
            if (VB.dist(nx, ny, ped.x, ped.y) < 12) { ped.flee = 6; addWanted(state, 2, 'CIVILIAN DOWN'); remove = true; break; }
          }
        }
      } else if (!remove && VB.dist(nx, ny, state.player.x, state.player.y) < 14) {
        hurtPlayer(state, b.dmg);
        remove = true;
      }
      if (remove) state.bullets.splice(i, 1);
      else { b.x = nx; b.y = ny; }
    }
  }

  function stepMissions(state, dt) {
    if (state.frozen) return;
    var m = VB.missions.current(state);
    var a = state.city.anchors;
    var stage = m.stages[state.missionStage];
    if (!stage) return;
    if (state.missionIndex === 3 && state.missionStage === 0 && VB.dist(state.player.x, state.player.y, a.warehouse.x, a.warehouse.y) < 240 && !state.missionFlags.guardsSpawned) {
      state.missionFlags.guardsSpawned = true;
      spawnEnemies(state, 'guard', 4, a.warehouse, 110);
    }
    if (state.missionIndex === 5 && state.missionStage === 0 && VB.dist(state.player.x, state.player.y, a.docks.x, a.docks.y) < 260 && !state.missionFlags.rivalsSpawned) {
      state.missionFlags.rivalsSpawned = true;
      spawnEnemies(state, 'rival', 6, a.docks, 150);
    }
    if (VB.missions.checkStage(state, dt)) {
      var result = VB.missions.advance(state);
      if (result === 'passed') notify(state, 'MISSION PASSED - ' + m.title, '#ffd45e');
      else notify(state, 'STAGE ' + VB.missions.formatStage(state) + ' - ' + VB.missions.formatObjective(state), '#8fe3a8');
      if (state.audio && state.audio.stage) state.audio.stage();
    }
  }

  function stepTapes(state, dt) {
    if (!state.player.onFoot) return;
    for (var i = 0; i < state.tapes.length; i += 1) {
      var t = state.tapes[i];
      if (t.got || VB.dist(t.x, t.y, state.player.x, state.player.y) > 30) continue;
      t.got = true;
      state.stats.tapes += 1;
      state.cash += 150;
      state.rep += 10;
      addFloater(state, 'SUNSET TAPE +$150', t.x, t.y - 20, '#8fe3ff', 15);
      if (state.audio && state.audio.stage) state.audio.stage();
    }
  }

  function stepCamera(state, dt) {
    var cam = state.camera;
    var p = state.player;
    var leadX = 0, leadY = 0;
    if (p.car) { leadX = Math.cos(p.car.angle) * 55; leadY = Math.sin(p.car.angle) * 55; }
    cam.x += (p.x + leadX - cam.x) * Math.min(1, dt * 4.2);
    cam.y += (p.y + leadY - cam.y) * Math.min(1, dt * 4.2);
    var targetZoom = p.car ? VB.clamp(0.94 - Math.abs(p.car.speed) / 1500, 0.66, 0.94) : 1.02;
    if (inputChase(state)) targetZoom = Math.min(targetZoom, 0.78);
    cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 2.4);
    if (cam.chase && p.car) {
      var want = p.car.angle + Math.PI / 2;
      cam.angle += VB.wrapAngle(want - cam.angle) * Math.min(1, dt * 2.6);
    }
    cam.shake *= Math.max(0, 1 - dt * 5);
  }

  function inputChase(state) { return state.camera.chase; }

  function stepEffects(state, dt) {
    for (var i = state.floaters.length - 1; i >= 0; i -= 1) {
      var f = state.floaters[i];
      f.life -= dt; f.y += f.vy * dt;
      if (f.life <= 0) state.floaters.splice(i, 1);
    }
    for (var j = state.notifications.length - 1; j >= 0; j -= 1) {
      state.notifications[j].life -= dt;
      if (state.notifications[j].life <= 0) state.notifications.splice(j, 1);
    }
    for (var k = 0; k < state.cars.length; k += 1) {
      var c = state.cars[k];
      c.flash = Math.max(0, (c.flash || 0) - dt);
      if (c.driver === 'traffic') E.stepTraffic(state.city, c, dt, state.cars, c === state.tailCar ? null : (state.player.car || state.player));
    }
    for (var p = 0; p < state.peds.length; p += 1) {
      E.stepPed(state.city, state.peds[p], dt, state.player, state.player.car);
    }
  }

  function step(state, dt, input) {
    if (!input) return;
    state.input = input;
    stepClock(state, dt);
    stepPlayer(state, dt, input);
    stepCourier(state, dt);
    stepPolice(state, dt);
    stepEnemies(state, dt);
    stepBullets(state, dt);
    stepMissions(state, dt);
    stepTapes(state, dt);
    stepEffects(state, dt);
    stepCamera(state, dt);
    if (state.audio && state.audio.update) state.audio.update(state, dt);
  }

  function clockText(clock) {
    var h = Math.floor(clock) % 24;
    var m = Math.floor((clock - Math.floor(clock)) * 60);
    return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }

  VB.world = {
    createState: createState, step: step, clockText: clockText,
    addFloater: addFloater, notify: notify, addWanted: addWanted,
    placeNear: placeNear, respawn: respawn, phaseFor: phaseFor,
    enterCar: enterCar, exitCar: exitCar, switchWeapon: switchWeapon, spawnPolice: spawnPolice
  };
})(window.VB = window.VB || {});
