// Entity factories and the lightweight traffic / pedestrian behaviours used by the
// living city. Simulation orchestration lives in world.js; this file only builds and
// steers individual actors.
(function (VB) {
  'use strict';

  var CFG = VB.CFG;

  function createPlayer(x, y) {
    return {
      x: x, y: y, vx: 0, vy: 0, angle: -Math.PI / 2,
      onFoot: true, car: null, health: 100, armor: 0, stamina: 100,
      weapon: 1, ammo: {}, fireCd: 0, hitFlash: 0, dead: 0,
      walkPhase: 0, aimX: 0, aimY: -1, dodge: 0
    };
  }

  function createCar(city, rng, x, y, angle, modelIdx, colorIdx, opts) {
    opts = opts || {};
    var model = VB.MODELS[modelIdx % VB.MODELS.length];
    var plateNum = rng.int(100, 999);
    return {
      x: x, y: y, angle: angle, speed: 0, steer: 0,
      model: model.name, kind: model.kind, max: model.max, accel: model.accel, turn: model.turn,
      w: model.w, h: model.h, color: VB.CAR_COLORS[colorIdx % VB.CAR_COLORS.length],
      plate: model.plate + '-' + plateNum,
      condition: opts.condition === undefined ? 100 : opts.condition,
      driver: opts.driver || 'traffic',
      axis: opts.axis || (Math.abs(Math.cos(angle)) > 0.5 ? 'x' : 'y'),
      dir: opts.dir || (Math.cos(angle) >= 0 ? 1 : 1),
      lane: opts.lane || 0, targetSpeed: opts.targetSpeed || 120,
      callsign: opts.callsign || '', status: opts.status || 'PATROL',
      hp: opts.hp || 100, disabled: false, flash: 0, siren: 0,
      hitCd: 0, wobble: rng.range(0, 6.28), rent: 0
    };
  }

  function createPed(rng, x, y, kind) {
    return {
      x: x, y: y, angle: rng.range(0, 6.28), speed: rng.range(44, 70),
      phase: rng.range(0, 6.28), color: rng.pick(['#d38f6a', '#5b8fb2', '#b0a3c8', '#6f9d78', '#c9b06a']),
      kind: kind || 'civilian', alert: 0, flee: 0, callCd: rng.range(0, 4),
      homeX: x, homeY: y, timer: rng.range(2, 7), cross: 0
    };
  }

  function createEnemy(x, y, kind, health) {
    return {
      x: x, y: y, angle: Math.PI, speed: 62, phase: 0,
      kind: kind || 'guard', health: health || 60, maxHealth: health || 60,
      fireCd: 0.6, hitFlash: 0, dead: false, alert: true, strafe: 1
    };
  }

  function createFloater(text, x, y, color, size) {
    return { text: text, x: x, y: y, color: color || '#ffd45e', size: size || 15, life: 1.35, max: 1.35, vy: -34 };
  }

  function spawnTraffic(city, rng, count) {
    var cars = [];
    for (var i = 0; i < count; i += 1) {
      var vertical = rng.chance(0.5);
      var road = rng.int(1, CFG.GRID - 1) * CFG.CELL;
      var along = rng.range(60, CFG.WORLD - 60);
      var dir = rng.chance(0.5) ? 1 : -1;
      var lane = (rng.chance(0.5) ? 1 : -1) * CFG.ROAD * 0.22;
      var x = vertical ? road + lane : along;
      var y = vertical ? along : road + lane;
      var angle = vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      var car = createCar(city, rng, x, y, angle, rng.int(0, VB.MODELS.length - 1), rng.int(0, VB.CAR_COLORS.length - 1), {
        driver: 'traffic', axis: vertical ? 'y' : 'x', dir: dir, lane: lane,
        targetSpeed: rng.range(96, 158)
      });
      car.wobble = rng.range(0, 6.28);
      cars.push(car);
    }
    return cars;
  }

  function spawnPeds(city, rng, count) {
    var peds = [];
    for (var i = 0; i < count; i += 1) {
      var bx = rng.int(0, CFG.GRID - 1);
      var by = rng.int(0, CFG.GRID - 1);
      var side = rng.int(0, 3);
      var edge = CFG.ROAD / 2 + CFG.WALK / 2;
      var bc = VB.city.centerOfBlock(bx, by);
      var x = side === 0 ? bc.x - CFG.CELL / 2 + edge : side === 1 ? bc.x + CFG.CELL / 2 - edge : bc.x + rng.range(-CFG.CELL / 3, CFG.CELL / 3);
      var y = side === 2 ? bc.y - CFG.CELL / 2 + edge : side === 3 ? bc.y + CFG.CELL / 2 - edge : bc.y + rng.range(-CFG.CELL / 3, CFG.CELL / 3);
      peds.push(createPed(rng, x, y, 'civilian'));
    }
    return peds;
  }

  function roadLane(car) {
    return car.lane || CFG.ROAD * 0.22;
  }

  function stepTraffic(city, car, dt, cars, threat) {
    if (car.disabled) return;
    var speedLimit = car.targetSpeed;
    var fx = Math.cos(car.angle), fy = Math.sin(car.angle);
    for (var i = 0; i < cars.length; i += 1) {
      var other = cars[i];
      if (other === car || other.disabled) continue;
      var dx = other.x - car.x, dy = other.y - car.y;
      var along = dx * fx + dy * fy;
      var side = Math.abs(-dx * fy + dy * fx);
      if (along > 0 && along < 90 && side < 26) speedLimit = Math.min(speedLimit, Math.max(0, other.speed - 12));
    }
    if (threat) {
      var tx = threat.x - car.x, ty = threat.y - car.y;
      if (tx * fx + ty * fy > 0 && Math.abs(-tx * fy + ty * fx) < 40 && VB.dist(car.x, car.y, threat.x, threat.y) < 110) {
        speedLimit = 0;
      }
    }
    var diff = speedLimit - car.speed;
    car.speed += VB.clamp(diff, -170 * dt, car.accel * dt);
    car.speed = VB.clamp(car.speed, 0, car.max);

    var axisPos = car.axis === 'x' ? car.x : car.y;
    var cross = Math.abs((axisPos % CFG.CELL) - CFG.CELL / 2);
    if (cross > CFG.CELL / 2 - 62 && VB.dist(car.x, car.y, car.x, car.y) >= 0) {
      car.wobble += dt;
    }

    var nx = car.x + Math.cos(car.angle) * car.speed * dt;
    var ny = car.y + Math.sin(car.angle) * car.speed * dt;
    if (VB.city.solidAt(city, nx, ny)) {
      car.speed *= 0.4;
      car.angle = -car.angle + (VB.clamp((car.x + car.y) % 1, -1, 1) * 0.3);
      car.dir *= -1;
    } else {
      car.x = nx;
      car.y = ny;
    }
    if (car.x < 20 || car.x > CFG.WORLD - 20 || car.y < 20 || car.y > CFG.WORLD - 20) {
      car.x = VB.clamp(car.x, 24, CFG.WORLD - 24);
      car.y = VB.clamp(car.y, 24, CFG.WORLD - 24);
      car.angle += Math.PI;
      car.dir *= -1;
    }
    car.flash = Math.max(0, car.flash - dt);
  }

  function stepPed(city, ped, dt, player, threat) {
    if (ped.flee > 0) {
      ped.flee -= dt;
      var ax = ped.x - (threat ? threat.x : player.x);
      var ay = ped.y - (threat ? threat.y : player.y);
      ped.angle = Math.atan2(ay, ax);
      ped.speed = 118;
    } else {
      ped.timer -= dt;
      if (ped.cross > 0) {
        ped.cross -= dt;
        ped.speed = 48;
      } else {
        if (ped.timer <= 0) {
          ped.timer = 4 + ((ped.phase * 7) % 5);
          if ((ped.phase * 11) % 3 < 1.2) {
            ped.angle += (ped.angle % 2 < 1 ? Math.PI / 2 : -Math.PI / 2);
            ped.cross = 3.4;
          } else {
            ped.angle += (VB.clamp((ped.x + ped.y) % 3, -1, 1)) * 1.1;
          }
        }
        ped.speed = 56;
      }
    }
    var nx = ped.x + Math.cos(ped.angle) * ped.speed * dt;
    var ny = ped.y + Math.sin(ped.angle) * ped.speed * dt;
    if (VB.city.solidAt(city, nx, ny)) {
      ped.angle += 1.4 + (ped.phase % 0.5);
      ped.timer = 1.5;
    } else {
      ped.x = nx;
      ped.y = ny;
    }
    ped.phase += dt * ped.speed * 0.09;
    if (ped.x < 16 || ped.x > CFG.WORLD - 16 || ped.y < 16 || ped.y > CFG.WORLD - 16) {
      ped.x = VB.clamp(ped.x, 20, CFG.WORLD - 20);
      ped.y = VB.clamp(ped.y, 20, CFG.WORLD - 20);
      ped.angle += Math.PI;
    }
  }

  function steerToward(car, tx, ty, dt, aggression) {
    var want = Math.atan2(ty - car.y, tx - car.x);
    var delta = VB.wrapAngle(want - car.angle);
    var turn = car.turn * (aggression || 1);
    car.angle += VB.clamp(delta, -turn * dt, turn * dt);
  }

  VB.entities = {
    createPlayer: createPlayer,
    createCar: createCar,
    createPed: createPed,
    createEnemy: createEnemy,
    createFloater: createFloater,
    spawnTraffic: spawnTraffic,
    spawnPeds: spawnPeds,
    stepTraffic: stepTraffic,
    stepPed: stepPed,
    steerToward: steerToward,
    roadLane: roadLane
  };
})(window.VB = window.VB || {});
