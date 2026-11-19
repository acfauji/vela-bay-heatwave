// Original world data for VELA BAY HEATWAVE. All names, vehicles, districts and story
// text here are authored for this entry. Classic window-scoped script:
// everything is published on the global VB namespace.
(function (VB) {
  'use strict';

  var CFG = {
    CELL: 470,
    GRID: 9,
    ROAD: 132,
    WALK: 30,
    WORLD: 9 * 470,
    SHOT_W: 1280,
    SHOT_H: 720,
    FOOT_SPEED: 208,
    FOOT_SPRINT: 330,
    GRAVITY: 0,
    MAX_WANTED: 5,
    SAVE_KEY: 'vela-bay-heatwave-slot-1'
  };

  var PALETTE = {
    day: {
      ground: '#cdb994', road: '#4c4b52', lane: '#e8cf86', walk: '#d8c6a1',
      sky: '#f6c98b', tint: 'rgba(255,183,94,0.07)', shadow: 'rgba(60,42,28,0.22)',
      water: '#3f93ad', park: '#84a86b', glow: 0
    },
    dusk: {
      ground: '#b98b6b', road: '#454250', lane: '#e8b96d', walk: '#c9a884',
      sky: '#e07a5f', tint: 'rgba(226,105,78,0.16)', shadow: 'rgba(44,26,40,0.3)',
      water: '#356b84', park: '#6d8459', glow: 0.45
    },
    night: {
      ground: '#4a5263', road: '#414957', lane: '#c0b28a', walk: '#6c7482',
      sky: '#1d2740', tint: 'rgba(20,32,62,0.24)', shadow: 'rgba(8,12,24,0.35)',
      water: '#2b4d68', park: '#49664f', glow: 1
    }
  };

  var DISTRICTS = [
    { name: 'SOLARIS HEIGHTS', x: 0, y: 0 },
    { name: 'TIDEWATER', x: 1, y: 0 },
    { name: 'MIRADOR', x: 2, y: 0 },
    { name: 'OLD QUAY', x: 0, y: 1 },
    { name: 'CABO VISTA', x: 1, y: 1 },
    { name: 'IRONWORKS', x: 2, y: 1 },
    { name: 'PELICAN FLATS', x: 0, y: 2 },
    { name: 'SABLE ROW', x: 1, y: 2 },
    { name: 'THE CAUSEWAY', x: 2, y: 2 }
  ];

  var BUILDING_COLORS = [
    '#e7b98f', '#d98f76', '#f0d5a4', '#9fc1bf', '#c9a1ad',
    '#b9c98d', '#e3a98b', '#b7a7c6', '#d7c39a', '#8fb2bd'
  ];

  var MODELS = [
    { name: 'VELOCE GT', kind: 'sports', max: 268, accel: 128, turn: 2.5, w: 46, h: 22, plate: 'VLB' },
    { name: 'CABRIO SOL', kind: 'convertible', max: 224, accel: 112, turn: 2.3, w: 48, h: 23, plate: 'CSL' },
    { name: 'PORTADOR', kind: 'sedan', max: 206, accel: 100, turn: 2.1, w: 50, h: 24, plate: 'PRT' },
    { name: 'NOCTURNE', kind: 'muscle', max: 244, accel: 122, turn: 2.0, w: 52, h: 25, plate: 'NCT' },
    { name: 'CARRETA', kind: 'van', max: 176, accel: 78, turn: 1.7, w: 58, h: 27, plate: 'CRT' },
    { name: 'TAXI SOL', kind: 'taxi', max: 202, accel: 98, turn: 2.2, w: 50, h: 24, plate: 'TXS' },
    { name: 'RANGER', kind: 'pickup', max: 198, accel: 92, turn: 1.9, w: 56, h: 26, plate: 'RNG' },
    { name: 'BOLIDO', kind: 'compact', max: 190, accel: 96, turn: 2.6, w: 44, h: 21, plate: 'BLD' }
  ];

  var CAR_COLORS = ['#d64545', '#e8c134', '#3d6fa8', '#2c2f38', '#d9d2c0', '#4b9a72', '#8c5b9e', '#e07f3c'];

  var WEAPONS = [
    { id: 'FISTS', label: 'FISTS', mag: 0, reserve: 0, rate: 0.34, dmg: 12, range: 42, locked: false },
    { id: 'PISTOL', label: 'VESPER 9', mag: 14, reserve: 84, rate: 0.24, dmg: 26, range: 520, locked: false },
    { id: 'SMG', label: 'MARLIN SMG', mag: 32, reserve: 192, rate: 0.085, dmg: 15, range: 430, locked: true },
    { id: 'RIFLE', label: 'TIDE RIFLE', mag: 24, reserve: 144, rate: 0.16, dmg: 34, range: 700, locked: true },
    { id: 'LAUNCHER', label: 'SUNSET TUBE', mag: 1, reserve: 4, rate: 1.1, dmg: 90, range: 340, locked: true }
  ];

  var STORY = {
    city: 'VELA BAY',
    hook: 'HEATWAVE',
    hero: 'ROOK ADISA',
    crew: [
      { name: 'TEZ BRANN', role: 'FIXER', line: 'Keep the engine warm, Rook. The bay pays the quick.' },
      { name: 'OMAR FITCH', role: 'WIRE MAN', line: 'Every lock is just a question with the right answer.' },
      { name: 'VANCE', role: 'DETECTIVE', line: 'I know you drove that car, Adisa. I can prove it.' },
      { name: 'BO TULL', role: 'MUSCLE', line: 'Talk is cheap. Bring the ledger, I will bring the noise.' }
    ]
  };

  var REP_RANKS = [
    { at: 0, name: 'OUTSIDER' },
    { at: 120, name: 'STREET NAME' },
    { at: 320, name: 'WHEELMAN' },
    { at: 700, name: 'SHOT CALLER' },
    { at: 1300, name: 'BAY BOSS' },
    { at: 2100, name: 'HEATWAVE KING' }
  ];

  var MISSIONS = [
    {
      id: 1, title: 'WARM ENGINE', contact: 'TEZ BRANN', tag: 'DRIVE',
      brief: 'Tez left a fast car in Solaris Heights. Bring it home before the heat gets loud.',
      stages: [
        { type: 'goto', text: 'Reach the Veloce GT', target: 'car', count: 1 },
        { type: 'enter', text: 'Take the getaway car', target: 'car', count: 1 },
        { type: 'goto', text: 'Drive to Tez\'s safehouse', target: 'safe', count: 1 }
      ],
      reward: 1500, rep: 100, unlock: 'VESPER 9 PISTOL'
    },
    {
      id: 2, title: 'SUNDAY TRAFFIC', contact: 'OMAR FITCH', tag: 'TAIL',
      brief: 'A courier is moving cash through Tidewater. Shadow him without losing the tail.',
      stages: [
        { type: 'goto', text: 'Find the courier in Tidewater', target: 'tail', count: 1 },
        { type: 'follow', text: 'Stay on his tail (0/18s)', target: 'tail', count: 18 },
        { type: 'goto', text: 'Meet Omar at the overlook', target: 'meet', count: 1 }
      ],
      reward: 2500, rep: 150, unlock: 'MARLIN SMG'
    },
    {
      id: 3, title: 'THE LEDGER', contact: 'BO TULL', tag: 'COMBAT',
      brief: 'The Sable Row crew keeps the books in a warehouse. Clear it and take the ledger.',
      stages: [
        { type: 'goto', text: 'Reach the Sable Row warehouse', target: 'warehouse', count: 1 },
        { type: 'kill', text: 'Clear the guards (0/4 down)', target: 'guard', count: 4 },
        { type: 'goto', text: 'Collect the ledger', target: 'ledger', count: 1 }
      ],
      reward: 4000, rep: 250, unlock: 'CABO VISTA SAFEHOUSE'
    },
    {
      id: 4, title: 'HOT WIRE', contact: 'TEZ BRANN', tag: 'CHASE',
      brief: 'Take a car off the street and lose the whole department before curfew.',
      stages: [
        { type: 'steal', text: 'Steal any car', target: 'anycar', count: 1 },
        { type: 'heat', text: 'Pull the cops off you (0/3 stars)', target: 'wanted', count: 3 },
        { type: 'escape', text: 'Lose the manhunt', target: 'escape', count: 1 }
      ],
      reward: 6000, rep: 350, unlock: 'TIDE RIFLE'
    },
    {
      id: 5, title: 'LAST LIGHT', contact: 'ROOK ADISA', tag: 'FINALE',
      brief: 'One last run at the Ironworks docks. Break the crew, grab the cash, vanish.',
      stages: [
        { type: 'goto', text: 'Reach the Ironworks docks', target: 'docks', count: 1 },
        { type: 'kill', text: 'Drop the dock crew (0/6 down)', target: 'rival', count: 6 },
        { type: 'escape', text: 'Escape with the cash', target: 'escape', count: 1 }
      ],
      reward: 15000, rep: 1000, unlock: 'STORY COMPLETE'
    }
  ];

  VB.CFG = CFG;
  VB.PALETTE = PALETTE;
  VB.DISTRICTS = DISTRICTS;
  VB.BUILDING_COLORS = BUILDING_COLORS;
  VB.MODELS = MODELS;
  VB.CAR_COLORS = CAR_COLORS;
  VB.WEAPONS = WEAPONS;
  VB.STORY = STORY;
  VB.REP_RANKS = REP_RANKS;
  VB.MISSIONS = MISSIONS;

  VB.PHASES = ['day', 'dusk', 'night'];
  VB.repRank = function (rep) {
    var rank = REP_RANKS[0];
    for (var i = 0; i < REP_RANKS.length; i += 1) if (rep >= REP_RANKS[i].at) rank = REP_RANKS[i];
    return rank.name;
  };
})(window.VB = window.VB || {});
