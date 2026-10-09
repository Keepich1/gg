// Terrain, water, forests and sky meshes built from the heightfield in world.js.
import * as THREE from '../vendor/three.module.min.js';
import { SIZE, HALF, RES, STEP, WATER_Y, grid, groundY, slopeAt, fbm, noise, riverX, mountainW, treeSpots } from './world.js';

// Seconds since start, shared by every animated shader (wind, water).
export const TIME = { value: 0 };

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

// Tileable detail texture. R: grass grain and clumps, G: soil with pebbles and cracks, B: broad blotches.
const thash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const pnoise = (u, v, P, s) => {
  const xi = Math.floor(u), yi = Math.floor(v), xf = u - xi, yf = v - yi, w = (i) => ((i % P) + P) % P;
  const a = thash(w(xi), w(yi), s), b = thash(w(xi + 1), w(yi), s), c = thash(w(xi), w(yi + 1), s), d = thash(w(xi + 1), w(yi + 1), s);
  const sx = xf * xf * (3 - 2 * xf), sy = yf * yf * (3 - 2 * yf);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};
// distance to the nearest and second-nearest jittered point on a wrapping grid
const cells = (u, v, P, s) => {
  const xi = Math.floor(u), yi = Math.floor(v);
  let f1 = 9, f2 = 9;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = xi + i, cy = yi + j, wx = ((cx % P) + P) % P, wy = ((cy % P) + P) % P;
    const d = Math.hypot(cx + thash(wx, wy, s) - u, cy + thash(wx, wy, s + 1) - v);
    if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return [f1, f2];
};
const detailTexture = () => {
  const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N;
    const clump = pnoise(u * 16, v * 16, 16, 1) * 0.5 + pnoise(u * 32, v * 32, 32, 2) * 0.3 + pnoise(u * 64, v * 64, 64, 3) * 0.2;
    const grain = thash(x, y, 4);
    const grass = Math.min(1, Math.max(0, (clump - 0.5) * 1.6 + 0.5 + (grain - 0.5) * 0.45));
    const [f1, f2] = cells(u * 12, v * 12, 12, 5), [p1] = cells(u * 40, v * 40, 40, 7);
    const soil = Math.min(1, Math.max(0, 0.5 + (pnoise(u * 24, v * 24, 24, 8) - 0.5) * 0.5 - (f2 - f1 < 0.05 ? 0.2 : 0) + (p1 < 0.18 ? 0.25 : 0) + (grain - 0.5) * 0.25));
    const blot = pnoise(u * 4, v * 4, 4, 9) * 0.65 + pnoise(u * 8, v * 8, 8, 10) * 0.35;
    img.data.set([grass * 255, soil * 255, blot * 255, 255], (y * N + x) * 4);
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
};

// Vertex colours give the biome; the detail texture, sampled at three scales in world space, gives the grain.
const terrainMaterial = () => {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true }), tex = detailTexture();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tDetail = { value: tex };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP; varying float vUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vUp = normal.y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tDetail; varying vec3 vWP; varying float vUp;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec2 p = vWP.xz;
          vec4 a = texture2D(tDetail, p * 0.11);
          vec4 b = texture2D(tDetail, p * 0.027 + 0.31);
          vec4 c = texture2D(tDetail, p * 0.0042 + 0.7);
          float grassy = clamp((vColor.g - max(vColor.r, vColor.b)) * 9.0 + 0.15, 0.0, 1.0) * smoothstep(0.78, 0.93, vUp);
          float lum = dot(vColor.rgb, vec3(0.3, 0.59, 0.11));
          float d = mix(a.g * 0.6 + b.g * 0.4, a.r * 0.6 + b.r * 0.4, grassy);
          float amp = 0.75 * (1.0 - smoothstep(0.42, 0.8, lum));
          diffuseColor.rgb *= 1.0 + (d - 0.5) * amp;
          float m = (c.b - 0.5) * 1.4;
          diffuseColor.rgb *= vec3(1.0 + m * 0.2, 1.0 + m * 0.07, 1.0 - m * 0.22);
          diffuseColor.rgb *= mix(0.6, 1.0, smoothstep(${(WATER_Y - 0.3).toFixed(2)}, ${(WATER_Y + 0.9).toFixed(2)}, vWP.y));
        }`);
  };
  return m;
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
  const mesh = new THREE.Mesh(geo, terrainMaterial());
  mesh.receiveShadow = true;
  return mesh;
}

// Water tinted by depth (read from the heightfield), with foam on the shore and moving ripples.
export function buildWater() {
  const W = RES + 1, data = new Uint8Array(W * W * 4);
  for (let k = 0; k < W * W; k++) data[k * 4] = Math.max(0, Math.min(1, (WATER_Y - grid[k]) / 3)) * 255;
  const depth = new THREE.DataTexture(data, W, W);
  depth.magFilter = depth.minFilter = THREE.LinearFilter; depth.needsUpdate = true;
  const mat = new THREE.MeshPhongMaterial({ color: '#4b8592', specular: '#cfe6ea', shininess: 70, transparent: true, opacity: 1 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tDepth = { value: depth }; sh.uniforms.uTime = TIME;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D tDepth; uniform float uTime; varying vec3 vWP;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 duv = ((vWP.xz + ${HALF.toFixed(1)}) / ${STEP.toFixed(1)} + 0.5) / ${W.toFixed(1)};
        float dep = texture2D(tDepth, duv).r;
        float flow = sin(vWP.x * 0.9 + vWP.z * 0.15 + uTime * 0.8) * sin(vWP.z * 0.35 - uTime * 1.6);
        diffuseColor.rgb = mix(vec3(0.16, 0.34, 0.30), vec3(0.025, 0.10, 0.13), smoothstep(0.0, 0.75, dep));
        float foam = (1.0 - smoothstep(0.0, 0.05 + 0.03 * flow, dep)) * 0.75 + smoothstep(0.55, 0.95, flow) * smoothstep(0.1, 0.35, dep) * 0.12;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85, 0.88, 0.86), foam);
        diffuseColor.a = mix(0.45, 0.93, smoothstep(0.0, 0.3, dep));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          vec2 q = vWP.xz, gr = vec2(0.0);
          gr += vec2(0.18, 1.0) * cos(dot(q, vec2(0.18, 1.0)) * 0.55 - uTime * 2.3) * 0.5;
          gr += vec2(-0.6, 0.8) * cos(dot(q, vec2(-0.6, 0.8)) * 1.3 - uTime * 3.1) * 0.25;
          gr += vec2(0.9, 0.4) * cos(dot(q, vec2(0.9, 0.4)) * 2.7 - uTime * 4.3) * 0.12;
          vec3 nW = normalize(vec3(-gr.x * 0.35, 1.0, -gr.y * 0.35));
          normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
        }`);
  };
  const m = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 4, SIZE * 4).rotateX(-Math.PI / 2), mat);
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
  const spots = { pine: [], poplar: [], elm: [] }, all = treeSpots();
  all.forEach(([kind, x, y, z, sc], n) => spots[kind].push([x, y, z, sc, n]));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const grp = new THREE.Group(), dummy = new THREE.Object3D(), col = new THREE.Color(), trees = [];
  for (const [key, geo] of [['pine', pine], ['poplar', poplar], ['elm', elm]]) {
    const list = spots[key], mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([x, y, z, s, n], i) => {
      dummy.position.set(x, y - 0.3, z); dummy.rotation.set(0, noise(x, z) * 6, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, col.setScalar(0.85 + noise(z, x) * 0.3));
      trees[n] = { x, z, mesh, idx: i };
    });
    mesh.castShadow = true; mesh.receiveShadow = false;
    grp.add(mesh);
  }
  grp.userData.trees = trees; // indexed like treeSpots(), so the economy can fell them
  return grp;
}
