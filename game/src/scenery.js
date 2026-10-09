// Ground clutter: wind-blown grass and tulips around the camera, rocks and bushes across the whole map.
import * as THREE from '../vendor/three.module.min.js';
import { WATER_Y, HALF, groundY, slopeAt, noise, riverX, mountainW, BASES, DEPOSITS } from './world.js';
import { groundColor, part, mergeGeos, TIME } from './terrain.js';

const hash = (a, b, s = 0) => {
  let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Bend instanced geometry with the wind after the instance transform, so every tuft leans the same way.
const windy = (mat, amp, upNormal = false) => {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = TIME;
    // thin blades: light both faces as if they faced the sky
    if (upNormal) sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <project_vertex>', `vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float gust = sin(uTime * 0.7 + ip.x * 0.021 + ip.z * 0.013) * 0.5 + 0.6;
        float w = (sin(uTime * 2.1 + ip.x * 0.17 + ip.z * 0.11) * 0.6 + sin(uTime * 3.7 + ip.z * 0.4) * 0.25) * gust;
        mvPosition.xz += vec2(0.85, 0.45) * w * position.y * position.y * ${amp.toFixed(3)};
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
  };
  return mat;
};

// A tuft of blades: dark at the root, light at the tip. Normals point up so both sides are lit alike.
const tuftGeo = () => {
  const pos = [], col = [], nor = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + hash(i, 3) * 0.8, lean = 0.1 + hash(i, 5) * 0.25, h = 0.4 + hash(i, 7) * 0.45, w = 0.09;
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz * w, pz = dx * w, r = 0.05 + hash(i, 9) * 0.12;
    pos.push(dx * r - px, 0, dz * r - pz, dx * r + px, 0, dz * r + pz, dx * (r + lean), h, dz * (r + lean));
    col.push(0.7, 0.72, 0.6, 0.7, 0.72, 0.6, 1.3, 1.28, 1.05);
    for (let k = 0; k < 3; k++) nor.push(dx * 0.25, 1, dz * 0.25);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
};
// Steppe tulip: a short stem and a closed cup; the cup takes the instance colour, the stem stays green.
const flowerGeo = () => {
  const head = new THREE.CylinderGeometry(0.11, 0.05, 0.2, 6).translate(0, 0.62, 0);
  const g = mergeGeos([part(new THREE.CylinderGeometry(0.015, 0.015, 0.55, 3), '#6f8f3a', 0, 0.27), part(head, '#ffffff'),
    part(new THREE.BoxGeometry(0.03, 0.18, 0.09), '#7a9a40', 0.05, 0.12, 0, 0, 0, -0.5)]);
  return g;
};
const flowerMat = () => {
  const m = windy(new THREE.MeshLambertMaterial({ vertexColors: true }), 0.18);
  const base = m.onBeforeCompile;
  m.onBeforeCompile = (sh) => {
    base(sh);
    // the instance colour paints only the white cup, the stem stays green
    sh.vertexShader = sh.vertexShader.replace('#include <color_vertex>', `vColor = color.rgb;
      #ifdef USE_INSTANCING_COLOR
        if (color.r > 0.95 && color.g > 0.95) vColor *= instanceColor.rgb;
      #endif`);
  };
  return m;
};
const PETALS = ['#d4302a', '#d4302a', '#e14b2a', '#e8c339', '#f1ece2', '#9a5bc0'].map((c) => new THREE.Color(c));

export class GrassField {
  constructor(scene) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.tufts = new THREE.InstancedMesh(tuftGeo(), windy(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 0.32, true), 11000);
    this.flowers = new THREE.InstancedMesh(flowerGeo(), flowerMat(), 1800);
    for (const m of [this.tufts, this.flowers]) {
      m.frustumCulled = false; m.receiveShadow = true; m.count = 0;
      m.setColorAt(0, new THREE.Color()); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m);
    }
    this.key = ''; this.blocked = null;
    this.d = new THREE.Object3D(); this.c = new THREE.Color();
  }
  dispose() { this.group.parent?.remove(this.group); }

  // Re-seed only when the camera moves to another 12 m step or buildings change: tufts are hashed per cell, so they never pop.
  update(tx, tz, dist, sig = 0) {
    this.group.visible = dist < 340;
    if (!this.group.visible) return;
    const R = Math.min(130, Math.max(60, dist * 0.8)), S = 12;
    const cx = Math.round(tx / S) * S, cz = Math.round(tz / S) * S, key = `${cx},${cz},${Math.round(R / 10)},${sig}`;
    if (key === this.key) return;
    this.key = key; this.rebuild(cx, cz, R);
  }

  rebuild(cx, cz, R) {
    const CELL = 6, d = this.d, c = this.c, t = this.tufts, f = this.flowers;
    let n = 0, nf = 0;
    const i0 = Math.floor((cx - R) / CELL), i1 = Math.ceil((cx + R) / CELL), j0 = Math.floor((cz - R) / CELL), j1 = Math.ceil((cz + R) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x0 = i * CELL, z0 = j * CELL, r = Math.hypot(x0 + CELL / 2 - cx, z0 + CELL / 2 - cz);
      if (r > R || Math.abs(x0) > HALF - 4 || Math.abs(z0) > HALF - 4) continue;
      const h = groundY(x0 + 3, z0 + 3);
      if (h < WATER_Y + 0.25 || h > 115 || slopeAt(x0 + 3, z0 + 3) > 0.55) continue;
      // lush by the river, thin on dry patches and up in the hills
      const dr = Math.abs(x0 - riverX(z0)), dry = noise(x0 * 0.05, z0 * 0.05);
      let dens = 4.2 + (dr < 80 ? 2.5 * (1 - dr / 80) : 0) - (dry > 0.6 ? 2.6 : 0) - mountainW(x0, z0) * 3;
      dens += hash(i, j, 1) * 2 - 1;
      if (dens <= 0) continue;
      const edge = Math.min(1, (R - r) / (R * 0.25));
      groundColor(x0 + 3, z0 + 3, h, 0, c);
      const cnt = Math.round(dens);
      for (let k = 0; k < cnt && n < t.instanceMatrix.count; k++) {
        const x = x0 + hash(i, j, k * 2 + 3) * CELL, z = z0 + hash(i, j, k * 2 + 4) * CELL;
        if (this.blocked?.(x, z)) continue;
        const s = (0.75 + hash(i, j, k + 40) * 0.7) * (0.35 + 0.65 * edge);
        d.position.set(x, groundY(x, z) - 0.04, z); d.rotation.set(0, hash(i, j, k + 50) * 6.28, 0); d.scale.set(s, s * (0.8 + hash(i, j, k + 60) * 0.6), s);
        d.updateMatrix(); t.setMatrixAt(n, d.matrix);
        const v = 0.92 + hash(i, j, k + 70) * 0.26;
        t.setColorAt(n, this.c2(c, v, dry)); n++;
      }
      // tulips in spring meadows
      const fl = hash(i, j, 90);
      if (fl < 0.11 + (dr < 120 ? 0.06 : 0) && dry < 0.6 && nf < f.instanceMatrix.count) {
        const m = 1 + Math.floor(hash(i, j, 91) * 4), col = PETALS[Math.floor(hash(i, j, 92) * PETALS.length)];
        for (let k = 0; k < m && nf < f.instanceMatrix.count; k++) {
          const x = x0 + hash(i, j, 93 + k) * CELL, z = z0 + hash(i, j, 97 + k) * CELL;
          if (this.blocked?.(x, z)) continue;
          const s = (0.8 + hash(i, j, 101 + k) * 0.5) * edge;
          d.position.set(x, groundY(x, z) - 0.03, z); d.rotation.set(0, k, 0); d.scale.setScalar(s); d.updateMatrix();
          f.setMatrixAt(nf, d.matrix); f.setColorAt(nf, col); nf++;
        }
      }
    }
    t.count = n; f.count = nf;
    for (const m of [t, f]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
  // grass a little greener and lighter than the soil it grows from
  c2(ground, v, dry) {
    const o = this.c3 ||= new THREE.Color();
    o.copy(ground).multiplyScalar(v * 1.08);
    o.g *= 1.06; if (dry > 0.6) { o.r *= 1.08; o.b *= 0.9; }
    return o;
  }
}

// ---------- rocks and bushes ----------
const jitterRock = (geo, seed) => {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.78 + hash(Math.round(x * 100), Math.round(z * 100), seed + Math.round(y * 100)) * 0.45;
    p.setXYZ(i, x * k, y * k * 0.72, z * k);
  }
  geo.computeVertexNormals();
  return geo;
};
const rockGeo = (seed) => {
  const g = jitterRock(new THREE.IcosahedronGeometry(1, 1), seed), p = g.attributes.position, col = [];
  const base = new THREE.Color('#8d877c'), moss = new THREE.Color('#77805a'), dark = new THREE.Color('#5e5a52'), c = new THREE.Color();
  for (let i = 0; i < p.count; i += 3) {
    const y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3;
    c.copy(base).lerp(y > 0.35 ? moss : dark, y > 0.35 ? 0.45 : Math.max(0, -y) * 0.8).multiplyScalar(0.9 + hash(i, seed) * 0.2);
    for (let k = 0; k < 3; k++) col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.deleteAttribute('uv');
  return g;
};
const bushGeo = (seed, tint) => {
  const parts = [part(new THREE.CylinderGeometry(0.06, 0.1, 0.6, 4), '#5a4330', 0, 0.3)];
  for (let i = 0; i < 6; i++) {
    const a = hash(i, seed) * 6.28, r = 0.3 + hash(i, seed + 1) * 0.5, s = 0.45 + hash(i, seed + 2) * 0.4;
    const leaf = new THREE.Color(tint).multiplyScalar(0.85 + hash(i, seed + 3) * 0.3);
    parts.push(part(new THREE.IcosahedronGeometry(s, 0), '#' + leaf.getHexString(), Math.cos(a) * r, 0.55 + hash(i, seed + 4) * 0.5, Math.sin(a) * r, i, i * 2, 0, 1, 0.75, 1));
  }
  return mergeGeos(parts);
};

export function buildScatter() {
  const grp = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const bushMat = windy(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), 0.03);
  const clear = [BASES.player, BASES.enemy].map(([x, z]) => [x, z, 95]).concat(DEPOSITS.map(([, x, z]) => [x, z, 20]));
  const ok = (x, z) => !clear.some(([a, b, r]) => Math.hypot(x - a, z - b) < r) && groundY(x, z) > WATER_Y + 0.2;
  const kinds = [
    { geo: rockGeo(1), mat, list: [] }, { geo: rockGeo(2), mat, list: [] }, { geo: rockGeo(3), mat, list: [] },
    { geo: bushGeo(1, '#5f6e3c'), mat: bushMat, list: [], bush: true }, { geo: bushGeo(2, '#7a8148'), mat: bushMat, list: [], bush: true },
    { geo: bushGeo(3, '#6d7d58'), mat: bushMat, list: [], bush: true },
  ];
  const span = HALF - 10;
  for (let k = 0; k < 13000; k++) {
    const x = (hash(k, 11) * 2 - 1) * span, z = (hash(k, 12) * 2 - 1) * span;
    if (!ok(x, z)) continue;
    const m = mountainW(x, z), s = slopeAt(x, z), dr = Math.abs(x - riverX(z)), r = hash(k, 13);
    // boulders on slopes and in the ranges, pebbles and bushes on the steppe
    if (r < 0.06 + m * 0.5 + Math.min(0.3, s * 0.4)) {
      const big = m > 0.25 || s > 0.5 ? 1.2 + hash(k, 14) * 3.5 : 0.25 + hash(k, 14) * 0.8;
      kinds[k % 3].list.push([x, z, big, hash(k, 15)]);
    } else if (r < 0.12 + (dr < 60 ? 0.12 : 0) && m < 0.4 && s < 0.5) {
      kinds[3 + (k % 3)].list.push([x, z, 0.7 + hash(k, 16) * 0.9, hash(k, 17)]);
    }
  }
  const d = new THREE.Object3D(), col = new THREE.Color(), items = [];
  for (const kd of kinds) {
    const mesh = new THREE.InstancedMesh(kd.geo, kd.mat, kd.list.length);
    kd.list.forEach(([x, z, s, r], i) => {
      d.position.set(x, groundY(x, z) - (kd.bush ? 0.1 : s * 0.3), z); d.rotation.set(kd.bush ? 0 : r * 0.6, r * 6.28, 0);
      d.scale.set(s * (0.8 + r * 0.5), s, s * (1.2 - r * 0.4)); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, col.setScalar(0.85 + r * 0.3));
      items.push({ x, z, mesh, i });
    });
    mesh.castShadow = true; mesh.receiveShadow = true;
    grp.add(mesh);
  }
  // hide the clutter a building is put on top of
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  grp.userData.clearRect = (x, z, w, dd) => {
    for (const it of items) if (Math.abs(it.x - x) < w / 2 + 1 && Math.abs(it.z - z) < dd / 2 + 1) { it.mesh.setMatrixAt(it.i, zero); it.mesh.instanceMatrix.needsUpdate = true; }
  };
  return grp;
}
