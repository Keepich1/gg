// Draws the simulation: instanced soldiers and horses, banners, selection rings, projectiles and smoke.
import * as THREE from '../vendor/three.module.min.js';
import { part, mergeGeos } from './terrain.js';
import { FACTIONS } from './units.js';
import { groundY } from './world.js';

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CY = (rt, rb, h, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
const SP = (r, w = 7, h = 5) => new THREE.SphereGeometry(r, w, h);
const CO = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);

const LOOK = {
  kokand: { robe: '#2f7c66', robe2: '#245f4f', sash: '#d4a64a', pants: '#3a3833', hat: 'turban', hatC: '#ece6d8', saddle: '#2f8f74' },
  kipchak: { robe: '#9a3029', robe2: '#7a241f', sash: '#2b467a', pants: '#3a3330', hat: 'kalpak', hatC: '#efebe2', saddle: '#b0392f' },
};
const SKIN = '#c99a6e', WOOD = '#6b4a2c', METAL = '#9aa1ab', HORSE = '#6e4529';

// armour: false | 'steel' | 'gold'
const hat = (L, y, armour = false) => armour === 'gold'
  ? [part(CO(0.18, 0.4), '#d9a23b', 0, y + 0.14), part(CY(0.18, 0.18, 0.07), '#a8792a', 0, y - 0.04), part(CO(0.05, 0.42, 5), '#f1ece0', 0, y + 0.5, -0.05, -0.5)]
  : armour === 'steel'
    ? [part(CO(0.17, 0.36), '#8a8f99', 0, y + 0.13), part(CY(0.17, 0.17, 0.06), '#5d616a', 0, y - 0.04), part(CO(0.04, 0.3, 5), '#a8322d', 0, y + 0.42, -0.04, -0.4)]
    : L.hat === 'turban' ? [part(SP(0.16), L.hatC, 0, y, 0, 0, 0, 0, 1, 0.72, 1)]
      : [part(CO(0.15, 0.36), L.hatC, 0, y + 0.12), part(CY(0.16, 0.16, 0.05), '#1d1b1a', 0, y - 0.05)];

const body = (L, y = 0, x = 0, z = 0) => [
  part(B(0.32, 0.8, 0.2), L.pants, x, y + 0.4, z), part(CY(0.17, 0.28, 0.9), L.robe, x, y + 1.08, z),
  part(CY(0.2, 0.2, 0.08), L.sash, x, y + 1.02, z), part(B(0.1, 0.55, 0.1), L.robe2, x + 0.25, y + 1.18, z + 0.04),
  part(B(0.1, 0.55, 0.1), L.robe2, x - 0.25, y + 1.18, z + 0.04), part(SP(0.12), SKIN, x, y + 1.63, z), ...hat(L, y + 1.76).map((g) => g.translate(x, 0, z)),
];
const horse = (L, coat = HORSE) => [
  part(B(0.55, 0.62, 1.7), coat, 0, 1.25), part(B(0.3, 0.75, 0.36), coat, 0, 1.68, 0.86, -0.6), part(B(0.22, 0.26, 0.58), coat, 0, 2.0, 1.2, 0.45),
  ...[[0.17, 0.6], [-0.17, 0.6], [0.17, -0.6], [-0.17, -0.6]].map(([x, z]) => part(B(0.13, 1.0, 0.13), '#4f311d', x, 0.5, z)),
  part(B(0.08, 0.7, 0.1), '#2b1d14', 0, 1.15, -0.95, 0.35), part(B(0.62, 0.08, 0.7), L.saddle, 0, 1.6, 0),
];
// horse armour: steel lamellar for the guard, team caparison with gold trim for the commander
const barding = (L, gold) => [
  part(B(0.72, 0.72, 1.9), gold ? L.saddle : '#7d838e', 0, 1.27), part(B(0.74, 0.1, 1.94), gold ? '#d9a23b' : L.saddle, 0, 0.93),
  part(B(0.34, 0.8, 0.42), gold ? L.saddle : '#7d838e', 0, 1.7, 0.88, -0.6), part(B(0.26, 0.3, 0.62), '#9aa1ab', 0, 2.02, 1.22, 0.45),
];
const rider = (L, armour) => [
  part(B(0.11, 0.45, 0.12), L.pants, 0.3, 1.5, 0.05), part(B(0.11, 0.45, 0.12), L.pants, -0.3, 1.5, 0.05),
  part(CY(0.16, 0.22, 0.66), armour === 'gold' ? '#8c6b2a' : armour ? '#5d616a' : L.robe, 0, 1.97), part(CY(0.19, 0.19, 0.07), L.sash, 0, 1.75),
  part(B(0.1, 0.5, 0.1), L.robe2, 0.24, 2.05, 0.1, -0.5), part(B(0.1, 0.5, 0.1), L.robe2, -0.24, 2.05, 0.1, -0.5),
  part(SP(0.12), SKIN, 0, 2.42), ...hat(L, 2.55, armour),
];
const sabre = (x, y, z, rx) => part(B(0.04, 0.8, 0.07), METAL, x, y, z, rx);
const bow = (x, y, z) => part(new THREE.TorusGeometry(0.48, 0.025, 4, 10, Math.PI), '#5a3a1e', x, y, z, 0, Math.PI / 2, 0);
const roundShield = (L, x, y, z, r = 0.3) => [part(CY(r, r, 0.05, 12), L.robe2, x, y, z, Math.PI / 2), part(CY(r * 0.3, r * 0.3, 0.07, 8), '#c9a24a', x, y, z + 0.03, Math.PI / 2),
  part(new THREE.TorusGeometry(r, 0.025, 4, 14), '#c9a24a', x, y, z + 0.02)];

const MODELS = {
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

const BANNER = (F) => mergeGeos([part(CY(0.045, 0.045, 5.2, 5), WOOD, 0, 2.6), part(B(0.03, 0.9, 1.4), F.color, 0, 4.55, -0.72),
  part(B(0.035, 0.18, 1.42), '#e7c46a', 0, 4.1, -0.72), F.key === 'kipchak' ? part(CO(0.16, 0.7, 6), '#1d1b1a', 0, 5.0, 0, Math.PI) : part(SP(0.12), '#e7c46a', 0, 5.3)]);

const PARTICLE_VS = `attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale;
varying float vA; varying vec3 vC;
void main(){ vA=aAlpha; vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const PARTICLE_FS = `varying float vA; varying vec3 vC;
void main(){ vec2 c=gl_PointCoord-0.5; float d=length(c); if(d>0.5) discard; gl_FragColor=vec4(vC, vA*smoothstep(0.5,0.12,d)); }`;

export class Renderer3D {
  constructor(scene, sim) {
    this.scene = scene; this.sim = sim; this.root = new THREE.Group(); scene.add(this.root);
    this.dummy = new THREE.Object3D(); this.selected = new Set();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    // one instanced mesh per (model, faction)
    const groups = new Map();
    for (const s of sim.soldiers) {
      const fk = sim.teams[s.team].key, key = s.model + '|' + fk;
      if (!groups.has(key)) groups.set(key, []);
      const g = groups.get(key); s.mi = g.length; g.push(s);
    }
    this.meshes = [];
    for (const [key, list] of groups) {
      const [model, fk] = key.split('|');
      const mesh = new THREE.InstancedMesh(mergeGeos(MODELS[model](LOOK[fk])), mat, list.length);
      mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      const c = new THREE.Color();
      list.forEach((s, i) => mesh.setColorAt(i, c.setScalar(s.tint)));
      for (const s of list) s.mesh = mesh;
      this.root.add(mesh); this.meshes.push({ mesh, list });
    }
    // banners
    this.banners = sim.teams.map((tm) => {
      const sqs = sim.squads.filter((q) => q.team === tm.id);
      const m = new THREE.InstancedMesh(BANNER(tm.faction), mat, sqs.length);
      m.frustumCulled = false; m.castShadow = true; this.root.add(m);
      return { mesh: m, sqs };
    });
    // selection rings (own) and target rings (enemy)
    const ringGeo = new THREE.RingGeometry(0.55, 0.78, 18).rotateX(-Math.PI / 2);
    const ringMat = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.rings = new THREE.InstancedMesh(ringGeo, ringMat('#f5f1c8', 0.95), sim.soldiers.length);
    this.targetRings = new THREE.InstancedMesh(ringGeo, ringMat('#ff6b5a', 0.7), sim.soldiers.length);
    for (const r of [this.rings, this.targetRings]) { r.frustumCulled = false; r.count = 0; this.root.add(r); }
    // projectiles
    this.arrows = new THREE.InstancedMesh(B(0.035, 0.035, 0.95), new THREE.MeshBasicMaterial({ color: '#3a2a1a' }), 3000);
    this.arrows.frustumCulled = false; this.arrows.count = 0; this.root.add(this.arrows);
    // order markers
    this.markers = [];
    // particles
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

  puff(x, y, z, kind) {
    if (this.pData.length >= this.pMax) this.pData.shift();
    const r = Math.random;
    const K = {
      smoke: [[0.9, 0.9, 0.87], 1.4, 6.5, 3.5 + r() * 2, 0.5, [0.7 + r() * 0.4, 0.35 + r() * 0.3, 0.2]],
      flash: [[1, 0.85, 0.45], 1.3, 0.6, 0.08, 1, [0, 0, 0]],
      dust: [[0.78, 0.71, 0.56], 1, 3.6, 1.3, 0.28, [r() - 0.5, 0.4, r() - 0.5]],
    }[kind];
    this.pData.push({ x, y, z, c: K[0], s0: K[1], s1: K[2], life: K[3], t: 0, a: K[4], v: K[5] });
  }

  marker(x, z, color, size = 1) { this.markers.push({ x, z, t: 0, color, size }); }

  onEvents(events) {
    for (const e of events) {
      if (e.k === 'cry') { this.marker(e.x, e.z, '#ffd66b', 2.2); for (let i = 0; i < 14; i++) this.puff(e.x + (Math.random() - 0.5) * 16, groundY(e.x, e.z) + 0.4, e.z + (Math.random() - 0.5) * 16, 'dust'); }
      else if (e.k === 'cmdDead') this.marker(e.x, e.z, '#ff6b5a', 2.5);
    }
  }

  update(dt, camera, viewportH) {
    const sim = this.sim, d = this.dummy, t = sim.time;
    // soldiers
    for (const { mesh, list } of this.meshes) {
      for (const s of list) {
        const T = s.T;
        let y = s.y, rx = 0, rz = 0;
        if (s.alive) {
          const f = T.mounted ? 1.7 : 2.4;
          y += Math.abs(Math.sin(s.walk * f)) * (T.mounted ? 0.14 : 0.06) * Math.min(1, s.speed);
          if (T.mounted) rx = Math.sin(s.walk * f) * 0.05 * Math.min(1, s.speed / 4);
          if (t - s.strikeT < 0.25) rx -= 0.25;
          if (T.mounted && s.speed > 6 && Math.random() < 0.035) this.puff(s.x, s.y + 0.3, s.z, 'dust');
        } else {
          const k = Math.min(1, (t - s.deadT) / 0.6);
          rz = s.fall * k * Math.PI / 2; y -= k * (T.mounted ? 0.35 : 0.12);
        }
        d.position.set(s.x, y, s.z); d.rotation.set(rx, s.yaw, rz, 'YXZ'); d.scale.setScalar(1); d.updateMatrix();
        mesh.setMatrixAt(s.mi, d.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    // banners
    for (const { mesh, sqs } of this.banners) {
      sqs.forEach((sq, i) => {
        const b = sq.banner;
        if (!b || sq.dead) { d.scale.setScalar(0); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); return; }
        d.position.set(b.x + Math.cos(b.yaw) * 0.45, b.y + (b.T.mounted ? 1.2 : 0) + (sq.state === 'rout' ? -1.2 : 0), b.z - Math.sin(b.yaw) * 0.45);
        d.rotation.set(sq.state === 'rout' ? 0.5 : Math.sin(t * 2 + i) * 0.04, sq.face + Math.PI / 2 + Math.sin(t * 1.3 + i) * 0.15, 0, 'YXZ');
        d.scale.setScalar(b.isCmd ? 1.35 : 1); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
    // rings
    let n = 0, m = 0;
    const targets = new Set();
    for (const sq of this.selected) {
      if (sq.dead) continue;
      if (sq.order.kind === 'attack' && sq.order.target && !sq.order.auto) targets.add(sq.order.target);
      for (const s of sq.alive) { d.position.set(s.x, s.y + 0.12, s.z); d.rotation.set(0, 0, 0); d.scale.setScalar(s.T.mounted ? 1.7 : 1); d.updateMatrix(); this.rings.setMatrixAt(n++, d.matrix); }
    }
    for (const sq of targets) for (const s of sq.alive) { d.position.set(s.x, s.y + 0.12, s.z); d.rotation.set(0, 0, 0); d.scale.setScalar(s.T.mounted ? 1.7 : 1); d.updateMatrix(); this.targetRings.setMatrixAt(m++, d.matrix); }
    this.rings.count = n; this.targetRings.count = m;
    this.rings.instanceMatrix.needsUpdate = true; this.targetRings.instanceMatrix.needsUpdate = true;
    // projectiles
    let a = 0;
    for (const p of sim.projectiles) {
      const u = p.t / p.T, x = p.x0 + (p.x1 - p.x0) * u, z = p.z0 + (p.z1 - p.z0) * u, y = p.y0 + (p.y1 - p.y0) * u + p.arc * 4 * u * (1 - u);
      if (p.k === 'arrow') {
        const vy = (p.y1 - p.y0) / p.T + p.arc * 4 * (1 - 2 * u) / p.T, vh = Math.hypot(p.x1 - p.x0, p.z1 - p.z0) / p.T;
        d.position.set(x, y, z); d.rotation.set(-Math.atan2(vy, vh), Math.atan2(p.x1 - p.x0, p.z1 - p.z0), 0, 'YXZ'); d.scale.setScalar(1); d.updateMatrix();
        if (a < 3000) this.arrows.setMatrixAt(a++, d.matrix);
      }
    }
    this.arrows.count = a; this.arrows.instanceMatrix.needsUpdate = true;
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

export { FACTIONS };
