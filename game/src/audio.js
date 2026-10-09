// Battle sound, synthesized with Web Audio: war cries, horns, sword clashes, arrow volleys, hoof rumble.
// Everything is generated in code, so later it can be swapped for recorded samples without touching the game.

const rnd = (a, b) => a + Math.random() * (b - a);
// vowel formants [F1, F2, F3]
const V = { u: [320, 800, 2240], a: [760, 1220, 2550], o: [520, 900, 2400], e: [560, 1750, 2550], n: [280, 1500, 2600] };
// war cry shapes: [vowel, start fraction of duration]; 'r' marks a rolled r (amplitude flutter)
const CRIES = {
  kokand: { dur: 1.25, f0: [125, 205], plan: [['u', 0], ['r', 0.12], ['a', 0.24]] },             // «Ур-раа!»
  kipchak: { dur: 1.6, f0: [115, 190], plan: [['u', 0], ['r', 0.1], ['a', 0.2], ['n', 0.82]] },   // «Ураан!»
};

export class BattleAudio {
  constructor() {
    this.ctx = null; this.muted = false;
    this.lx = 0; this.lz = 0; this.zoom = 200; this.yaw = 0;
    this.shouts = 0; this.volleyT = 0; this.shotAcc = []; this.clashBudget = 0; this.yellBudget = 0;
  }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 5;
    this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(comp).connect(ctx.destination);
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // continuous beds: hooves and wind
    const loop = (filterType, freq, q) => {
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(f).connect(g).connect(this.master); src.start();
      return g;
    };
    this.hoof = loop('lowpass', 170, 0.8);
    this.wind = loop('bandpass', 420, 0.4); this.wind.gain.value = 0.025;
  }

  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05); }
  listener(x, z, dist, yaw) { this.lx = x; this.lz = z; this.zoom = dist; this.yaw = yaw; }
  att(x, z) {
    const d = Math.hypot(x - this.lx, z - this.lz), k = Math.max(0.3, Math.min(1.3, 150 / this.zoom));
    return k / (1 + (d / 75) ** 2);
  }
  bus(x, z, gain) {
    const ctx = this.ctx, g = ctx.createGain(), p = ctx.createStereoPanner();
    const r = (x - this.lx) * Math.cos(this.yaw) - (z - this.lz) * Math.sin(this.yaw);
    p.pan.value = Math.max(-0.9, Math.min(0.9, r / 140));
    g.gain.value = gain; g.connect(p).connect(this.master);
    return g;
  }
  noiseSrc(t, dur) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loopStart = rnd(0, 1.5); s.start(t, rnd(0, 1.5), dur); return s; }

  // One shouting voice through three formant filters.
  voice(out, t, dur, f0, plan, loud = 1) {
    const ctx = this.ctx, osc = ctx.createOscillator(), vib = ctx.createOscillator(), vibG = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0, t); osc.frequency.linearRampToValueAtTime(f0 * 1.25, t + dur * 0.3);
    osc.frequency.linearRampToValueAtTime(f0 * 1.08, t + dur * 0.8); osc.frequency.linearRampToValueAtTime(f0 * 0.85, t + dur);
    vib.frequency.value = rnd(5, 7); vibG.gain.value = f0 * 0.035; vib.connect(vibG).connect(osc.frequency);
    const breath = this.noiseSrc(t, dur + 0.3), bG = ctx.createGain(); bG.gain.value = 0.12; breath.connect(bG);
    const env = ctx.createGain(); env.gain.value = 0;
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(loud, t + 0.07);
    env.gain.setValueAtTime(loud * 0.95, t + dur * 0.75); env.gain.linearRampToValueAtTime(0, t + dur + 0.2);
    [1, 0.55, 0.22].forEach((amp, i) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 7 + i * 3;
      let prev = null;
      for (const [ph, at] of plan) {
        const tt = t + at * dur;
        if (ph === 'r') { if (i === 0) { env.gain.setValueAtTime(loud * 0.35, tt); env.gain.setValueAtTime(loud, tt + 0.04); env.gain.setValueAtTime(loud * 0.4, tt + 0.08); env.gain.setValueAtTime(loud, tt + 0.11); } continue; }
        const f = V[ph][i] * rnd(0.95, 1.08);
        if (prev === null) bp.frequency.setValueAtTime(f, t);
        else { bp.frequency.setValueAtTime(prev, tt); bp.frequency.linearRampToValueAtTime(f, tt + 0.05); }
        prev = f;
      }
      const g = ctx.createGain(); g.gain.value = amp * 2.2;
      osc.connect(bp); bG.connect(bp); bp.connect(g).connect(env);
    });
    env.connect(out);
    osc.start(t); vib.start(t); osc.stop(t + dur + 0.3); vib.stop(t + dur + 0.3);
  }

  shout(x, z, faction, n = 30, big = false) {
    if (!this.ctx || this.muted || this.shouts > 3) return;
    const a = this.att(x, z) * (big ? 1.4 : 1);
    if (a < 0.025) return;
    const C = CRIES[faction], dur = C.dur * (big ? 1.3 : 1), voices = Math.min(12, 4 + Math.round(n / 5));
    const out = this.bus(x, z, Math.min(0.9, a * 0.42)), t0 = this.ctx.currentTime + 0.02;
    for (let i = 0; i < voices; i++) this.voice(out, t0 + rnd(0, 0.28), dur * rnd(0.85, 1.1), rnd(...C.f0) * (big ? 0.92 : 1), C.plan, rnd(0.6, 1));
    this.shouts++; setTimeout(() => this.shouts--, (dur + 0.6) * 1000);
  }

  // Карнай for Kokand, a deeper horn for the Kipchaks.
  horn(x, z, faction, gain = 1) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.02, kok = faction === 'kokand';
    const f = kok ? 98 : 73, dur = kok ? 2.2 : 1.8;
    const out = this.bus(x, z, Math.min(0.7, Math.max(0.12, this.att(x, z)) * 0.45 * gain));
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(kok ? 1500 : 1000, t + 0.35); lp.frequency.linearRampToValueAtTime(700, t + dur);
    const env = ctx.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + 0.25);
    env.gain.setValueAtTime(0.9, t + dur - 0.5); env.gain.linearRampToValueAtTime(0, t + dur);
    lp.connect(env).connect(out);
    for (const [mul, type, g] of [[1, 'sawtooth', 0.5], [2.003, 'sawtooth', 0.3], [3, kok ? 'square' : 'sawtooth', 0.12]]) {
      const o = ctx.createOscillator(), og = ctx.createGain(); o.type = type; og.gain.value = g;
      o.frequency.setValueAtTime(f * mul * 0.94, t); o.frequency.linearRampToValueAtTime(f * mul, t + 0.2);
      if (kok) { o.frequency.setValueAtTime(f * mul, t + dur * 0.55); o.frequency.linearRampToValueAtTime(f * mul * 1.5, t + dur * 0.62); }
      o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 0.05);
    }
  }

  clash(x, z) {
    const a = this.att(x, z); if (a < 0.05) return;
    const ctx = this.ctx, t = ctx.currentTime + rnd(0, 0.03), out = this.bus(x, z, Math.min(0.5, a * 0.22));
    for (const base of [2300, 3650, 5200]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = base * rnd(0.9, 1.15); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + rnd(0.12, 0.3));
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.32);
    }
    const n = this.noiseSrc(t, 0.03), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const ng = ctx.createGain(); ng.gain.value = 0.8; n.connect(hp).connect(ng).connect(out);
  }

  yell(x, z, faction) {
    const a = this.att(x, z); if (a < 0.06) return;
    const out = this.bus(x, z, Math.min(0.4, a * 0.3)), t = this.ctx.currentTime + 0.01;
    const C = CRIES[faction];
    this.voice(out, t, rnd(0.22, 0.4), rnd(...C.f0) * rnd(1, 1.3), [[Math.random() < 0.5 ? 'a' : 'e', 0]], 0.8);
  }

  volley(x, z, count) {
    const a = this.att(x, z) * Math.min(1, 0.35 + count * 0.04); if (a < 0.03) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01, out = this.bus(x, z, Math.min(0.5, a * 0.4));
    const n = this.noiseSrc(t, 0.8), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(3200, t); bp.frequency.exponentialRampToValueAtTime(1100, t + 0.7);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + 0.06); g.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    n.connect(bp).connect(g).connect(out);
  }

  // Axe on wood, pick on stone and gold, sickle in the field.
  work(x, z, res) {
    const a = this.att(x, z); if (a < 0.06) return;
    const ctx = this.ctx, t = ctx.currentTime + 0.01, out = this.bus(x, z, Math.min(0.35, a * 0.25));
    if (res === 'wood') {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(rnd(160, 220), t); o.frequency.exponentialRampToValueAtTime(70, t + 0.09);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.12); o.connect(g).connect(out); o.start(t); o.stop(t + 0.14);
    } else if (res === 'food') {
      const n = this.noiseSrc(t, 0.25), hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3500;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.22); n.connect(hp).connect(g).connect(out);
      return;
    } else {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = rnd(1700, 2700) * (res === 'gold' ? 1.25 : 1);
      g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.connect(g).connect(out); o.start(t); o.stop(t + 0.16);
    }
    const n = this.noiseSrc(t, 0.03), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = res === 'wood' ? 900 : 2500;
    const ng = ctx.createGain(); ng.gain.value = 0.6; n.connect(bp).connect(ng).connect(out);
  }

  // Called once per frame with the simulation's events.
  onEvents(events, sim, dt) {
    if (!this.ctx || this.muted) return;
    const fac = (team) => sim.teams[team].faction.cry;
    let strikes = 0;
    for (const e of events) {
      if (e.k === 'shout') this.shout(e.x, e.z, fac(e.team), e.n);
      else if (e.k === 'cry') { this.horn(e.x, e.z, fac(e.team), 1.4); setTimeout(() => this.shout(e.x, e.z, fac(e.team), 60, true), 500); }
      else if (e.k === 'shot') this.shotAcc.push(e);
      else if (e.k === 'strike') strikes++;
      else if (e.k === 'work' && (this.workBudget || 0) >= 1) { this.work(e.x, e.z, e.res); this.workBudget--; }
      else if (e.k === 'raid') this.horn(this.lx, this.lz - 260, e.fac || 'kipchak', 2.2);
    }
    this.workBudget = Math.min(3, (this.workBudget || 0) + dt * 5);
    // arrows: one whoosh per ~0.3 s for the volley nearest to the camera
    this.volleyT -= dt;
    if (this.volleyT <= 0 && this.shotAcc.length) {
      let best = null, ba = 0;
      for (const s of this.shotAcc) { const a = this.att(s.x, s.z); if (a > ba) { ba = a; best = s; } }
      if (best) this.volley(best.x, best.z, this.shotAcc.length);
      this.shotAcc = []; this.volleyT = 0.3;
    }
    // melee din: a budget of clashes and yells per second, picked from this frame's blows
    this.clashBudget = Math.min(3, this.clashBudget + dt * 9); this.yellBudget = Math.min(2, this.yellBudget + dt * 2.5);
    if (strikes) {
      const hits = events.filter((e) => e.k === 'strike');
      while (this.clashBudget >= 1 && hits.length) { const h = hits.splice(Math.floor(Math.random() * hits.length), 1)[0]; this.clash(h.x, h.z); this.clashBudget--; }
      const all = events.filter((e) => e.k === 'strike');
      if (this.yellBudget >= 1 && all.length) { const h = all[Math.floor(Math.random() * all.length)]; this.yell(h.x, h.z, Math.random() < 0.5 ? 'kokand' : 'kipchak'); this.yellBudget--; }
    }
  }

  // Hoof rumble from galloping riders near the camera.
  updateBeds(sim) {
    if (!this.ctx) return;
    let h = 0;
    for (const s of sim.soldiers) if (s.alive && s.T.mounted && s.speed > 4) h += this.att(s.x, s.z) * (s.speed / s.T.speed);
    this.hoof.gain.setTargetAtTime(Math.min(0.9, h * 0.03), this.ctx.currentTime, 0.2);
  }
}
