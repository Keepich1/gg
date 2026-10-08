// Mouse and keyboard: select squads, give orders, formations, control groups.
import * as THREE from '../vendor/three.module.min.js';
import { frontage, formationsFor } from './units.js';
import { groundY } from './world.js';

const PICK = 26; // px

export class Input {
  constructor({ dom, rts, scene, onChange }) {
    this.dom = dom; this.rts = rts; this.scene = scene; this.onChange = onChange || (() => {});
    this.sim = null; this.r3d = null; this.team = 0;
    this.sel = new Set(); this.groups = {}; this.lastDigit = { k: null, t: 0 };
    this.box = document.getElementById('selbox');
    this.v = new THREE.Vector3();
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#fff6c8', depthTest: false }));
    this.line.renderOrder = 10; this.line.visible = false; scene.add(this.line);
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('pointerdown', (e) => this.down(e));
    dom.addEventListener('pointermove', (e) => this.move(e));
    dom.addEventListener('pointerup', (e) => this.up(e));
    dom.addEventListener('dblclick', (e) => this.dbl(e));
    addEventListener('keydown', (e) => this.key(e));
  }

  attach(sim, r3d, team = 0) {
    this.sim = sim; this.r3d = r3d; this.team = team; this.sel = r3d.selected; this.groups = {};
    this.sel.clear(); this.run = false; this.onChange();
  }

  pos(e) { const r = this.dom.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  screenOf(s) {
    const v = this.v.set(s.x, s.y + 1.2, s.z).project(this.rts.cam);
    if (v.z > 1) return null;
    return [((v.x + 1) / 2) * this.dom.clientWidth, ((1 - v.y) / 2) * this.dom.clientHeight];
  }
  soldierAt(px, py, wantEnemy) {
    let best = null, bd = PICK * PICK;
    for (const s of this.sim.soldiers) {
      if (!s.alive || (s.team !== this.team) !== wantEnemy) continue;
      const p = this.screenOf(s); if (!p) continue;
      const d = (p[0] - px) ** 2 + (p[1] - py) ** 2;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  select(list, add = false) {
    if (!add) this.sel.clear();
    for (const sq of list) if (!sq.dead && sq.team === this.team) this.sel.add(sq);
    this.onChange();
  }
  selectedLive() { return [...this.sel].filter((q) => !q.dead); }

  down(e) {
    if (!this.sim) return;
    const [x, y] = this.pos(e);
    if (e.button === 0) { this.ldrag = { x0: x, y0: y, x1: x, y1: y, shift: e.shiftKey }; this.dom.setPointerCapture(e.pointerId); }
    if (e.button === 2) {
      const g = this.rts.groundAt(x, y);
      this.rdrag = { x0: x, y0: y, g0: g, g1: g };
      this.dom.setPointerCapture(e.pointerId);
    }
  }
  move(e) {
    const [x, y] = this.pos(e);
    if (this.ldrag) {
      Object.assign(this.ldrag, { x1: x, y1: y });
      const L = this.ldrag, w = Math.abs(L.x1 - L.x0), h = Math.abs(L.y1 - L.y0);
      if (w + h > 6) Object.assign(this.box.style, { display: 'block', left: Math.min(L.x0, L.x1) + 'px', top: Math.min(L.y0, L.y1) + 'px', width: w + 'px', height: h + 'px' });
    }
    if (this.rdrag && this.rdrag.g0) {
      const g = this.rts.groundAt(x, y);
      if (g) this.rdrag.g1 = g;
      if (Math.hypot(x - this.rdrag.x0, y - this.rdrag.y0) > 12 && this.sel.size) {
        const a = this.rdrag.g0, b = this.rdrag.g1, p = this.line.geometry.attributes.position;
        p.setXYZ(0, a.x, groundY(a.x, a.z) + 0.8, a.z); p.setXYZ(1, b.x, groundY(b.x, b.z) + 0.8, b.z); p.needsUpdate = true;
        this.line.visible = true;
      }
    }
  }
  up(e) {
    const [x, y] = this.pos(e);
    if (e.button === 0 && this.ldrag) {
      const L = this.ldrag; this.ldrag = null; this.box.style.display = 'none';
      if (Math.abs(L.x1 - L.x0) + Math.abs(L.y1 - L.y0) > 6) {
        const x0 = Math.min(L.x0, L.x1), x1 = Math.max(L.x0, L.x1), y0 = Math.min(L.y0, L.y1), y1 = Math.max(L.y0, L.y1), hit = new Set();
        for (const s of this.sim.soldiers) {
          if (!s.alive || s.team !== this.team) continue;
          const p = this.screenOf(s);
          if (p && p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1) hit.add(s.sq);
        }
        this.select(hit, L.shift);
      } else {
        const s = this.soldierAt(x, y, false);
        if (s) { if (L.shift && this.sel.has(s.sq)) { this.sel.delete(s.sq); this.onChange(); } else this.select([s.sq], L.shift); }
        else if (!L.shift) this.select([]);
      }
    }
    if (e.button === 2 && this.rdrag) {
      const R = this.rdrag; this.rdrag = null; this.line.visible = false;
      const sqs = this.selectedLive(); if (!sqs.length) return;
      const now = performance.now(), run = now - (this.lastRight || 0) < 350;
      this.lastRight = now; this.run = run;
      const foe = this.soldierAt(x, y, true);
      if (foe && Math.hypot(x - R.x0, y - R.y0) < 12) {
        for (const sq of sqs) this.sim.order(sq, { kind: 'attack', target: foe.sq, run });
        this.r3d.marker(foe.sq.mx, foe.sq.mz, '#ff6b5a');
      } else if (R.g0) {
        if (Math.hypot(x - R.x0, y - R.y0) >= 12 && R.g1) this.lineOrder(sqs, R.g0, R.g1);
        else this.groupMove(sqs, R.g0.x, R.g0.z);
      }
      this.onChange();
    }
  }
  dbl(e) {
    const [x, y] = this.pos(e), s = this.soldierAt(x, y, false);
    if (!s) return;
    const same = this.sim.squads.filter((q) => q.team === this.team && !q.dead && q.key === s.sq.key && this.screenOf(q.alive[0]));
    this.select(same, e.shiftKey);
  }

  // Move several squads side by side to a point, facing away from where they are now.
  groupMove(sqs, x, z) {
    let cx = 0, cz = 0;
    for (const q of sqs) { cx += q.mx; cz += q.mz; }
    cx /= sqs.length; cz /= sqs.length;
    let face = Math.atan2(x - cx, z - cz);
    if (Math.hypot(x - cx, z - cz) < 8) face = sqs[0].face;
    this.placeAlong(sqs, x, z, face, null);
  }
  // Drag a front line: squads spread along it and face perpendicular to it, away from the camera.
  lineOrder(sqs, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
    let face = Math.atan2(-dz, dx);
    const camF = Math.atan2(this.rts.tx - this.rts.cam.position.x, this.rts.tz - this.rts.cam.position.z);
    if (Math.cos(face - camF) < 0) face += Math.PI;
    this.placeAlong(sqs, (a.x + b.x) / 2, (a.z + b.z) / 2, face, len);
  }
  placeAlong(sqs, x, z, face, width) {
    const rx = -Math.cos(face), rz = Math.sin(face);
    const sorted = sqs.slice().sort((p, q) => (p.mx * rx + p.mz * rz) - (q.mx * rx + q.mz * rz));
    const gap = 6, widths = sorted.map((q) => frontage(q));
    const total = widths.reduce((s, w) => s + w, 0) + gap * (sorted.length - 1);
    const scale = width ? Math.max(0.3, (width - gap * (sorted.length - 1)) / Math.max(1, total - gap * (sorted.length - 1))) : 1;
    let acc = -((width ? width : total) / 2);
    sorted.forEach((q, i) => {
      const w = widths[i] * scale, mid = acc + w / 2;
      const files = width && q.formation !== 'square' && q.formation !== 'column' ? Math.max(2, Math.round(w / (q.T.spacing * (q.formation === 'loose' ? 1.8 : 1))) + 1) : q.files;
      const px = x + rx * mid, pz = z + rz * mid;
      this.sim.order(q, { kind: 'move', x: px, z: pz, face, files, run: this.run });
      this.r3d.marker(px, pz, '#c8f5b0');
      acc += w + gap;
    });
  }

  key(e) {
    if (!this.sim || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const sqs = this.selectedLive();
    if (e.code === 'KeyH') { for (const q of sqs) this.sim.order(q, { kind: 'hold', face: q.face }); this.onChange(); }
    else if (e.code === 'KeyF') this.cycleFormation(sqs);
    else if (e.code === 'KeyG') this.toggleSkirmish(sqs);
    else if (e.code === 'KeyR') this.toggleMelee(sqs);
    else if (e.code === 'KeyV') this.warCry();
    else if (e.code === 'Escape') this.select([]);
    else if (e.code === 'Space') { e.preventDefault(); this.focus(sqs); }
    else if (/^Digit[1-9]$/.test(e.code)) {
      const k = e.code.slice(5);
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.groups[k] = sqs; this.onChange(); return; }
      const g = (this.groups[k] || []).filter((q) => !q.dead);
      if (!g.length) return;
      const now = performance.now();
      if (this.lastDigit.k === k && now - this.lastDigit.t < 350) this.focus(g);
      this.lastDigit = { k, t: now };
      this.select(g);
    }
  }
  cycleFormation(sqs) {
    for (const q of sqs) { const f = formationsFor(q.T), i = f.indexOf(q.formation); q.formation = f[(i + 1) % f.length]; q.files = null; }
    this.onChange();
  }
  toggleSkirmish(sqs) {
    const hs = sqs.filter((q) => q.T.skirmish);
    const on = !hs.every((q) => q.skirmish);
    for (const q of hs) q.skirmish = on;
    this.onChange();
  }
  toggleMelee(sqs) {
    const rs = sqs.filter((q) => q.T.ranged);
    const on = !rs.every((q) => q.meleeMode);
    for (const q of rs) this.sim.setMelee(q, on);
    this.onChange();
  }
  warCry() { if (this.sim.warCry(this.team)) this.onChange(); }
  focus(sqs) {
    if (!sqs.length) return;
    this.rts.centerOn(sqs.reduce((a, q) => a + q.mx, 0) / sqs.length, sqs.reduce((a, q) => a + q.mz, 0) / sqs.length);
  }
}
