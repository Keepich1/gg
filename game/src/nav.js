// Walkability grid and A* for the city mode, so units go round walls and through their own gates.
// Each 4 m cell remembers the most solid building on it. Who may pass depends on the team:
// ordinary buildings stop everyone; walls and towers stop their owner but an enemy may break through
// (at a high cost, so it prefers a way round); a gate lets its owner through and is a wall to the enemy.
import { SIZE, HALF, WATER_Y, groundY, slopeAt } from './world.js';

export const NAV_CELL = 4;
const N = SIZE / NAV_CELL;
const BREACH = 30;      // cost of breaking through one cell of an enemy wall (a ~120 m detour is cheaper)
const MAX_EXPAND = 60000;
const SQ2 = Math.SQRT2;

const rank = (b) => (b.T.gate ? 1 : b.T.wall || b.T.tower ? 2 : 3);

export class Nav {
  constructor(sim) {
    this.sim = sim;
    this.occ = new Array(N * N).fill(null);
    // terrain: steep slopes and water are slow, so paths avoid them a little
    this.terr = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -HALF + (i + 0.5) * NAV_CELL, z = -HALF + (j + 0.5) * NAV_CELL, s = slopeAt(x, z);
      this.terr[j * N + i] = groundY(x, z) < WATER_Y - 0.2 ? 2.2 : s > 0.9 ? 6 : s > 0.45 ? 1.8 : 1;
    }
    this.g = new Float32Array(N * N); this.from = new Int32Array(N * N);
    this.seen = new Uint32Array(N * N); this.shut = new Uint32Array(N * N); this.gen = 0;
    this.heapI = new Int32Array(N * 8); this.heapF = new Float32Array(N * 8);
    this.count = 0; this.ver = -1;
  }

  // ---------- grid upkeep ----------
  sync() {
    const sim = this.sim;
    if (sim.bver === this.ver) return;
    this.ver = sim.bver;
    for (const b of sim.buildings) {
      const on = !b.dead && !b.walk;
      if (on !== !!b.navOn) { b.navOn = on; this.refresh(b); }
    }
  }
  box(b) {
    const i0 = Math.max(0, Math.floor((b.x - b.w / 2 + HALF) / NAV_CELL)), i1 = Math.min(N - 1, Math.floor((b.x + b.w / 2 + HALF) / NAV_CELL));
    const j0 = Math.max(0, Math.floor((b.z - b.d / 2 + HALF) / NAV_CELL)), j1 = Math.min(N - 1, Math.floor((b.z + b.d / 2 + HALF) / NAV_CELL));
    return [i0, i1, j0, j1];
  }
  // recompute the cells under b from every building that still stands there
  refresh(b) {
    const [i0, i1, j0, j1] = this.box(b);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) this.occ[j * N + i] = null;
    for (const o of this.sim.buildings) {
      if (!o.navOn) continue;
      const [a0, a1, c0, c1] = this.box(o);
      if (a1 < i0 || a0 > i1 || c1 < j0 || c0 > j1) continue;
      for (let j = Math.max(j0, c0); j <= Math.min(j1, c1); j++) for (let i = Math.max(i0, a0); i <= Math.min(i1, a1); i++) {
        const k = j * N + i, cur = this.occ[k];
        if (!cur || rank(o) > rank(cur)) this.occ[k] = o;
      }
    }
  }

  // ---------- costs ----------
  cellOf(x, z) {
    const i = Math.max(0, Math.min(N - 1, Math.floor((x + HALF) / NAV_CELL))), j = Math.max(0, Math.min(N - 1, Math.floor((z + HALF) / NAV_CELL)));
    return j * N + i;
  }
  centre(k) { return [-HALF + ((k % N) + 0.5) * NAV_CELL, -HALF + (Math.floor(k / N) + 0.5) * NAV_CELL]; }
  // 0: free, 1: must break through (enemy wall), 2: closed
  block(k, team) {
    const b = this.occ[k];
    if (!b) return 0;
    if (b.T.gate) return b.team === team ? 0 : 1;
    if (b.T.wall || b.T.tower) return b.team === team ? 2 : 1;
    return 2;
  }
  // a straight walk from a to b crosses nothing in the way (corners count, so nobody slips between two touching pieces)
  // (the cells at both ends are skipped: a unit at a door or at the foot of a wall stands in a building's cell)
  clear(ax, az, bx, bz, team) {
    const d = Math.hypot(bx - ax, bz - az), n = Math.ceil(d / (NAV_CELL * 0.35)), ka = this.cellOf(ax, az), kb = this.cellOf(bx, bz);
    for (let s = 0; s <= n; s++) {
      const t = s / Math.max(1, n), k = this.cellOf(ax + (bx - ax) * t, az + (bz - az) * t);
      if (k !== ka && k !== kb && this.block(k, team)) return false;
    }
    return true;
  }

  // ---------- A* ----------
  push(k, f) {
    let i = this.count++;
    if (i >= this.heapI.length) { const a = new Int32Array(i * 2), b = new Float32Array(i * 2); a.set(this.heapI); b.set(this.heapF); this.heapI = a; this.heapF = b; }
    const H = this.heapI, F = this.heapF;
    while (i > 0) { const p = (i - 1) >> 1; if (F[p] <= f) break; H[i] = H[p]; F[i] = F[p]; i = p; }
    H[i] = k; F[i] = f;
  }
  pop() {
    const H = this.heapI, F = this.heapF, top = H[0], last = H[--this.count], lf = F[this.count];
    let i = 0;
    for (;;) {
      let c = 2 * i + 1; if (c >= this.count) break;
      if (c + 1 < this.count && F[c + 1] < F[c]) c++;
      if (F[c] >= lf) break;
      H[i] = H[c]; F[i] = F[c]; i = c;
    }
    H[i] = last; F[i] = lf;
    return top;
  }

  // Waypoints from (ax,az) to (bx,bz) for a team, or null when nothing stands in the way.
  // When the way leads through an enemy wall, `breach` is that building and `at` the waypoint before it.
  find(ax, az, bx, bz, team) {
    if (this.clear(ax, az, bx, bz, team)) return null;
    const start = this.cellOf(ax, az);
    let goal = this.cellOf(bx, bz);
    // a goal inside a building (a door, a wall to break) is reached at its nearest open cell
    if (this.block(goal, team) === 2) goal = this.nearestOpen(goal, team, ax, az);
    const gen = ++this.gen, g = this.g, from = this.from, seen = this.seen, shut = this.shut, terr = this.terr;
    const gi = goal % N, gj = Math.floor(goal / N);
    const h = (k) => { const di = Math.abs((k % N) - gi), dj = Math.abs(Math.floor(k / N) - gj); return (di + dj) + (SQ2 - 2) * Math.min(di, dj); };
    this.count = 0;
    g[start] = 0; from[start] = -1; seen[start] = gen; this.push(start, h(start));
    let best = start, bh = h(start), found = false, n = 0;
    while (this.count && n++ < MAX_EXPAND) {
      const k = this.pop();
      if (shut[k] === gen) continue;
      shut[k] = gen;
      if (k === goal) { found = true; break; }
      const hk = h(k); if (hk < bh) { bh = hk; best = k; }
      const i = k % N, j = Math.floor(k / N);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        const nk = nj * N + ni, bl = this.block(nk, team);
        if (bl === 2 && nk !== goal) continue;
        // no cutting corners past anything solid
        if (di && dj && (this.block(j * N + ni, team) || this.block(nj * N + i, team))) continue;
        const step = (di && dj ? SQ2 : 1) * (terr[nk] + (bl === 1 ? BREACH : 0));
        const ng = g[k] + step;
        if (seen[nk] !== gen || ng < g[nk]) { seen[nk] = gen; g[nk] = ng; from[nk] = k; this.push(nk, ng + h(nk)); }
      }
    }
    const end = found ? goal : best;
    const cells = [];
    for (let k = end; k !== -1; k = from[k]) cells.push(k);
    cells.reverse();
    // the first enemy wall on the way
    let bi = -1;
    for (let c = 0; c < cells.length; c++) if (this.block(cells[c], team) === 1) { bi = c; break; }
    const upto = bi >= 0 ? bi : cells.length;
    // string-pull: keep only the turns that a straight walk cannot skip
    const pts = [];
    let ax0 = ax, az0 = az, c = 0;
    while (c < upto - 1) {
      let far = c + 1;
      for (let t = upto - 1; t > c + 1; t--) { const [x, z] = this.centre(cells[t]); if (this.clear(ax0, az0, x, z, team)) { far = t; break; } }
      const [x, z] = this.centre(cells[far]); pts.push([x, z]); ax0 = x; az0 = z; c = far;
    }
    if (bi >= 0) {
      const wb = this.occ[cells[bi]], [px, pz] = bi > 0 ? this.centre(cells[bi - 1]) : [ax, az];
      if (!pts.length || pts[pts.length - 1][0] !== px || pts[pts.length - 1][1] !== pz) pts.push([px, pz]);
      return { pts, breach: wb, at: pts.length - 1 };
    }
    pts.push([bx, bz]);
    return { pts, breach: null, at: -1 };
  }
  nearestOpen(k, team, ax, az) {
    let best = k, bd = Infinity;
    const i = k % N, j = Math.floor(k / N);
    for (let r = 1; r < 12 && bd === Infinity; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = nj * N + ni; if (this.block(nk, team) === 2) continue;
      const [x, z] = this.centre(nk), d = Math.hypot(x - ax, z - az);
      if (d < bd) { bd = d; best = nk; }
    }
    return best;
  }
}
