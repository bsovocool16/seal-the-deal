// Bot plays every floor using only the same inputs a player has (turn/move/fire). Reports survival per HP/damage setting.
const { chromium } = require('playwright');
const path = require('path');
const [hp, ammo, dmg, runs] = [+(process.argv[2] || 70), +(process.argv[3] || 30), +(process.argv[4] || 0.9), +(process.argv[5] || 2)];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '../index.html'));
  const res = await p.evaluate(async ([hp, ammo, dmg, runs, only]) => {
    const out = [];
    for (let lvl = only ?? 0; lvl < (only != null ? only + 1 : FPS.LEVELS.length); lvl++) for (let r = 0; r < runs; r++) {
      const result = await new Promise((resolve) => {
        FPS.start({ level: lvl, hp, ammo, enemyDmg: dmg, onEnd: (s) => resolve(s) });
        const t0 = performance.now();
        const iv = setInterval(() => {
          const s = FPS.state; if (!s.P || s.done) { if (s.done) clearInterval(iv); return; }
          const P = s.P, map = s.map;
          ['f', 'b', 'tl', 'tr', 'fire', 'sl', 'sr'].forEach((k) => FPS.press(k, false));
          if (performance.now() - t0 > 90000) { P.hp = 0; return; }
          const vis = (e) => { const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy), n = Math.ceil(d * 6); for (let i = 1; i < n; i++) if (FPS.solid(Math.floor(P.x + dx * i / n), Math.floor(P.y + dy * i / n))) return false; return true; };
          const live = s.ents.filter((e) => e.st !== 'dead');
          const target = live.filter(vis).sort((a, b2) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b2.x - P.x, b2.y - P.y))[0];
          const turnTo = (tx, ty) => { let da = Math.atan2(ty - P.y, tx - P.x) - P.a; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; if (da > 0.04) FPS.press('tr', true); else if (da < -0.04) FPS.press('tl', true); return Math.abs(da); };
          if (target) { const da = turnTo(target.x, target.y); if (da < 0.12) FPS.press('fire', true); if (Math.hypot(target.x - P.x, target.y - P.y) > 4) FPS.press('f', true); FPS.press(Math.floor(performance.now() / 700) % 2 ? 'sl' : 'sr', true); return; }
          // navigate: BFS to nearest live enemy, else exit
          const goal = live.length ? live : s.items.filter((it) => it.k === 'exit');
          const goals = new Set(goal.map((g) => Math.floor(g.x) + ',' + Math.floor(g.y)));
          const start = Math.floor(P.x) + ',' + Math.floor(P.y), prev = { [start]: null }, q = [[Math.floor(P.x), Math.floor(P.y)]];
          let found = null;
          while (q.length) { const [x, y] = q.shift(); if (goals.has(x + ',' + y)) { found = [x, y]; break; } for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (x + dx) + ',' + (y + dy); if (!(k in prev) && !FPS.solid(x + dx, y + dy)) { prev[k] = [x, y]; q.push([x + dx, y + dy]); } } }
          if (!found) return;
          let cur = found, step = found; while (prev[cur.join()] && prev[cur.join()].join() !== start) { step = prev[cur.join()]; cur = step; } if (prev[found.join()] && prev[found.join()].join() === start) step = found;
          const da = turnTo(step[0] + 0.5, step[1] + 0.5); if (da < 0.5) FPS.press('f', true);
        }, 30);
      });
      out.push({ lvl, win: result.win, hpLeft: result.hpLeft, kills: result.kills, dmg: result.dmg, t: Math.round(result.time) });
    }
    return out;
  }, [hp, ammo, dmg, runs, process.env.LVL ? +process.env.LVL : null]);
  res.forEach((r) => console.log(JSON.stringify(r)));
  console.log('errors', errs);
  await b.close();
})();
