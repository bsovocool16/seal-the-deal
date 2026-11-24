/* Seal the Deal — chiptune engine and soundtrack. All tracks are original compositions,
   except "Ride of the Analysts", an arrangement of Wagner's public-domain Ride of the Valkyries (1856). */
const Music = (function () {
  'use strict';
  let ctx = null, out = null, noise = null, timer = null;
  let song = null, step = 0, nextT = 0, tempoMul = 1;
  const waves = {};

  // ---------- note helpers ----------
  const IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midi(n) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(n);
    if (!m) return null;
    return 12 * (+m[3] + 1) + IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // "C4 - - . E4" → [{s:0,n:'C4',len:3},{s:4,n:'E4',len:1}], length in steps
  function parse(str) {
    const tok = str.trim().split(/\s+/), ev = [];
    tok.forEach((t, i) => {
      if (t === '-') { if (ev.length && ev[ev.length - 1].s + ev[ev.length - 1].len === i) ev[ev.length - 1].len++; return; }
      if (t !== '.') ev.push({ s: i, n: t, len: 1 });
    });
    return { ev, len: tok.length };
  }
  const rep = (s, n) => Array(n).fill(s.trim()).join(' ') + ' ';

  // ---------- audio graph ----------
  function ensure() {
    if (ctx) return true;
    try { build(new (window.AudioContext || window.webkitAudioContext)()); return true; } catch (e) { ctx = null; return false; }
  }
  function build(c) {
    {
      ctx = c;
      out = ctx.createGain(); out.gain.value = 0.22;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      out.connect(comp); comp.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      [0.125, 0.25].forEach((duty) => {
        const N = 32, re = new Float32Array(N), im = new Float32Array(N);
        for (let k = 1; k < N; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * 2;
        waves[duty] = ctx.createPeriodicWave(re, im);
      });
    }
  }

  function tone(inst, m, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (inst.wave === 'pulse25' || inst.wave === 'pulse12') o.setPeriodicWave(waves[inst.wave === 'pulse25' ? 0.25 : 0.125]);
    else o.type = inst.wave;
    o.frequency.setValueAtTime(hz(m + (inst.shift || 0)), t);
    if (inst.glideFrom) { o.frequency.setValueAtTime(hz(m + inst.glideFrom), t); o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.06); }
    if (inst.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = 5.5; lg.gain.value = hz(m) * 0.012;
      l.connect(lg); lg.connect(o.frequency); l.start(t + Math.min(0.15, dur * 0.4)); l.stop(t + dur + 0.1);
    }
    const v = inst.vol, a = 0.004, hold = inst.pluck ? Math.min(dur, inst.pluck) : dur * 0.92;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    if (inst.decay) g.gain.exponentialRampToValueAtTime(v * inst.decay, t + hold);
    else g.gain.setValueAtTime(v, t + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + hold + (inst.rel || 0.04));
    o.connect(g); g.connect(out);
    o.start(t); o.stop(t + hold + (inst.rel || 0.04) + 0.02);
  }

  function drum(k, t, vol = 1) {
    if (k === 'k' || k === 'K') { // kick / 808 kick
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(k === 'K' ? 120 : 160, t); o.frequency.exponentialRampToValueAtTime(k === 'K' ? 38 : 45, t + 0.12);
      g.gain.setValueAtTime(0.9 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + (k === 'K' ? 0.45 : 0.18));
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.5); return;
    }
    if (k === 't') { // timpani-ish
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(98, t); o.frequency.exponentialRampToValueAtTime(82, t + 0.3);
      g.gain.setValueAtTime(0.7 * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.55);
    }
    const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = noise;
    let dur = 0.04, v = 0.25;
    if (k === 's' || k === 'S') { f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.7; dur = k === 'S' ? 0.22 : 0.12; v = 0.55; }
    else if (k === 'h') { f.type = 'highpass'; f.frequency.value = 7500; dur = 0.03; v = 0.22; }
    else if (k === 'o') { f.type = 'highpass'; f.frequency.value = 6500; dur = 0.16; v = 0.2; }
    else if (k === 'c') { f.type = 'highpass'; f.frequency.value = 5000; dur = 0.7; v = 0.22; }
    else if (k === 't') { f.type = 'lowpass'; f.frequency.value = 400; dur = 0.2; v = 0.3; }
    else return;
    g.gain.setValueAtTime(v * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(out); n.start(t, Math.random() * 0.5); n.stop(t + dur + 0.02);
  }

  // ---------- scheduler ----------
  function schedule(i, t, sd) {
    song.parts.forEach((p) => {
      const local = i % p.seq.len;
      if (p.drums) {
        p.seq.ev.forEach((e) => {
          if (e.s !== local) return;
          if (e.n === 'r') { drum('h', t, 0.8); drum('h', t + sd / 2, 0.6); }
          else if (e.n === 'z') { drum('h', t, 0.8); drum('h', t + sd / 3, 0.6); drum('h', t + 2 * sd / 3, 0.7); }
          else if (e.n === 'R') { drum('s', t, 0.5); drum('s', t + sd / 2, 0.6); }
          else e.n.split('+').forEach((k) => drum(k, t));
        });
        return;
      }
      p.seq.ev.forEach((e) => {
        if (e.s !== local) return;
        const m = midi(e.n); if (m == null) return;
        tone(p.inst, m, t, e.len * sd);
        (p.inst.chord || []).forEach((iv) => tone({ ...p.inst, vol: p.inst.vol * 0.6, vib: false }, m + iv, t, e.len * sd));
      });
    });
  }
  function tick() {
    if (!song || !ctx) return;
    const sd = song.step / tempoMul;
    while (nextT < ctx.currentTime + 0.15) {
      schedule(step, nextT, sd);
      nextT += sd; step = (step + 1) % song.len;
    }
  }

  // ---------- songs ----------
  // Valkyrie cell: 12 sixteenths in 6/8 — dotted-8th, 16th, 8th, long note, pickup.
  const cell = (a, b, c, d, p) => `${a} - - ${b} ${c} - ${d} - - - - ${p}`;
  const held = (a, p) => `${a} - - - - - - - - - - ${p}`;
  const vA = [cell('B4', 'F#4', 'B4', 'D5', 'B4'), cell('D5', 'B4', 'D5', 'F#5', 'D5'), cell('F#5', 'D5', 'F#5', 'A5', 'F#5'), held('A5', 'F#4')];
  const vB = [cell('D5', 'A4', 'D5', 'F#5', 'D5'), cell('F#5', 'D5', 'F#5', 'A5', 'F#5'), cell('A5', 'F#5', 'A5', 'C#6', 'A5'), held('C#6', 'F#4')];
  const vC = [cell('B4', 'F#4', 'B4', 'D5', 'B4'), cell('D5', 'B4', 'D5', 'F#5', 'D5'), cell('E5', 'C#5', 'E5', 'G5', 'E5'), held('F#5', 'F#4')];
  const intro = ['. . . . . . . . . . . .', '. . . . . . . . . . . F#4'];
  const bassCell = (r) => `${r}2 . ${r}1 . ${r}2 . ${r}1 . ${r}2 . ${r}1 .`;
  const vBass = ['B', 'B', 'D', 'F#', 'D', 'D', 'A', 'A', 'B', 'B', 'E', 'F#'].map(bassCell).join(' ');
  const vDr = 't . . . . . t . . . . . ';

  const SONGS = {
    valkyrie: {
      name: 'Ride of the Analysts', sub: 'after Wagner', gain: 1.7,
      step: 60 / (112 * 6), len: 0,
      parts: [
        { inst: { wave: 'pulse25', vol: 0.16, vib: true, rel: 0.06 }, seq: parse(intro.concat(vA, vB, vC).join(' ')) },
        { inst: { wave: 'square', vol: 0.06, shift: -12, rel: 0.05 }, seq: parse(intro.concat(vA, vB, vC).join(' ')) },
        { inst: { wave: 'triangle', vol: 0.32, pluck: 0.09, rel: 0.03 }, seq: parse([bassCell('B'), bassCell('B'), vBass].join(' ')) },
        { drums: true, seq: parse(rep(vDr, 13) + 't . t . t . R R R R R S') },
      ],
    },
    hustle: {
      name: 'Hustle Season', sub: 'trap-ish', gain: 0.9,
      step: 60 / 142 / 4, len: 0,
      parts: [
        { inst: { wave: 'pulse25', vol: 0.13, chord: [-12], rel: 0.05 }, seq: parse(
          'C5 - - . Eb5 - - . G5 - . . F5 - Eb5 - ' + 'D5 - - . Eb5 - - . C5 - - - . . . . ' +
          'C5 - - . Eb5 - - . G5 - . . Ab5 - G5 - ' + 'F5 - - . Eb5 - D5 - C5 - - - . . G4 - ' +
          'C6 - - . Bb5 - - . Ab5 - - . G5 - - - ' + 'Ab5 - - . G5 - - . Eb5 - - - D5 - - - ' +
          'C6 - - . Bb5 - - . Ab5 - - . G5 - F5 - ' + 'Eb5 - D5 - C5 - - - - - - - . . . . ') },
        { inst: { wave: 'sine', vol: 0.55, glideFrom: 12, rel: 0.12 }, seq: parse(
          'C2 - - - - - - - . . C2 - Eb2 - - - ' + 'Ab1 - - - - - - - . . G1 - - - - - ' +
          'C2 - - - - - - - . . C2 - Eb2 - - - ' + 'F1 - - - - - - - G1 - - - - - - - ') },
        { inst: { wave: 'square', vol: 0.03, rel: 0.02, pluck: 0.05 }, seq: parse(rep('C4 . G4 . Eb4 . G4 . C4 . G4 . Eb4 . G4 .', 2) + ' ' + rep('Ab3 . Eb4 . C4 . Eb4 . G3 . D4 . B3 . D4 .', 1) + ' ' + rep('C4 . G4 . Eb4 . G4 . C4 . G4 . Eb4 . G4 .', 1)) },
        { drums: true, seq: parse('K . . . . . . . . . K . . . . . ' + 'K . . . . . . K . . K . . . . .') },
        { drums: true, seq: parse('. . . . . . . . S . . . . . . . ') },
        { drums: true, seq: parse('h h h h h h h h h h h h r r r r ' + 'h h h h h . h h z . z . h h o .') },
      ],
    },
    crunch: {
      name: 'Model Crunch', sub: 'demon-slaying metal', gain: 1.4,
      step: 60 / 168 / 4, len: 0,
      parts: [
        { inst: { wave: 'pulse25', vol: 0.11, chord: [7, 12], pluck: 0.07, decay: 0.5, rel: 0.03 }, seq: parse(rep(
          'E2 . E2 E2 G2 . E2 E2 A2 . E2 E2 Bb2 A2 G2 . ' + 'E2 . E2 E2 G2 . E2 E2 D3 . C3 . B2 . A2 . ' +
          'E2 . E2 E2 G2 . E2 E2 A2 . E2 E2 Bb2 A2 G2 . ' + 'G2 - - - F#2 - - - F2 - - - E2 . E2 E2', 2)) },
        { inst: { wave: 'triangle', vol: 0.3, pluck: 0.07, rel: 0.02 }, seq: parse(rep(
          'E1 . E1 E1 G1 . E1 E1 A1 . E1 E1 Bb1 A1 G1 . ' + 'E1 . E1 E1 G1 . E1 E1 D2 . C2 . B1 . A1 . ' +
          'E1 . E1 E1 G1 . E1 E1 A1 . E1 E1 Bb1 A1 G1 . ' + 'G1 - - - F#1 - - - F1 - - - E1 . E1 E1', 2)) },
        { inst: { wave: 'pulse12', vol: 0.13, vib: true, rel: 0.1 }, seq: parse(
          rep('. . . . . . . . . . . . . . . . ', 4) +
          'E5 - - - G5 - - - F#5 - - - D5 - - - ' + 'E5 - - - - - - - B4 - - - - - - - ' +
          'C5 - - - B4 - - - A4 - - - G4 - - - ' + 'A4 - - - B4 - - - - - - - - - - - ') },
        { drums: true, seq: parse(rep('k . k . k . k . k . k . k . k . ', 4) + rep('k k k k k k k k k k k k k k k k ', 4)) },
        { drums: true, seq: parse(rep('. . . . s . . . . . . . s . . . ', 3) + '. . . . s . . . R R R R S . S . ') },
        { drums: true, seq: parse('c . h . h . h . h . h . h . h . ' + rep('h . h . h . h . h . h . h . h . ', 3)) },
      ],
    },
  };
  Object.values(SONGS).forEach((s) => { s.len = Math.max(...s.parts.map((p) => p.seq.len)); });

  return {
    list: ['valkyrie', 'hustle', 'crunch'],
    SONGS,
    play(id) {
      if (!SONGS[id]) { this.stop(); return; }
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (song === SONGS[id] && timer) return;
      song = SONGS[id]; step = 0; nextT = ctx.currentTime + 0.08;
      out.gain.value = 0.22 * (song.gain || 1);
      clearInterval(timer); timer = setInterval(tick, 25); tick();
    },
    stop() { clearInterval(timer); timer = null; song = null; },
    setIntensity(x) { tempoMul = 1 + 0.18 * Math.max(0, Math.min(1, x)); },
    // Renders a track to an AudioBuffer without touching the live player (used for previews/tests).
    renderOffline(id, secs) {
      const saved = { ctx, out, noise, w: { ...waves }, song };
      const oc = new OfflineAudioContext(1, Math.ceil(44100 * secs), 44100);
      build(oc); song = SONGS[id]; out.gain.value = 0.22 * (song.gain || 1);
      const sd = song.step;
      for (let i = 0, t = 0.05; t < secs - 0.5; i++, t += sd) schedule(i % song.len, t, sd);
      ctx = saved.ctx; out = saved.out; noise = saved.noise; Object.assign(waves, saved.w); song = saved.song;
      return oc.startRendering();
    },
    get playing() { return song ? Object.keys(SONGS).find((k) => SONGS[k] === song) : null; },
  };
})();
