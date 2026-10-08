// Battle simulation. No rendering here, so it also runs headless in Node.
import { TYPES, FACTIONS, FORMATIONS, slotLocal } from './units.js';
import { groundY, terrainSpeed, HALF, SIZE, rng } from './world.js';

const CELL = 8, GW = Math.ceil(SIZE / CELL);
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const turn = (a, b, rate) => { const d = angDiff(a, b); return Math.abs(d) <= rate ? b : a + Math.sign(d) * rate; };
export const fwdOf = (th) => [Math.sin(th), Math.cos(th)];
export const rightOf = (th) => [-Math.cos(th), Math.sin(th)];
const ROUT_AT = (T) => (T.mounted ? 22 : 28);

export class Sim {
  constructor({ factions, seed = 1, armyScale = 1 }) {
    this.rand = rng(seed);
    this.time = 0;
    this.soldiers = []; this.squads = []; this.projectiles = []; this.events = [];
    this.result = null;
    this.teams = factions.map((key, id) => ({ id, key, faction: FACTIONS[key], initial: 0, alive: 0, kills: 0, losses: 0, routT: 0 }));
    this.teams.forEach((tm) => {
      const th = tm.id === 0 ? Math.PI : 0, baseZ = tm.id === 0 ? 330 : -330;
      const [fx, fz] = fwdOf(th), [rx, rz] = rightOf(th);
      for (const [key, lat, dep] of tm.faction.army) this.addSquad(tm.id, key, rx * lat + fx * dep, baseZ + rz * lat + fz * dep, th, armyScale);
    });
    this.cellCount = new Int32Array(GW * GW);
    this.cellStart = new Int32Array(GW * GW + 1);
    this.cellItems = new Int32Array(this.soldiers.length);
  }

  addSquad(team, key, cx, cz, face, scale) {
    const T = TYPES[key], n = Math.max(1, Math.round(T.count * scale));
    const sq = {
      id: this.squads.length, team, T, key, cx, cz, mx: cx, mz: cz, face, soldiers: [], alive: [],
      order: { kind: 'idle', face }, formation: T.skirmish ? 'loose' : 'line', files: null,
      morale: 100, state: 'idle', initial: n, kills: 0, skirmish: !!T.skirmish, fireTarget: null,
      moving: false, engaged: 0, errSum: 0, dead: false, lastHit: -99, banner: null, threat: null,
    };
    for (let i = 0; i < n; i++) {
      const [lx, lz] = slotLocal(sq, i, n), [fx, fz] = fwdOf(face), [rx, rz] = rightOf(face);
      const x = cx + rx * lx + fx * lz, z = cz + rz * lx + fz * lz;
      const s = {
        i: this.soldiers.length, team, sq, T, x, z, y: groundY(x, z), vx: 0, vz: 0, yaw: face,
        hp: T.hp, alive: true, reload: T.ranged ? this.rand() * T.ranged.reload : 0, meleeCd: 0, ammo: T.ranged?.ammo ?? Infinity,
        target: null, chargeT: 0, deadT: -1, fall: this.rand() < 0.5 ? -1 : 1, walk: this.rand() * 10,
        speed: 0, slot: i, shotT: -99, strikeT: -99, tint: 0.82 + this.rand() * 0.3,
      };
      sq.soldiers.push(s); sq.alive.push(s); this.soldiers.push(s);
    }
    sq.banner = sq.alive[Math.floor(Math.min(n, Math.ceil(n / T.ranks)) / 2)] || sq.alive[0];
    this.squads.push(sq);
    this.teams[team].initial += n; this.teams[team].alive += n;
    return sq;
  }

  // ---------- spatial grid ----------
  rebuildGrid() {
    const cc = this.cellCount, cs = this.cellStart, items = this.cellItems;
    cc.fill(0);
    for (const s of this.soldiers) if (s.alive) { s.cell = this.cellOf(s.x, s.z); cc[s.cell]++; }
    let acc = 0;
    for (let c = 0; c < cc.length; c++) { cs[c] = acc; acc += cc[c]; }
    cs[cc.length] = acc;
    const fill = cs.slice(0, cc.length);
    for (const s of this.soldiers) if (s.alive) items[fill[s.cell]++] = s.i;
  }
  cellOf(x, z) {
    const cx = Math.max(0, Math.min(GW - 1, Math.floor((x + HALF) / CELL))), cz = Math.max(0, Math.min(GW - 1, Math.floor((z + HALF) / CELL)));
    return cz * GW + cx;
  }
  forNear(x, z, r, fn) {
    const x0 = Math.max(0, Math.floor((x - r + HALF) / CELL)), x1 = Math.min(GW - 1, Math.floor((x + r + HALF) / CELL));
    const z0 = Math.max(0, Math.floor((z - r + HALF) / CELL)), z1 = Math.min(GW - 1, Math.floor((z + r + HALF) / CELL));
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
      const c = cz * GW + cx;
      for (let k = this.cellStart[c]; k < this.cellStart[c + 1]; k++) fn(this.soldiers[this.cellItems[k]]);
    }
  }
  nearestEnemy(s, r) {
    let best = null, bd = r * r;
    this.forNear(s.x, s.z, r, (o) => {
      if (o.team === s.team || !o.alive) return;
      const d = (o.x - s.x) ** 2 + (o.z - s.z) ** 2;
      if (d < bd) { bd = d; best = o; }
    });
    return best;
  }

  // ---------- orders (used by the player and the AI) ----------
  order(sq, o) {
    if (sq.dead || sq.state === 'rout') return;
    sq.order = o;
    if (o.kind === 'move') sq.files = o.files ?? sq.files;
  }

  // ---------- main step ----------
  step(dt) {
    if (this.result) return;
    this.time += dt;
    this.rebuildGrid();
    for (const sq of this.squads) if (!sq.dead) this.updateSquad(sq, dt);
    for (const sq of this.squads) { sq.engaged = 0; sq.errSum = 0; }
    for (const s of this.soldiers) if (s.alive) this.updateSoldier(s, dt);
    this.updateProjectiles(dt);
    this.checkResult(dt);
  }

  updateSquad(sq, dt) {
    const al = sq.alive, T = sq.T;
    if (!al.length) { sq.dead = true; sq.state = 'dead'; return; }
    let mx = 0, mz = 0;
    for (const s of al) { mx += s.x; mz += s.z; }
    sq.mx = mx / al.length; sq.mz = mz / al.length;

    // nearest enemy squad, and nearest melee threat
    let near = null, nd = Infinity, threat = null, td = Infinity;
    for (const o of this.squads) {
      if (o.dead || o.team === sq.team) continue;
      const d = Math.hypot(o.mx - sq.mx, o.mz - sq.mz);
      if (o.state !== 'rout' && d < nd) { nd = d; near = o; }
      if (o.state !== 'rout' && o.T.melee && !o.T.ranged && d < td) { td = d; threat = o; }
      // shooters with a shorter reach are also something to back away from
      if (T.ranged && o.state !== 'rout' && o.T.ranged && !o.T.artillery && o.T.ranged.range < T.ranged.range && d < o.T.ranged.range + 8 && d - 30 < td) { td = d - 30; threat = o; }
    }
    sq.near = near; sq.nearD = nd;

    // morale
    const inFight = sq.engaged > 0 || this.time - sq.lastHit < 4;
    if (sq.state === 'rout') {
      if (nd > 90) sq.morale += 7 * dt;
      if (sq.morale >= 60 && al.length >= sq.initial * 0.15) { sq.state = 'idle'; sq.order = { kind: 'idle', face: sq.face }; }
    } else {
      if (!inFight && nd > 120) sq.morale = Math.min(100, sq.morale + 1.5 * dt);
      if (sq.morale < ROUT_AT(T)) { sq.state = 'rout'; sq.fireTarget = null; this.events.push({ k: 'rout', sq }); }
    }

    let gx = sq.cx, gz = sq.cz, faceGoal = sq.order.face ?? sq.face, speedMul = FORMATIONS[sq.formation].speed;
    sq.fireTarget = null;
    const o = sq.order;
    if (sq.state === 'rout') {
      const home = sq.team === 0 ? HALF - 60 : -HALF + 60;
      const ax = near ? sq.mx - near.mx : 0, az = near ? sq.mz - near.mz : 1, al2 = Math.hypot(ax, az) || 1;
      gx = sq.mx + (ax / al2) * 40; gz = sq.mz * 0.5 + home * 0.5 + (az / al2) * 40;
      speedMul = 1.15; faceGoal = Math.atan2(gx - sq.cx, gz - sq.cz);
    } else if (o.kind === 'move') {
      gx = o.x; gz = o.z;
      if (Math.hypot(gx - sq.cx, gz - sq.cz) < 1.5) sq.order = { kind: 'idle', face: o.face ?? sq.face };
      faceGoal = o.face ?? sq.face;
    } else if (o.kind === 'attack') {
      const tg = o.target;
      if (!tg || tg.dead || (tg.state === 'rout' && Math.hypot(tg.mx - sq.mx, tg.mz - sq.mz) > 120)) sq.order = { kind: 'idle', face: sq.face };
      else {
        const dx = tg.mx - sq.mx, dz = tg.mz - sq.mz, d = Math.hypot(dx, dz);
        faceGoal = Math.atan2(dx, dz);
        if (T.ranged) {
          const R = T.ranged;
          const stand = sq.skirmish ? 0.9 : 0.8;
          if (d > R.range * 0.95) { gx = sq.cx + (dx / d) * (d - R.range * stand); gz = sq.cz + (dz / d) * (d - R.range * stand); }
          else if (R.minRange && d < R.minRange) { gx = sq.cx - (dx / d) * 15; gz = sq.cz - (dz / d) * 15; }
          else { gx = sq.cx; gz = sq.cz; sq.fireTarget = tg; }
        } else { gx = tg.mx; gz = tg.mz; }
      }
    }
    if (sq.state !== 'rout' && sq.order.kind !== 'attack') {
      // auto-engage when idle
      if (T.ranged && near && nd <= T.ranged.range && nd >= (T.ranged.minRange || 0)) sq.fireTarget = near;
      else if (!T.ranged && T.melee && near && sq.order.kind === 'idle' && nd < (T.mounted ? 70 : 40)) sq.order = { kind: 'attack', target: near, auto: true };
    }
    if (T.ranged && !sq.fireTarget && sq.state !== 'rout' && near && nd <= T.ranged.range && (T.mounted || sq.order.kind !== 'move')) sq.fireTarget = near;

    // качып атуу: horse archers back away from melee threats while shooting
    sq.kiting = false;
    if (sq.skirmish && sq.state !== 'rout' && threat && td < (threat.T.mounted ? 55 : threat.T.ranged ? threat.T.ranged.range - 22 : 28)) {
      const ax = sq.mx - threat.mx, az = sq.mz - threat.mz, l = Math.hypot(ax, az) || 1;
      gx = sq.cx + (ax / l) * 35; gz = sq.cz + (az / l) * 35; speedMul = 1; sq.kiting = true;
    }

    // keep the centre with the fight once soldiers are engaged
    if (sq.lastEngaged > al.length * 0.25) { sq.cx += (sq.mx - sq.cx) * Math.min(1, dt * 2); sq.cz += (sq.mz - sq.cz) * Math.min(1, dt * 2); gx = sq.cx; gz = sq.cz; }

    const dx = gx - sq.cx, dz = gz - sq.cz, d = Math.hypot(dx, dz);
    const cohesion = sq.lastErr > (T.mounted ? 9 : 4.5) ? 0.35 : 1;
    sq.moving = d > 0.6;
    if (sq.moving) {
      const v = Math.min(d, T.speed * speedMul * cohesion * terrainSpeed(sq.cx, sq.cz) * dt);
      sq.cx += (dx / d) * v; sq.cz += (dz / d) * v;
      if (sq.kiting || (o.kind === 'move' && d > 12 && !sq.fireTarget)) faceGoal = Math.atan2(dx, dz);
    }
    sq.cx = Math.max(-HALF + 20, Math.min(HALF - 20, sq.cx)); sq.cz = Math.max(-HALF + 20, Math.min(HALF - 20, sq.cz));
    sq.face = turn(sq.face, faceGoal, (T.mounted ? 2 : 1.1) * dt);
  }

  updateSoldier(s, dt) {
    const sq = s.sq, T = s.T, n = sq.alive.length;
    const [lx, lz] = slotLocal(sq, s.slot, n), [fx, fz] = fwdOf(sq.face), [rx, rz] = rightOf(sq.face);
    let gx = sq.cx + rx * lx + fx * lz, gz = sq.cz + rz * lx + fz * lz;
    s.meleeCd -= dt;

    // melee
    let foe = null;
    if (sq.state !== 'rout' && T.melee) {
      const charging = sq.order.kind === 'attack' && !T.ranged;
      const r = charging ? (T.mounted ? 14 : 9) : sq.kiting ? 0 : T.mounted ? 6 : 4.5;
      if (r > 0) foe = s.target && s.target.alive && (s.target.x - s.x) ** 2 + (s.target.z - s.z) ** 2 < (r * 1.6) ** 2 ? s.target : this.nearestEnemy(s, r);
    }
    s.target = foe;
    let stand = false;
    if (foe) {
      sq.engaged++;
      const d = Math.hypot(foe.x - s.x, foe.z - s.z), reach = T.melee.reach + (foe.T.mounted ? 0.6 : 0);
      gx = foe.x; gz = foe.z;
      if (d <= reach + 0.3) { stand = true; if (s.meleeCd <= 0) this.strike(s, foe); }
    } else sq.errSum += Math.hypot(gx - s.x, gz - s.z);

    // shooting
    if (!foe && T.ranged && sq.fireTarget && sq.state !== 'rout') {
      s.reload -= dt;
      const canFire = T.mounted || !sq.moving;
      if (canFire && s.reload <= 0 && s.ammo > 0) {
        const ft = sq.fireTarget.alive;
        const tgt = ft.length ? ft[Math.floor(this.rand() * ft.length)] : null;
        const d = tgt ? Math.hypot(tgt.x - s.x, tgt.z - s.z) : Infinity;
        if (tgt && d <= T.ranged.range && d >= (T.ranged.minRange || 0)) { this.fire(s, tgt, d); s.ammo--; s.reload = T.ranged.reload * (0.9 + this.rand() * 0.2); }
        else s.reload = 0.4;
      }
    } else if (T.ranged && s.reload > 0) s.reload -= dt * 0.5;
    if (T.ranged?.ammo && sq.nearD > 160 && s.ammo < T.ranged.ammo) s.ammo = Math.min(T.ranged.ammo, s.ammo + dt * 0.6);

    // movement
    let dvx = 0, dvz = 0;
    if (!stand) {
      const dx = gx - s.x, dz = gz - s.z, d = Math.hypot(dx, dz);
      if (d > 0.15) {
        let v = T.speed * terrainSpeed(s.x, s.z);
        if (sq.state === 'rout') v *= 1.15;
        if (!foe && d > 3) v *= 1.3;
        if (!foe && d < 2) v *= d / 2;
        dvx = (dx / d) * v; dvz = (dz / d) * v;
      }
    }
    // separation from neighbours
    const rad = T.mounted ? 2.1 : 0.95;
    let px = 0, pz = 0;
    this.forNear(s.x, s.z, rad, (o) => {
      if (o === s || !o.alive) return;
      const ox = s.x - o.x, oz = s.z - o.z, d2 = ox * ox + oz * oz, rr = (rad + (o.T.mounted ? 2.1 : 0.95)) * 0.5;
      if (d2 < rr * rr && d2 > 1e-6) { const d = Math.sqrt(d2), k = (rr - d) / rr; px += (ox / d) * k; pz += (oz / d) * k; }
    });
    const k = Math.min(1, dt * (T.mounted ? 3 : 6));
    s.vx += (dvx - s.vx) * k + px * 4 * dt; s.vz += (dvz - s.vz) * k + pz * 4 * dt;
    s.x = Math.max(-HALF + 2, Math.min(HALF - 2, s.x + s.vx * dt));
    s.z = Math.max(-HALF + 2, Math.min(HALF - 2, s.z + s.vz * dt));
    s.y = groundY(s.x, s.z);
    s.speed = Math.hypot(s.vx, s.vz);
    s.walk += s.speed * dt;

    let yawGoal = sq.face;
    if (foe) yawGoal = Math.atan2(foe.x - s.x, foe.z - s.z);
    else if (sq.fireTarget && (T.mounted || !sq.moving) && !sq.kiting) yawGoal = Math.atan2(sq.fireTarget.mx - s.x, sq.fireTarget.mz - s.z);
    else if (s.speed > 0.8) yawGoal = Math.atan2(s.vx, s.vz);
    s.yaw = turn(s.yaw, yawGoal, 5 * dt);
    if (T.mounted) s.chargeT = s.speed > 0.75 * T.speed ? s.chargeT + dt : Math.max(0, s.chargeT - dt * 2);
  }

  strike(s, foe) {
    const T = s.T;
    let dmg = T.melee.dmg;
    if (foe.T.mounted && T.melee.vsCav) dmg *= T.melee.vsCav;
    if (T.mounted && s.chargeT > 1.2) {
      dmg *= T.melee.charge || 1.5; s.chargeT = 0;
      const fsq = foe.sq;
      fsq.morale -= foe.T.melee?.vsCav || fsq.formation === 'square' ? 0.3 : 1.3; // charge shock
      if (foe.T.melee && foe.T.melee.vsCav && fsq.state !== 'rout') { this.hurt(s, 30, foe); dmg *= 0.4; }
      if (fsq.formation === 'square') dmg *= 0.3;
    }
    if (foe.sq.state === 'rout') dmg *= 1.5;
    const sqArmor = foe.sq.formation === 'square' && T.mounted ? 4 : 0;
    dmg = Math.max(1, dmg - foe.T.armor - sqArmor) * (0.85 + this.rand() * 0.3);
    s.meleeCd = T.melee.rate * (0.85 + this.rand() * 0.3);
    s.strikeT = this.time;
    if (s.alive) this.hurt(foe, dmg, s);
  }

  fire(s, tgt, d) {
    const R = s.T.ranged, u = Math.min(1, d / R.range);
    let acc = R.acc[0] + (R.acc[1] - R.acc[0]) * u;
    if (tgt.T.mounted) acc *= 1.1;
    s.shotT = this.time;
    if (R.kind === 'musket') {
      const hit = this.rand() < acc;
      if (hit) this.hurt(tgt, Math.max(1, R.dmg * (0.8 + this.rand() * 0.4) - tgt.T.armor), s);
      this.events.push({ k: 'musket', x: s.x, y: s.y, z: s.z, yaw: s.yaw, hit, tx: tgt.x, tz: tgt.z });
    } else if (R.kind === 'arrow') {
      const hit = this.rand() < acc, miss = hit ? 0 : 2 + this.rand() * 5, a = this.rand() * 6.283;
      const tx = tgt.x + Math.cos(a) * miss + tgt.vx * 0.6, tz = tgt.z + Math.sin(a) * miss + tgt.vz * 0.6;
      this.projectiles.push({ k: 'arrow', team: s.team, src: s, tgt, hit, dmg: R.dmg, t: 0, T: d / 38 + 0.25,
        x0: s.x, y0: s.y + 2.2, z0: s.z, x1: tx, y1: groundY(tx, tz) + (hit ? 1.2 : 0), z1: tz, arc: d * 0.12 });
    } else {
      const spread = d * (1 - acc) * 0.12, a = this.rand() * 6.283, r = Math.sqrt(this.rand()) * spread;
      const tx = tgt.x + Math.cos(a) * r, tz = tgt.z + Math.sin(a) * r;
      this.projectiles.push({ k: 'ball', team: s.team, src: s, dmg: R.dmg, splash: R.splash, t: 0, T: d / 120 + 0.6,
        x0: s.x + Math.sin(s.yaw) * 1.6, y0: s.y + 1.1, z0: s.z + Math.cos(s.yaw) * 1.6, x1: tx, y1: groundY(tx, tz), z1: tz, arc: d * 0.08 });
      this.events.push({ k: 'cannon', x: s.x, y: s.y, z: s.z, yaw: s.yaw });
    }
  }

  updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projectiles) {
      p.t += dt;
      if (p.t < p.T) { keep.push(p); continue; }
      if (p.k === 'arrow') { if (p.hit && p.tgt.alive) this.hurt(p.tgt, Math.max(1, p.dmg * (0.8 + this.rand() * 0.4) - p.tgt.T.armor * 0.5), p.src); }
      else {
        this.events.push({ k: 'impact', x: p.x1, y: p.y1, z: p.z1 });
        const hitSq = new Set();
        this.forNear(p.x1, p.z1, p.splash, (o) => {
          if (!o.alive || o.team === p.team) return;
          const d = Math.hypot(o.x - p.x1, o.z - p.z1);
          if (d > p.splash) return;
          hitSq.add(o.sq);
          this.hurt(o, p.dmg * Math.pow(1 - d / p.splash, 0.7) * (0.8 + this.rand() * 0.4), p.src);
        });
        for (const sq of hitSq) sq.morale -= 1.5;
      }
    }
    this.projectiles = keep;
  }

  hurt(t, dmg, by) {
    if (!t.alive) return;
    t.hp -= dmg; t.sq.lastHit = this.time;
    if (t.hp <= 0) this.kill(t, by);
  }

  kill(s, by) {
    s.alive = false; s.deadT = this.time; s.target = null;
    const sq = s.sq, idx = sq.alive.indexOf(s);
    if (idx >= 0) { sq.alive.splice(idx, 1); for (let i = idx; i < sq.alive.length; i++) sq.alive[i].slot = i; }
    sq.morale -= (100 / sq.initial) * 1.4 + 0.3;
    if (sq.banner === s) sq.banner = sq.alive[Math.floor(sq.alive.length / 2)] || null;
    this.teams[s.team].alive--; this.teams[s.team].losses++;
    if (by) { this.teams[by.team].kills++; by.sq.kills++; }
    this.events.push({ k: 'death', s });
  }

  checkResult(dt) {
    for (const sq of this.squads) { sq.lastEngaged = sq.engaged; sq.lastErr = sq.alive.length ? sq.errSum / sq.alive.length : 0; }
    for (const tm of this.teams) {
      const standing = this.squads.filter((q) => q.team === tm.id && !q.dead && q.state !== 'rout').reduce((a, q) => a + q.alive.length, 0);
      tm.standing = standing;
      tm.routT = standing === 0 ? tm.routT + dt : 0;
      if (tm.alive < tm.initial * 0.08 || tm.routT > 12) {
        this.result = { winner: 1 - tm.id, loser: tm.id, time: this.time };
        this.events.push({ k: 'end', result: this.result });
        return;
      }
    }
  }
}
