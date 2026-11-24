/* Super Seal the Deal — a tiny first-person "committee defense" shooter.
   Raycast walls, billboard sprites, everything drawn procedurally. No external assets. */
const FPS = (function () {
  'use strict';
  const W = 320, H = 200, VH = 160; // view height; bottom 40px is the status bar
  const FOV = 0.66; // camera plane length
  const TS = 64;    // texture size

  // ---------- colors ----------
  const rgb = (r, g, b, a = 255) => ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  const hex = (h) => rgb(parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16));
  let seed = 1;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const shade = (c, f) => { const r = c & 255, g = (c >> 8) & 255, b = (c >> 16) & 255; return rgb(Math.min(255, r * f) | 0, Math.min(255, g * f) | 0, Math.min(255, b * f) | 0); };

  // ---------- 3x5 pixel font (for textures, sprites) ----------
  const FONT = {
    A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100',
    G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
    M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101',
    S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
    Y: '101101010010010', Z: '111001010100111', '!': '010010010000010', '?': '110001010000010', '%': '101001010100101', ' ': '000000000000000',
    '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110', '4': '101101111001001',
    '5': '111100110001110', '6': '011100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001110', '.': '000000000000010',
  };
  function text3(put, str, x, y, col, scale = 1) {
    let cx = x;
    for (const ch of str.toUpperCase()) {
      const g = FONT[ch] || FONT[' '];
      for (let i = 0; i < 15; i++) if (g[i] === '1') for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) put(cx + (i % 3) * scale + a, y + Math.floor(i / 3) * scale + b, col);
      cx += 4 * scale;
    }
  }

  // ---------- textures ----------
  const TEX = {};
  function makeTex(name, painter) {
    const d = new Uint32Array(TS * TS);
    const put = (x, y, c) => { if (x >= 0 && y >= 0 && x < TS && y < TS) d[y * TS + x] = c; };
    painter(put, d);
    TEX[name] = d;
  }
  function genTextures() {
    seed = 42;
    makeTex('office', (put) => { // beige drywall, chair rail, baseboard
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        let c = hex('#c9b994'); const n = rnd() * 0.12 + 0.94; c = shade(c, n);
        if (y > 56) c = shade(hex('#4a3b2a'), n); else if (y === 38 || y === 39) c = shade(hex('#8f7b58'), n);
        put(x, y, c);
      }
    });
    makeTex('poster', (put) => { // office wall + framed "FAIR" stamp
      const base = TEX.office;
      for (let i = 0; i < TS * TS; i++) put(i % TS, (i / TS) | 0, base[i]);
      for (let y = 8; y < 34; y++) for (let x = 12; x < 52; x++) put(x, y, (y < 10 || y > 31 || x < 14 || x > 49) ? hex('#2a2419') : hex('#efe7d2'));
      for (let y = 13; y < 29; y++) for (let x = 17; x < 47; x++) if (y < 15 || y > 26 || x < 19 || x > 44) put(x, y, hex('#2f7d3a'));
      text3(put, 'FAIR', 20, 16, hex('#2f7d3a'), 2);
    });
    makeTex('cubicle', (put) => { // grey-blue fabric with aluminum cap
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        let c = shade(hex('#6f7f96'), 0.9 + rnd() * 0.18);
        if (y < 5) c = shade(hex('#c8ccd2'), y === 4 ? 0.7 : 1);
        if (x % 32 === 0) c = hex('#9aa3ad');
        put(x, y, c);
      }
      for (let y = 20; y < 30; y++) for (let x = 40; x < 54; x++) put(x, y, y < 21 || x < 41 || x > 52 ? hex('#333') : hex('#f7e36b')); // sticky note
      text3(put, 'Q4', 43, 23, hex('#c23a2b'));
    });
    makeTex('glass', (put) => {
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        let c = hex('#7fa7c4');
        if ((x + y) % 40 < 3 || (x + y + 14) % 40 < 1) c = hex('#cfe6f5');
        if (x < 3 || x > 60 || y < 3 || y > 60) c = hex('#8b939c');
        if (y > 28 && y < 33) c = shade(hex('#7fa7c4'), 0.7); // frosted band
        put(x, y, c);
      }
    });
    makeTex('wood', (put) => {
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        const plank = Math.floor(x / 16);
        let c = shade(hex('#5a2f1c'), 0.85 + ((plank * 37) % 5) * 0.05 + Math.sin(y * 0.4 + plank * 3 + x * 0.05) * 0.06);
        if (x % 16 === 0) c = hex('#2e170c');
        if (y > 58) c = hex('#2e170c');
        put(x, y, c);
      }
    });
    makeTex('table', (put) => {
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        let c = hex('#22324f'); // wall behind the table: navy
        if (y > 30) c = shade(hex('#6b3a1f'), 0.9 + Math.sin(x * 0.3) * 0.06);
        if (y === 30 || y === 31) c = hex('#a0632f');
        if (y > 30 && y < 36 && x > 8 && x < 22) c = hex('#efe7d2'); // a stack of board books
        put(x, y, c);
      }
    });
    makeTex('cabinet', (put) => {
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) {
        let c = shade(hex('#8c9196'), 0.95 + rnd() * 0.06);
        if (y % 16 === 0 || x < 2 || x > 61) c = hex('#55595e');
        if (y % 16 === 7 && x > 26 && x < 38) c = hex('#d8dadd');
        if (y % 16 > 2 && y % 16 < 6 && x > 22 && x < 42) c = hex('#efe7d2');
        put(x, y, c);
      }
    });
  }
  const TILE_TEX = { '#': 'office', F: 'poster', C: 'cubicle', G: 'glass', W: 'wood', T: 'table', S: 'cabinet' };

  // ---------- sprites ----------
  const SPR = {};
  function makeSpr(name, w, h, painter) {
    const d = new Uint32Array(w * h);
    const R = (x, y, ww, hh, c) => { for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) { const X = x + i, Y = y + j; if (X >= 0 && Y >= 0 && X < w && Y < h) d[Y * w + X] = typeof c === 'string' ? hex(c) : c; } };
    const P = (x, y, c) => R(x, y, 1, 1, c);
    painter(R, P);
    SPR[name] = { w, h, d };
  }
  // A person in a suit, 32x48. frame: 0/1 walk, 2 attack, 3 pain
  function person(name, o) {
    for (let f = 0; f < 4; f++) makeSpr(name + f, 32, 48, (R, P) => {
      const skin = f === 3 ? '#ffffff' : o.skin;
      const suit = f === 3 ? '#ffffff' : o.suit;
      // legs
      const lo = f === 1 ? 1 : 0, ro = f === 0 ? 1 : 0;
      R(11, 36 - lo, 4, 12 - (f === 1 ? 0 : 0), o.pants); R(17, 36 - ro, 4, 12, o.pants);
      R(10, 46, 6, 2, '#111'); R(17, 46, 6, 2, '#111');
      // torso
      R(8, 18, 16, 19, suit); R(13, 18, 6, 10, '#f2f1ea'); R(15, 19, 2, 9, o.tie);
      R(12, 18, 2, 6, shade(hex(suit.length === 7 ? suit : '#ffffff'), 0.8)); R(18, 18, 2, 6, shade(hex(suit.length === 7 ? suit : '#ffffff'), 0.8));
      // arms
      if (f === 2) { R(4, 8, 4, 12, suit); R(24, 8, 4, 12, suit); R(4, 5, 4, 4, skin); R(24, 5, 4, 4, skin); R(25, 0, 2, 6, o.prop); }
      else { R(5, 19, 3, 14, suit); R(24, 19, 3, 14, suit); R(5, 32, 3, 3, skin); R(24, 32, 3, 3, skin); R(26, 26, o.propW || 2, o.propH || 9, o.prop); }
      // head
      R(11, 4, 10, 13, skin); R(10, 7, 1, 6, skin); R(21, 7, 1, 6, skin);
      R(11, 2, 10, 4, o.hair); if (o.bald) R(13, 2, 6, 2, skin);
      if (o.glasses) { R(12, 9, 3, 2, '#111'); R(17, 9, 3, 2, '#111'); R(15, 9, 2, 1, '#111'); }
      else { P(13, 10, '#111'); P(18, 10, '#111'); }
      R(12, 8, 3, 1, o.hair); R(17, 8, 3, 1, o.hair);
      if (f === 2) R(14, 13, 4, 3, '#3a1212'); else R(14, 14, 4, 1, '#3a1212');
    });
    makeSpr(name + 'X', 32, 48, (R) => { // defeated: face-down under paperwork
      R(4, 40, 24, 6, o.suit); R(26, 39, 5, 5, o.skin); R(27, 38, 4, 2, o.hair);
      R(2, 44, 28, 4, '#efe7d2'); R(6, 36, 9, 5, '#efe7d2'); R(8, 37, 5, 1, '#c23a2b');
    });
  }
  function genSprites() {
    person('assoc', { skin: '#e9b48c', suit: '#2c3a5c', pants: '#1d2840', tie: '#c23a2b', hair: '#3b2a1e', prop: '#c23a2b', propW: 1, propH: 6 });
    person('member', { skin: '#d9a27a', suit: '#5b5f66', pants: '#3e4146', tie: '#1f3a8a', hair: '#9a9a9a', glasses: true, prop: '#1f3a8a', propW: 4, propH: 8 });
    person('chair', { skin: '#e8a07e', suit: '#5e1a22', pants: '#3a0f14', tie: '#e2b04a', hair: '#e6e6e6', bald: true, glasses: true, prop: '#6b3a1f', propW: 5, propH: 5 });
    makeSpr('pen', 8, 8, (R) => { R(1, 3, 6, 2, '#c23a2b'); R(6, 3, 2, 2, '#efe7d2'); });
    makeSpr('memo', 12, 12, (R, P) => { R(1, 1, 10, 10, '#efe7d2'); R(1, 1, 10, 1, '#999'); R(5, 3, 2, 4, '#c23a2b'); R(5, 8, 2, 2, '#c23a2b'); });
    makeSpr('gavel', 14, 10, (R) => { R(1, 1, 8, 5, '#6b3a1f'); R(8, 3, 6, 2, '#a0632f'); R(0, 0, 1, 7, '#e2b04a'); });
    makeSpr('coffee', 12, 14, (R) => { R(2, 3, 8, 10, '#efe7d2'); R(10, 5, 2, 4, '#efe7d2'); R(2, 3, 8, 2, '#3a2210'); R(3, 7, 6, 3, '#2f7d3a'); R(4, 0, 1, 2, '#ccc'); R(7, 0, 1, 2, '#ccc'); });
    makeSpr('ammo', 14, 12, (R) => { R(1, 3, 12, 9, '#efe7d2'); R(1, 3, 12, 1, '#999'); R(1, 6, 12, 1, '#c9c0a6'); R(1, 9, 12, 1, '#c9c0a6'); R(5, 0, 4, 4, '#e2b04a'); });
    makeSpr('shotgun', 20, 10, (R) => { R(0, 3, 18, 3, '#55595e'); R(10, 5, 8, 4, '#6b3a1f'); R(2, 2, 3, 1, '#e2b04a'); });
    makeSpr('exit', 24, 32, (R, P) => {
      R(0, 6, 24, 26, '#2f7d3a'); R(2, 8, 20, 22, '#efe7d2');
      text3((x, y, c) => R(x, y, 1, 1, c), 'FAIR', 4, 15, hex('#2f7d3a'), 1);
      R(10, 0, 4, 6, '#e2b04a');
    });
  }

  // ---------- levels ----------
  const LEVELS = [
    { name: 'FLOOR 12: LEGAL', map: [
      '################',
      '#P..#......a...#',
      '#...#.####.....#',
      '#...#.#f.#..CC.#',
      '#.c.....##..C..#',
      '##.####.....C..#',
      '#....a#..CCC...#',
      '#.....#........#',
      '#..f..#..a..####',
      '#.......F.....X#',
      '################'] },
    { name: 'FLOOR 23: COMPLIANCE', map: [
      '####################',
      '#P....G.....a......#',
      '#.....G.GGGGGG.....#',
      '#..c..G.G.f..G..m..#',
      '#.......G....G.....#',
      '#GGGG.GGG.a..GG.GGG#',
      '#..........s.......#',
      '#.CC.CC.CC.CC.CC...#',
      '#.a.............a..#',
      '#....m......f....X.#',
      '####################'] },
    { name: 'FLOOR 34: RESEARCH', map: [
      '####################',
      '#P..S...S...S...S..#',
      '#...S.a.S.f.S.a.S..#',
      '#..................#',
      '#CC.CC.CC##CC.CC.CC#',
      '#.c......#m........#',
      '#..m.....#....a..s.#',
      '#####.####.#####...#',
      '#.f....a.....m...c.#',
      '#...S..S..S..S...X.#',
      '####################'] },
    { name: 'FLOOR 41: CREDIT COMMITTEE', map: [
      '######################',
      '#P.....#......m......#',
      '#.c....#.WWWWWWWWWW..#',
      '#......#.W........W..#',
      '#..a.....W..m..f..W..#',
      '####.#####........W..#',
      '#....a...W..a.....W..#',
      '#.f......WWWWW.WWWW..#',
      '#..m............s..m.#',
      '#.....F.......c....X.#',
      '######################'] },
    { name: 'FLOOR 47: THE BOARDROOM', wall: 'W', boss: true, map: [
      '######################',
      '#P..c#..............f#',
      '#....#.m.............#',
      '#.f..#...TTTTTTTT....#',
      '#........T......T..s.#',
      '#....#.a.TTTTTTTT..a.#',
      '##.###...............#',
      '#..c.F.........B.....#',
      '#.......m........c..X#',
      '######################'] },
  ];

  const LINES = {
    assoc: ['WHY IS THE TGR 4%?', 'IS THAT A BANKRUPT PEER?', 'SOURCE?', 'SEE FOOTNOTE WHAT?', 'REDLINE INCOMING!', 'DID LEGAL SEE THIS?'],
    member: ['I HAVE A FEW QUESTIONS.', 'WALK ME THROUGH THE WACC.', 'THAT IS NOT A PEER.', 'THIS SMELLS.', 'IS THIS MANAGEMENT CASE REAL?'],
    chair: ['THE CHAIR WILL NOW HEAR OBJECTIONS!', 'I HAVE READ THE 10-K!', 'NOT FAIR. NOT. FAIR.', 'MOTION TO DENY!'],
  };
  const ETYPE = {
    a: { k: 'assoc', hp: 3, speed: 1.6, dmg: 6, cd: [1.1, 2.0], proj: 'pen', pspeed: 6, pts: 10 },
    m: { k: 'member', hp: 6, speed: 1.1, dmg: 12, cd: [1.6, 2.6], proj: 'memo', pspeed: 4.2, pts: 25 },
    B: { k: 'chair', hp: 24, speed: 1.0, dmg: 9, cd: [1.2, 1.9], proj: 'gavel', pspeed: 4.6, pts: 200, boss: true, scale: 1.45 },
  };

  // ---------- state ----------
  let cv, ctx, img, buf, zbuf, overlay, running = false, raf = 0, last = 0;
  let L, map, mw, mh, P, ents, projs, items, keys = {}, tch = {}, msgs = [], opts, stats, flash = 0, hurt = 0, bob = 0, faceT = 0, grin = 0, done = false, doneT = 0, exitMsgT = 0;

  const solid = (x, y) => { const c = map[y] && map[y][x]; return c === undefined || TILE_TEX[c] !== undefined; };
  const cell = (x, y) => (map[y] ? map[y][x] : '#');

  function los(ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy), n = Math.ceil(d * 6);
    for (let i = 1; i < n; i++) { const t = i / n; if (solid(Math.floor(ax + dx * t), Math.floor(ay + dy * t))) return false; }
    return true;
  }
  function tryMove(o, nx, ny, r = 0.22) {
    const ok = (x, y) => !solid(Math.floor(x - r), Math.floor(y - r)) && !solid(Math.floor(x + r), Math.floor(y - r)) && !solid(Math.floor(x - r), Math.floor(y + r)) && !solid(Math.floor(x + r), Math.floor(y + r));
    if (ok(nx, o.y)) o.x = nx;
    if (ok(o.x, ny)) o.y = ny;
  }
  function say(text, col = '#ffe9a8') { msgs.push({ text, col, t: 2.2 }); if (msgs.length > 3) msgs.shift(); }

  function load(idx) {
    L = LEVELS[idx % LEVELS.length];
    map = L.map.map((row) => row.split(''));
    mh = map.length; mw = map[0].length;
    ents = []; projs = []; items = [];
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const c = map[y][x];
      if (c === 'P') { P = { x: x + 0.5, y: y + 0.5, a: 0, hp: opts.hp, ammo: opts.ammo, gun: 0, guns: [true, false], cd: 0 }; map[y][x] = '.'; }
      else if (ETYPE[c]) { const t = ETYPE[c]; ents.push({ ...t, type: c, x: x + 0.5, y: y + 0.5, hp: Math.round(t.hp * (opts.enemyHp || 1)), st: 'idle', cdT: 1 + Math.random(), anim: 0, pain: 0 }); map[y][x] = '.'; }
      else if ('cfs'.includes(c)) { items.push({ k: { c: 'coffee', f: 'ammo', s: 'shotgun' }[c], x: x + 0.5, y: y + 0.5 }); map[y][x] = '.'; }
      else if (c === 'X') { items.push({ k: 'exit', x: x + 0.5, y: y + 0.5 }); map[y][x] = '.'; }
      else if (c === '#' && L.wall) map[y][x] = L.wall;
    }
    // face the open side
    const dirs = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    for (const [dx, dy] of dirs) if (!solid(Math.floor(P.x + dx), Math.floor(P.y + dy))) { P.a = Math.atan2(dy, dx); break; }
  }

  // ---------- input ----------
  const KEYMAP = { ArrowUp: 'f', KeyW: 'f', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'tl', ArrowRight: 'tr', KeyA: 'sl', KeyD: 'sr', KeyQ: 'tl', KeyE: 'tr', Space: 'fire', ControlLeft: 'fire', ControlRight: 'fire', KeyJ: 'fire', Digit1: 'g1', Digit2: 'g2' };
  function kd(e) { const k = KEYMAP[e.code]; if (!k) return; e.preventDefault(); keys[k] = true; if (k === 'g1') P.gun = 0; if (k === 'g2' && P.guns[1]) P.gun = 1; }
  function ku(e) { const k = KEYMAP[e.code]; if (!k) return; e.preventDefault(); keys[k] = false; }
  const inp = (k) => keys[k] || tch[k];

  // ---------- update ----------
  function fire() {
    const sg = P.gun === 1, cost = sg ? 2 : 1;
    if (P.cd > 0) return;
    if (P.ammo < cost) { if (sg && P.ammo >= 1) P.gun = 0; else { say('OUT OF FOOTNOTES', '#ff7a66'); P.cd = 0.5; } return; }
    P.ammo -= cost; P.cd = sg ? 0.75 : 0.32; flash = 0.09; stats.shots++;
    opts.sfx && opts.sfx(sg ? 'shotgun' : 'shot');
    const rays = sg ? [-0.07, -0.025, 0.025, 0.07] : [0];
    rays.forEach((off) => {
      const a = P.a + off; let best = null, bd = 1e9;
      for (const e of ents) {
        if (e.st === 'dead') continue;
        const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
        let da = Math.atan2(dy, dx) - a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        const tol = Math.atan2(0.32 * (e.scale || 1), d);
        if (Math.abs(da) < tol && d < bd && los(P.x, P.y, e.x, e.y)) { bd = d; best = e; }
      }
      if (best) hit(best, sg ? (bd < 3 ? 2 : 1) : 1);
    });
  }
  function hit(e, dmg) {
    e.hp -= dmg; e.pain = 0.15; stats.hits++;
    if (e.st === 'idle') alert(e);
    if (e.hp <= 0) {
      e.st = 'dead'; stats.kills++; stats.pts += e.pts; grin = 0.8;
      opts.sfx && opts.sfx('down');
      if (e.boss) say('THE CHAIR HAS BEEN OVERRULED', '#8fcf9a');
      else if (Math.random() < 0.35) items.push({ k: 'ammo', x: e.x, y: e.y, small: true });
    }
  }
  function alert(e) {
    e.st = 'chase';
    if (Math.random() < (e.boss ? 1 : 0.55)) say(LINES[e.k][Math.floor(Math.random() * LINES[e.k].length)], e.boss ? '#ff7a66' : '#ffe9a8');
  }
  function update(dt) {
    if (done) { doneT -= dt; if (doneT <= 0) finish(); return; }
    const mv = 3.0 * dt, rot = 2.6 * dt;
    if (inp('tl')) P.a -= rot; if (inp('tr')) P.a += rot;
    const ca = Math.cos(P.a), sa = Math.sin(P.a);
    let fx = 0, fy = 0;
    if (inp('f')) { fx += ca; fy += sa; } if (inp('b')) { fx -= ca; fy -= sa; }
    if (inp('sl')) { fx += sa; fy -= ca; } if (inp('sr')) { fx -= sa; fy += ca; }
    const fl = Math.hypot(fx, fy);
    if (fl > 0) { tryMove(P, P.x + fx / fl * mv, P.y + fy / fl * mv); bob += dt * 9; }
    P.cd = Math.max(0, P.cd - dt);
    if (inp('fire')) fire();
    flash = Math.max(0, flash - dt); hurt = Math.max(0, hurt - dt); grin = Math.max(0, grin - dt); faceT += dt; exitMsgT = Math.max(0, exitMsgT - dt);
    msgs.forEach((m) => m.t -= dt); msgs = msgs.filter((m) => m.t > 0);

    // enemies
    for (const e of ents) {
      if (e.st === 'dead') continue;
      e.pain = Math.max(0, e.pain - dt); e.anim += dt;
      const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy);
      const see = d < 14 && los(e.x, e.y, P.x, P.y);
      if (e.st === 'idle') { if (see && d < 10) alert(e); continue; }
      if (d > 1.6 && e.pain <= 0) tryMove(e, e.x + dx / d * e.speed * dt, e.y + dy / d * e.speed * dt, 0.25);
      e.cdT -= dt;
      if (see && e.cdT <= 0) {
        e.cdT = e.cd[0] + Math.random() * (e.cd[1] - e.cd[0]); e.atk = 0.3;
        const spread = e.boss ? [-0.25, 0, 0.25] : [0];
        spread.forEach((s) => { const a = Math.atan2(dy, dx) + s + (Math.random() - 0.5) * 0.08; projs.push({ k: e.proj, x: e.x, y: e.y, vx: Math.cos(a) * e.pspeed, vy: Math.sin(a) * e.pspeed, dmg: e.dmg }); });
        opts.sfx && opts.sfx('enemy');
      }
      if (e.atk) e.atk = Math.max(0, e.atk - dt);
    }
    // projectiles
    for (const p of projs) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (solid(Math.floor(p.x), Math.floor(p.y))) p.dead = true;
      else if (Math.hypot(p.x - P.x, p.y - P.y) < 0.35) {
        p.dead = true; const dmg = Math.round(p.dmg * (opts.enemyDmg || 1));
        P.hp -= dmg; stats.dmg += dmg; hurt = 0.35; opts.sfx && opts.sfx('hurt');
        if (P.hp <= 0) { P.hp = 0; end(false); return; }
      }
    }
    projs = projs.filter((p) => !p.dead);
    // pickups + exit
    for (const it of items) {
      if (it.got) continue;
      const d = Math.hypot(it.x - P.x, it.y - P.y);
      if (it.k === 'exit') {
        if (d < 0.6) {
          const boss = ents.find((e) => e.boss && e.st !== 'dead');
          if (boss) { if (exitMsgT <= 0) { say('THE CHAIR MUST BE OVERRULED FIRST', '#ff7a66'); exitMsgT = 2; } }
          else { end(true); return; }
        }
        continue;
      }
      if (d > 0.5) continue;
      if (it.k === 'coffee') { if (P.hp >= 100) continue; P.hp = Math.min(100, P.hp + 25); say('COLD BREW +25 CREDIBILITY', '#8fcf9a'); }
      if (it.k === 'ammo') { P.ammo = Math.min(99, P.ammo + (it.small ? 4 : 12)); say('FOOTNOTES +' + (it.small ? 4 : 12), '#8fcf9a'); }
      if (it.k === 'shotgun') { P.guns[1] = true; P.gun = 1; P.ammo = Math.min(99, P.ammo + 8); grin = 1.2; say('DISCLAIMER BLASTER! PRESS 2', '#8fcf9a'); }
      it.got = true; opts.sfx && opts.sfx('pickup');
    }
  }

  // ---------- render ----------
  function render() {
    // ceiling + floor
    const ceil = L.boss ? hex('#1a1212') : hex('#2a2f3a'), ceil2 = L.boss ? hex('#2a1a16') : hex('#3b4252');
    const floor = L.boss ? hex('#5e1a22') : hex('#4a4f45'), floor2 = L.boss ? hex('#3a0f14') : hex('#33372f');
    for (let y = 0; y < VH; y++) {
      const c = y < VH / 2 ? (y % 8 === 0 ? ceil2 : ceil) : shade(y % 2 ? floor : floor2, 0.55 + (y - VH / 2) / (VH / 2) * 0.6);
      buf.fill(c, y * W, y * W + W);
    }
    // ceiling light panels
    const dx = Math.cos(P.a), dy = Math.sin(P.a), px = -dy * FOV, py = dx * FOV;
    for (let x = 0; x < W; x++) {
      const camX = 2 * x / W - 1, rx = dx + px * camX, ry = dy + py * camX;
      let mx = Math.floor(P.x), my = Math.floor(P.y);
      const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry);
      let sx, sy, sdx, sdy, side = 0;
      if (rx < 0) { sx = -1; sdx = (P.x - mx) * ddx; } else { sx = 1; sdx = (mx + 1 - P.x) * ddx; }
      if (ry < 0) { sy = -1; sdy = (P.y - my) * ddy; } else { sy = 1; sdy = (my + 1 - P.y) * ddy; }
      let guard = 0;
      while (guard++ < 64) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
        if (solid(mx, my)) break;
      }
      const dist = side === 0 ? (mx - P.x + (1 - sx) / 2) / rx : (my - P.y + (1 - sy) / 2) / ry;
      zbuf[x] = dist;
      const lh = Math.floor(VH / Math.max(0.0001, dist));
      const y0 = Math.floor(VH / 2 - lh / 2), y1 = y0 + lh;
      let wx = side === 0 ? P.y + dist * ry : P.x + dist * rx; wx -= Math.floor(wx);
      let tx = Math.floor(wx * TS); if ((side === 0 && rx > 0) || (side === 1 && ry < 0)) tx = TS - tx - 1;
      const tex = TEX[TILE_TEX[cell(mx, my)] || 'office'];
      const fog = Math.max(0.25, 1 - dist / 14) * (side ? 0.78 : 1);
      const ys = Math.max(0, y0), ye = Math.min(VH, y1);
      for (let y = ys; y < ye; y++) {
        const ty = Math.floor((y - y0) / lh * TS) & (TS - 1);
        buf[y * W + x] = shade(tex[ty * TS + tx], fog);
      }
    }
    // sprites
    const list = [];
    ents.forEach((e) => list.push({ o: e, spr: e.st === 'dead' ? SPR[e.k + 'X'] : SPR[e.k + (e.pain > 0 ? 3 : e.atk > 0 ? 2 : (Math.floor(e.anim * 4) % 2))], s: e.scale || 1, lift: 0 }));
    items.forEach((it) => { if (!it.got) list.push({ o: it, spr: SPR[it.k], s: it.k === 'exit' ? 0.8 : 0.35, lift: it.k === 'exit' ? 0.1 + Math.sin(faceT * 3) * 0.05 : 0, bottom: true }); });
    projs.forEach((p) => list.push({ o: p, spr: SPR[p.k], s: 0.22, lift: 0.5, mid: true }));
    const inv = 1 / (px * dy - dx * py);
    list.forEach((s) => { s.d = (s.o.x - P.x) ** 2 + (s.o.y - P.y) ** 2; });
    list.sort((a, b) => b.d - a.d);
    for (const s of list) {
      const rx = s.o.x - P.x, ry = s.o.y - P.y;
      const tX = inv * (dy * rx - dx * ry), tY = inv * (-py * rx + px * ry);
      if (tY <= 0.1) continue;
      const scrX = Math.floor(W / 2 * (1 + tX / tY));
      const spr = s.spr; const aspect = spr.w / spr.h;
      const hgt = Math.abs(Math.floor(VH / tY)) * s.s * (s.bottom || s.mid ? 1 : 1);
      const wid = hgt * aspect;
      const floorY = VH / 2 + VH / tY / 2; // where the floor meets this distance
      const yBot = s.mid ? VH / 2 + hgt / 2 - (s.lift * VH / tY) * 0.2 : floorY - s.lift * VH / tY;
      const yTop = yBot - hgt;
      const x0 = Math.floor(scrX - wid / 2), x1 = Math.floor(scrX + wid / 2);
      const fog = Math.max(0.3, 1 - tY / 14);
      for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
        if (tY >= zbuf[x]) continue;
        const sx = Math.floor((x - x0) / wid * spr.w);
        for (let y = Math.max(0, Math.floor(yTop)); y < Math.min(VH, Math.floor(yBot)); y++) {
          const sy = Math.floor((y - yTop) / hgt * spr.h);
          const c = spr.d[sy * spr.w + sx];
          if (c >>> 24) buf[y * W + x] = shade(c, fog);
        }
      }
    }
    // status bar background
    for (let y = VH; y < H; y++) buf.fill(y === VH ? hex('#000000') : hex('#1b2236'), y * W, y * W + W);
    ctx.putImageData(img, 0, 0);
    drawWeapon(); drawHUD();
    if (hurt > 0) { ctx.fillStyle = `rgba(194,58,43,${hurt})`; ctx.fillRect(0, 0, W, VH); }
    if (flash > 0) { ctx.fillStyle = 'rgba(255,240,180,0.18)'; ctx.fillRect(0, 0, W, VH); }
  }

  function drawWeapon() {
    const bx = W / 2 + Math.sin(bob) * 4, by = VH + Math.abs(Math.cos(bob)) * 3 - (P.cd > 0 ? 3 : 0);
    const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(bx + x), Math.round(by + y), w, h); };
    if (P.gun === 0) { // "Footnote Pistol": a chunky fountain pen launcher
      R(-6, -46, 12, 40, '#1d2840'); R(-4, -46, 3, 40, '#2c3a5c'); R(-3, -56, 6, 10, '#e2b04a'); R(-1, -60, 2, 4, '#e2b04a');
      R(-12, -14, 24, 16, '#e9b48c'); R(-12, -14, 24, 3, '#c98d68');
      if (flash > 0) { R(-8, -74, 16, 14, '#fff3b0'); ctx.fillStyle = '#c23a2b'; ctx.font = '10px "Press Start 2P", monospace'; ctx.fillText('¹', bx - 3, by - 62); }
    } else { // "Disclaimer Blaster": a heavy-duty stapler
      R(-26, -40, 52, 14, '#55595e'); R(-26, -40, 52, 3, '#8c9196'); R(-22, -26, 44, 12, '#2a2f3a'); R(-4, -46, 8, 6, '#c23a2b');
      R(-18, -14, 14, 16, '#e9b48c'); R(6, -14, 14, 16, '#e9b48c');
      if (flash > 0) { R(-20, -60, 40, 18, '#fff3b0'); ctx.fillStyle = '#c23a2b'; ctx.font = '7px "Press Start 2P", monospace'; ctx.fillText('*SEE', bx - 14, by - 48); }
    }
  }

  function drawFace(x, y) {
    const hp = P.hp, st = hp > 80 ? 0 : hp > 60 ? 1 : hp > 40 ? 2 : hp > 20 ? 3 : 4;
    const R = (a, b, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + a, y + b, w, h); };
    R(0, 0, 28, 34, '#22324f');
    const look = hurt > 0 ? 0 : [0, 1, 0, -1][Math.floor(faceT / 1.3) % 4];
    R(6, 5, 16, 22, '#e9b48c'); R(4, 11, 2, 6, '#c98d68'); R(22, 11, 2, 6, '#c98d68');
    R(6, 3, 16, 5, '#2a1d14'); if (st >= 2) { R(5, 2, 2, 2, '#2a1d14'); R(21, 1, 2, 3, '#2a1d14'); } if (st >= 3) { R(12, 1, 2, 2, '#2a1d14'); R(16, 0, 2, 3, '#2a1d14'); }
    // glasses + eyes
    R(7, 12, 6, 4, '#111'); R(15, 12, 6, 4, '#111'); R(8, 13, 4, 2, '#fff'); R(16, 13, 4, 2, '#fff'); R(13, 13, 2, 1, '#111');
    R(9 + look + (look < 0 ? 1 : 0), 13, 2, 2, '#1b1b2a'); R(17 + look + (look < 0 ? 1 : 0), 13, 2, 2, '#1b1b2a');
    if (st >= 4) { R(15, 12, 6, 1, '#c23a2b'); }
    // mouth
    if (grin > 0) { R(10, 21, 8, 3, '#fff'); R(10, 21, 8, 1, '#3a1212'); }
    else if (hurt > 0) { R(10, 20, 8, 4, '#3a1212'); }
    else if (st <= 1) R(10, 22, 8, 1, '#3a1212'); else { R(10, 22, 8, 1, '#3a1212'); R(9, 23, 1, 1, '#3a1212'); R(18, 23, 1, 1, '#3a1212'); }
    // red-ink "damage"
    if (st >= 1) R(18, 7, 3, 1, '#c23a2b');
    if (st >= 2) { R(7, 18, 4, 1, '#c23a2b'); R(8, 19, 1, 2, '#c23a2b'); }
    if (st >= 3) { R(19, 17, 2, 4, '#c23a2b'); R(12, 7, 5, 1, '#c23a2b'); }
    if (st >= 4) { R(7, 24, 6, 1, '#c23a2b'); R(16, 25, 4, 1, '#c23a2b'); }
    R(9, 27, 10, 7, '#f2f1ea'); R(13, 27, 2, 7, '#c23a2b');
  }

  function drawHUD() {
    ctx.font = '8px "Press Start 2P", monospace';
    const box = (x, w, label, val, col) => {
      ctx.fillStyle = '#0d1220'; ctx.fillRect(x, VH + 3, w, 34);
      ctx.fillStyle = col; ctx.font = '12px "Press Start 2P", monospace'; ctx.fillText(val, x + 4, VH + 22);
      ctx.fillStyle = '#7d8aa8'; ctx.font = '5px "Press Start 2P", monospace'; ctx.fillText(label, x + 4, VH + 33);
    };
    box(2, 60, 'FOOTNOTES', String(P.ammo), '#e2b04a');
    box(64, 70, 'CREDIBILITY', P.hp + '%', P.hp > 40 ? '#e2b04a' : '#ff6b5a');
    drawFace(146, VH + 3);
    box(186, 56, P.gun ? 'BLASTER' : 'PEN', P.gun ? '2' : '1', '#d9e1f2');
    const alive = ents.filter((e) => e.st !== 'dead').length;
    box(244, 74, 'OBJECTIONS', String(alive), alive ? '#ff6b5a' : '#6fe08a');
    // top: level name + messages
    ctx.font = '6px "Press Start 2P", monospace'; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, 10);
    ctx.fillStyle = '#e2b04a'; ctx.fillText(L.name, 4, 8);
    msgs.forEach((m, i) => { ctx.font = '7px "Press Start 2P", monospace'; const w = ctx.measureText(m.text).width; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W / 2 - w / 2 - 3, 14 + i * 12, w + 6, 11); ctx.fillStyle = m.col; ctx.fillText(m.text, W / 2 - w / 2, 23 + i * 12); });
    // crosshair
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(W / 2 - 1, VH / 2 - 4, 2, 3); ctx.fillRect(W / 2 - 1, VH / 2 + 2, 2, 3); ctx.fillRect(W / 2 - 4, VH / 2 - 1, 3, 2); ctx.fillRect(W / 2 + 2, VH / 2 - 1, 3, 2);
    if (done) {
      ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 60, W, 40);
      ctx.font = '12px "Press Start 2P", monospace'; ctx.fillStyle = stats.win ? '#6fe08a' : '#ff6b5a';
      const t = stats.win ? 'OPINION DEFENDED' : 'CREDIBILITY: 0%';
      ctx.fillText(t, W / 2 - ctx.measureText(t).width / 2, 85);
    }
  }

  // ---------- loop + lifecycle ----------
  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    update(dt); if (running) render();
    raf = requestAnimationFrame(frame);
  }
  function end(win) {
    if (done) return;
    done = true; doneT = 1.6; stats.win = win; stats.hpLeft = Math.max(0, P.hp); stats.ammoLeft = P.ammo;
    stats.time = (performance.now() - stats.t0) / 1000;
    opts.sfx && opts.sfx(win ? 'win' : 'lose');
  }
  function finish() {
    running = false; cancelAnimationFrame(raf);
    window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku);
    overlay.hidden = true; keys = {}; tch = {};
    const cb = opts.onEnd; opts = null; cb && cb(stats);
  }

  function buildOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'fps'; overlay.hidden = true;
    overlay.innerHTML = `<div class="fps-wrap"><canvas id="fps-cv" width="${W}" height="${H}"></canvas>
      <div class="fps-touch" aria-hidden="true">
        <div class="fps-pad"><button data-k="f">▲</button><button data-k="tl">◀</button><button data-k="tr">▶</button><button data-k="b">▼</button></div>
        <div class="fps-act"><button data-k="g">⇄</button><button data-k="fire" class="fire">FIRE</button></div>
      </div>
      <p class="fps-help">W/S or ↑/↓ move · ←/→ turn · A/D strafe · SPACE fire · 1/2 switch · reach the green FAIR stamp</p></div>`;
    document.body.appendChild(overlay);
    cv = overlay.querySelector('canvas'); ctx = cv.getContext('2d');
    img = ctx.createImageData(W, H); buf = new Uint32Array(img.data.buffer); zbuf = new Float32Array(W);
    overlay.querySelectorAll('[data-k]').forEach((b) => {
      const k = b.dataset.k;
      const on = (e) => { e.preventDefault(); if (k === 'g') { if (P.guns[1]) P.gun = 1 - P.gun; return; } tch[k] = true; };
      const off = (e) => { e.preventDefault(); tch[k] = false; };
      b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointerleave', off); b.addEventListener('pointercancel', off);
    });
  }

  return {
    LEVELS,
    start(o) {
      if (!overlay) { genTextures(); genSprites(); buildOverlay(); }
      opts = o; done = false; msgs = [];
      stats = { kills: 0, shots: 0, hits: 0, dmg: 0, pts: 0, t0: performance.now(), level: o.level };
      load(o.level);
      say(L.name, '#e2b04a');
      if (o.intro) say(o.intro, '#ffe9a8');
      overlay.hidden = false; running = true; last = performance.now();
      window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
      raf = requestAnimationFrame(frame);
    },
    // test hooks
    get state() { return { P, ents, items, projs, done, map }; },
    _keys: keys,
    press(k, v) { tch[k] = v; },
    solid: (x, y) => solid(x, y),
  };
})();
