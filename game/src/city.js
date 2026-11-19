// Seeded city generator: roads, blocks, buildings, sidewalks, palms and district anchors.
// The layout is a pure function of the seed so every run and every shot is repeatable.
(function (VB) {
  'use strict';

  var CFG = VB.CFG;

  var H_STREETS = [
    'Sunrise Avenue', 'Marisol Boulevard', 'Cabo Road', 'Sable Street',
    'Quay Line', 'Fitch Avenue', 'Heatwave Way', 'Dock Road', 'Last Light Drive', 'Bay Rim'
  ];
  var V_STREETS = [
    'Vela Street', 'Palm Causeway', 'Tez Avenue', 'Mirador Road',
    'Solaris Drive', 'Ironworks Lane', 'Brisa Street', 'Tidewater Way', 'Rook Road', 'Gulf Road'
  ];

  function centerOfBlock(i, j) {
    return { x: (i + 0.5) * CFG.CELL, y: (j + 0.5) * CFG.CELL };
  }

  function addBuilding(city, x, y, w, h, rng) {
    if (w < 34 || h < 34) return;
    var color = rng.pick(VB.BUILDING_COLORS);
    city.buildings.push({
      x: x, y: y, w: w, h: h,
      color: color,
      roof: rng.pick(['flat', 'tile', 'garden', 'vent']),
      floors: rng.int(1, 5),
      seed: rng.int(0, 9999),
      lit: rng.chance(0.7)
    });
  }

  function makeBlock(city, i, j, rng) {
    var half = CFG.ROAD / 2;
    var x0 = i * CFG.CELL + half;
    var y0 = j * CFG.CELL + half;
    var inner = CFG.CELL - CFG.ROAD;
    var marina = i === CFG.GRID - 1 && j >= 3;
    var block = { i: i, j: j, x: x0, y: y0, w: inner, h: inner, marina: marina, park: false };

    if (marina) {
      city.marina.push({ x: x0, y: y0, w: inner, h: inner });
      var pierY = y0 + inner * 0.32;
      city.piers.push({ x: x0 + inner * 0.1, y: pierY, w: inner * 0.8, h: inner * 0.16 });
      for (var p = 0; p < 3; p += 1) {
        city.props.push({ type: 'bollard', x: x0 + inner * (0.18 + p * 0.3), y: pierY + inner * 0.25, r: 6 });
      }
      return;
    }

    city.blocks.push(block);

    if (rng.chance(0.13)) {
      block.park = true;
      city.parks.push({ x: x0 + CFG.WALK, y: y0 + CFG.WALK, w: inner - CFG.WALK * 2, h: inner - CFG.WALK * 2 });
      var trees = rng.int(3, 6);
      for (var t = 0; t < trees; t += 1) {
        city.props.push({
          type: rng.chance(0.75) ? 'palm' : 'tree',
          x: x0 + CFG.WALK + rng.range(20, inner - CFG.WALK - 20),
          y: y0 + CFG.WALK + rng.range(20, inner - CFG.WALK - 20),
          r: rng.range(12, 20)
        });
      }
      city.props.push({ type: 'bench', x: x0 + inner * 0.5, y: y0 + inner * 0.5, r: 14 });
      return;
    }

    var cols = rng.chance(0.42) ? 1 : 2;
    var rows = rng.chance(0.4) ? 1 : 2;
    var pad = CFG.WALK + 8;
    var usableW = inner - pad * 2;
    var usableH = inner - pad * 2;
    var lotW = usableW / cols;
    var lotH = usableH / rows;
    for (var c = 0; c < cols; c += 1) {
      for (var r = 0; r < rows; r += 1) {
        if (rng.chance(0.14)) continue;
        var gap = rng.range(7, 17);
        addBuilding(city, x0 + pad + c * lotW + gap, y0 + pad + r * lotH + gap,
          lotW - gap * 2, lotH - gap * 2, rng);
      }
    }
  }

  function generate(seed) {
    var rng = VB.makeRng(seed);
    var city = {
      seed: seed, size: CFG.WORLD,
      blocks: [], buildings: [], props: [], parks: [], marina: [], piers: [],
      streetsH: H_STREETS, streetsV: V_STREETS
    };
    for (var i = 0; i < CFG.GRID; i += 1) {
      for (var j = 0; j < CFG.GRID; j += 1) makeBlock(city, i, j, rng);
    }
    for (var k = 0; k <= CFG.GRID; k += 1) {
      for (var s = 0; s < 6; s += 1) {
        var off = (s - 2.5) * (CFG.CELL / 6);
        if (rng.chance(0.55)) {
          city.props.push({ type: 'palm', x: k * CFG.CELL + CFG.ROAD / 2 + 12, y: k * CFG.CELL + off, r: 14 });
        }
        if (rng.chance(0.4)) {
          city.props.push({ type: 'lamp', x: k * CFG.CELL - CFG.ROAD / 2 - 8, y: k * CFG.CELL + off, r: 5 });
        }
      }
    }
    city.tapes = [];
    for (var ti = 0; ti < 12; ti += 1) {
      var tbx = rng.int(0, CFG.GRID - 1);
      var tby = rng.int(0, CFG.GRID - 1);
      var tc = centerOfBlock(tbx, tby);
      var tx = tc.x + rng.range(-100, 100);
      var ty = tc.y + rng.range(-100, 100);
      if (solidAt(city, tx, ty)) { tx = tc.x; ty = tc.y; }
      city.tapes.push({ x: tx, y: ty });
    }
    city.anchors = {
      start: centerOfBlock(3, 3),
      m1car: centerOfBlock(1, 0),
      safe: centerOfBlock(1, 1),
      tail: centerOfBlock(0, 1),
      meet: centerOfBlock(2, 0),
      warehouse: centerOfBlock(1, 2),
      ledger: { x: centerOfBlock(1, 2).x + 70, y: centerOfBlock(1, 2).y + 60 },
      docks: centerOfBlock(2, 2),
      exit: centerOfBlock(0, 2),
      station: centerOfBlock(2, 1)
    };
    return city;
  }

  function outside(x, y) {
    return x < 12 || y < 12 || x > CFG.WORLD - 12 || y > CFG.WORLD - 12;
  }

  function solidAt(city, x, y) {
    if (outside(x, y)) return true;
    for (var i = 0; i < city.buildings.length; i += 1) {
      var b = city.buildings[i];
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
    }
    return false;
  }

  function roadAt(x) {
    var m = ((x % CFG.CELL) + CFG.CELL) % CFG.CELL;
    var d = Math.min(m, CFG.CELL - m);
    return d < CFG.ROAD / 2;
  }

  function isRoad(city, x, y) { return roadAt(x) || roadAt(y); }

  function districtAt(x, y) {
    var gx = VB.clamp(Math.floor(x / CFG.CELL), 0, 2);
    var gy = VB.clamp(Math.floor(y / CFG.CELL), 0, 2);
    return VB.DISTRICTS[gy * 3 + gx].name;
  }

  function streetAt(x, y) {
    var col = VB.clamp(Math.round(x / CFG.CELL), 0, H_STREETS.length - 1);
    var row = VB.clamp(Math.round(y / CFG.CELL), 0, V_STREETS.length - 1);
    return Math.abs((x % CFG.CELL) - CFG.CELL / 2) < Math.abs((y % CFG.CELL) - CFG.CELL / 2)
      ? V_STREETS[col] : H_STREETS[row];
  }

  function moveCircle(city, ent, radius) {
    var nx = ent.x + Math.cos(ent.angle || 0) * (ent.vx || 0);
    var ny = ent.y + Math.sin(ent.angle || 0) * (ent.vy || 0);
    if (!solidAt(city, nx, ent.y)) ent.x = nx; else ent.vx = 0;
    if (!solidAt(city, ent.x, ny)) ent.y = ny; else ent.vy = 0;
    if (outside(ent.x, ent.y)) {
      ent.x = VB.clamp(ent.x, 14, CFG.WORLD - 14);
      ent.y = VB.clamp(ent.y, 14, CFG.WORLD - 14);
    }
    return ent;
  }

  // Axis-separated collision for a small rectangle body; returns true when it hit something.
  function moveBody(city, body, dx, dy) {
    var hit = false;
    var r = body.r || 12;
    if (solidAt(city, body.x + dx + r, body.y) || solidAt(city, body.x + dx - r, body.y)) { hit = true; }
    else body.x += dx;
    if (solidAt(city, body.x, body.y + dy + r) || solidAt(city, body.x, body.y + dy - r)) { hit = true; }
    else body.y += dy;
    if (outside(body.x, body.y)) {
      body.x = VB.clamp(body.x, 14, CFG.WORLD - 14);
      body.y = VB.clamp(body.y, 14, CFG.WORLD - 14);
      hit = true;
    }
    return hit;
  }

  VB.city = {
    generate: generate, solidAt: solidAt, isRoad: roadAt, districtAt: districtAt,
    streetAt: streetAt, moveCircle: moveCircle, moveBody: moveBody,
    centerOfBlock: centerOfBlock, outside: outside
  };
})(window.VB = window.VB || {});
