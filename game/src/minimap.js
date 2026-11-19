// Circular minimap: streets, blocks, buildings, the objective, the police search
// zone and every active unit. Kept axis-aligned so it reads at a glance in a shot.
(function (VB) {
  'use strict';

  function draw(ctx, state, size) {
    var s = size || 210;
    ctx.clearRect(0, 0, s, s);
    var cx = s / 2, cy = s / 2;
    var range = 900;
    var scale = (s / 2 - 8) / range;
    var pal = VB.PALETTE[state.phase];
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, s / 2 - 2, 0, 6.28);
    ctx.clip();
    ctx.fillStyle = pal.road;
    ctx.fillRect(0, 0, s, s);

    function tx(x) { return cx + (x - state.player.x) * scale; }
    function ty(y) { return cy + (y - state.player.y) * scale; }

    ctx.fillStyle = pal.walk;
    for (var i = 0; i < state.city.blocks.length; i += 1) {
      var b = state.city.blocks[i];
      ctx.fillRect(tx(b.x), ty(b.y), b.w * scale, b.h * scale);
    }
    ctx.fillStyle = pal.water;
    for (var m = 0; m < state.city.marina.length; m += 1) {
      var q = state.city.marina[m];
      ctx.fillRect(tx(q.x), ty(q.y), q.w * scale, q.h * scale);
    }
    ctx.fillStyle = pal.ground;
    for (var k = 0; k < state.city.buildings.length; k += 1) {
      var g = state.city.buildings[k];
      ctx.fillRect(tx(g.x), ty(g.y), Math.max(1.5, g.w * scale), Math.max(1.5, g.h * scale));
    }
    ctx.strokeStyle = pal.lane;
    ctx.lineWidth = 1;
    for (var r = 0; r <= VB.CFG.GRID; r += 1) {
      var pos = r * VB.CFG.CELL;
      ctx.beginPath(); ctx.moveTo(tx(pos), 0); ctx.lineTo(tx(pos), s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, ty(pos)); ctx.lineTo(s, ty(pos)); ctx.stroke();
    }

    if (state.wanted > 0) {
      ctx.strokeStyle = state.inSight ? 'rgba(255,92,74,0.9)' : 'rgba(255,190,90,0.65)';
      ctx.lineWidth = 2; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.arc(tx(state.search.x), ty(state.search.y), state.search.r * scale, 0, 6.28); ctx.stroke();
      ctx.setLineDash([]);
    }

    var goal = VB.missions.targetPos(state);
    var gx = tx(goal.x), gy = ty(goal.y);
    ctx.strokeStyle = '#ffd45e'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(gx, gy); ctx.stroke();
    ctx.fillStyle = '#ffd45e';
    ctx.beginPath(); ctx.arc(gx, gy, 6, 0, 6.28); ctx.fill();
    ctx.strokeStyle = '#fff2c8'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(gx, gy, 9 + Math.sin(state.time * 4) * 2, 0, 6.28); ctx.stroke();

    for (var tp = 0; tp < state.tapes.length; tp += 1) {
      var tape = state.tapes[tp];
      if (tape.got) continue;
      ctx.fillStyle = '#8fe3ff';
      ctx.fillRect(tx(tape.x) - 2, ty(tape.y) - 2, 4, 4);
    }
    for (var u = 0; u < state.police.length; u += 1) {
      var unit = state.police[u];
      ctx.fillStyle = unit.disabled ? '#7b7b7b' : '#ff5b4a';
      ctx.beginPath(); ctx.arc(tx(unit.x), ty(unit.y), unit.disabled ? 3 : 4, 0, 6.28); ctx.fill();
      if (!unit.disabled) {
        ctx.strokeStyle = 'rgba(255,91,74,0.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(tx(unit.x), ty(unit.y), 7, 0, 6.28); ctx.stroke();
      }
    }
    for (var c = 0; c < state.cars.length; c += 1) {
      var car = state.cars[c];
      if (car.driver !== 'traffic') continue;
      ctx.fillStyle = 'rgba(200,220,235,0.6)';
      ctx.fillRect(tx(car.x) - 2, ty(car.y) - 2, 4, 4);
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.player.car ? -state.player.car.angle : state.player.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1b2330'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.restore();
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,212,94,0.85)';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, s / 2 - 2, 0, 6.28); ctx.stroke();
    ctx.fillStyle = 'rgba(18,22,30,0.88)';
    ctx.fillRect(cx - 62, 4, 124, 19);
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.fillStyle = '#ffd45e';
    ctx.textAlign = 'center';
    ctx.fillText(VB.city.districtAt(state.player.x, state.player.y), cx, 17);
    ctx.fillStyle = '#9fb6c8';
    ctx.fillText('N', cx, s - 7);
    ctx.textAlign = 'left';
  }

  VB.minimap = { draw: draw };
})(window.VB = window.VB || {});
