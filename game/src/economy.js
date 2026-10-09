// City economy: stockpiles, resource nodes, worker jobs, construction, training queues, population and food upkeep.
// Pure logic on top of Sim, so it runs headless too.
import { BUILDINGS, RES_NAMES, MAIN } from './buildings.js';
import { TYPES } from './units.js';
import { groundY, slopeAt, WATER_Y, HALF, SIZE, BASES, DEPOSITS, treeSpots, mountainW, fbm } from './world.js';
import { edgePoint } from './sim.js';

export const CARRY = 10;
const RATE = { wood: 0.9, stone: 0.65, gold: 0.5, food: 0.7 }; // per worker per second
const TREE_WOOD = 100, DEPOSIT = { stone: 4000, gold: 3000 };
const UPKEEP = 0.012; // food per soldier per second (~0.7 per minute)
const TG = 25;        // tree grid cell, m
const PG = 40, PN = SIZE / PG;            // pasture grid
const HERD = 0.9;                         // food per second from one koroo on fresh grass
const GRAZE = 0.0016, REGROW = 0.00035;   // pasture wear per koroo, and regrowth, per second
const START = { kokand: { food: 500, wood: 400, stone: 250, gold: 200 }, kipchak: { food: 350, wood: 380, stone: 0, gold: 150 } };
export const JOB_TEXT = { wood: 'рубит лес', stone: 'добывает камень', gold: 'добывает золото', food: 'работает в поле' };

export class Economy {
  constructor(sim) {
    this.sim = sim;
    this.stock = sim.teams.map((t) => ({ ...START[t.key] }));
    this.faction = sim.teams.map((t) => t.key);
    // pasture: fresh steppe grass, poorer on dry ground and in the mountains
    this.grass = new Float32Array(PN * PN); this.grassMax = new Float32Array(PN * PN);
    for (let j = 0; j < PN; j++) for (let i = 0; i < PN; i++) {
      const x = -HALF + (i + 0.5) * PG, z = -HALF + (j + 0.5) * PG;
      const v = groundY(x, z) < WATER_Y ? 0 : Math.max(0.15, 0.65 + fbm(x * 0.004, z * 0.004, 3) * 0.5 - mountainW(x, z) * 0.8);
      this.grass[j * PN + i] = this.grassMax[j * PN + i] = Math.min(1, v);
    }
    this.popCap = [0, 0];
    this.jobs = new Map();
    this.msgs = [];
    this.felled = [];
    this.trees = treeSpots().map(([, x, , z], i) => ({ kind: 'wood', tree: true, i, x, z, amount: TREE_WOOD, r: 1.3 }));
    this.treeGrid = new Map();
    for (const t of this.trees) { const k = this.tkey(t.x, t.z); if (!this.treeGrid.has(k)) this.treeGrid.set(k, []); this.treeGrid.get(k).push(t); }
    this.nodes = DEPOSITS.map(([kind, x, z], id) => ({ kind, id, x, z, amount: DEPOSIT[kind], max: DEPOSIT[kind], r: 4.5 }));
    this.upkeepAcc = 0; this.famineT = -99; this.popT = 0;
  }

  say(text, cls = '', team = 0) {
    if (team !== 0) return;
    // the same warning from several workers at once is shown once
    const last = (this.saidAt ||= new Map()).get(text);
    if (last != null && this.sim.time - last < 6) return;
    this.saidAt.set(text, this.sim.time);
    this.msgs.push({ text, cls });
  }

  // ---------- resource lookup ----------
  tkey(x, z) { return Math.floor((x + HALF) / TG) + ',' + Math.floor((z + HALF) / TG); }
  treesNear(x, z, r, fn) {
    const c0 = Math.floor((x - r + HALF) / TG), c1 = Math.floor((x + r + HALF) / TG), r0 = Math.floor((z - r + HALF) / TG), r1 = Math.floor((z + r + HALF) / TG);
    for (let cz = r0; cz <= r1; cz++) for (let cx = c0; cx <= c1; cx++) for (const t of this.treeGrid.get(cx + ',' + cz) || []) if (t.amount > 0) fn(t);
  }
  nearestNode(kind, x, z, r = 220) {
    let best = null, bd = r * r;
    const test = (n) => { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd && n.amount > 0) { bd = d; best = n; } };
    if (kind === 'wood') this.treesNear(x, z, r, test); else for (const n of this.nodes) if (n.kind === kind) test(n);
    return best;
  }
  nodeAt(x, z, r = 3) {
    let best = null, bd = Infinity;
    for (const n of this.nodes) { const d = Math.hypot(n.x - x, n.z - z) - n.r; if (d < r && d < bd && n.amount > 0) { bd = d; best = n; } }
    if (best) return best;
    this.treesNear(x, z, r + 2, (t) => { const d = Math.hypot(t.x - x, t.z - z); if (d < r && d < bd) { bd = d; best = t; } });
    return best;
  }
  buildingAt(x, z, pad = 1) {
    return this.sim.buildings.find((b) => !b.dead && Math.abs(x - b.x) < b.w / 2 + pad && Math.abs(z - b.z) < b.d / 2 + pad) || null;
  }

  // ---------- money ----------
  canAfford(team, cost) { return Object.entries(cost).every(([k, v]) => this.stock[team][k] >= v); }
  pay(team, cost, sign = 1) { for (const [k, v] of Object.entries(cost)) this.stock[team][k] -= v * sign; }
  missing(team, cost) { return Object.entries(cost).filter(([k, v]) => this.stock[team][k] < v).map(([k, v]) => `${RES_NAMES[k].toLowerCase()} ${Math.ceil(v - this.stock[team][k])}`).join(', '); }

  // ---------- buildings ----------
  footprintOk(key, x, z, ignore = null) {
    const T = BUILDINGS[key], hw = T.w / 2, hd = T.d / 2;
    if (T.mine && !this.nodes.some((n) => n.amount > 0 && Math.hypot(n.x - x, n.z - z) < n.r + 26)) return { ok: false, why: 'Кен ставится рядом с золотом или камнем' };
    for (const s of this.sim.soldiers) {
      if (!s.alive || !s.unpackAt || s === ignore) continue;
      const P = BUILDINGS[s.cargo.key];
      if (Math.abs(x - s.unpackAt[0]) < hw + P.w / 2 + 2 && Math.abs(z - s.unpackAt[1]) < hd + P.d / 2 + 2) return { ok: false, why: 'Здесь уже будет другая юрта' };
    }
    if (Math.abs(x) > HALF - 30 - hw || Math.abs(z) > HALF - 30 - hd) return { ok: false, why: 'Слишком близко к краю карты' };
    let lo = Infinity, hi = -Infinity;
    for (const u of [-1, 0, 1]) for (const v of [-1, 0, 1]) {
      const h = groundY(x + u * hw, z + v * hd);
      if (h < WATER_Y + 0.5) return { ok: false, why: 'Нельзя строить в воде' };
      lo = Math.min(lo, h); hi = Math.max(hi, h);
      if (slopeAt(x + u * hw, z + v * hd) > 0.5) return { ok: false, why: 'Слишком крутой склон' };
    }
    if (hi - lo > 4.5) return { ok: false, why: 'Слишком неровная земля' };
    for (const b of this.sim.buildings) {
      if (b.dead) continue;
      const m = b.walk || T.walk ? 0.5 : 2;
      if (Math.abs(x - b.x) < hw + b.w / 2 + m && Math.abs(z - b.z) < hd + b.d / 2 + m) return { ok: false, why: 'Место занято' };
    }
    for (const n of this.nodes) if (Math.abs(x - n.x) < hw + n.r + 2 && Math.abs(z - n.z) < hd + n.r + 2) return { ok: false, why: 'Мешает месторождение' };
    let tree = false;
    // keep clear of the crowns, not just the trunks
    this.treesNear(x, z, Math.max(hw, hd) + 4, (t) => { if (Math.abs(t.x - x) < hw + 2.2 && Math.abs(t.z - z) < hd + 2.2) tree = true; });
    if (tree) return { ok: false, why: 'Мешают деревья' };
    return { ok: true };
  }

  addBuilding(team, key, x, z, done = false) {
    const T = BUILDINGS[key];
    let y = 0; for (const [u, v] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) y += groundY(x + (u * T.w) / 2, z + (v * T.d) / 2) / 5;
    const b = {
      id: this.sim.buildings.length, key, T, team, x, z, y, w: T.w, d: T.d, walk: !!T.walk,
      hp: done ? T.hp : T.hp * 0.1, maxHp: T.hp, progress: done ? 1 : 0, done, dead: false, gone: false,
      queue: [], qT: 0, blocked: false, rally: null, users: new Set(), lastHit: -99,
    };
    this.sim.buildings.push(b);
    if (done) this.recalcPop();
    return b;
  }
  place(team, key, x, z, builders = []) {
    const T = BUILDINGS[key];
    if (!this.canAfford(team, T.cost)) { this.say(`Не хватает: ${this.missing(team, T.cost)}`, 'bad', team); return null; }
    const f = this.footprintOk(key, x, z);
    if (!f.ok) { this.say(f.why, 'bad', team); return null; }
    this.pay(team, T.cost);
    const b = this.addBuilding(team, key, x, z, false);
    for (const sq of builders) this.assignBuild(sq, b);
    return b;
  }
  recalcPop() {
    for (const tm of [0, 1]) this.popCap[tm] = Math.min(500, this.sim.buildings.filter((b) => b.team === tm && b.done && !b.dead).reduce((a, b) => a + (b.T.pop || 0), 0));
  }
  popUsed(team) { return this.sim.teams[team].alive; }

  // ---------- training ----------
  train(b, key) {
    const T = TYPES[key];
    if (!b.done || b.dead || !b.T.trains?.includes(key)) return false;
    if (b.queue.length >= 10) { this.say('Очередь заполнена', 'bad', b.team); return false; }
    if (!this.canAfford(b.team, T.cost)) { this.say(`Не хватает: ${this.missing(b.team, T.cost)}`, 'bad', b.team); return false; }
    this.pay(b.team, T.cost); b.queue.push(key);
    return true;
  }
  cancel(b, i) {
    const key = b.queue[i]; if (!key) return;
    this.pay(b.team, TYPES[key].cost, -1); b.queue.splice(i, 1); if (i === 0) b.qT = 0;
  }
  produce(b, dt) {
    const key = b.queue[0], T = TYPES[key];
    if (b.team === 0 && this.popUsed(0) >= this.popCap[0]) { if (!b.blocked) this.say('Нужно больше домов: население на пределе', 'bad'); b.blocked = true; return; }
    b.blocked = false; b.qT += dt;
    if (b.qT < T.time) return;
    b.qT = 0; b.queue.shift();
    const side = b.rally ? Math.sign(b.rally.z - b.z) || 1 : 1;
    const x = b.x + (this.sim.rand() - 0.5) * b.w * 0.6, z = b.z + side * (b.d / 2 + 3);
    const sq = this.sim.spawnUnit(b.team, key, x, z, side > 0 ? 0 : Math.PI);
    const r = b.rally;
    if (r?.node && T.worker) this.assignGather(sq, r.node);
    else if (r?.b && T.worker && !r.b.dead) r.b.done ? this.assignGather(sq, r.b) : this.assignBuild(sq, r.b);
    else if (r) this.sim.order(sq, { kind: 'move', x: r.x + (this.sim.rand() - 0.5) * 8, z: r.z + (this.sim.rand() - 0.5) * 8, face: sq.face });
  }

  // ---------- worker jobs ----------
  assignGather(sq, target) {
    const s = sq.alive[0]; if (!s || !s.T.worker) return;
    this.stopJob(sq);
    if (target.T?.field) {
      if (!target.done || target.dead) return;
      if (target.users.size >= target.T.slots) { this.say('Поле занято: на нём уже 4 деҳқона', 'bad', sq.team); return; }
      target.users.add(s);
      this.jobs.set(s, { kind: 'gather', res: 'food', field: target, phase: 'go', carry: 0 });
    } else this.jobs.set(s, { kind: 'gather', res: target.kind, node: target, phase: 'go', carry: 0 });
  }
  assignBuild(sq, b) {
    const s = sq.alive[0]; if (!s || !s.T.worker) return;
    const prev = this.jobs.get(s), back = prev?.kind === 'gather' ? prev.field || prev.node : prev?.back;
    this.stopJob(sq);
    this.jobs.set(s, { kind: 'build', b, phase: 'go', back }); // `back`: return to this work afterwards
  }
  stopJob(sq) {
    const s = sq.alive[0]; if (!s) return;
    const j = this.jobs.get(s);
    if (j) { j.field?.users.delete(s); this.jobs.delete(s); }
    s.faceTo = null;
  }
  jobOf(sq) { return sq.alive[0] ? this.jobs.get(sq.alive[0]) : null; }
  jobText(sq) {
    const j = this.jobOf(sq);
    if (!j) return 'без дела';
    if (j.kind === 'build') return 'строит';
    return j.phase === 'carry' ? `несёт: ${RES_NAMES[j.res].toLowerCase()}` : JOB_TEXT[j.res];
  }
  idleWorkers(team) {
    return this.sim.squads.filter((q) => q.team === team && !q.dead && q.T.worker && !this.jobs.get(q.alive[0]) && q.order.kind === 'idle');
  }

  go(s, job, x, z) {
    if (job.dest && Math.abs(job.dest[0] - x) + Math.abs(job.dest[1] - z) < 0.6 && s.sq.order.kind === 'move') return;
    job.dest = [x, z]; s.faceTo = null;
    this.sim.order(s.sq, { kind: 'move', x, z, face: s.yaw });
  }
  near(s, x, z, r) { return (s.x - x) ** 2 + (s.z - z) ** 2 < r * r; }
  dropFor(team, res, x, z) {
    let best = null, bd = Infinity;
    for (const b of this.sim.buildings) {
      if (b.team !== team || !b.done || b.dead || !b.T.drop?.includes(res)) continue;
      const [ex, ez] = edgePoint(b, x, z), d = Math.hypot(ex - x, ez - z);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  work(s, job, dt) {
    if (job.kind === 'build') {
      const b = job.b;
      if (b.dead || b.done) {
        this.jobs.delete(s); s.faceTo = null;
        if (b.done && b.T.field && b.users.size < b.T.slots) this.assignGather(s.sq, b);
        else if (job.back && !job.back.dead && (job.back.T?.field || job.back.amount > 0)) this.assignGather(s.sq, job.back);
        else if (job.back?.tree) { const t = this.nearestNode('wood', job.back.x, job.back.z, 60); if (t) this.assignGather(s.sq, t); }
        return;
      }
      const [ex, ez] = edgePoint(b, s.x, s.z), dx = s.x - b.x, dz = s.z - b.z, l = Math.hypot(dx, dz) || 1;
      const px = ex + (dx / l) * 1.1, pz = ez + (dz / l) * 1.1;
      if (!this.near(s, px, pz, 2.6)) { this.go(s, job, px, pz); return; }
      if (s.sq.order.kind === 'move') this.sim.order(s.sq, { kind: 'idle', face: s.yaw });
      s.faceTo = [b.x, b.z];
      b.builders = (b.builders || 0) + 1;
      const k = b.builders <= 4 ? 1 : 0.35;
      b.progress = Math.min(1, b.progress + (dt / b.T.time) * k);
      b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * 0.9 * dt / b.T.time) * k);
      if (this.sim.time - s.strikeT > 0.9) s.strikeT = this.sim.time;
      if (b.progress >= 1 && !b.done) {
        b.done = true; b.hp = Math.max(b.hp, b.maxHp * 0.95); this.recalcPop();
        this.say(`Построено: ${b.T.name}`, 'good', b.team);
        this.sim.events.push({ k: 'built', b });
      }
      return;
    }
    // gathering
    const field = job.field;
    let node = job.node;
    if (job.phase !== 'carry') {
      if (field && (field.dead || !field.done)) { this.stopJob(s.sq); return; }
      if (!field && (!node || node.amount <= 0)) {
        node = job.node = this.nearestNode(job.res, s.x, s.z, 90);
        if (!node) { if (job.carry > 0) job.phase = 'carry'; else { this.jobs.delete(s); s.faceTo = null; return; } }
        else job.phase = 'go';
      }
    }
    if (job.phase === 'go') {
      let px, pz, r = 1.6;
      if (field) {
        const i = [...field.users].indexOf(s), u = (i % 2) - 0.5, v = Math.floor(i / 2) - 0.5;
        px = field.x + u * field.w * 0.5; pz = field.z + v * field.d * 0.5; r = 1.2;
      } else {
        const dx = s.x - node.x, dz = s.z - node.z, l = Math.hypot(dx, dz) || 1;
        px = node.x + (dx / l) * (node.r + 0.9); pz = node.z + (dz / l) * (node.r + 0.9); r = 1.8;
      }
      if (!this.near(s, px, pz, r)) { this.go(s, job, px, pz); return; }
      job.phase = 'work'; job.dest = null;
      if (s.sq.order.kind === 'move') this.sim.order(s.sq, { kind: 'idle', face: s.yaw });
    }
    if (job.phase === 'work') {
      s.faceTo = field ? [field.x, field.z] : [node.x, node.z];
      if (!job.kenT || this.sim.time > job.kenT) { job.kenT = this.sim.time + 2; job.ken = !field && this.sim.buildings.some((b) => b.T.mine && b.done && !b.dead && b.team === s.team && Math.hypot(b.x - node.x, b.z - node.z) < 34); }
      const take = RATE[job.res] * dt * (job.ken ? 1.5 : 1);
      if (!field) { node.amount -= take; if (node.amount <= 0 && node.tree) this.felled.push(node); }
      job.carry += take;
      if (this.sim.time - s.strikeT > (field ? 1.3 : 0.9)) { s.strikeT = this.sim.time; this.sim.events.push({ k: 'work', res: job.res, x: s.x, z: s.z }); }
      if (job.carry >= CARRY) { job.phase = 'carry'; job.dest = null; s.faceTo = null; }
      return;
    }
    if (job.phase === 'carry') {
      const b = this.dropFor(s.team, job.res, s.x, s.z);
      if (!b) { if (!job.warned) { this.say(`Некуда нести ${RES_NAMES[job.res].toLowerCase()}: ${this.faction[s.team] === 'kipchak' ? 'разверните ордо или поставьте кен' : `постройте ${job.res === 'food' ? 'тегирмон' : 'омбор'}`}`, 'bad', s.team); job.warned = true; } return; }
      const [ex, ez] = edgePoint(b, s.x, s.z), dx = s.x - b.x, dz = s.z - b.z, l = Math.hypot(dx, dz) || 1;
      const px = ex + (dx / l) * 1.2, pz = ez + (dz / l) * 1.2;
      if (!this.near(s, px, pz, 2.4)) { this.go(s, job, px, pz); return; }
      this.stock[s.team][job.res] += job.carry; job.carry = 0; job.phase = 'go'; job.dest = null; job.warned = false;
    }
  }

  update(dt) {
    const sim = this.sim;
    for (const b of sim.buildings) {
      b.builders = 0;
      if (!b.dead && b.done && b.queue.length) this.produce(b, dt);
    }
    for (const [s, job] of this.jobs) {
      if (!s.alive) { job.field?.users.delete(s); this.jobs.delete(s); continue; }
      this.work(s, job, dt);
    }
    for (const b of sim.buildings) if (b.dead && !b.gone) this.destroyed(b);
    this.herds(dt);
    for (const s of sim.soldiers) if (s.alive && s.unpackAt) this.tryUnpack(s);
    this.upkeep(dt);
    this.popT -= dt; if (this.popT <= 0) { this.popT = 0.5; this.recalcPop(); }
  }

  destroyed(b) {
    b.gone = true; b.queue = [];
    for (const s of b.users) this.jobs.delete(s);
    b.users.clear();
    this.recalcPop();
    if (b.packed) return;
    if (b.team === 0) this.say(`Разрушено: ${b.T.name}`, 'bad'); else this.say(`Враг потерял: ${b.T.name}`, 'good');
    if (b.T.main && !this.sim.result) this.end(1 - b.team);
  }

  // ---------- nomads: herds, loot, packing the camp ----------
  cell(x, z) { return Math.max(0, Math.min(PN - 1, Math.floor((z + HALF) / PG))) * PN + Math.max(0, Math.min(PN - 1, Math.floor((x + HALF) / PG))); }
  pastureAt(x, z) { return this.grass[this.cell(x, z)]; }
  herds(dt) {
    const g = this.grass, used = new Set();
    for (const b of this.sim.buildings) {
      if (!b.T.herd || !b.done || b.dead) continue;
      const c = this.cell(b.x, b.z);
      b.grass = g[c];
      const rate = HERD * Math.min(1, g[c] * 1.3);
      this.stock[b.team].food += rate * dt; b.foodRate = rate * 60;
      g[c] = Math.max(0, g[c] - GRAZE * dt); used.add(c);
      if (g[c] < 0.3 && !b.warned && b.team === 0) { b.warned = true; this.say('Пастбище вытоптано: отару пора перегнать (свернуть короо и поставить на свежей траве)', 'bad'); }
    }
    if ((this.regrowT = (this.regrowT || 0) - dt) <= 0) {
      this.regrowT = 2;
      for (let i = 0; i < g.length; i++) if (!used.has(i) && g[i] < this.grassMax[i]) g[i] = Math.min(this.grassMax[i], g[i] + REGROW * 2);
    }
  }
  // Raiders live on plunder: kills and razed buildings pay the Kipchaks.
  onEvents(events) {
    for (const e of events) {
      if (e.k === 'death') {
        if (e.s.cargo?.main && !this.sim.result) { this.say(`Арба с ханской ставкой потеряна!`, 'bad', e.s.team); this.end(1 - e.s.team); }
        else if (e.s.cargo && e.s.team === 0) this.say(`Потеряна арба: ${BUILDINGS[e.s.cargo.key].name}`, 'bad');
        if (e.by != null && this.faction[e.by] === 'kipchak') {
          const loot = e.s.T.civil ? { gold: 10, food: 10 } : { gold: 4, food: 6 };
          this.pay(e.by, loot, -1); this.lootSum = (this.lootSum || 0) + loot.gold;
        }
      } else if (e.k === 'bdead' && e.by != null && this.faction[e.by] === 'kipchak' && !e.b.packed) {
        const c = e.b.T.cost || {}, loot = { gold: Math.round((c.gold || 0) * 0.4 + (c.stone || 0) * 0.3 + (e.b.T.main ? 400 : 30)), wood: Math.round((c.wood || 0) * 0.3) };
        this.pay(e.by, loot, -1);
        this.say(`Олжо: +${loot.gold} золота, +${loot.wood} дерева с «${e.b.T.name}»`, 'good', e.by);
      }
    }
  }
  pack(b) {
    if (!b.T.pack || !b.done || b.dead) return null;
    for (const k of b.queue) this.pay(b.team, TYPES[k].cost, -1);
    b.queue = []; b.dead = true; b.packed = true;
    for (const s of b.users) this.jobs.delete(s);
    b.users.clear();
    const sq = this.sim.spawnUnit(b.team, 'arba', b.x, b.z + b.d / 2 + 2.5, 0);
    sq.alive[0].cargo = { key: b.key, hp: b.hp / b.maxHp, main: !!b.T.main };
    this.recalcPop();
    this.sim.events.push({ k: 'packed', b });
    return sq;
  }
  packCamp(team) {
    const main = this.sim.buildings.find((b) => b.team === team && b.T.main && !b.dead);
    if (!main) return [];
    const list = this.sim.buildings.filter((b) => b.team === team && b.T.pack && b.done && !b.dead && Math.hypot(b.x - main.x, b.z - main.z) < 170);
    const out = list.map((b) => this.pack(b)).filter(Boolean);
    this.say(`Көч! Лагерь свёрнут: ${out.length} арб. Ведите их к новому месту и разверните`, 'good', team);
    return out;
  }
  unpack(sq, x, z, quiet = false) {
    const s = sq.alive[0];
    if (!s?.cargo) return false;
    const f = this.footprintOk(s.cargo.key, x, z, s);
    if (!f.ok) { if (!quiet) this.say(f.why, 'bad', sq.team); return false; }
    s.unpackAt = [x, z];
    this.sim.order(sq, { kind: 'move', x, z, face: Math.PI }); // the site is still empty: drive onto it
    return true;
  }
  // Lay a whole caravan out around a point: the khan's ordo in the middle, the rest in rings.
  unpackGroup(sqs, x, z) {
    const wagons = sqs.filter((q) => q.alive[0]?.cargo).sort((a, b) => (b.alive[0].cargo.main ? 1 : 0) - (a.alive[0].cargo.main ? 1 : 0));
    let placed = 0;
    for (const q of wagons) {
      const key = q.alive[0].cargo.key;
      let done = false;
      for (let r = 0; r <= 110 && !done; r += 9) for (let a = 0; a < Math.PI * 2 && !done; a += r ? 9 / r : 7) {
        const px = Math.round(x + Math.cos(a) * r), pz = Math.round(z + Math.sin(a) * r);
        if (this.footprintOk(key, px, pz, q.alive[0]).ok) { done = this.unpack(q, px, pz, true); }
      }
      if (done) placed++;
    }
    if (placed < wagons.length) this.say(`Не нашлось места для ${wagons.length - placed} юрт`, 'bad', wagons[0]?.team ?? 0);
    return placed;
  }
  tryUnpack(s) {
    const [x, z] = s.unpackAt, key = s.cargo.key, T = BUILDINGS[key];
    // close to the site from any side: neighbours' yurts may block one of them
    if (Math.hypot(s.x - x, s.z - z) > Math.max(T.w, T.d) / 2 + 5) {
      if (s.sq.order.kind === 'idle') this.sim.order(s.sq, { kind: 'move', x, z, face: Math.PI });
      return;
    }
    s.unpackAt = null;
    const f = this.footprintOk(key, x, z, s);
    if (!f.ok) { this.say(`${T.name}: ${f.why.toLowerCase()}`, 'bad', s.team); return; }
    const b = this.addBuilding(s.team, key, x, z, true);
    b.hp = b.maxHp * s.cargo.hp;
    this.sim.remove(s);
    this.recalcPop();
    this.sim.events.push({ k: 'unpacked', b });
  }
  end(winner) {
    this.sim.result = { winner, loser: 1 - winner, time: this.sim.time, city: true };
    this.sim.events.push({ k: 'end', result: this.sim.result });
  }

  upkeep(dt) {
    this.upkeepAcc += dt;
    if (this.upkeepAcc < 1) return;
    const t = this.upkeepAcc; this.upkeepAcc = 0;
    const army = this.sim.soldiers.filter((s) => s.alive && s.team === 0 && !s.T.worker);
    this.stock[0].food -= army.length * UPKEEP * t;
    if (this.stock[0].food < 0) {
      this.stock[0].food = 0;
      for (const s of army) this.sim.hurt(s, 0.6 * t, null);
      if (this.sim.time - this.famineT > 25) { this.famineT = this.sim.time; this.say('Голод! Войску не хватает еды, солдаты слабеют', 'bad'); }
    }
  }
  upkeepPerMin(team = 0) { return this.sim.soldiers.filter((s) => s.alive && s.team === team && !s.T.worker).length * UPKEEP * 60; }

  // ---------- start of a city game ----------
  setupPlayer() {
    const [x, z] = BASES.player, fac = this.faction[0], kip = fac === 'kipchak';
    this.addBuilding(0, MAIN[fac], x, z, true);
    if (kip) { this.addBuilding(0, 'boz', x - 16, z + 4, true); this.addBuilding(0, 'boz', x + 16, z + 4, true); this.addBuilding(0, 'koroo', x + 2, z + 26, true); }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI - Math.PI, sq = this.sim.spawnUnit(0, kip ? 'malchy' : 'dehqon', x + Math.cos(a) * 16, z - 14 + Math.sin(a) * 5, Math.PI);
      if (i < 4) { const t = this.nearestNode('wood', sq.cx, sq.cz, 260); if (t) this.assignGather(sq, t); }
    }
    this.sim.spawnUnit(0, kip ? 'juzbashy' : 'yuzboshi', x + 14, z - 18, Math.PI);
    for (let i = 0; i < 6; i++) this.sim.spawnUnit(0, kip ? 'atchan' : 'sarbaz', x - 12 + (i % 3) * 2.5, z - 22 - Math.floor(i / 3) * 2.5, Math.PI);
    this.recalcPop();
  }
}
