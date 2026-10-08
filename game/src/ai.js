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
    const sim = this.sim, tm = sim.teams[this.team];
    const mine = sim.squads.filter((q) => q.team === this.team && !q.dead && q.state !== 'rout');
    const foes = sim.squads.filter((q) => q.team !== this.team && !q.dead);
    const live = foes.filter((q) => q.state !== 'rout');
    if (!live.length || !mine.length) return;
    const nearestOf = (sq, list) => list.reduce((b, q) => (!b || dist(sq, q) < dist(sq, b) ? q : b), null);
    const guarded = (q) => foes.some((g) => g !== q && g.T.melee?.vsCav && g.state !== 'rout' && dist(g, q) < 30);
    const attack = (sq, tg) => { if (tg && (sq.order.kind !== 'attack' || sq.order.target !== tg)) sim.order(sq, { kind: 'attack', target: tg }); };
    const moveTo = (sq, x, z, face) => {
      const o = sq.order;
      if (o.kind === 'move' && Math.hypot(o.x - x, o.z - z) < 10) return;
      sim.order(sq, { kind: 'move', x, z, face });
    };
    const army = mine.filter((q) => !q.T.commander);
    const cx = army.reduce((a, q) => a + q.mx, 0) / Math.max(1, army.length), cz = army.reduce((a, q) => a + q.mz, 0) / Math.max(1, army.length);
    const ex = live.reduce((a, q) => a + q.mx, 0) / live.length, ez = live.reduce((a, q) => a + q.mz, 0) / live.length;
    const toEnemy = Math.atan2(ex - cx, ez - cz);

    // war cry when the line is fighting or wavering
    const fighting = mine.filter((q) => q.lastEngaged > 0).length;
    if (tm.cmd && (fighting >= 2 || mine.some((q) => q.morale < 45))) sim.warCry(this.team);

    const enemyBroken = foes.reduce((a, q) => a + (q.state === 'rout' ? 0 : q.alive.length), 0) < sim.teams[1 - this.team].initial * 0.35;
    const soft = live.filter((q) => !q.T.mounted || sim.shoots(q));

    for (const sq of mine) {
      const T = sq.T, near = nearestOf(sq, live), d = dist(sq, near);
      const face = Math.atan2(near.mx - sq.mx, near.mz - sq.mz);

      if (T.commander) {
        const threat = live.filter((q) => dist(sq, q) < 70);
        if (threat.length) attack(sq, nearestOf(sq, threat));
        else if (enemyBroken) attack(sq, nearestOf(sq, soft.length ? soft : live));
        else moveTo(sq, cx - Math.sin(toEnemy) * 55, cz - Math.cos(toEnemy) * 55, toEnemy);
        continue;
      }
      if (sim.shoots(sq) && !T.mounted) {
        // foot archers: don't chase riders that out-range us
        if (near.T.mounted && sim.shoots(near) && near.T.ranged.range > T.ranged.range && d > T.ranged.range) { if (sq.order.kind !== 'idle') sim.order(sq, { kind: 'idle', face }); }
        else attack(sq, near);
        continue;
      }
      if (sim.shoots(sq) && T.mounted) {
        sq.skirmish = true;
        attack(sq, nearestOf(sq, soft.length ? soft : live));
        continue;
      }
      if (T.melee?.vsCav && !T.mounted) {
        // spearmen escort friendly archers and intercept cavalry that comes close to them
        const shooters = mine.filter((q) => sim.shoots(q) && !q.T.mounted);
        const cav = live.filter((q) => q.T.mounted && shooters.some((s) => dist(s, q) < 140));
        if (cav.length) attack(sq, nearestOf(sq, cav));
        else if (shooters.length) {
          const s = nearestOf(sq, shooters), f = Math.atan2(near.mx - s.mx, near.mz - s.mz), side = sq.id % 2 ? 30 : -30;
          moveTo(sq, s.mx + Math.sin(f) * 14 + Math.cos(f) * side, s.mz + Math.cos(f) * 14 - Math.sin(f) * side, f);
        } else attack(sq, near);
        continue;
      }
      if (!T.mounted) {
        const inf = live.filter((q) => !q.T.mounted);
        attack(sq, nearestOf(sq, inf.length ? inf : live));
        continue;
      }
      // melee cavalry (and horse archers out of arrows)
      if (sim.time < this.cavWait && T.speed < 10.5 && !sq.meleeMode) continue;
      if (sq.stam < 28 && d > 60) { moveTo(sq, sq.mx - Math.sin(face) * 50, sq.mz - Math.cos(face) * 50, face); continue; } // rest the horses
      let best = null, bs = -Infinity;
      for (const q of foes) {
        if (q.dead) continue;
        let s = -dist(sq, q);
        if (sim.shoots(q) && !q.T.mounted) s += 140;
        if (q.T.melee?.vsCav && q.state !== 'rout') s -= 260;
        if (q.T.shield) s -= 40;
        if (q.T.commander) s -= 120;
        if (guarded(q)) s -= 180;
        if (q.state === 'rout') s += 60;
        s += (100 - q.morale) * 0.8 + (100 - q.stam) * 0.4;
        if (s > bs) { bs = s; best = q; }
      }
      attack(sq, best);
    }
  }
}
