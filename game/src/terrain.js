// Terrain, water, forests and sky meshes built from the heightfield in world.js.
import * as THREE from '../vendor/three.module.min.js';
import { SIZE, HALF, RES, STEP, WATER_Y, grid, groundY, slopeAt, fbm, noise, riverX, mountainW } from './world.js';

const C = (hex) => new THREE.Color(hex);
const PAL = {
  grassA: C('#7d8c43'), grassB: C('#9b9a55'), dry: C('#b4a36a'), lush: C('#61853a'), sand: C('#c4b183'),
  bed: C('#7d7a5c'), rock: C('#7b756c'), rock2: C('#958c7f'), snow: C('#eef2f6'), forest: C('#4f6b3a'),
};

// Ground colour used for both the mesh and the minimap.
export const groundColor = (x, z, h = groundY(x, z), slope = slopeAt(x, z), out = new THREE.Color()) => {
  const n = fbm(x * 0.012, z * 0.012, 3), n2 = noise(x * 0.05, z * 0.05);
  out.copy(PAL.grassA).lerp(PAL.grassB, n);
  if (n2 > 0.62) out.lerp(PAL.dry, Math.min(1, (n2 - 0.62) * 3));
  const dr = Math.abs(x - riverX(z));
  if (dr < 70) out.lerp(PAL.lush, Math.max(0, 1 - dr / 70) * 0.7);
  if (dr < 22 && h < 2.5) out.copy(PAL.sand).lerp(PAL.bed, Math.max(0, Math.min(1, (1.5 - h) / 3)));
  const m = mountainW(x, z);
  if (m > 0.05) out.lerp(PAL.forest, Math.min(1, m * 1.6) * 0.5);
  const rockT = Math.max(0, Math.min(1, (slope - 0.38) * 3)) + Math.max(0, Math.min(1, (h - 90) / 60));
  if (rockT > 0) out.lerp(n > 0.5 ? PAL.rock2 : PAL.rock, Math.min(1, rockT));
  const snowLine = 165 + (n - 0.5) * 60;
  if (h > snowLine && slope < 1.1) out.lerp(PAL.snow, Math.min(1, (h - snowLine) / 25));
  return out;
};

const detailTexture = () => {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), img = g.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) {
    const x = i % 128, y = (i / 128) | 0;
    const v = 205 + (noise(x * 0.35, y * 0.35) * 0.6 + Math.random() * 0.4) * 50;
    img.data.set([v, v, v * 0.97, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(260, 260); t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

export function buildTerrain() {
  const W = RES + 1, pos = new Float32Array(W * W * 3), col = new Float32Array(W * W * 3), uv = new Float32Array(W * W * 2);
  const c = new THREE.Color();
  for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, x = -HALF + i * STEP, z = -HALF + j * STEP, h = grid[k];
    pos.set([x, h, z], k * 3);
    groundColor(x, z, h, slopeAt(x, z), c);
    col.set([c.r, c.g, c.b], k * 3);
    uv.set([i / RES, j / RES], k * 2);
  }
  const idx = new Uint32Array(RES * RES * 6);
  let p = 0;
  for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
    const a = j * W + i, b = a + 1, d = a + W, e = d + 1;
    idx.set([a, d, b, b, d, e], p); p += 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: detailTexture() }));
  mesh.receiveShadow = true;
  return mesh;
}

export function buildWater() {
  const geo = new THREE.PlaneGeometry(SIZE * 4, SIZE * 4).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: '#4b8592', specular: '#d8eef2', shininess: 90, transparent: true, opacity: 0.85 }));
  m.position.y = WATER_Y;
  m.receiveShadow = true;
  return m;
}

// Steppe strips beyond the map edge so the horizon is not a void.
export function buildOuterGround() {
  const mat = new THREE.MeshLambertMaterial({ color: '#8f9452' }), grp = new THREE.Group(), F = 8000;
  for (const [w, d, x, z] of [[SIZE + 2 * F, F, 0, -HALF - F / 2], [SIZE + 2 * F, F, 0, HALF + F / 2], [F, SIZE, -HALF - F / 2, 0], [F, SIZE, HALF + F / 2, 0]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), mat);
    m.position.set(x, 3, z); grp.add(m);
  }
  return grp;
}

export function buildSky() {
  const geo = new THREE.SphereGeometry(6000, 32, 16), col = [], top = C('#6f9fd0'), mid = C('#bcd5e8'), hor = C('#e7e3d4');
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 6000, c = y > 0.15 ? mid.clone().lerp(top, Math.min(1, (y - 0.15) / 0.6)) : hor.clone().lerp(mid, Math.max(0, (y + 0.05) / 0.2));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  m.renderOrder = -1;
  return m;
}

// ---------- trees ----------
const coloured = (geo, hex) => {
  geo = geo.index ? geo.toNonIndexed() : geo;
  geo.deleteAttribute('uv');
  const c = C(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
};
export const mergeGeos = (geos) => {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
};
export const part = (geo, hex, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  return coloured(geo.clone().applyMatrix4(m), hex);
};

export function buildTrees() {
  const pine = mergeGeos([
    part(new THREE.CylinderGeometry(0.25, 0.35, 3, 5), '#5a4330', 0, 1.5),
    part(new THREE.ConeGeometry(2.4, 5, 7), '#2f4a35', 0, 4.5), part(new THREE.ConeGeometry(1.9, 4.5, 7), '#36553b', 0, 7),
    part(new THREE.ConeGeometry(1.3, 4, 7), '#3d5f41', 0, 9.5)]);
  const poplar = mergeGeos([part(new THREE.CylinderGeometry(0.2, 0.3, 3, 5), '#5a4330', 0, 1.5),
    part(new THREE.SphereGeometry(1, 8, 6), '#4f7a36', 0, 8, 0, 0, 0, 0, 1.5, 6.5, 1.5)]);
  const elm = mergeGeos([part(new THREE.CylinderGeometry(0.25, 0.4, 3, 5), '#5a4330', 0, 1.5),
    part(new THREE.SphereGeometry(3, 8, 6), '#56803b', 0, 5, 0, 0, 0, 0, 1, 0.8, 1), part(new THREE.SphereGeometry(2, 7, 5), '#6a9447', 1, 6.3, 0.6)]);
  const spots = { pine: [], poplar: [], elm: [] };
  for (let z = -HALF + 6; z < HALF - 6; z += 9) for (let x = -HALF + 6; x < HALF - 6; x += 9) {
    const jx = x + (noise(x * 0.7, z * 0.3) - 0.5) * 8, jz = z + (noise(x * 0.3, z * 0.7) - 0.5) * 8;
    const h = groundY(jx, jz), s = slopeAt(jx, jz), m = mountainW(jx, jz), n = fbm(jx * 0.01, jz * 0.01, 3);
    if (h < WATER_Y + 0.6) continue;
    const dr = Math.abs(jx - riverX(jz));
    if (m > 0.15 && h < 150 && s < 0.9 && n > 0.42) spots.pine.push([jx, h, jz, 0.8 + noise(jx, jz) * 0.6]);
    else if (dr > 24 && dr < 40 && noise(jz * 0.08, 3) > 0.3) spots.poplar.push([jx, h, jz, 0.8 + noise(jz, jx) * 0.4]);
    else if (m < 0.05 && n > 0.66 && noise(jx * 0.05, jz * 0.05) > 0.55) spots.elm.push([jx, h, jz, 0.7 + noise(jx, jz) * 0.6]);
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const grp = new THREE.Group(), dummy = new THREE.Object3D(), col = new THREE.Color();
  for (const [key, geo] of [['pine', pine], ['poplar', poplar], ['elm', elm]]) {
    const list = spots[key], mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, y, z, s], i) => {
      dummy.position.set(x, y - 0.3, z); dummy.rotation.set(0, noise(x, z) * 6, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, col.setScalar(0.85 + noise(z, x) * 0.3));
    });
    mesh.castShadow = true; mesh.receiveShadow = false;
    grp.add(mesh);
  }
  grp.userData.count = spots.pine.length + spots.poplar.length + spots.elm.length;
  return grp;
}
