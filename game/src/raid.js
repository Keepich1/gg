// The computer's side in the city mode: a base in the north, a garrison, and raids that grow after a peace period.
// It does not run a real economy yet: raids are paid for by a timer.
import { BASES } from './world.js';
import { MAIN } from './buildings.js';

const dist = (a, b) => Math.hypot(a.mx - b.mx, a.mz - b.mz);
// Raid compositions by wave number: [type, count]
const WAVES = {
  kipchak: [
    [['atchan', 24], ['chabuul', 18]],
    [['atchan', 30], ['chabuul', 24], ['joo', 30]],
    [['atchan', 36], ['chabuul', 24], ['saiyskar', 24], ['joo', 40]],
    [['atchan', 36], ['atchan', 36], ['saiyskar', 30], ['joo', 50], ['mergen', 24]],
    [['atchan', 36], ['atchan', 36], ['chabuul', 30], ['saiyskar', 32], ['joo', 50], ['mergen', 30], ['batyr', 12]],
  ],
  kokand: [
    [['navkar', 20], ['kilichboz', 24]],
    [['navkar', 24], ['sarbaz', 30], ['naizachi', 30]],
    [['navkar', 30], ['sarbaz', 36], ['kamonchi', 30], ['kilichboz', 30]],
    [['navkar', 30], ['sarbaz', 40], ['naizachi', 40], ['kamonchi', 30], ['zarbzan', 3]],
    [['navkar', 36], ['sarbaz', 40], ['naizachi', 40], ['kamonchi', 36], ['kilichboz', 40], ['zarbzan', 3], ['xos', 12]],
  ],
};
// Buildings raiders go for first: the other side's economy
const PREY = { dala: 160, tegirmon: 160, ombor: 160, uy: 80, koroo: 170, ken: 160, boz: 90 };

export class RaidAI {
  constructor(sim, eco, { peace = 360 } = {}) {
    this.sim = sim; this.eco = eco; this.next = peace; this.wave = 0; this.t = 0; this.raiders = [];
    this.fac = sim.teams[1].key;
    const [x, z] = BASES.enemy;
    this.main = eco.addBuilding(1, MAIN[this.fac], x, z, true);
    if (this.fac === 'kipchak') {
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.3; eco.addBuilding(1, 'boz', x + Math.cos(a) * 34, z + Math.sin(a) * 34, true); }
      eco.addBuilding(1, 'koroo', x - 60, z - 10, true);
      this.garrison = [sim.addSquad(1, 'joo', x - 30, z + 52, 0, { count: 40 }), sim.addSquad(1, 'atchan', x + 34, z + 52, 0, { count: 30 }), sim.addSquad(1, 'batyr', x, z + 34, 0, { count: 12 })];
    } else {
      for (const [dx, dz] of [[-30, -10], [30, -10], [-30, 22], [30, 22], [-14, -30], [14, -30]]) eco.addBuilding(1, 'uy', x + dx, z + dz, true);
      eco.addBuilding(1, 'kazarma', x - 52, z + 8, true); eco.addBuilding(1, 'otxona', x + 54, z + 8, true);
      eco.addBuilding(1, 'dala', x - 40, z + 48, true); eco.addBuilding(1, 'dala', x + 40, z + 48, true);
      this.garrison = [sim.addSquad(1, 'sarbaz', x - 26, z + 44, 0, { count: 40 }), sim.addSquad(1, 'naizachi', x + 26, z + 44, 0, { count: 40 }), sim.addSquad(1, 'xos', x, z + 26, 0, { count: 12 })];
    }
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
    // garrison defends the base
    for (const sq of this.garrison) {
      if (sq.dead || sq.state === 'rout') continue;
      const close = foes.filter((q) => Math.hypot(q.mx - this.main.x, q.mz - this.main.z) < 260);
      if (close.length) { const t = nearestOf(sq, close); if (sq.order.target !== t) sim.order(sq, { kind: 'attack', target: t }); }
      else { const [hx, hz] = this.home.get(sq); if (Math.hypot(sq.cx - hx, sq.cz - hz) > 40 && sq.order.kind !== 'move') sim.order(sq, { kind: 'move', x: hx, z: hz, face: 0 }); }
    }
    // raiders hunt workers, wagons and economy buildings, and fight whatever gets close
    if (sim.teams[1].cmd?.alive && this.raiders.some((q) => !q.dead && q.lastEngaged > 0)) sim.warCry(1);
    for (const sq of this.raiders) {
      if (sq.dead || sq.state === 'rout') continue;
      const close = foes.filter((q) => dist(sq, q) < (sim.shoots(sq) ? sq.T.ranged.range + 20 : 90));
      if (close.length) {
        const pref = close.filter((q) => q.T.civil || q.T.artillery);
        const t = nearestOf(sq, pref.length && sq.T.mounted ? pref : close);
        if (sq.order.target !== t) sim.order(sq, { kind: 'attack', target: t });
        continue;
      }
      const b = this.pickTarget(sq);
      if (b && sq.order.b !== b) sim.order(sq, { kind: 'attackB', b });
      if (!b) sim.order(sq, { kind: 'move', x: this.main.x, z: this.main.z + 60, face: 0 });
    }
  }

  pickTarget(sq) {
    let best = null, bs = -Infinity;
    for (const b of this.sim.buildings) {
      if (b.team !== 0 || b.dead) continue;
      let s = -Math.hypot(b.x - sq.mx, b.z - sq.mz) + (PREY[b.key] || 0);
      if (b.T.main) s -= sq.T.mounted ? 120 : 0;
      if (s > bs) { bs = s; best = b; }
    }
    return best;
  }

  launch() {
    const sim = this.sim, list = WAVES[this.fac], comp = list[Math.min(this.wave, list.length - 1)], extra = Math.max(0, this.wave - list.length + 1);
    this.wave++;
    const [x, z] = BASES.enemy, sz = z + (this.fac === 'kokand' ? 330 : 80); // foot armies march from a forward camp
    let n = 0;
    comp.forEach(([key, count], i) => {
      const lat = (i - (comp.length - 1) / 2) * 45;
      const sq = sim.addSquad(1, key, x + lat, sz, 0, { count: Math.round(count * (1 + extra * 0.25)) });
      this.raiders.push(sq); n += sq.alive.length;
    });
    this.eco.say(this.fac === 'kipchak' ? `Набег кыпчаков! ${n} воинов идут с севера` : `Кокандское войско выступило! ${n} воинов идут с севера`, 'bad');
    sim.events.push({ k: 'raid', n, fac: this.fac });
    this.next = sim.time + Math.max(150, 240 - this.wave * 15);
  }
}
