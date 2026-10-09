// Battle simulation. No rendering here, so it also runs headless in Node.
// Every unit belongs to a squad. A unit trained on its own is a "solo" squad of one;
// a yuzboshi (officer) can merge up to 100 solos of one type into a real formation.
import { TYPES, FACTIONS, FORMATIONS, slotLocal, defaultFormation } from './units.js';
import { groundY, terrainSpeed, HALF, SIZE, rng } from './world.js';

const CELL = 8, GW = Math.ceil(SIZE / CELL);
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const turn = (a, b, rate) => { const d = angDiff(a, b); return Math.abs(d) <= rate ? b : a + Math.sign(d) * rate; };
export const fwdOf = (th) => [Math.sin(th), Math.cos(th)];
export const rightOf = (th) => [-Math.cos(th), Math.sin(th)];
const ROUT_AT = (T) => (T.mounted ? 22 : 28);
export const tiredK = (st) => (st >= 30 ? 1 : 0.55 + (0.45 * st) / 30); // speed factor from stamina
export const CRY_COOLDOWN = 75;
export const MAX_SQUAD = 100;
const AURA = 90; // commander morale aura, m
const VS_BUILDING = { musket: 0.3, arrow: 0.12, ball: 3, melee: 0.35 };

// Closest point of an axis-aligned building rectangle to (x, z).
export const edgePoint = (b, x, z) => [Math.max(b.x - b.w / 2, Math.min(b.x + b.w / 2, x)), Math.max(b.z - b.d / 2, Math.min(b.z + b.d / 2, z))];
// Where along the segment (ox,oz)+t(dx,dz), t in [0,1], it enters a box of half-size hw×hd at the origin; null if it misses.
const segBox = (ox, oz, dx, dz, hw, hd) => {
  let t0 = 0, t1 = 1;
  for (const [p, d, h] of [[ox, dx, hw], [oz, dz, hd]]) {
    if (Math.abs(d) < 1e-9) { if (Math.abs(p) >= h) return null; continue; }
    let a = (-h - p) / d, b = (h - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  return t0;
};

export class Sim {
  constructor({ factions, seed = 1, armyScale = 1, mode = 'battle' }) {
    this.rand = rng(seed);
    this.mode = mode;
    this.time = 0;
    this.soldiers = []; this.squads = []; this.projectiles = []; this.events = []; this.buildings = [];
    this.result = null;
    this.teams = factions.map((key, id) => ({ id, key, faction: FACTIONS[key], initial: 0, alive: 0, kills: 0, losses: 0, routT: 0, cmd: null, cmdDead: false, cryReady: 15 }));
    if (mode === 'battle') this.teams.forEach((tm) => {
      const th = tm.id === 0 ? Math.PI : 0, baseZ = tm.id === 0 ? 330 : -330;
      const [fx, fz] = fwdOf(th), [rx, rz] = rightOf(th);
      for (const [key, lat, dep] of tm.faction.army) this.addSquad(tm.id, key, rx * lat + fx * dep, baseZ + rz * lat + fz * dep, th, { scale: armyScale });
    });
    this.cellCount = new Int32Array(GW * GW);
    this.cellStart = new Int32Array(GW * GW + 1);
    this.cellItems = new Int32Array(Math.max(256, this.soldiers.length));
  }

  newSquad(team, key, cx, cz, face) {
    const T = TYPES[key];
    const sq = {
      id: this.squads.length, team, T, key, cx, cz, mx: cx, mz: cz, face, soldiers: [], alive: [],
      order: { kind: 'idle', face }, formation: defaultFormation(T), files: null, solo: false, officer: null,
      morale: 100, stam: 100, ammo: 0, state: 'idle', initial: 0, kills: 0, skirmish: !!T.skirmish, meleeMode: false,
      fireTarget: null, fireB: null, moving: false, running: false, engaged: 0, errSum: 0, dead: false, lastHit: -99, shoutT: -99, banner: null,
    };
    this.squads.push(sq);
    return sq;
  }
  newSoldier(team, sq, T, x, z, face, isCmd = false) {
    const s = {
      i: this.soldiers.length, team, sq, T, x, z, y: groundY(x, z), vx: 0, vz: 0, yaw: face,
      hp: T.hp * (isCmd ? 1.4 : 1), alive: true, reload: T.ranged ? this.rand() * T.ranged.reload : 0, meleeCd: 0,
      ammo: T.ranged?.ammo ?? 0, stam: 100, isCmd, model: isCmd ? T.commander.model : T.model,
      target: null, chargeT: 0, deadT: -1, fall: this.rand() < 0.5 ? -1 : 1, walk: this.rand() * 10,
      speed: 0, slot: 0, shotT: -99, strikeT: -99, tint: isCmd ? 1 : 0.82 + this.rand() * 0.3,
    };
    this.soldiers.push(s);
    this.teams[team].initial++; this.teams[team].alive++;
    this.events.push({ k: 'spawn', s });
    return s;
  }

  // A full squad (battle mode, enemy camp) laid out in its formation.
  addSquad(team, key, cx, cz, face, { scale = 1, count } = {}) {
    const T = TYPES[key], n = count ?? Math.max(1, Math.round(T.count * scale));
    const sq = this.newSquad(team, key, cx, cz, face);
    for (let i = 0; i < n; i++) {
      const [lx, lz] = slotLocal(sq, i, n), [fx, fz] = fwdOf(face), [rx, rz] = rightOf(face);
      const s = this.newSoldier(team, sq, T, cx + rx * lx + fx * lz, cz + rz * lx + fz * lz, face, !!(T.commander && i === 0));
      s.slot = i; sq.soldiers.push(s); sq.alive.push(s);
    }
    sq.initial = n;
    sq.banner = T.commander ? sq.alive[0] : sq.alive[Math.floor(Math.min(n, Math.ceil(n / T.ranks)) / 2)] || sq.alive[0];
    if (T.commander) this.teams[team].cmd = sq.alive[0];
    return sq;
  }

  // One freshly trained unit.
  spawnUnit(team, key, x, z, face = 0) {
    const sq = this.newSquad(team, key, x, z, face);
    const s = this.newSoldier(team, sq, TYPES[key], x, z, face);
    sq.soldiers.push(s); sq.alive.push(s); sq.initial = 1; sq.solo = true; sq.formation = 'line';
    return sq;
  }

  // Officer merges up to 100 solos of the most common type among `cands` into a formation.
  formSquad(offSq, cands) {
    const off = offSq?.alive[0];
    if (!off || !off.T.officer || !offSq.solo) return null;
    const pool = cands.filter((q) => q.solo && !q.dead && q.team === off.team && !q.T.officer && !q.T.civil && !q.T.artillery && q.state !== 'rout');
    const byKey = {};
    for (const q of pool) (byKey[q.key] ||= []).push(q);
    const key = Object.keys(byKey).sort((a, b) => byKey[b].length - byKey[a].length)[0];
    if (!key || byKey[key].length < 2) return null;
    const list = byKey[key].sort((a, b) => Math.hypot(a.mx - off.x, a.mz - off.z) - Math.hypot(b.mx - off.x, b.mz - off.z)).slice(0, MAX_SQUAD - 1);
    let fx = 0, fz = 0;
    for (const q of list) { fx += q.mx; fz += q.mz; }
    fx /= list.length; fz /= list.length;
    const sq = this.newSquad(off.team, key, fx, fz, Math.atan2(fx - off.x, fz - off.z) + Math.PI);
    sq.officer = off;
    for (const q of [offSq, ...list]) {
      for (const s of q.alive) { s.sq = sq; sq.soldiers.push(s); sq.alive.push(s); }
      q.alive = []; q.dead = true; q.merged = true; q.state = 'dead';
    }
    sq.alive.forEach((s, i) => { s.slot = i; });
    sq.initial = sq.alive.length; sq.banner = off;
    this.events.push({ k: 'formed', sq });
    return sq;
  }
  disband(sq) {
    if (sq.solo || sq.dead) return [];
    const out = [];
    for (const s of sq.alive) {
      const q = this.newSquad(sq.team, s.T.key, s.x, s.z, s.yaw);
      s.sq = q; s.slot = 0; q.soldiers.push(s); q.alive.push(s); q.initial = 1; q.solo = true; q.formation = 'line';
      out.push(q);
    }
    sq.alive = []; sq.dead = true; sq.merged = true; sq.state = 'dead';
    return out;
  }

  // ---------- spatial grid ----------
  rebuildGrid() {
    const cc = this.cellCount, cs = this.cellStart;
    if (this.cellItems.length < this.soldiers.length) this.cellItems = new Int32Array(this.soldiers.length * 2);
    const items = this.cellItems;
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
  nearestEnemy(s, r, skipWorkers = false) {
    let best = null, bd = r * r;
    this.forNear(s.x, s.z, r, (o) => {
      if (o.team === s.team || !o.alive || (skipWorkers && o.T.civil)) return;
      const d = (o.x - s.x) ** 2 + (o.z - s.z) ** 2;
      if (d < bd) { bd = d; best = o; }
    });
    return best;
  }

  // ---------- commands (player and AI) ----------
  order(sq, o) {
    if (sq.dead || sq.state === 'rout') return;
    sq.order = o;
    if (o.kind === 'move') sq.files = o.files ?? sq.files;
  }
  shoots(sq) { return !!sq.T.ranged && !sq.meleeMode; }
  setMelee(sq, on) {
    if (!sq.T.ranged || sq.T.artillery) return;
    sq.meleeMode = on || (sq.T.ranged.ammo != null && sq.ammo < 1);
    if (sq.order.kind === 'attack') sq.order = { ...sq.order };
  }
  warCry(team) {
    const tm = this.teams[team], c = tm.cmd;
    if (!c || !c.alive || this.time < tm.cryReady) return false;
    tm.cryReady = this.time + CRY_COOLDOWN;
    for (const q of this.squads) {
      if (q.team !== team || q.dead || Math.hypot(q.mx - c.x, q.mz - c.z) > 130) continue;
      q.morale = Math.min(100, q.morale + 25);
      if (q.state === 'rout' && q.morale >= 45) { q.state = 'idle'; q.order = { kind: 'idle', face: q.face }; }
      for (const s of q.alive) s.stam = Math.min(100, s.stam + 25);
    }
    this.events.push({ k: 'cry', team, x: c.x, z: c.z });
    return true;
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
    const al = sq.alive, T = sq.T, tm = this.teams[sq.team];
    if (!al.length) { sq.dead = true; sq.state = 'dead'; return; }
    let mx = 0, mz = 0, st = 0, am = 0;
    for (const s of al) { mx += s.x; mz += s.z; st += s.stam; am += s.ammo; }
    sq.mx = mx / al.length; sq.mz = mz / al.length; sq.stam = st / al.length; sq.ammo = am;
    if (T.ranged?.ammo != null && !sq.meleeMode && am < 1) { sq.meleeMode = true; this.events.push({ k: 'noAmmo', sq }); }
    const shoots = this.shoots(sq);
    const cmd = tm.cmd;
    sq.aura = !!(cmd && cmd.alive && Math.hypot(cmd.x - sq.mx, cmd.z - sq.mz) < AURA);

    // nearest enemy squad, and the nearest thing a skirmisher should back away from
    let near = null, nd = Infinity, threat = null, td = Infinity;
    if (sq.solo) {
      const e = this.nearestEnemy(al[0], 170, T.civil);
      if (e && e.sq.state !== 'rout') { near = e.sq; nd = Math.hypot(e.x - sq.mx, e.z - sq.mz); if (!this.shoots(near) && near.T.melee) { threat = near; td = nd; } }
    } else for (const o of this.squads) {
      if (o.dead || o.team === sq.team || o.state === 'rout') continue;
      const d = Math.hypot(o.mx - sq.mx, o.mz - sq.mz);
      if (d < nd) { nd = d; near = o; }
      const oShoots = this.shoots(o);
      if (!oShoots && o.T.melee && d < td) { td = d; threat = o; }
      if (shoots && oShoots && o.T.ranged.range < T.ranged.range && d < o.T.ranged.range + 8 && d - 30 < td) { td = d - 30; threat = o; }
    }
    sq.near = near; sq.nearD = nd;

    // morale (solos and workers fight on; formations can break)
    const inFight = sq.engaged > 0 || this.time - sq.lastHit < 4;
    if (sq.solo) sq.morale = 100;
    else if (sq.state === 'rout') {
      if (nd > 90) sq.morale += (7 + (sq.aura ? 3 : 0)) * dt;
      if (sq.morale >= 60 && al.length >= sq.initial * 0.15) { sq.state = 'idle'; sq.order = { kind: 'idle', face: sq.face }; }
    } else {
      if (!inFight && nd > 120) sq.morale = Math.min(100, sq.morale + (1.5 + (sq.aura ? 2 : 0)) * dt);
      if (sq.morale < ROUT_AT(T)) { sq.state = 'rout'; sq.fireTarget = null; this.events.push({ k: 'rout', sq }); }
    }

    let gx = sq.cx, gz = sq.cz, faceGoal = sq.order.face ?? sq.face, speedMul = FORMATIONS[sq.formation].speed;
    sq.fireTarget = null; sq.fireB = null;
    const o = sq.order;
    if (sq.state === 'rout') {
      const home = sq.team === 0 ? HALF - 60 : -HALF + 60;
      const ax = near ? sq.mx - near.mx : 0, az = near ? sq.mz - near.mz : 1, l = Math.hypot(ax, az) || 1;
      gx = sq.mx + (ax / l) * 40; gz = sq.mz * 0.5 + home * 0.5 + (az / l) * 40;
      speedMul = 1.1; faceGoal = Math.atan2(gx - sq.cx, gz - sq.cz);
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
        if (shoots) {
          const R = T.ranged, stand = sq.skirmish ? 0.9 : 0.85;
          if (d > R.range * 0.95) { gx = sq.cx + (dx / d) * (d - R.range * stand); gz = sq.cz + (dz / d) * (d - R.range * stand); }
          else if (R.minRange && d < R.minRange) { gx = sq.cx - (dx / d) * 15; gz = sq.cz - (dz / d) * 15; }
          else { gx = sq.cx; gz = sq.cz; sq.fireTarget = tg; }
        } else { gx = tg.mx; gz = tg.mz; }
      }
    } else if (o.kind === 'attackB') {
      const b = o.b;
      if (!b || b.dead) sq.order = { kind: 'idle', face: sq.face };
      else {
        const [ex, ez] = edgePoint(b, sq.mx, sq.mz), dx = ex - sq.mx, dz = ez - sq.mz, d = Math.hypot(dx, dz) || 1;
        faceGoal = Math.atan2(b.x - sq.mx, b.z - sq.mz);
        if (shoots) {
          const R = T.ranged;
          if (d > R.range * 0.9) { gx = sq.cx + (dx / d) * (d - R.range * 0.8); gz = sq.cz + (dz / d) * (d - R.range * 0.8); }
          else { gx = sq.cx; gz = sq.cz; sq.fireB = b; }
        } else if (d > 6) { gx = sq.cx + (dx / d) * (d - 4); gz = sq.cz + (dz / d) * (d - 4); }
        else { gx = sq.cx; gz = sq.cz; }
      }
    }
    if (sq.state !== 'rout' && sq.order.kind !== 'attack' && !T.civil) {
      if (shoots && near && nd <= T.ranged.range && nd >= (T.ranged.minRange || 0)) sq.fireTarget = near;
      else if (!shoots && T.melee && near && sq.order.kind === 'idle' && nd < (T.mounted ? 70 : 40)) sq.order = { kind: 'attack', target: near, auto: true };
    }
    if (shoots && !sq.fireTarget && !sq.fireB && sq.state !== 'rout' && near && nd <= T.ranged.range && (T.mounted || sq.order.kind !== 'move')) sq.fireTarget = near;

    // качып атуу: horse archers back away from melee threats while shooting
    sq.kiting = false;
    if (sq.skirmish && shoots && sq.state !== 'rout' && threat && td < (threat.T.mounted ? 55 : this.shoots(threat) ? threat.T.ranged.range - 22 : 28)) {
      const ax = sq.mx - threat.mx, az = sq.mz - threat.mz, l = Math.hypot(ax, az) || 1;
      gx = sq.cx + (ax / l) * 35; gz = sq.cz + (az / l) * 35; speedMul = 1; sq.kiting = true;
    }

    // walk or run: charges, flight and kiting run; double right-click orders run all the way
    const oo = sq.order;
    let running = sq.state === 'rout' || sq.kiting || !!oo.run;
    if (oo.kind === 'attack' && oo.target && !oo.target.dead && !shoots) {
      const dd = Math.hypot(oo.target.mx - sq.mx, oo.target.mz - sq.mz);
      if (dd < (T.mounted ? 80 : 40)) {
        running = true;
        if (!sq.solo && this.time - sq.shoutT > 25 && sq.state !== 'rout') { sq.shoutT = this.time; this.events.push({ k: 'shout', team: sq.team, x: sq.mx, z: sq.mz, n: al.length }); }
      }
    }
    sq.running = running;

    sq.aimX = gx; sq.aimZ = gz; // solo units steer around buildings towards this
    // keep the centre with the fight once soldiers are engaged
    if (sq.solo || sq.lastEngaged > al.length * 0.25) {
      const k = sq.solo ? 1 : Math.min(1, dt * 2);
      if (!sq.solo || sq.lastEngaged > 0) { sq.cx += (sq.mx - sq.cx) * k; sq.cz += (sq.mz - sq.cz) * k; }
      if (sq.lastEngaged > 0) { gx = sq.cx; gz = sq.cz; }
    }

    const dx = gx - sq.cx, dz = gz - sq.cz, d = Math.hypot(dx, dz);
    const cohesion = !sq.solo && sq.lastErr > (T.mounted ? 9 : 4.5) ? 0.35 : 1;
    sq.moving = d > 0.6;
    if (sq.moving) {
      const v = Math.min(d, T.speed * (running ? 1 : T.walk) * speedMul * cohesion * tiredK(sq.stam) * terrainSpeed(sq.cx, sq.cz) * dt * (sq.solo ? 1.3 : 1));
      sq.cx += (dx / d) * v; sq.cz += (dz / d) * v;
      if (sq.kiting || (o.kind === 'move' && d > 12 && !sq.fireTarget)) faceGoal = Math.atan2(dx, dz);
    }
    sq.cx = Math.max(-HALF + 20, Math.min(HALF - 20, sq.cx)); sq.cz = Math.max(-HALF + 20, Math.min(HALF - 20, sq.cz));
    sq.face = turn(sq.face, faceGoal, (T.mounted ? 2 : 1.1) * dt);
  }

  detour(x, z, gx, gz, rad) {
    if (Math.hypot(gx - x, gz - z) < 1) return null;
    let hit = null, ht = 1;
    for (const b of this.buildings) {
      if (b.walk || b.dead) continue;
      const hw = b.w / 2 + rad * 0.6 + 0.3, hd = b.d / 2 + rad * 0.6 + 0.3;
      if (Math.abs(gx - b.x) < hw && Math.abs(gz - b.z) < hd) continue; // heading to this very building
      const t = segBox(x - b.x, z - b.z, gx - x, gz - z, hw, hd);
      if (t != null && t < ht) { ht = t; hit = b; }
    }
    if (!hit) return null;
    // the inner box is a little smaller than the solid footprint, so a unit pressed against a wall still sees the corners on its side
    const m = rad * 0.6 + 1.2, hw = hit.w / 2 + m, hd = hit.d / 2 + m, iw = hit.w / 2 + rad * 0.6 - 0.35, id = hit.d / 2 + rad * 0.6 - 0.35;
    let best = null, cost = Infinity;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const cx = hit.x + sx * hw, cz = hit.z + sz * hd;
      if (Math.hypot(cx - x, cz - z) < 1.2) continue; // already here: go on to the next corner
      if (segBox(x - hit.x, z - hit.z, cx - x, cz - z, iw, id) != null) continue; // corner hidden behind the building
      const c = Math.hypot(cx - x, cz - z) + Math.hypot(gx - cx, gz - cz);
      if (c < cost) { cost = c; best = [cx, cz]; }
    }
    return best;
  }

  updateSoldier(s, dt) {
    const sq = s.sq, T = s.T, n = sq.alive.length, shoots = this.shoots(sq) && !!T.ranged;
    const [lx, lz] = slotLocal(sq, s.slot, n), [fx, fz] = fwdOf(sq.face), [rx, rz] = rightOf(sq.face);
    let gx = sq.cx + rx * lx + fx * lz, gz = sq.cz + rz * lx + fz * lz;
    s.meleeCd -= dt;
    const tired = tiredK(s.stam);

    // melee: enemy soldiers first, then a building we were told to attack
    let foe = null, stand = false;
    if (sq.state !== 'rout' && T.melee && !(T.civil && sq.order.kind !== 'attack')) {
      const charging = (sq.order.kind === 'attack' || sq.order.kind === 'attackB') && !shoots;
      const r = charging ? (T.mounted ? 14 : 9) : sq.kiting ? 0 : T.mounted ? 6 : 4.5;
      if (r > 0) foe = s.target && s.target.alive && (s.target.x - s.x) ** 2 + (s.target.z - s.z) ** 2 < (r * 1.6) ** 2 ? s.target : this.nearestEnemy(s, r);
    }
    s.target = foe;
    if (foe) {
      sq.engaged++;
      const d = Math.hypot(foe.x - s.x, foe.z - s.z), reach = T.melee.reach + (foe.T.mounted ? 0.6 : 0);
      gx = foe.x; gz = foe.z;
      if (d <= reach + 0.3) { stand = true; if (s.meleeCd <= 0) this.strike(s, foe); }
    } else if (sq.order.kind === 'attackB' && !shoots && T.melee && sq.state !== 'rout') {
      const b = sq.order.b, [ex, ez] = edgePoint(b, s.x, s.z), d = Math.hypot(ex - s.x, ez - s.z);
      if (d < 18) { gx = ex; gz = ez; if (d <= T.melee.reach + 0.8) { stand = true; if (s.meleeCd <= 0) this.strikeBuilding(s, b); } }
    } else sq.errSum += Math.hypot(gx - s.x, gz - s.z);

    // shooting at soldiers or at a building
    if (!foe && shoots && (sq.fireTarget || sq.fireB) && sq.state !== 'rout') {
      s.reload -= dt;
      const canFire = T.mounted || !sq.moving;
      if (canFire && s.reload <= 0 && (T.ranged.ammo == null || s.ammo > 0)) {
        if (sq.fireB) {
          const b = sq.fireB, [ex, ez] = edgePoint(b, s.x, s.z), d = Math.hypot(ex - s.x, ez - s.z);
          if (d <= T.ranged.range) { this.fireAt(s, null, b, ex, ez, d); if (T.ranged.ammo != null) s.ammo--; s.reload = T.ranged.reload * (0.9 + this.rand() * 0.2); }
          else s.reload = 0.4;
        } else {
          const ft = sq.fireTarget.alive;
          const tgt = ft.length ? ft[Math.floor(this.rand() * ft.length)] : null;
          const d = tgt ? Math.hypot(tgt.x - s.x, tgt.z - s.z) : Infinity;
          if (tgt && d <= T.ranged.range && d >= (T.ranged.minRange || 0)) { this.fireAt(s, tgt, null, tgt.x, tgt.z, d); if (T.ranged.ammo != null) s.ammo--; s.reload = T.ranged.reload * (0.9 + this.rand() * 0.2); }
          else s.reload = 0.4;
        }
      }
    } else if (T.ranged && s.reload > 0) s.reload -= dt * 0.5;

    // no pathfinding yet: walk around a building in the way by its nearest free corner
    const rad = T.mounted ? 2.1 : T.artillery ? 2.4 : 0.95;
    if (this.mode === 'city' && !stand && !foe) {
      const far = sq.solo && sq.aimX != null, w = this.detour(s.x, s.z, far ? sq.aimX : gx, far ? sq.aimZ : gz, rad);
      if (w) { gx = w[0]; gz = w[1]; }
    }

    // movement
    let dvx = 0, dvz = 0;
    if (!stand) {
      const dx = gx - s.x, dz = gz - s.z, d = Math.hypot(dx, dz);
      if (d > 0.15) {
        const top = T.speed * tired * terrainSpeed(s.x, s.z);
        let v = foe ? top * (T.mounted ? 1 : 0.9) : top * (sq.running ? 1 : T.walk);
        if (!foe && d > 3) v = Math.min(top, v * 1.25);
        if (!foe && d < 2) v *= d / 2;
        dvx = (dx / d) * v; dvz = (dz / d) * v;
      }
    }
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
    // buildings are solid: slide out of their footprint
    for (const b of this.buildings) {
      if (b.walk || b.dead) continue;
      const hw = b.w / 2 + rad * 0.6, hd = b.d / 2 + rad * 0.6, ox = s.x - b.x, oz = s.z - b.z;
      if (Math.abs(ox) < hw && Math.abs(oz) < hd) {
        const px2 = hw - Math.abs(ox), pz2 = hd - Math.abs(oz);
        if (px2 < pz2) s.x = b.x + Math.sign(ox || 1) * hw; else s.z = b.z + Math.sign(oz || 1) * hd;
      }
    }
    s.y = groundY(s.x, s.z);
    s.speed = Math.hypot(s.vx, s.vz);
    s.walk += s.speed * dt;

    // stamina: running and galloping tire, standing restores
    if (s.speed > T.speed * T.walk * 1.12) s.stam = Math.max(0, s.stam - T.drain * dt);
    else s.stam = Math.min(100, s.stam + (s.speed < 0.4 ? 5 : 2.2) * dt);

    let yawGoal = sq.face;
    if (foe) yawGoal = Math.atan2(foe.x - s.x, foe.z - s.z);
    else if (s.faceTo) yawGoal = Math.atan2(s.faceTo[0] - s.x, s.faceTo[1] - s.z);
    else if (sq.fireB && !sq.moving) yawGoal = Math.atan2(sq.fireB.x - s.x, sq.fireB.z - s.z);
    else if (sq.fireTarget && (T.mounted || !sq.moving) && !sq.kiting) yawGoal = Math.atan2(sq.fireTarget.mx - s.x, sq.fireTarget.mz - s.z);
    else if (s.speed > 0.8) yawGoal = Math.atan2(s.vx, s.vz);
    s.yaw = turn(s.yaw, yawGoal, 5 * dt);
    if (T.mounted) s.chargeT = s.speed > 0.75 * T.speed && s.stam > 20 ? s.chargeT + dt : Math.max(0, s.chargeT - dt * 2);
  }

  strike(s, foe) {
    const T = s.T;
    let dmg = T.melee.dmg * (0.7 + 0.3 * Math.min(1, s.stam / 30)) * (s.isCmd ? 1.4 : 1);
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
    s.stam = Math.max(0, s.stam - (T.mounted ? 1.2 : 2));
    this.events.push({ k: 'strike', x: foe.x, z: foe.z });
    if (s.alive) this.hurt(foe, dmg, s);
  }
  strikeBuilding(s, b) {
    s.meleeCd = s.T.melee.rate * (0.85 + this.rand() * 0.3); s.strikeT = this.time;
    this.events.push({ k: 'strike', x: s.x, z: s.z });
    this.hurtBuilding(b, s.T.melee.dmg * VS_BUILDING.melee, s);
  }

  fireAt(s, tgt, b, tx0, tz0, d) {
    const R = s.T.ranged, u = Math.min(1, d / R.range);
    let acc = R.acc[0] + (R.acc[1] - R.acc[0]) * u;
    if (tgt?.T.mounted) acc *= 1.1;
    if (b) acc = 1;
    s.shotT = this.time;
    if (R.kind === 'musket') {
      const hit = this.rand() < acc;
      if (hit) { if (b) this.hurtBuilding(b, R.dmg * VS_BUILDING.musket, s); else this.hurt(tgt, Math.max(1, R.dmg * (0.8 + this.rand() * 0.4) - tgt.T.armor), s); }
      this.events.push({ k: 'musket', x: s.x, y: s.y, z: s.z, yaw: s.yaw, team: s.team });
    } else if (R.kind === 'arrow') {
      const hit = this.rand() < acc, miss = hit ? 0 : 2 + this.rand() * 5, a = this.rand() * 6.283;
      const tx = tx0 + Math.cos(a) * miss + (tgt ? tgt.vx * 0.6 : 0), tz = tz0 + Math.sin(a) * miss + (tgt ? tgt.vz * 0.6 : 0);
      this.projectiles.push({ k: 'arrow', team: s.team, src: s, tgt, b, hit, dmg: R.dmg, t: 0, T: d / 38 + 0.25,
        x0: s.x, y0: s.y + (s.T.mounted ? 2.2 : 1.5), z0: s.z, x1: tx, y1: groundY(tx, tz) + (hit ? 1.2 : 0), z1: tz, arc: d * 0.12 });
      this.events.push({ k: 'shot', team: s.team, x: s.x, z: s.z });
    } else {
      const spread = d * (1 - acc) * 0.12, a = this.rand() * 6.283, r = Math.sqrt(this.rand()) * spread;
      const tx = tx0 + Math.cos(a) * r, tz = tz0 + Math.sin(a) * r;
      this.projectiles.push({ k: 'ball', team: s.team, src: s, b, dmg: R.dmg, splash: R.splash, t: 0, T: d / 120 + 0.6,
        x0: s.x + Math.sin(s.yaw) * 1.6, y0: s.y + 1.1, z0: s.z + Math.cos(s.yaw) * 1.6, x1: tx, y1: groundY(tx, tz) + (b ? 2 : 0), z1: tz, arc: d * 0.08 });
      this.events.push({ k: 'cannon', x: s.x, y: s.y, z: s.z, yaw: s.yaw, team: s.team });
    }
  }

  updateProjectiles(dt) {
    const keep = [];
    for (const p of this.projectiles) {
      p.t += dt;
      if (p.t < p.T) { keep.push(p); continue; }
      if (p.k === 'arrow') {
        if (p.b) { if (!p.b.dead) this.hurtBuilding(p.b, p.dmg * VS_BUILDING.arrow, p.src); }
        else if (p.hit && p.tgt.alive) this.hurt(p.tgt, Math.max(1, p.dmg * (0.8 + this.rand() * 0.4) * (p.tgt.T.shield ? 0.55 : 1) - p.tgt.T.armor * 0.5), p.src);
        continue;
      }
      this.events.push({ k: 'impact', x: p.x1, y: p.y1, z: p.z1 });
      if (p.b && !p.b.dead && Math.abs(p.x1 - p.b.x) < p.b.w / 2 + 3 && Math.abs(p.z1 - p.b.z) < p.b.d / 2 + 3) this.hurtBuilding(p.b, p.dmg * VS_BUILDING.ball, p.src);
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
    this.projectiles = keep;
  }

  hurt(t, dmg, by) {
    if (!t.alive) return;
    t.hp -= dmg; t.sq.lastHit = this.time;
    if (t.hp <= 0) this.kill(t, by);
  }
  hurtBuilding(b, dmg, by) {
    if (b.dead) return;
    b.hp -= dmg; b.lastHit = this.time;
    if (b.hp <= 0) { b.hp = 0; b.dead = true; this.events.push({ k: 'bdead', b, by: by?.team }); }
  }

  kill(s, by) {
    s.alive = false; s.deadT = this.time; s.target = null;
    const sq = s.sq, idx = sq.alive.indexOf(s), tm = this.teams[s.team];
    if (idx >= 0) { sq.alive.splice(idx, 1); for (let i = idx; i < sq.alive.length; i++) sq.alive[i].slot = i; }
    sq.morale -= ((100 / Math.max(1, sq.initial)) * 1.4 + 0.3) * (sq.aura ? 0.65 : 1);
    if (sq.banner === s) sq.banner = sq.alive[Math.floor(sq.alive.length / 2)] || null;
    if (sq.officer === s) { sq.officer = null; sq.morale -= 30; this.events.push({ k: 'officerDead', sq }); }
    if (s.isCmd) {
      tm.cmd = null; tm.cmdDead = true;
      for (const q of this.squads) if (q.team === s.team && !q.dead) q.morale -= 20;
      this.events.push({ k: 'cmdDead', team: s.team, name: s.T.commander.name, x: s.x, z: s.z });
    }
    tm.alive--; tm.losses++;
    if (by) { this.teams[by.team].kills++; by.sq.kills++; }
    this.events.push({ k: 'death', s, by: by?.team });
  }
  // Take a unit off the field without it counting as a loss (a wagon turning back into a yurt).
  remove(s) {
    if (!s.alive) return;
    s.alive = false; s.removed = true; s.deadT = this.time;
    const sq = s.sq, idx = sq.alive.indexOf(s), tm = this.teams[s.team];
    if (idx >= 0) { sq.alive.splice(idx, 1); for (let i = idx; i < sq.alive.length; i++) sq.alive[i].slot = i; }
    tm.alive--; tm.initial--;
    this.events.push({ k: 'removed', s });
  }

  checkResult(dt) {
    for (const sq of this.squads) { sq.lastEngaged = sq.engaged; sq.lastErr = sq.alive.length ? sq.errSum / sq.alive.length : 0; }
    if (this.mode !== 'battle') return; // the city mode decides victory by buildings
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
