// Draws the simulation: instanced soldiers and horses, banners, selection rings, projectiles, smoke and dust.
// Unit meshes are pools that grow as new units are trained.
import * as THREE from '../vendor/three.module.min.js';
import { part, mergeGeos } from './terrain.js';
import { groundY } from './world.js';

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CY = (rt, rb, h, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
const SP = (r, w = 7, h = 5) => new THREE.SphereGeometry(r, w, h);
const CO = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);

// Vertex tags drive the leg animation and horse coats in the unit shader.
const tag = (geos, t) => geos.map((g) => { const n = g.attributes.position.count; g.setAttribute('aTag', new THREE.BufferAttribute(new Float32Array(n).fill(t), 1)); return g; });
const mergeTagged = (geos) => {
  for (const g of geos) if (!g.attributes.aTag) tag([g], 0);
  const m = mergeGeos(geos);
  let n = 0; const t = new Float32Array(m.attributes.position.count);
  for (const g of geos) { t.set(g.attributes.aTag.array, n); n += g.attributes.position.count; }
  m.setAttribute('aTag', new THREE.BufferAttribute(t, 1));
  return m;
};
const COATS = ['#6e4529', '#8a5a32', '#3a2a20', '#b38b5a', '#cfc7b8', '#5a4a3e', '#2a2220', '#7a3e22'].map((c) => new THREE.Color(c));
const COATED = new Set(['cav', 'horsearcher', 'lancer']);

const LOOK = {
  kokand: { robe: '#2f7c66', robe2: '#245f4f', sash: '#d4a64a', pants: '#3a3833', hat: 'turban', hatC: '#ece6d8', saddle: '#2f8f74' },
  kipchak: { robe: '#9a3029', robe2: '#7a241f', sash: '#2b467a', pants: '#3a3330', hat: 'kalpak', hatC: '#efebe2', saddle: '#b0392f' },
};
const SKIN = '#c99a6e', WOOD = '#6b4a2c', METAL = '#9aa1ab', HORSE = '#6e4529';

// armour: false | 'steel' | 'gold' | 'doppi'
const hat = (L, y, armour = false) => armour === 'gold'
  ? [part(CO(0.18, 0.4), '#d9a23b', 0, y + 0.14), part(CY(0.18, 0.18, 0.07), '#a8792a', 0, y - 0.04), part(CO(0.05, 0.42, 5), '#f1ece0', 0, y + 0.5, -0.05, -0.5)]
  : armour === 'steel'
    ? [part(CO(0.17, 0.36), '#8a8f99', 0, y + 0.13), part(CY(0.17, 0.17, 0.06), '#5d616a', 0, y - 0.04), part(CO(0.04, 0.3, 5), '#a8322d', 0, y + 0.42, -0.04, -0.4)]
    : armour === 'doppi' ? [part(CY(0.13, 0.14, 0.12, 4), '#1d1d1d', 0, y - 0.02), part(CY(0.135, 0.135, 0.02, 4), '#e8e1cf', 0, y + 0.03)]
      : L.hat === 'turban' ? [part(SP(0.16), L.hatC, 0, y, 0, 0, 0, 0, 1, 0.72, 1)]
        : [part(CO(0.15, 0.36), L.hatC, 0, y + 0.12), part(CY(0.16, 0.16, 0.05), '#1d1b1a', 0, y - 0.05)];

const leg = (L, side, x, y, z, t) => tag([part(B(0.13, 0.62, 0.17), L.pants, x + side * 0.09, y + 0.5, z), part(B(0.14, 0.24, 0.22), '#2b231d', x + side * 0.09, y + 0.12, z + 0.02)], t);
const body = (L, y = 0, x = 0, z = 0, robe = L.robe, head = false, anim = true) => [
  ...leg(L, -1, x, y, z, anim ? 6 : 0), ...leg(L, 1, x, y, z, anim ? 7 : 0), part(CY(0.17, 0.28, 0.9), robe, x, y + 1.08, z),
  part(B(0.24, 0.07, 0.2), '#3b2a1e', x, y + 0.86, z),
  part(CY(0.2, 0.2, 0.08), L.sash, x, y + 1.02, z), part(B(0.1, 0.55, 0.1), robe, x + 0.25, y + 1.18, z + 0.04),
  part(B(0.1, 0.55, 0.1), robe, x - 0.25, y + 1.18, z + 0.04), part(SP(0.12), SKIN, x, y + 1.63, z), ...hat(L, y + 1.76, head).map((g) => g.translate(x, 0, z)),
];
const horse = (L, coat = HORSE) => [
  ...tag([part(B(0.55, 0.62, 1.7), coat, 0, 1.25), part(B(0.3, 0.75, 0.36), coat, 0, 1.68, 0.86, -0.6), part(B(0.22, 0.26, 0.58), coat, 0, 2.0, 1.2, 0.45),
    part(B(0.12, 0.12, 0.14), coat, 0.08, 2.17, 1.0), part(B(0.12, 0.12, 0.14), coat, -0.08, 2.17, 1.0)], 1),
  ...[[0.17, 0.6], [-0.17, 0.6], [0.17, -0.6], [-0.17, -0.6]].flatMap(([x, z], i) => tag([part(B(0.13, 0.8, 0.13), coat, x, 0.6, z), part(B(0.14, 0.22, 0.15), '#2b211a', x, 0.11, z)], 2 + i)),
  part(B(0.08, 0.7, 0.1), '#2b1d14', 0, 1.15, -0.95, 0.35), part(B(0.05, 0.45, 0.5), '#2b1d14', 0, 1.95, 0.8, -0.5), part(B(0.62, 0.08, 0.7), L.saddle, 0, 1.6, 0),
  part(B(0.66, 0.05, 0.08), '#5a3d22', 0, 1.62, 0.3), part(B(0.04, 0.35, 0.04), '#3b3b3b', 0.33, 1.3, 0), part(B(0.04, 0.35, 0.04), '#3b3b3b', -0.33, 1.3, 0),
];
const barding = (L, gold) => [
  part(B(0.72, 0.72, 1.9), gold ? L.saddle : '#7d838e', 0, 1.27), part(B(0.74, 0.1, 1.94), gold ? '#d9a23b' : L.saddle, 0, 0.93),
  part(B(0.34, 0.8, 0.42), gold ? L.saddle : '#7d838e', 0, 1.7, 0.88, -0.6), part(B(0.26, 0.3, 0.62), '#9aa1ab', 0, 2.02, 1.22, 0.45),
];
const rider = (L, armour) => [
  part(B(0.11, 0.45, 0.12), L.pants, 0.3, 1.5, 0.05), part(B(0.11, 0.45, 0.12), L.pants, -0.3, 1.5, 0.05),
  part(CY(0.16, 0.22, 0.66), armour === 'gold' ? '#8c6b2a' : armour === 'steel' ? '#5d616a' : L.robe, 0, 1.97), part(CY(0.19, 0.19, 0.07), L.sash, 0, 1.75),
  part(B(0.1, 0.5, 0.1), L.robe2, 0.24, 2.05, 0.1, -0.5), part(B(0.1, 0.5, 0.1), L.robe2, -0.24, 2.05, 0.1, -0.5),
  part(SP(0.12), SKIN, 0, 2.42), ...hat(L, 2.55, armour),
];
const sabre = (x, y, z, rx) => part(B(0.04, 0.8, 0.07), METAL, x, y, z, rx);
const bow = (x, y, z) => part(new THREE.TorusGeometry(0.48, 0.025, 4, 10, Math.PI), '#5a3a1e', x, y, z, 0, Math.PI / 2, 0);
const roundShield = (L, x, y, z, r = 0.3) => [part(CY(r, r, 0.05, 12), L.robe2, x, y, z, Math.PI / 2), part(CY(r * 0.3, r * 0.3, 0.07, 8), '#c9a24a', x, y, z + 0.03, Math.PI / 2),
  part(new THREE.TorusGeometry(r, 0.025, 4, 14), '#c9a24a', x, y, z + 0.02)];

const MODELS = {
  worker: (L) => [...body(L, 0, 0, 0, '#7a6648', L.hat === 'turban' ? 'doppi' : false), part(CY(0.025, 0.025, 0.9, 4), WOOD, 0.3, 1.0, 0.2, 0.6), part(B(0.06, 0.16, 0.22), '#6f747c', 0.3, 1.36, 0.42, 0.6)],
  officer: (L) => [...horse(L, '#3b2a1e'), ...rider(L), part(CO(0.035, 0.4, 5), '#f1ece0', 0, 2.9, -0.06, -0.4), sabre(0.36, 2.55, 0.3, -0.3),
    part(CY(0.025, 0.025, 2.2, 4), WOOD, -0.18, 2.9, -0.32), part(B(0.02, 0.4, 0.55), L.saddle, -0.18, 3.75, -0.6), part(CY(0.21, 0.21, 0.08), '#d9a23b', 0, 1.76)],
  wagon: (L) => [
    ...horse(L, '#5b3b24').map((g) => g.translate(0, 0, 2.7)),
    part(B(0.07, 0.07, 2.6), WOOD, 0.36, 1.25, 1.3, 0.12), part(B(0.07, 0.07, 2.6), WOOD, -0.36, 1.25, 1.3, 0.12),
    part(B(1.5, 0.22, 2.5), WOOD, 0, 1.15, -0.5),
    ...[0.86, -0.86].flatMap((x) => [part(CY(1.08, 1.08, 0.12, 16), '#4a3220', x, 1.08, -0.6, 0, 0, Math.PI / 2), part(CY(0.16, 0.16, 0.22, 8), '#2b1d14', x, 1.08, -0.6, 0, 0, Math.PI / 2),
      ...[0, 1, 2].map((k) => part(B(0.05, 2.0, 0.07), '#5a3d22', x, 1.08, -0.6, (k * Math.PI) / 3))]),
    part(CY(0.56, 0.56, 1.5, 12), '#efe8d6', 0, 1.85, -0.1, 0, 0, Math.PI / 2), part(CY(0.5, 0.5, 1.5, 12), '#e2d6bf', 0, 1.8, -1.05, 0, 0, Math.PI / 2),
    part(B(1.45, 0.08, 1.9), L.saddle, 0, 2.38, -0.6), part(B(1.47, 0.09, 0.12), '#d9a23b', 0, 2.4, 0.3),
    ...[-0.45, 0, 0.45].map((x) => part(B(0.06, 0.06, 2.8), '#8a6a44', x, 2.5, -0.6, 0.12)),
  ],
  musket: (L) => [...body(L), part(B(0.05, 1.45, 0.05), WOOD, 0.27, 1.15, 0.1), part(CY(0.02, 0.02, 0.6, 4), '#3b3b3b', 0.27, 1.95, 0.1)],
  cannon: (L) => [part(B(0.7, 0.35, 1.5), WOOD, 0, 0.55, -0.1), part(CY(0.46, 0.46, 0.1, 12), '#4a3220', 0.45, 0.46, -0.1, 0, 0, Math.PI / 2),
    part(CY(0.46, 0.46, 0.1, 12), '#4a3220', -0.45, 0.46, -0.1, 0, 0, Math.PI / 2), part(CY(0.12, 0.17, 1.8, 9), '#a07c3a', 0, 0.86, 0.4, Math.PI / 2),
    part(B(0.25, 0.12, 1.3), WOOD, 0, 0.3, -1.3, 0.25), ...body(L, 0, 1.1, -0.8, L.robe, false, false), ...body(L, 0, -1.15, -0.4, L.robe, false, false)],
  archer: (L) => [...body(L), bow(-0.3, 1.2, 0.12), part(B(0.13, 0.55, 0.13), '#5a3a1e', 0.12, 1.25, -0.2, 0.25), part(B(0.02, 0.2, 0.02), '#e8e1cf', 0.12, 1.6, -0.24)],
  sword: (L) => [...body(L), ...roundShield(L, -0.28, 1.12, 0.16, 0.34), sabre(0.3, 1.25, 0.25, 0.6)],
  spear: (L) => [...body(L), part(CY(0.025, 0.025, 3.3, 4), WOOD, 0.28, 1.6, 0.06), part(CO(0.05, 0.28, 4), METAL, 0.28, 3.38, 0.06), ...roundShield(L, -0.27, 1.15, 0.14)],
  cav: (L) => [...horse(L), ...rider(L), sabre(0.34, 2.2, 0.25, 0.7)],
  horsearcher: (L) => [...horse(L), ...rider(L), bow(-0.36, 2.1, 0.15), part(B(0.14, 0.5, 0.14), '#5a3a1e', 0.2, 2.1, -0.25, 0.3), sabre(0.32, 1.75, -0.1, 1.2)],
  lancer: (L) => [...horse(L), ...rider(L, 'steel'), part(CY(0.03, 0.03, 4, 4), WOOD, 0.34, 2.35, 0.7, 1.15), part(CO(0.05, 0.3, 4), METAL, 0.34, 3.1, 2.55, 1.15),
    part(B(0.02, 0.22, 0.4), L.saddle, 0.34, 2.95, 2.0, 1.15)],
  guard: (L) => [...horse(L, '#4a3020'), ...barding(L, false), ...rider(L, 'steel'), ...roundShield(L, -0.36, 2.05, 0.1, 0.28),
    part(CY(0.035, 0.035, 4.2, 4), WOOD, 0.34, 2.4, 0.75, 1.15), part(CO(0.06, 0.34, 4), METAL, 0.34, 3.2, 2.65, 1.15)],
  commander: (L) => [...horse(L, '#2f241c'), ...barding(L, true), ...rider(L, 'gold'), part(B(0.62, 0.95, 0.05), L.saddle, 0, 1.95, -0.26, 0.25),
    sabre(0.36, 2.55, 0.3, -0.3), ...roundShield(L, -0.36, 2.05, 0.1, 0.3)],
};

// Lambert material for units: legs swing around the hip / shoulder of the horse, horse coats tint per instance.
const unitMaterial = () => {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTag; attribute vec2 aAnim; attribute vec3 aCoat;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor.xyz *= mix(vec3(1.0), aCoat, (aTag > 0.5 && aTag < 5.5) ? 1.0 : 0.0);')
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position);
        if (aTag > 1.5) {
          bool horseLeg = aTag < 5.5;
          float pivot = horseLeg ? 1.0 : 0.8;
          float odd = horseLeg ? ((aTag < 2.5 || aTag > 4.5) ? 0.0 : 3.14159) : (aTag > 6.5 ? 3.14159 : 0.0);
          float an = sin(aAnim.x + odd) * (horseLeg ? 0.55 : 0.5) * aAnim.y;
          float dy = transformed.y - pivot;
          if (dy < 0.0) { transformed.z -= dy * sin(an); transformed.y = pivot + dy * cos(an); }
        }`);
  };
  return m;
};

const BANNER = (F) => mergeGeos([part(CY(0.045, 0.045, 5.2, 5), WOOD, 0, 2.6), part(B(0.03, 0.9, 1.4), F.color, 0, 4.55, -0.72),
  part(B(0.035, 0.18, 1.42), '#e7c46a', 0, 4.1, -0.72), F.key === 'kipchak' ? part(CO(0.16, 0.7, 6), '#1d1b1a', 0, 5.0, 0, Math.PI) : part(SP(0.12), '#e7c46a', 0, 5.3)]);

const PARTICLE_VS = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale;
varying float vA; varying vec3 vC;
void main(){ vA=aAlpha; vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const PARTICLE_FS = `varying float vA; varying vec3 vC;
void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard; gl_FragColor=vec4(vC, vA*smoothstep(0.5,0.12,d)); }`;

// An instanced mesh that grows when it fills up.
class Pool {
  constructor(root, geo, mat, cap = 64, shadow = true) {
    Object.assign(this, { root, geo, mat, shadow, list: [] });
    this.make(cap);
  }
  make(cap) {
    if (this.geo.attributes.aTag) {
      const grow = (name, size, fill) => { const a = new THREE.InstancedBufferAttribute(new Float32Array(cap * size).fill(fill), size); const o = this.geo.attributes[name]; if (o) a.array.set(o.array.subarray(0, Math.min(o.array.length, cap * size))); a.setUsage(THREE.DynamicDrawUsage); this.geo.setAttribute(name, a); };
      grow('aAnim', 2, 0); grow('aCoat', 3, 1);
    }
    const old = this.mesh, m = new THREE.InstancedMesh(this.geo, this.mat, cap);
    m.castShadow = this.shadow; m.receiveShadow = this.shadow; m.frustumCulled = false; m.count = 0;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    if (old) { m.instanceColor.array.set(old.instanceColor.array.subarray(0, Math.min(old.instanceColor.array.length, cap * 3))); this.root.remove(old); old.dispose(); }
    this.root.add(m); this.mesh = m; this.cap = cap;
  }
  ensure(n) { if (n > this.cap) { let c = this.cap; while (c < n) c *= 2; this.make(c); } }
}

export class Renderer3D {
  constructor(scene, sim) {
    this.scene = scene; this.sim = sim; this.root = new THREE.Group(); scene.add(this.root);
    this.dummy = new THREE.Object3D(); this.selected = new Set(); this.time = 0;
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.unitMat = unitMaterial();
    this.pools = new Map();
    for (const s of sim.soldiers) this.addSoldier(s);
    this.banners = sim.teams.map((tm) => new Pool(this.root, BANNER(tm.faction), this.mat, 32));
    const ringGeo = new THREE.RingGeometry(0.55, 0.78, 18).rotateX(-Math.PI / 2);
    const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.rings = new Pool(this.root, ringGeo, ringMat('#f5f1c8', 0.95), 256, false);
    this.targetRings = new Pool(this.root, ringGeo, ringMat('#ff6b5a', 0.7), 256, false);
    this.arrows = new Pool(this.root, B(0.035, 0.035, 0.95), new THREE.MeshBasicMaterial({ color: '#3a2a1a' }), 512, false);
    this.balls = new Pool(this.root, SP(0.2, 8, 6), new THREE.MeshLambertMaterial({ color: '#2a2a2a' }), 32, false);
    this.markers = [];
    const N = 9000;
    this.pData = []; this.pMax = N;
    const pg = new THREE.BufferGeometry();
    this.pPos = new Float32Array(N * 3); this.pSize = new Float32Array(N); this.pAlpha = new Float32Array(N); this.pCol = new Float32Array(N * 3);
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aSize', new THREE.BufferAttribute(this.pSize, 1).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aAlpha', new THREE.BufferAttribute(this.pAlpha, 1).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aColor', new THREE.BufferAttribute(this.pCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.pMat = new THREE.ShaderMaterial({ vertexShader: PARTICLE_VS, fragmentShader: PARTICLE_FS, uniforms: { uScale: { value: 800 } }, transparent: true, depthWrite: false });
    this.points = new THREE.Points(pg, this.pMat); this.points.frustumCulled = false; this.root.add(this.points);
  }

  addSoldier(s) {
    if (s.pool) return;
    const fk = this.sim.teams[s.team].key, key = s.model + '|' + fk;
    let p = this.pools.get(key);
    if (!p) { p = new Pool(this.root, mergeTagged(MODELS[s.model](LOOK[fk])), this.unitMat, 64); p.coated = COATED.has(s.model); this.pools.set(key, p); }
    p.ensure(p.list.length + 1);
    s.pool = p; s.mi = p.list.length; p.list.push(s);
    if (!s.coat) { const c = p.coated ? COATS[(s.i * 7 + 3) % COATS.length] : null, base = new THREE.Color(HORSE); s.coat = c ? [c.r / base.r, c.g / base.g, c.b / base.b] : [1, 1, 1]; }
    this.paint(p, s);
  }
  paint(p, s) {
    p.mesh.setColorAt(s.mi, new THREE.Color().setScalar(s.tint)); p.mesh.instanceColor.needsUpdate = true;
    const c = p.geo.attributes.aCoat; c.array.set(s.coat, s.mi * 3); c.needsUpdate = true;
  }
  removeSoldier(s) {
    const p = s.pool, last = p.list.pop();
    if (last !== s) { p.list[s.mi] = last; last.mi = s.mi; this.paint(p, last); }
    s.pool = null;
  }

  puff(x, y, z, kind) {
    if (this.pData.length >= this.pMax) this.pData.shift();
    const r = Math.random;
    const K = {
      smoke: [[0.9, 0.9, 0.87], 1.4, 6.5, 3.5 + r() * 2, 0.5, [0.7 + r() * 0.4, 0.35 + r() * 0.3, 0.2]],
      flash: [[1, 0.85, 0.45], 1.3, 0.6, 0.08, 1, [0, 0, 0]],
      cannon: [[0.88, 0.88, 0.85], 3, 14, 6 + r() * 3, 0.6, [0.6 + r(), 0.5 + r() * 0.4, r() - 0.5]],
      dust: [[0.78, 0.71, 0.56], 1, 3.6, 1.3, 0.28, [r() - 0.5, 0.4, r() - 0.5]],
      impact: [[0.74, 0.66, 0.52], 2, 10, 2.4, 0.42, [(r() - 0.5) * 3, 2 + r() * 2, (r() - 0.5) * 3]],
      chips: [[0.62, 0.45, 0.26], 0.4, 0.8, 0.6, 0.9, [(r() - 0.5) * 2, 1.5 + r(), (r() - 0.5) * 2]],
      grit: [[0.75, 0.74, 0.7], 0.4, 1, 0.7, 0.8, [(r() - 0.5) * 2, 1.2 + r(), (r() - 0.5) * 2]],
      spark: [[1, 0.85, 0.3], 0.35, 0.5, 0.5, 1, [(r() - 0.5) * 2, 1.4 + r(), (r() - 0.5) * 2]],
      chaff: [[0.85, 0.76, 0.45], 0.4, 1.4, 1, 0.6, [(r() - 0.5) * 1.5, 0.8, (r() - 0.5) * 1.5]],
      rubble: [[0.68, 0.6, 0.48], 4, 18, 4 + r() * 3, 0.55, [(r() - 0.5) * 4, 1.5 + r() * 2, (r() - 0.5) * 4]],
    }[kind];
    this.pData.push({ x, y, z, c: K[0], s0: K[1], s1: K[2], life: K[3], t: 0, a: K[4], v: K[5] });
  }

  marker(x, z, color, size = 1) { this.markers.push({ x, z, t: 0, color, size }); }

  onEvents(events) {
    for (const e of events) {
      if (e.k === 'spawn') this.addSoldier(e.s);
      else if (e.k === 'removed') { if (e.s.pool) this.removeSoldier(e.s); }
      else if (e.k === 'musket') {
        const mx = e.x + Math.sin(e.yaw) * 0.8, mz = e.z + Math.cos(e.yaw) * 0.8;
        this.puff(mx, e.y + 1.5, mz, 'flash'); this.puff(mx, e.y + 1.6, mz, 'smoke'); if (Math.random() < 0.5) this.puff(mx, e.y + 1.8, mz, 'smoke');
      } else if (e.k === 'cannon') {
        const mx = e.x + Math.sin(e.yaw) * 1.9, mz = e.z + Math.cos(e.yaw) * 1.9;
        this.puff(mx, e.y + 1, mz, 'flash'); for (let i = 0; i < 5; i++) this.puff(mx, e.y + 1.2, mz, 'cannon');
      } else if (e.k === 'impact') for (let i = 0; i < 7; i++) this.puff(e.x, e.y + 0.5, e.z, 'impact');
      else if (e.k === 'work') { const y = groundY(e.x, e.z) + 1; for (let i = 0; i < 3; i++) this.puff(e.x, y, e.z, { wood: 'chips', stone: 'grit', gold: 'spark', food: 'chaff' }[e.res]); }
      else if (e.k === 'cry') { this.marker(e.x, e.z, '#ffd66b', 2.2); for (let i = 0; i < 14; i++) this.puff(e.x + (Math.random() - 0.5) * 16, groundY(e.x, e.z) + 0.4, e.z + (Math.random() - 0.5) * 16, 'dust'); }
      else if (e.k === 'cmdDead') this.marker(e.x, e.z, '#ff6b5a', 2.5);
      else if (e.k === 'bdead') { const b = e.b; for (let i = 0; i < 24; i++) this.puff(b.x + (Math.random() - 0.5) * b.w, b.y + 1 + Math.random() * 4, b.z + (Math.random() - 0.5) * b.d, 'rubble'); }
    }
  }

  update(dt, camera, viewportH) {
    const sim = this.sim, d = this.dummy, t = sim.time;
    this.time += dt;
    const keepCorpse = sim.mode === 'battle' ? 1e9 : 120;
    for (const p of this.pools.values()) {
      for (let i = p.list.length - 1; i >= 0; i--) { const s = p.list[i]; if (!s.alive && t - s.deadT > keepCorpse) this.removeSoldier(s); }
      for (const s of p.list) {
        const T = s.T;
        let y = s.y, rx = 0, rz = 0;
        if (s.alive) {
          const f = T.mounted ? 1.7 : 2.4;
          y += Math.abs(Math.sin(s.walk * f)) * (T.mounted ? 0.14 : 0.06) * Math.min(1, s.speed);
          if (T.mounted) rx = Math.sin(s.walk * f) * 0.05 * Math.min(1, s.speed / 4);
          if (t - s.strikeT < 0.25) rx -= T.worker ? 0.45 : 0.25;
          if (t - s.shotT < 0.15 && T.ranged?.kind === 'musket') rx += 0.08;
          if (T.mounted && s.speed > 6 && Math.random() < 0.035) this.puff(s.x, s.y + 0.3, s.z, 'dust');
        } else {
          const k = Math.min(1, (t - s.deadT) / 0.6);
          rz = s.fall * k * Math.PI / 2 * (T.artillery ? 0.25 : 1); y -= k * (T.mounted ? 0.35 : 0.12);
        }
        d.position.set(s.x, y, s.z); d.rotation.set(rx, s.yaw, rz, 'YXZ'); d.scale.setScalar(1); d.updateMatrix();
        p.mesh.setMatrixAt(s.mi, d.matrix);
        const an = p.geo.attributes.aAnim.array;
        an[s.mi * 2] = s.walk * (T.mounted || T.wagon ? 2.4 : 4.4); an[s.mi * 2 + 1] = s.alive ? Math.min(1, s.speed / (T.mounted || T.wagon ? 4 : 1.8)) : 0;
      }
      p.mesh.count = p.list.length; p.mesh.instanceMatrix.needsUpdate = true; p.geo.attributes.aAnim.needsUpdate = true;
    }
    // banners over real formations (not over single units)
    const bn = [0, 0];
    for (const sq of sim.squads) {
      const b = sq.banner;
      if (!b || sq.dead || sq.solo || !b.alive) continue;
      const pool = this.banners[sq.team], i = bn[sq.team]++;
      pool.ensure(i + 1);
      d.position.set(b.x + Math.cos(b.yaw) * 0.45, b.y + (b.T.mounted ? 1.2 : 0) + (sq.state === 'rout' ? -1.2 : 0), b.z - Math.sin(b.yaw) * 0.45);
      d.rotation.set(sq.state === 'rout' ? 0.5 : Math.sin(t * 2 + i) * 0.04, sq.face + Math.PI / 2 + Math.sin(t * 1.3 + i) * 0.15, 0, 'YXZ');
      d.scale.setScalar(b.isCmd ? 1.35 : 1); d.updateMatrix(); pool.mesh.setMatrixAt(i, d.matrix);
    }
    this.banners.forEach((p, k) => { p.mesh.count = bn[k]; p.mesh.instanceMatrix.needsUpdate = true; });
    // rings under selected units and under the enemy they were told to attack
    const ring = (pool, list) => {
      let n = 0;
      for (const s of list) { pool.ensure(n + 1); d.position.set(s.x, s.y + 0.12, s.z); d.rotation.set(0, 0, 0); d.scale.setScalar(s.T.mounted ? 1.7 : s.T.artillery ? 2.2 : 1); d.updateMatrix(); pool.mesh.setMatrixAt(n++, d.matrix); }
      pool.mesh.count = n; pool.mesh.instanceMatrix.needsUpdate = true;
    };
    const sel = [], tgt = [], seenT = new Set();
    for (const sq of this.selected) {
      if (sq.dead) continue;
      sel.push(...sq.alive);
      const tg = sq.order.kind === 'attack' && !sq.order.auto ? sq.order.target : null;
      if (tg && !seenT.has(tg)) { seenT.add(tg); tgt.push(...tg.alive); }
    }
    ring(this.rings, sel); ring(this.targetRings, tgt);
    // projectiles
    let a = 0, bl = 0;
    for (const p of sim.projectiles) {
      const u = p.t / p.T, x = p.x0 + (p.x1 - p.x0) * u, z = p.z0 + (p.z1 - p.z0) * u, y = p.y0 + (p.y1 - p.y0) * u + p.arc * 4 * u * (1 - u);
      if (p.k === 'arrow') {
        const vy = (p.y1 - p.y0) / p.T + p.arc * 4 * (1 - 2 * u) / p.T, vh = Math.hypot(p.x1 - p.x0, p.z1 - p.z0) / p.T;
        this.arrows.ensure(a + 1);
        d.position.set(x, y, z); d.rotation.set(-Math.atan2(vy, vh), Math.atan2(p.x1 - p.x0, p.z1 - p.z0), 0, 'YXZ'); d.scale.setScalar(1); d.updateMatrix();
        this.arrows.mesh.setMatrixAt(a++, d.matrix);
      } else { this.balls.ensure(bl + 1); d.position.set(x, y, z); d.rotation.set(0, 0, 0); d.scale.setScalar(1); d.updateMatrix(); this.balls.mesh.setMatrixAt(bl++, d.matrix); }
    }
    this.arrows.mesh.count = a; this.balls.mesh.count = bl;
    this.arrows.mesh.instanceMatrix.needsUpdate = true; this.balls.mesh.instanceMatrix.needsUpdate = true;
    // order markers (expanding rings)
    for (const mk of this.markers) {
      if (!mk.mesh) { mk.mesh = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: mk.color, transparent: true, depthWrite: false })); this.root.add(mk.mesh); }
      mk.t += dt; mk.mesh.position.set(mk.x, groundY(mk.x, mk.z) + 0.2, mk.z); mk.mesh.scale.setScalar((1 + mk.t * 1.5) * mk.size); mk.mesh.material.opacity = Math.max(0, 1 - mk.t / 0.9);
      if (mk.t > 0.9) { this.root.remove(mk.mesh); mk.mesh.geometry.dispose(); mk.mesh.material.dispose(); }
    }
    this.markers = this.markers.filter((mk) => mk.t <= 0.9);
    // particles
    const P = this.pData;
    let k = 0;
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      p.t += dt;
      if (p.t >= p.life) continue;
      p.x += p.v[0] * dt; p.y += p.v[1] * dt; p.z += p.v[2] * dt;
      const u = p.t / p.life;
      this.pPos[k * 3] = p.x; this.pPos[k * 3 + 1] = p.y; this.pPos[k * 3 + 2] = p.z;
      this.pSize[k] = p.s0 + (p.s1 - p.s0) * Math.sqrt(u);
      this.pAlpha[k] = p.a * Math.min(1, u * 8) * (1 - u);
      this.pCol[k * 3] = p.c[0]; this.pCol[k * 3 + 1] = p.c[1]; this.pCol[k * 3 + 2] = p.c[2];
      P[k++] = p;
    }
    P.length = k;
    const g = this.points.geometry;
    for (const at of ['position', 'aSize', 'aAlpha', 'aColor']) g.attributes[at].needsUpdate = true;
    g.setDrawRange(0, k);
    this.pMat.uniforms.uScale.value = viewportH / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }
}
