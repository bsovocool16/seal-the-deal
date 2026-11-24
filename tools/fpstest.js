// Smoke test for Super Seal the Deal: level sanity (BFS), render, combat, win and lose paths, screenshots.
const { chromium } = require('playwright');
const path = require('path');
const out = process.argv[2] || '.';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.join(__dirname, '../index.html'));
  // static level checks
  console.log(await p.evaluate(() => FPS.LEVELS.map((L, i) => {
    const m = L.map, w = m[0].length, bad = m.filter((r) => r.length !== w).length;
    const walls = new Set(['#', 'F', 'C', 'G', 'W', 'T', 'S']);
    let start; const targets = [];
    m.forEach((r, y) => [...r].forEach((c, x) => { if (c === 'P') start = [x, y]; else if ('XcfsamB'.includes(c)) targets.push([x, y, c]); }));
    const seen = new Set([start.join()]), q = [start];
    while (q.length) { const [x, y] = q.shift(); [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy, c = m[ny] && m[ny][nx]; if (c && !walls.has(c) && !seen.has(nx + ',' + ny)) { seen.add(nx + ',' + ny); q.push([nx, ny]); } }); }
    const unreach = targets.filter(([x, y]) => !seen.has(x + ',' + y)).map((t) => t[2]);
    const edge = m.every((r, y) => (y === 0 || y === m.length - 1) ? [...r].every((c) => walls.has(c)) : walls.has(r[0]) && walls.has(r[w - 1]));
    return `${L.name}: ${w}x${m.length} badRows=${bad} closed=${edge} enemies=${targets.filter((t) => 'amB'.includes(t[2])).length} unreachable=[${unreach}]`;
  }).join('\n')));
  // doomwad only: play floor 1
  // (no title-screen shortcut anymore; chain the floors directly)
  await p.evaluate(() => {
    const run = (i, hp, ammo) => FPS.start({ level: i, hp, ammo, enemyDmg: 0.9, onEnd: (s) => {
      if (s.win && i < FPS.LEVELS.length - 1) return run(i + 1, Math.min(75, s.hpLeft + 10), s.ammoLeft + 5);
      document.getElementById('modal-inner').innerHTML = '<h2>' + (s.win ? 'ALL FLOORS CLEARED' : 'LOST') + '</h2><button id="m-ok">ok</button>';
      document.getElementById('modal').hidden = false;
      document.getElementById('m-ok').onclick = () => { document.getElementById('modal').hidden = true; };
    } });
    run(0, 75, 30);
  });
  await p.waitForTimeout(600);
  await p.screenshot({ path: out + '/30-fps-start.png' });
  // walk forward + fire for a bit
  await p.keyboard.down('ArrowUp'); await p.waitForTimeout(700); await p.keyboard.up('ArrowUp');
  await p.keyboard.down('ArrowRight'); await p.waitForTimeout(500); await p.keyboard.up('ArrowRight');
  await p.keyboard.down('Space'); await p.waitForTimeout(400);
  await p.screenshot({ path: out + '/31-fps-fire.png' });
  await p.keyboard.up('Space');
  // face nearest enemy, get it to attack, screenshot
  await p.evaluate(() => { const s = FPS.state; const e = s.ents[0]; s.P.x = e.x - 3; s.P.y = e.y; if (FPS.solid(Math.floor(s.P.x), Math.floor(s.P.y))) { s.P.x = e.x; s.P.y = e.y + 2.5; } s.P.a = Math.atan2(e.y - s.P.y, e.x - s.P.x); e.st = 'chase'; });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '/32-fps-enemy.png' });
  const st1 = await p.evaluate(() => ({ hp: FPS.state.P.hp, ammo: FPS.state.P.ammo, alive: FPS.state.ents.filter((e) => e.st !== 'dead').length }));
  console.log('after fight', st1);
  // force-clear each floor: kill all, teleport to exit
  for (let i = 0; i < 5; i++) {
    await p.evaluate(() => { const s = FPS.state; s.ents.forEach((e) => { e.hp = 0; e.st = 'dead'; }); const x = s.items.find((it) => it.k === 'exit'); s.P.x = x.x; s.P.y = x.y; });
    await p.waitForTimeout(2200);
    if (i === 3) await p.screenshot({ path: out + '/33-fps-boardroom.png' });
  }
  await p.waitForTimeout(300);
  console.log('doomwad end:', (await p.textContent('#modal-inner h2')), await p.isHidden('#fps'));
  await p.click('#m-ok');
  // integrated: a fair submit approves normally (no fight)
  const h2 = async () => p.textContent('#modal-inner h2');
  await p.click('[data-diff="easy"]'); await p.click('#m-go');
  await p.evaluate(() => { const s = window.__std; s.handle('tab:prec'); s.handle('prec:4'); s.handle('prec:5'); s.handle('tab:bridge'); s.handle('bridge:0'); s.handle('wacc:0.25'); s.handle('wacc:0.25'); });
  await p.click('#btn-submit'); await p.waitForTimeout(300);
  console.log('fair submit:', await h2(), 'fps visible:', await p.isVisible('#fps'));
  // fresh run, submit unfair deal -> kicked back with the secret button
  await p.goto('file://' + path.join(__dirname, '../index.html'));
  await p.click('[data-diff="easy"]'); await p.click('#m-go');
  await p.click('#btn-submit'); await p.waitForTimeout(300);
  console.log('unfair submit:', await h2(), 'doom button:', await p.isVisible('#m-doom'));
  await p.screenshot({ path: out + '/34-kickback.png' });
  await p.click('#m-doom'); await p.waitForTimeout(200);
  console.log('briefing:', await h2());
  await p.screenshot({ path: out + '/35-briefing.png' });
  await p.click('#m-fight'); await p.waitForTimeout(500);
  await p.evaluate(() => { FPS.state.P.hp = 1; FPS.state.projs.push({ k: 'pen', x: FPS.state.P.x + 0.5, y: FPS.state.P.y, vx: -3, vy: 0, dmg: 50 }); });
  await p.waitForTimeout(2600);
  console.log('after death:', await h2(), 'spent', await p.evaluate(() => window.__std.G.spent), 'over', await p.evaluate(() => window.__std.G.over));
  await p.click('#m-ok'); await p.waitForTimeout(200);
  // second attempt, win
  await p.click('#btn-submit'); await p.waitForTimeout(300); await p.click('#m-doom'); await p.click('#m-fight'); await p.waitForTimeout(500);
  await p.evaluate(() => { const s = FPS.state; s.ents.forEach((e) => { e.hp = 0; e.st = 'dead'; }); const x = s.items.find((it) => it.k === 'exit'); s.P.x = x.x; s.P.y = x.y; });
  await p.waitForTimeout(2600);
  console.log('after win:', await h2());
  await p.screenshot({ path: out + '/36-overruled.png' });
  console.log('errors', errs);
  await b.close();
})();
