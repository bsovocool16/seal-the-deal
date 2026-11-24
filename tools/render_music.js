// Renders each soundtrack to a WAV (and prints level stats) via OfflineAudioContext in headless Chromium.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const outDir = process.argv[2] || '.';
const secs = +(process.argv[3] || 30);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '../dist/seal-the-deal.html'));
  for (const id of await p.evaluate(() => Music.list)) {
    const r = await p.evaluate(async ([id, secs]) => {
      const buf = await Music.renderOffline(id, secs);
      const d = buf.getChannelData(0);
      let peak = 0, sum = 0; for (const v of d) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
      const pcm = new Int16Array(d.length); for (let i = 0; i < d.length; i++) pcm[i] = Math.max(-1, Math.min(1, d[i])) * 32767;
      return { peak, rms: Math.sqrt(sum / d.length), pcm: Array.from(pcm), rate: buf.sampleRate };
    }, [id, secs]);
    const data = Buffer.from(new Int16Array(r.pcm).buffer);
    const h = Buffer.alloc(44);
    h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(r.rate, 24);
    h.writeUInt32LE(r.rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(data.length, 40);
    fs.writeFileSync(path.join(outDir, id + '.wav'), Buffer.concat([h, data]));
    console.log(id, 'peak', r.peak.toFixed(3), 'rms', r.rms.toFixed(3));
  }
  console.log('errors', errs);
  await b.close();
})();
