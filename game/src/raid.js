// Kipchak camp for the city mode: khan's ordo, yurts, a garrison, and raids that grow after a peace period.
// The camp does not run a real economy yet: raids are paid for by a timer.
import { BASES } from './world.js';

const dist = (a, b) => Math.hypot(a.mx - b.mx, a.mz - b.mz);
// Raid compositions by wave number: [type, riders]
const WAVES = [
  [['atchan', 24], ['chabuul', 18]],
  [['atchan', 30], ['chabuul', 24], ['joo', 30]],
  [['atchan', 36], ['chabuul', 24], ['saiyskar', 24], ['joo', 40]],
  [['atchan', 36], ['atchan', 36], ['saiyskar', 30], ['joo', 50], ['mergen', 24]],
  [['atchan', 36], ['atchan', 36], ['chabuul', 30], ['saiyskar', 32], ['joo', 50], ['mergen', 30], ['batyr', 12]],
];

export class RaidAI {
  constructor(sim, eco, { peace = 360 } = {}) {
    this.sim = sim; this.eco = eco; this.next = peace; this.wave = 0; this.t = 0; this.raiders = [];
    const [x, z] = BASES.enemy;
    this.khan = eco.addBuilding(1, 'xanordo', x, z, true);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.3; eco.addBuilding(1, 'bozuy', x + Math.cos(a) * 34, z + Math.sin(a) * 34, true); }
    this.garrison = [
      sim.addSquad(1, 'joo', x - 30, z + 52, 0, { count: 40 }),
      sim.addSquad(1, 'atchan', x + 34, z + 52, 0, { count: 30 }),
      sim.addSquad(1, 'batyr', x, z + 34, 0, { count: 12 }),
    ];
    this.home = new Map(this.garrison.map((q) => [q, [q.cx, q.cz]]));
  }

  update(dt) {
    if (this.sim.time >= this.next) this.launch();
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1.4;
    const sim = this.sim;
    const foes = sim.squads.filter((q) => q.team === 0 && !q.dead);
    const nearestOf = (sq, list) => list.reduce((b, q) => (!b || dist(sq, q) < dist(sq, b) ? q : b), null);
    // garrison defends the camp
    for (const sq of this.garrison) {
      if (sq.dead || sq.state === 'rout') continue;
      const close = foes.filter((q) => Math.hypot(q.mx - this.khan.x, q.mz - this.khan.z) < 260);
      if (close.length) { const t = nearestOf(sq, close); if (sq.order.target !== t) sim.order(sq, { kind: 'attack', target: t }); }
      else { const [hx, hz] = this.home.get(sq); if (Math.hypot(sq.cx - hx, sq.cz - hz) > 40 && sq.order.kind !== 'move') sim.order(sq, { kind: 'move', x: hx, z: hz, face: 0 }); }
    }
    // raiders hunt workers and economy buildings, and fight whatever gets close
    if (sim.teams[1].cmd?.alive && this.raiders.some((q) => !q.dead && q.lastEngaged > 0)) sim.warCry(1);
    for (const sq of this.raiders) {
      if (sq.dead || sq.state === 'rout') continue;
      const close = foes.filter((q) => dist(sq, q) < (sim.shoots(sq) ? sq.T.ranged.range + 20 : 90));
      if (close.length) {
        const pref = close.filter((q) => q.T.worker || q.T.artillery);
        const t = nearestOf(sq, pref.length && sq.T.mounted ? pref : close);
        if (sq.order.target !== t) sim.order(sq, { kind: 'attack', target: t });
        continue;
      }
      const b = this.pickTarget(sq);
      if (b && sq.order.b !== b) sim.order(sq, { kind: 'attackB', b });
      if (!b) sim.order(sq, { kind: 'move', x: this.khan.x, z: this.khan.z + 60, face: 0 });
    }
  }

  pickTarget(sq) {
    let best = null, bs = -Infinity;
    for (const b of this.sim.buildings) {
      if (b.team !== 0 || b.dead) continue;
      let s = -Math.hypot(b.x - sq.mx, b.z - sq.mz);
      if (b.T.field || b.key === 'tegirmon' || b.key === 'ombor') s += 160; // raiders go for the economy
      if (b.key === 'uy') s += 80;
      if (b.key === 'urda') s -= sq.T.mounted ? 120 : 0;
      if (s > bs) { bs = s; best = b; }
    }
    return best;
  }

  launch() {
    const sim = this.sim, comp = WAVES[Math.min(this.wave, WAVES.length - 1)], extra = Math.max(0, this.wave - WAVES.length + 1);
    this.wave++;
    const [x, z] = BASES.enemy;
    let n = 0;
    comp.forEach(([key, count], i) => {
      const lat = (i - (comp.length - 1) / 2) * 45;
      const sq = sim.addSquad(1, key, x + lat, z + 80, 0, { count: Math.round(count * (1 + extra * 0.25)) });
      this.raiders.push(sq); n += sq.alive.length;
    });
    this.eco.say(`Набег кыпчаков! ${n} воинов идут с севера`, 'bad');
    sim.events.push({ k: 'raid', n });
    this.next = sim.time + Math.max(150, 240 - this.wave * 15);
  }
}
