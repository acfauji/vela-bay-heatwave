// Story mission evaluation: target locations, objective text with x/total counters,
// stage completion rules and reward/unlock payloads. Mission data lives in config.js.
(function (VB) {
  'use strict';

  var MISSIONS = VB.MISSIONS;

  function current(state) {
    return MISSIONS[VB.clamp(state.missionIndex - 1, 0, MISSIONS.length - 1)];
  }

  function total() { return MISSIONS.length; }

  function targetPos(state) {
    var m = current(state);
    var s = m.stages[VB.clamp(state.missionStage, 0, m.stages.length - 1)];
    var a = state.city.anchors;
    if (s.target === 'car') return state.missionCar ? { x: state.missionCar.x, y: state.missionCar.y } : a.m1car;
    if (s.target === 'tail') return state.tailCar ? { x: state.tailCar.x, y: state.tailCar.y } : a.tail;
    if (s.target === 'safe') return a.safe;
    if (s.target === 'meet') return a.meet;
    if (s.target === 'warehouse') return a.warehouse;
    if (s.target === 'ledger') return a.ledger;
    if (s.target === 'docks') return a.docks;
    if (s.target === 'escape') return a.exit;
    if (s.target === 'wanted') return a.station;
    if (s.target === 'anycar') return a.start;
    return a.start;
  }

  function formatObjective(state) {
    var m = current(state);
    var s = m.stages[VB.clamp(state.missionStage, 0, m.stages.length - 1)];
    var text = s.text;
    if (s.type === 'goto' || s.type === 'enter' || s.type === 'steal') {
      text = text.replace('(0/1)', Math.min(1, state.missionProgress) + '/1');
    } else if (s.type === 'follow') {
      text = 'Stay on his tail (' + Math.min(s.count, Math.floor(state.missionProgress)) + '/' + s.count + 's)';
    } else if (s.type === 'kill') {
      var base = s.text.split(' (')[0];
      text = base + ' (' + Math.min(s.count, state.missionProgress) + '/' + s.count + ' down)';
    } else if (s.type === 'heat') {
      text = 'Pull the cops off you (' + Math.min(s.count, state.wanted) + '/' + s.count + ' stars)';
    } else if (s.type === 'escape') {
      text = 'Lose the manhunt (' + (state.wanted === 0 ? '1/1' : '0/1') + ')';
    }
    return text;
  }

  function formatStage(state) {
    var m = current(state);
    return (state.missionStage + 1) + '/' + m.stages.length;
  }

  function formatMissionNumber(state) { return state.missionIndex + '/' + total(); }

  function checkStage(state, dt) {
    var m = current(state);
    var s = m.stages[state.missionStage];
    if (!s) return false;
    var p = state.player;
    var target = targetPos(state);
    var far = VB.dist(p.x, p.y, target.x, target.y);
    if (s.type === 'goto') {
      state.missionProgress = far < (p.onFoot ? 96 : 128) ? 1 : 0;
      return state.missionProgress >= 1;
    }
    if (s.type === 'enter') return !!state.missionFlags.enteredMissionCar;
    if (s.type === 'steal') return !!state.missionFlags.stoleAny;
    if (s.type === 'follow') {
      var tail = state.tailCar;
      var near = tail && VB.dist(p.x, p.y, tail.x, tail.y) < 165;
      state.missionProgress = VB.clamp(state.missionProgress + (near ? dt : -dt * 0.6), 0, s.count);
      return state.missionProgress >= s.count;
    }
    if (s.type === 'kill') {
      var kind = s.target;
      var down = 0;
      for (var i = 0; i < state.enemies.length; i += 1) if (state.enemies[i].dead && state.enemies[i].kind === kind) down += 1;
      state.missionProgress = down;
      return down >= s.count;
    }
    if (s.type === 'heat') { state.missionProgress = state.wanted; return state.wanted >= s.count; }
    if (s.type === 'escape') {
      var clean = state.wanted === 0 && !state.police.some(function (u) { return !u.disabled && VB.dist(u.x, u.y, p.x, p.y) < 230; });
      state.missionProgress = clean ? 1 : 0;
      return clean;
    }
    return false;
  }

  function advance(state) {
    var m = current(state);
    state.missionStage += 1;
    state.missionProgress = 0;
    if (state.missionStage >= m.stages.length) {
      state.missionDone[state.missionIndex - 1] = true;
      state.rewardPanel = {
        title: 'MISSION PASSED', mission: m.title, cash: m.reward, rep: m.rep,
        unlock: m.unlock, next: state.missionIndex < total() ? MISSIONS[state.missionIndex].title : 'THE BAY IS YOURS'
      };
      state.cash += m.reward;
      state.rep += m.rep;
      if (state.missionIndex === 1) state.unlocked.PISTOL = true;
      if (state.missionIndex === 2) state.unlocked.SMG = true;
      if (state.missionIndex === 4) state.unlocked.RIFLE = true;
      if (state.missionIndex < total()) {
        state.missionIndex += 1;
        state.missionStage = 0;
      } else {
        state.storyComplete = true;
      }
      if (state.onReward) state.onReward();
      return 'passed';
    }
    if (state.onStage) state.onStage(state.missionStage);
    return 'stage';
  }

  function nextTitle(state) {
    return state.missionIndex < total() ? 'NEXT: MISSION ' + (state.missionIndex + 1) + '/5 ' + MISSIONS[state.missionIndex].title : 'STORY COMPLETE';
  }

  function progressPercent(state) {
    var done = 0;
    for (var i = 0; i < state.missionDone.length; i += 1) if (state.missionDone[i]) done += 1;
    return Math.round((done / total()) * 100);
  }

  VB.missions = {
    current: current, total: total, targetPos: targetPos,
    formatObjective: formatObjective, formatStage: formatStage,
    formatMissionNumber: formatMissionNumber, checkStage: checkStage,
    advance: advance, nextTitle: nextTitle, progressPercent: progressPercent
  };
})(window.VB = window.VB || {});
