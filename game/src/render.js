// Canvas renderer for the overhead city. A rotated, zoomed camera follows the player;
// the same world is drawn for gameplay and for the four staged screenshot scenes.
(function (VB) {
  'use strict';

  var CFG = VB.CFG;

  function palette(state) { return VB.PALETTE[state.phase] || VB.PALETTE.day; }

  function setup(canvas, w, h) {
    var dpr = 1;
    var cw = w || canvas.clientWidth || CFG.SHOT_W;
    var ch = h || canvas.clientHeight || CFG.SHOT_H;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    if (canvas.style) { canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px'; }
    return { w: cw * dpr, h: ch * dpr };
  }

  function roadGrid(ctx, city, pal) {
    var N = CFG.GRID, C = CFG.CELL, R = CFG.ROAD;
    ctx.fillStyle = pal.road;
    for (var k = 0; k <= N; k += 1) {
      ctx.fillRect(k * C - R / 2, -200, R, city.size + 400);
      ctx.fillRect(-200, k * C - R / 2, city.size + 400, R);
    }
    ctx.strokeStyle = pal.lane;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([18, 16]);
    for (var v = 0; v <= N; v += 1) {
      ctx.beginPath(); ctx.moveTo(v * C, -100); ctx.lineTo(v * C, city.size + 100); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-100, v * C); ctx.lineTo(city.size + 100, v * C); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,0.26)';
    ctx.lineWidth = 1.4;
    for (var a = 0; a <= N; a += 1) {
      for (var b = 0; b <= N; b += 1) {
        var x = a * C, y = b * C;
        for (var s = -2; s <= 2; s += 1) {
          ctx.beginPath(); ctx.moveTo(x - R / 2 + 7, y + s * 11 - 4); ctx.lineTo(x - R / 2 + 7, y + s * 11 + 4); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + R / 2 - 7, y + s * 11 - 4); ctx.lineTo(x + R / 2 - 7, y + s * 11 + 4); ctx.stroke();
        }
      }
    }
  }

  function drawBlocks(ctx, city, pal) {
    var i;
    ctx.fillStyle = pal.walk;
    for (i = 0; i < city.blocks.length; i += 1) {
      var b = city.blocks[i];
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    ctx.fillStyle = pal.ground;
    for (i = 0; i < city.blocks.length; i += 1) {
      var q = city.blocks[i];
      ctx.fillRect(q.x + CFG.WALK, q.y + CFG.WALK, q.w - CFG.WALK * 2, q.h - CFG.WALK * 2);
    }
    ctx.fillStyle = pal.park;
    for (i = 0; i < city.parks.length; i += 1) {
      var pk = city.parks[i];
      ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
      ctx.strokeStyle = 'rgba(244,228,190,0.5)';
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(pk.x, pk.y + pk.h / 2); ctx.lineTo(pk.x + pk.w, pk.y + pk.h / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pk.x + pk.w / 2, pk.y); ctx.lineTo(pk.x + pk.w / 2, pk.y + pk.h); ctx.stroke();
    }
    ctx.fillStyle = pal.water;
    for (i = 0; i < city.marina.length; i += 1) {
      var m = city.marina[i];
      ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.strokeStyle = 'rgba(180,230,245,0.22)';
      ctx.lineWidth = 2;
      for (var w = 14; w < m.h; w += 22) {
        ctx.beginPath(); ctx.moveTo(m.x, m.y + w); ctx.lineTo(m.x + m.w, m.y + w); ctx.stroke();
      }
    }
    ctx.fillStyle = '#b79a72';
    for (i = 0; i < city.piers.length; i += 1) {
      var pi = city.piers[i];
      ctx.fillRect(pi.x, pi.y, pi.w, pi.h);
    }
  }

  function drawBuildings(ctx, city, pal) {
    for (var i = 0; i < city.buildings.length; i += 1) {
      var b = city.buildings[i];
      var lift = Math.min(16, b.floors * 3.2);
      ctx.fillStyle = pal.shadow;
      ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.11)';
      ctx.fillRect(b.x, b.y, b.w, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(b.x + b.w - 5, b.y, 5, b.h);
      ctx.fillStyle = b.roof === 'tile' ? '#9a6b56' : b.roof === 'garden' ? '#6f9460' : b.roof === 'vent' ? '#8f929c' : '#c3a98d';
      ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, Math.max(6, b.h - 8));
      if (b.roof === 'vent') {
        ctx.fillStyle = '#6c707b';
        ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.5, Math.min(18, b.w * 0.2), Math.min(14, b.h * 0.2));
      }
      var cols = Math.max(1, Math.floor((b.w - 10) / 20));
      var rows = Math.max(1, Math.floor((b.h - 10) / 20));
      for (var cx = 0; cx < cols; cx += 1) {
        for (var cy = 0; cy < rows; cy += 1) {
          var lit = pal.glow > 0 && b.lit && ((b.seed + cx * 7 + cy * 13) % 5 < 3);
          ctx.fillStyle = lit ? '#ffd98a' : 'rgba(40,48,60,0.5)';
          ctx.fillRect(b.x + 8 + cx * 20, b.y + 8 + cy * 20, 8, 8);
        }
      }
      ctx.strokeStyle = 'rgba(58,42,34,0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      if (lift > 0 && pal.glow < 0.2) {
        ctx.fillStyle = 'rgba(255,240,210,0.16)';
        ctx.fillRect(b.x - lift * 0.3, b.y - lift * 0.3, b.w, b.h);
      }
    }
  }

  function drawProps(ctx, city, pal) {
    for (var i = 0; i < city.props.length; i += 1) {
      var p = city.props[i];
      if (p.type === 'palm') {
        ctx.fillStyle = 'rgba(40,30,25,0.2)';
        ctx.beginPath(); ctx.ellipse(p.x + 4, p.y + 5, p.r, p.r * 0.5, 0, 0, 6.28); ctx.fill();
        ctx.strokeStyle = '#8a6746'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 2, p.y - 18); ctx.stroke();
        ctx.fillStyle = '#3f7a50';
        for (var f = 0; f < 6; f += 1) {
          var a = (f / 6) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(p.x + 2 + Math.cos(a) * p.r * 0.7, p.y - 18 + Math.sin(a) * p.r * 0.4, p.r * 0.75, p.r * 0.28, a, 0, 6.28);
          ctx.fill();
        }
      } else if (p.type === 'tree') {
        ctx.fillStyle = '#4d7c4c';
        ctx.beginPath(); ctx.arc(p.x, p.y - 6, p.r, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#6a9a5c';
        ctx.beginPath(); ctx.arc(p.x - p.r * 0.25, p.y - 10, p.r * 0.65, 0, 6.28); ctx.fill();
      } else if (p.type === 'lamp') {
        ctx.fillStyle = '#545a64';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, 6.28); ctx.fill();
        if (pal.glow > 0.2) {
          var gr = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, 80);
          gr.addColorStop(0, 'rgba(255,217,140,' + (0.5 * pal.glow) + ')');
          gr.addColorStop(1, 'rgba(255,217,140,0)');
          ctx.fillStyle = gr;
          ctx.beginPath(); ctx.arc(p.x, p.y, 80, 0, 6.28); ctx.fill();
        }
      } else if (p.type === 'bench') {
        ctx.fillStyle = '#8a6a4c';
        ctx.fillRect(p.x - 14, p.y - 4, 28, 8);
        ctx.fillStyle = '#6b5038';
        ctx.fillRect(p.x - 12, p.y - 12, 24, 5);
      } else if (p.type === 'bollard') {
        ctx.fillStyle = '#d7cbb2';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.28); ctx.fill();
      }
    }
  }

  function drawCar(ctx, car, isPlayer, isPolice) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(20,18,22,0.28)';
    ctx.fillRect(-car.w / 2 + 4, -car.h / 2 + 5, car.w, car.h);
    ctx.fillStyle = car.disabled ? '#5c5a58' : car.color;
    ctx.fillRect(-car.w / 2, -car.h / 2, car.w, car.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(-car.w / 2, -car.h / 2, car.w, 3);
    ctx.fillStyle = '#2e3c48';
    ctx.fillRect(-car.w * 0.1, -car.h / 2 + 2, car.w * 0.32, car.h - 4);
    ctx.fillStyle = '#9dc0cf';
    ctx.fillRect(-car.w * 0.08, -car.h / 2 + 4, car.w * 0.26, car.h - 8);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(car.w / 2 - 3, -car.h / 2 + 2, 3, 5);
    ctx.fillRect(car.w / 2 - 3, car.h / 2 - 7, 3, 5);
    ctx.fillStyle = '#a83232';
    ctx.fillRect(-car.w / 2, -car.h / 2 + 2, 3, 5);
    ctx.fillRect(-car.w / 2, car.h / 2 - 7, 3, 5);
    if (isPolice) {
      var on = Math.sin(car.siren || 0) > 0;
      ctx.fillStyle = on ? '#3d8fff' : '#2b4f80';
      ctx.fillRect(-3, -car.h / 2 - 1, 6, 5);
      ctx.fillStyle = on ? '#7a8ba8' : '#ff4d4d';
      ctx.fillRect(-3, car.h / 2 - 4, 6, 5);
      if (on) {
        ctx.fillStyle = 'rgba(70,140,255,0.25)';
        ctx.beginPath(); ctx.arc(0, 0, car.w * 0.9, 0, 6.28); ctx.fill();
      }
    }
    if (car.flash > 0) {
      ctx.fillStyle = 'rgba(255,240,200,' + car.flash * 2 + ')';
      ctx.fillRect(-car.w / 2, -car.h / 2, car.w, car.h);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffd45e'; ctx.lineWidth = 2;
      ctx.strokeRect(-car.w / 2 - 2, -car.h / 2 - 2, car.w + 4, car.h + 4);
    }
    ctx.restore();
    ctx.font = '9px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(240,235,220,0.75)';
    ctx.textAlign = 'center';
    ctx.fillText(car.plate, car.x, car.y - car.h / 2 - 5);
    ctx.textAlign = 'left';
  }

  function drawPerson(ctx, x, y, angle, color, phase, outline, team) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    var bob = Math.sin(phase) * 1.4;
    ctx.fillStyle = 'rgba(20,18,20,0.25)';
    ctx.beginPath(); ctx.ellipse(2, 3, 7, 4, 0, 0, 6.28); ctx.fill();
    if (outline) {
      ctx.strokeStyle = outline; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, bob, 10, 0, 6.28); ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, bob, 6, 0, 6.28); ctx.fill();
    ctx.fillStyle = team === 'enemy' ? '#c9382e' : team === 'police' ? '#315fa8' : '#e3d2b6';
    ctx.fillRect(-3, bob - 2, 6, 9);
    ctx.fillStyle = '#f0c7a0';
    ctx.beginPath(); ctx.arc(4, bob, 3.2, 0, 6.28); ctx.fill();
    ctx.restore();
  }

  function drawMarker(ctx, state, pal, t) {
    var pos = VB.missions.targetPos(state);
    var pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.save();
    ctx.strokeStyle = '#ffd45e'; ctx.lineWidth = 3;
    ctx.setLineDash([9, 7]);
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 34 + pulse * 12, 0, 6.28); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,212,94,' + (0.16 + pulse * 0.12) + ')';
    ctx.beginPath(); ctx.arc(pos.x, pos.y, 32, 0, 6.28); ctx.fill();
    ctx.fillStyle = '#ffd45e';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - 16 - pulse * 4);
    ctx.lineTo(pos.x + 12, pos.y);
    ctx.lineTo(pos.x, pos.y + 16 + pulse * 4);
    ctx.lineTo(pos.x - 12, pos.y);
    ctx.closePath(); ctx.fill();
    ctx.font = 'bold 13px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3cf';
    ctx.fillText('OBJECTIVE', pos.x, pos.y - 34);
    ctx.textAlign = 'left';
    ctx.restore();
  }

  function drawRoute(ctx, state) {
    var pos = VB.missions.targetPos(state);
    var p = state.player;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,212,94,0.45)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 12]);
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    var mx = (p.x + pos.x) / 2 + 70;
    var my = (p.y + pos.y) / 2 - 70;
    ctx.quadraticCurveTo(mx, my, pos.x, pos.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawWorld(ctx, state, w, h) {
    var pal = palette(state);
    var cam = state.camera;
    var t = state.time;
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    var shakeX = (Math.sin(t * 61) * cam.shake) || 0;
    var shakeY = (Math.cos(t * 47) * cam.shake) || 0;
    ctx.translate(w / 2 + shakeX, h / 2 + shakeY);
    ctx.rotate(-cam.angle);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x, -cam.y);

    var viewW = w / cam.zoom + 800, viewH = h / cam.zoom + 800;
    var minX = cam.x - viewW / 2, maxX = cam.x + viewW / 2;
    var minY = cam.y - viewH / 2, maxY = cam.y + viewH / 2;

    drawBlocks(ctx, state.city, pal);
    roadGrid(ctx, state.city, pal);
    drawBuildings(ctx, state.city, pal);
    drawProps(ctx, state.city, pal);

    for (var tp = 0; tp < state.tapes.length; tp += 1) {
      var tape = state.tapes[tp];
      if (tape.got) continue;
      ctx.fillStyle = 'rgba(143,227,255,0.18)';
      ctx.beginPath(); ctx.arc(tape.x, tape.y, 15 + Math.sin(t * 3 + tp) * 3, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#8fe3ff';
      ctx.fillRect(tape.x - 7, tape.y - 5, 14, 10);
      ctx.fillStyle = '#183040';
      ctx.fillRect(tape.x - 4, tape.y - 2, 8, 4);
    }

    if (state.search.r > 0 && state.wanted > 0) {
      ctx.save();
      ctx.strokeStyle = state.inSight ? 'rgba(255,92,74,0.85)' : 'rgba(255,180,80,0.5)';
      ctx.lineWidth = 3; ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.arc(state.search.x, state.search.y, state.search.r, 0, 6.28); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,92,74,0.08)';
      ctx.beginPath(); ctx.arc(state.search.x, state.search.y, state.search.r, 0, 6.28); ctx.fill();
      ctx.font = 'bold 11px ui-monospace, monospace';
      ctx.fillStyle = state.inSight ? '#ff8a72' : '#ffce7a';
      ctx.fillText(state.inSight ? 'IN SIGHT' : 'SEARCH ZONE', state.search.x - 40, state.search.y - state.search.r - 8);
      ctx.restore();
    }

    drawRoute(ctx, state);
    drawMarker(ctx, state, pal, t);

    for (var i = 0; i < state.cars.length; i += 1) {
      var c = state.cars[i];
      if (c.x < minX - 80 || c.x > maxX + 80 || c.y < minY - 80 || c.y > maxY + 80) continue;
      var police = c.driver === 'police';
      drawCar(ctx, c, state.player.car === c, police);
    }
    for (var p = 0; p < state.peds.length; p += 1) {
      var ped = state.peds[p];
      if (ped.x < minX || ped.x > maxX || ped.y < minY || ped.y > maxY) continue;
      drawPerson(ctx, ped.x, ped.y, ped.angle, ped.flee > 0 ? '#f0a060' : ped.color, ped.phase, ped.flee > 0 ? '#ffd45e' : null, 'civilian');
    }
    for (var e = 0; e < state.enemies.length; e += 1) {
      var en = state.enemies[e];
      if (en.dead) {
        ctx.fillStyle = 'rgba(40,34,30,0.5)';
        ctx.beginPath(); ctx.arc(en.x, en.y, 8, 0, 6.28); ctx.fill();
        continue;
      }
      drawPerson(ctx, en.x, en.y, en.angle, '#8d3d36', en.phase, '#ff5b4a', 'enemy');
      if (en.hitFlash > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(en.x, en.y, 11, 0, 6.28); ctx.fill();
      }
    }
    if (state.player.onFoot) {
      drawPerson(ctx, state.player.x, state.player.y, state.player.angle, '#3f5f9c', state.player.walkPhase, '#ffd45e', 'player');
      var ax = state.player.x + state.player.aimX * 20;
      var ay = state.player.y + state.player.aimY * 20;
      ctx.strokeStyle = '#2b2b30'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(state.player.x, state.player.y); ctx.lineTo(ax, ay); ctx.stroke();
    }
    for (var b = 0; b < state.bullets.length; b += 1) {
      var bl = state.bullets[b];
      ctx.strokeStyle = bl.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bl.x, bl.y); ctx.lineTo(bl.x - bl.vx * 0.016, bl.y - bl.vy * 0.016); ctx.stroke();
    }
    for (var f = 0; f < state.floaters.length; f += 1) {
      var fl = state.floaters[f];
      ctx.globalAlpha = VB.clamp(fl.life / fl.max, 0, 1);
      ctx.font = 'bold ' + fl.size + 'px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(fl.text, fl.x + 1, fl.y + 1);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x, fl.y);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    ctx.fillStyle = pal.tint;
    ctx.fillRect(0, 0, w, h);
    var grd = ctx.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.9);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, state.phase === 'night' ? 'rgba(4,8,20,0.24)' : 'rgba(40,22,8,0.2)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
    if (state.phase === 'day' || state.phase === 'dusk') {
      var sx = w * 0.82, sy = h * 0.13;
      var sun = ctx.createRadialGradient(sx, sy, 4, sx, sy, 150);
      sun.addColorStop(0, 'rgba(255,246,200,0.6)');
      sun.addColorStop(1, 'rgba(255,200,120,0)');
      ctx.fillStyle = sun;
      ctx.fillRect(sx - 150, sy - 150, 300, 300);
    }
    if (state.player.hitFlash > 0.3) {
      ctx.fillStyle = 'rgba(200,30,24,' + Math.min(0.32, (state.player.hitFlash - 0.3) * 0.6) + ')';
      ctx.fillRect(0, 0, w, h);
    }
  }

  VB.render = { draw: drawWorld, setup: setup, palette: palette };
})(window.VB = window.VB || {});
