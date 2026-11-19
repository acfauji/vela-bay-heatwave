// The four staged screenshot scenes. Each scene configures the real world once, after
// all systems exist, then the bootstrap renders that exact frame synchronously. Nothing
// here resets the world after staging, so the shot is the same live game the player sees.
(function (VB) {
  'use strict';

  var E = VB.entities;
  var CFG = VB.CFG;

  function placeCar(state, car, x, y, angle, speed) {
    var p = VB.world.placeNear(state.city, x, y);
    car.x = p.x; car.y = p.y; car.angle = angle; car.speed = speed;
    car.disabled = false; car.condition = 100;
    return car;
  }

  function addPolice(state, count, cx, cy, angle) {
    var names = ['VBD-01', 'VBD-12', 'GULL-4', 'VBD-27', 'TARPON-9', 'AIR-3'];
    for (var i = 0; i < count; i += 1) {
      var x = cx - Math.cos(angle) * (78 + i * 62) + (i % 2 ? 36 : -36);
      var y = cy - Math.sin(angle) * (78 + i * 62) + (i % 2 ? -16 : 16);
      var car = E.createCar(state.city, state.rng, x, y, angle, 2, 0, {
        driver: 'police', targetSpeed: 200, callsign: names[i], status: i === 0 ? 'RAMMING' : i === 1 ? 'ENGAGED' : 'PURSUING', hp: 100
      });
      car.speed = 170 + i * 8;
      car.siren = i * 2.1;
      state.police.push(car);
      state.cars.push(car);
    }
    state.search.x = cx; state.search.y = cy; state.search.r = 165; state.inSight = true; state.decay = 12;
  }

  function cover(state) {
    var roadY = 4 * CFG.CELL + CFG.ROAD * 0.18;
    var carX = 4 * CFG.CELL + 30;
    var car = state.missionCar;
    car.model = 'VELOCE GT'; car.kind = 'sports'; car.max = 268; car.accel = 128; car.turn = 2.5;
    car.color = '#d64545'; car.plate = 'VLB-417'; car.condition = 92; car.driver = 'player'; car.owned = true;
    placeCar(state, car, carX, roadY, 0, 196);
    state.player.car = car;
    state.player.onFoot = false;
    state.player.x = car.x; state.player.y = car.y;
    state.player.angle = 0;
    state.player.health = 88; state.player.armor = 42;
    state.camera.x = car.x + 48; state.camera.y = car.y; state.camera.zoom = 1.02;
    state.camera.angle = Math.PI / 2; state.camera.chase = true;
    state.clock = 18.65; state.phase = 'dusk'; state.heat = 0.79; state.day = 2;
    state.wanted = 4;
    addPolice(state, 4, car.x, car.y, 0);
    for (var t = 0; t < 4; t += 1) {
      var traffic = E.createCar(state.city, state.rng, car.x + 180 + t * 130, roadY + (t % 2 ? -34 : 32), 0, 2 + (t % 5), t, { driver: 'traffic', targetSpeed: 120, axis: 'x', dir: 1 });
      traffic.speed = 100;
      state.cars.push(traffic);
    }
    var sideY = 4 * CFG.CELL - CFG.ROAD / 2 - 22;
    for (var p = 0; p < 5; p += 1) {
      var ped = E.createPed(state.rng, car.x - 180 + p * 95, sideY, 'civilian');
      ped.angle = p % 2 ? 0.1 : Math.PI + 0.1;
      state.peds.push(ped);
    }
    state.missionIndex = 4; state.missionStage = 1; state.missionProgress = 4;
    state.cash = 18450; state.rep = 420;
    VB.world.addFloater(state, 'NEAR MISS +$250', car.x + 80, car.y - 44, '#8fe3ff', 17);
    VB.world.addFloater(state, 'DRIFT x3 +$120', car.x - 60, car.y + 48, '#ffd45e', 17);
    VB.world.notify(state, 'VEHICLE STOLEN - VELOCE GT / VLB-417', '#ffb347');
    VB.world.notify(state, 'WANTED 4/5 - GRAND THEFT', '#ff6b52');
  }

  function city(state) {
    var c = VB.city.centerOfBlock(4, 4);
    var spot = VB.world.placeNear(state.city, c.x, c.y);
    state.player.onFoot = true;
    state.player.car = null;
    state.player.x = spot.x; state.player.y = spot.y;
    state.player.angle = 0.4;
    state.camera.x = (4.5) * CFG.CELL; state.camera.y = (4.5) * CFG.CELL;
    state.camera.zoom = 0.4; state.camera.angle = 0; state.camera.chase = false;
    state.clock = 11.35; state.phase = 'day'; state.heat = 0.52; state.day = 1;
    state.wanted = 0; state.police.length = 0;
    state.missionIndex = 1; state.missionStage = 0;
    state.cash = 6400; state.rep = 180;
  }

  function onfoot(state) {
    var bx = 2, by = 3;
    var x = bx * CFG.CELL + CFG.ROAD / 2 + CFG.WALK / 2 + 6;
    var y = (by + 0.5) * CFG.CELL;
    var spot = VB.world.placeNear(state.city, x, y);
    state.player.onFoot = true;
    state.player.car = null;
    state.player.x = spot.x; state.player.y = spot.y;
    state.player.angle = -0.6;
    state.player.health = 100; state.player.armor = 0;
    state.camera.x = spot.x + 40; state.camera.y = spot.y; state.camera.zoom = 1.06;
    state.camera.angle = 0; state.camera.chase = false;
    state.clock = 16.3; state.phase = 'day'; state.heat = 0.66; state.day = 1;
    state.wanted = 0; state.police.length = 0;
    state.missionIndex = 2; state.missionStage = 0;
    state.cash = 9850; state.rep = 260;
    for (var p = 0; p < 6; p += 1) {
      var ped = E.createPed(state.rng, spot.x + 20 + p * 34, spot.y + (p % 2 ? -18 : 22), 'civilian');
      ped.angle = p % 2 ? 0 : Math.PI;
      state.peds.push(ped);
    }
    var roadX = bx * CFG.CELL;
    for (var t = 0; t < 3; t += 1) {
      var car = E.createCar(state.city, state.rng, roadX + (t % 2 ? 30 : -30), spot.y - 140 + t * 140, Math.PI / 2, 2 + t, 2 + t, { driver: 'traffic', targetSpeed: 120, axis: 'y', dir: 1 });
      car.speed = 110;
      state.cars.push(car);
    }
    VB.world.addFloater(state, 'ON FOOT', spot.x, spot.y - 34, '#8fe3a8', 16);
  }

  function mission(state) {
    var a = state.city.anchors;
    var goal = a.warehouse;
    var car = state.missionCar;
    placeCar(state, car, goal.x - 250, goal.y - 170, 0.6, 118);
    car.color = '#3d6fa8'; car.model = 'PORTADOR'; car.plate = 'PRT-826';
    car.driver = 'player'; car.owned = true;
    state.player.car = car; state.player.onFoot = false;
    state.player.x = car.x; state.player.y = car.y;
    state.camera.x = car.x + 55; state.camera.y = car.y + 20;
    state.camera.zoom = 0.78; state.camera.angle = 0; state.camera.chase = false;
    state.clock = 21.7; state.phase = 'night'; state.heat = 0.95; state.day = 3;
    state.wanted = 2;
    addPolice(state, 2, goal.x + 120, goal.y + 180, 2.4);
    state.missionIndex = 3; state.missionStage = 0; state.missionProgress = 0;
    state.missionFlags.guardsSpawned = true;
    for (var i = 0; i < 4; i += 1) {
      var ang = (i / 4) * Math.PI * 2;
      var g = VB.world.placeNear(state.city, goal.x + Math.cos(ang) * 70, goal.y + Math.sin(ang) * 70);
      state.enemies.push(E.createEnemy(g.x, g.y, 'guard', 60));
    }
    state.cash = 11240; state.rep = 310;
    VB.world.notify(state, 'MISSION 3/5 - THE LEDGER', '#ffd45e');
    VB.world.addFloater(state, 'OBJECTIVE 240m', car.x + 60, car.y - 40, '#ffd45e', 17);
  }

  var SCENES = { cover: cover, city: city, onfoot: onfoot, mission: mission };

  function stageShot(name, state) {
    state.screen = 'play';
    var fn = SCENES[name] || cover;
    fn(state);
    state.rewardPanel = null;
    state.frozen = true;
    state.pointer.x = CFG.SHOT_W / 2;
    state.pointer.y = CFG.SHOT_H / 2;
    return state;
  }

  VB.shots = { stageShot: stageShot, names: Object.keys(SCENES) };
})(window.VB = window.VB || {});
