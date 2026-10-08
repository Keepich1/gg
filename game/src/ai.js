// Computer commander. Thinks a few times per second and gives squad orders through sim.order().
const dist = (a, b) => Math.hypot(a.mx - b.mx, a.mz - b.mz);

export class AI {
  constructor(sim, team) {
    this.sim = sim; this.team = team; this.t = 0.5 + team * 0.3;
    this.cavWait = 22 + sim.rand() * 18; // heavy cavalry holds back at first
  }

  update(dt) {
    this.t -= dt;
    if (this.t > 0) return;
    this.t = 1.1 + this.sim.rand() * 0.5;
    this.think();
  }

  think() {
    const sim = this.sim;
    const mine = sim.squads.filter((q) => q.team === this.team && !q.dead && q.state !== 'rout');
    const foes = sim.squads.filter((q) => q.team !== this.team && !q.dead);
    const live = foes.filter((q) => q.state !== 'rout');
    if (!live.length) return;
    const nearestOf = (sq, list) => list.reduce((b, q) => (!b || dist(sq, q) < dist(sq, b) ? q : b), null);
    const guarded = (q) => foes.some((g) => g !== q && g.T.melee && g.T.melee.vsCav && g.state !== 'rout' && dist(g, q) < 30);
    const attack = (sq, tg) => { if (sq.order.kind !== 'attack' || sq.order.target !== tg) sim.order(sq, { kind: 'attack', target: tg }); };
    const moveTo = (sq, x, z, face) => {
      const o = sq.order;
      if (o.kind === 'move' && Math.hypot(o.x - x, o.z - z) < 10) return;
      sim.order(sq, { kind: 'move', x, z, face });
    };

    for (const sq of mine) {
      const T = sq.T, near = nearestOf(sq, live), d = dist(sq, near);
      const face = Math.atan2(near.mx - sq.mx, near.mz - sq.mz);
      if (T.artillery) {
        if (d > T.ranged.range * 0.9) moveTo(sq, near.mx - Math.sin(face) * T.ranged.range * 0.8, near.mz - Math.cos(face) * T.ranged.range * 0.8, face);
        else attack(sq, near);
      } else if (T.ranged && !T.mounted) {
        // don't chase faster riders that out-range us: hold and let guns and cavalry deal with them
        if (near.T.mounted && near.T.ranged && d > T.ranged.range) { if (sq.order.kind !== 'idle') sim.order(sq, { kind: 'idle', face }); }
        else attack(sq, near); // walks into range, then volleys
      } else if (T.ranged && T.mounted) {
        sq.skirmish = true;
        const ammo = sq.alive.reduce((a, s) => a + s.ammo, 0) / (sq.alive.length * T.ranged.ammo);
        if (ammo < 0.15 || (sq.resupply && ammo < 0.8)) { // ride back for arrows
          sq.resupply = true;
          moveTo(sq, sq.mx - Math.sin(face) * 200, sq.mz - Math.cos(face) * 200, face);
          continue;
        }
        sq.resupply = false;
        const soft = live.filter((q) => !q.T.mounted || q.T.ranged);
        attack(sq, nearestOf(sq, soft.length ? soft : live));
      } else if (T.melee && T.melee.vsCav && !T.mounted) {
        // spearmen escort friendly shooters and intercept cavalry that comes close to them
        const shooters = mine.filter((q) => q.T.ranged && !q.T.mounted);
        const cav = live.filter((q) => q.T.mounted && shooters.some((s) => dist(s, q) < 140));
        if (cav.length) attack(sq, nearestOf(sq, cav));
        else if (shooters.length) {
          const s = nearestOf(sq, shooters), f = Math.atan2(near.mx - s.mx, near.mz - s.mz);
          moveTo(sq, s.mx + Math.sin(f) * 14 + Math.cos(f) * (sq.id % 2 ? 30 : -30), s.mz + Math.cos(f) * 14 - Math.sin(f) * (sq.id % 2 ? 30 : -30), f);
        } else attack(sq, near);
      } else if (T.mounted) {
        if (sim.time < this.cavWait) continue;
        let best = null, bs = -Infinity;
        for (const q of foes) {
          if (q.dead) continue;
          let s = -dist(sq, q);
          if (q.T.ranged && !q.T.mounted) s += 120;
          if (q.T.artillery) s += 160;
          if (q.T.melee && q.T.melee.vsCav && q.state !== 'rout') s -= 260;
          if (guarded(q)) s -= 180;
          if (q.state === 'rout') s += 60;
          s += (100 - q.morale) * 0.8;
          if (s > bs) { bs = s; best = q; }
        }
        if (best) attack(sq, best);
      } else attack(sq, near);
    }
  }
}
