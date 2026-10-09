// City mode visuals: Kokand buildings, the Kipchak camp, fields, stone and gold deposits,
// construction scaffolding, destruction, felled trees and the placement ghost.
import * as THREE from '../vendor/three.module.min.js';
import { part, mergeGeos } from './terrain.js';
import { BUILDINGS } from './buildings.js';
import { groundY } from './world.js';

const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const CY = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
const DOME = (r, s = 16) => new THREE.SphereGeometry(r, s, Math.max(6, s / 2), 0, Math.PI * 2, 0, Math.PI / 2);
const prism = (len, r) => CY(r, r, len, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2);

const C = { adobe: '#cdb185', adobe2: '#b89a6c', brick: '#ad6a3a', turq: '#2c9f98', turq2: '#1f6f6d', wood: '#7a5332', roof: '#8d6c45',
  dark: '#2a1d16', felt: '#efe8d6', red: '#a8322d', gold: '#d9a23b', hay: '#cfae55' };

const portal = (w, h, z) => [
  part(B(w, h, 1), C.adobe, 0, h / 2, z), part(B(w - 0.8, h - 1.2, 0.15), C.turq, 0, h / 2 - 0.1, z + 0.55),
  part(B(w * 0.42, h * 0.5, 0.2), C.dark, 0, h * 0.25, z + 0.62), part(CY(w * 0.21, w * 0.21, 0.2, 14), C.dark, 0, h * 0.5, z + 0.62, Math.PI / 2),
  part(B(w - 0.8, 0.35, 0.18), C.gold, 0, h - 0.9, z + 0.6),
];
const merlons = (w, d, y) => {
  const out = [];
  for (let x = -w / 2 + 0.6; x <= w / 2 - 0.5; x += 1.4) { out.push(part(B(0.6, 0.6, 0.5), C.adobe, x, y, d / 2 - 0.25), part(B(0.6, 0.6, 0.5), C.adobe, x, y, -d / 2 + 0.25)); }
  for (let z = -d / 2 + 1.3; z <= d / 2 - 1.2; z += 1.4) { out.push(part(B(0.5, 0.6, 0.6), C.adobe, w / 2 - 0.25, y, z), part(B(0.5, 0.6, 0.6), C.adobe, -w / 2 + 0.25, y, z)); }
  return out;
};
const flag = (color, x, y, z, h = 5) => [part(CY(0.06, 0.06, h, 5), C.wood, x, y + h / 2, z), part(B(0.05, 1, 1.6), color, x, y + h - 0.6, z - 0.8)];
// Felt yurt: lattice wall with an ornament band, a domed roof with rope rings, the tunduk crown and a carved door.
const yurt = (r, col = C.felt, rich = false) => {
  const out = [
    part(CY(r, r * 1.02, r * 0.55, 28), col, 0, r * 0.275), part(CY(r * 1.012, r * 1.012, r * 0.09, 28), rich ? C.gold : C.red, 0, r * 0.47),
    part(CY(r * 1.014, r * 1.014, r * 0.035, 28), '#26407a', 0, r * 0.41), part(CY(r * 1.03, r * 1.03, 0.12, 28), '#8a6a44', 0, 0.06),
    part(DOME(r * 1.02, 28), col, 0, r * 0.55, 0, 0, 0, 0, 1, 0.5, 1),
    part(CY(r * 0.88, r * 0.88, 0.07, 28), '#7a5a3a', 0, r * 0.55 + r * 0.26), part(CY(r * 0.5, r * 0.5, 0.07, 24), '#7a5a3a', 0, r * 0.55 + r * 0.44),
    part(CY(r * 0.2, r * 0.22, 0.28, 12), '#5a3d22', 0, r * 1.06), part(new THREE.TorusGeometry(r * 0.2, 0.05, 4, 12), '#c9a064', 0, r * 1.2, 0, Math.PI / 2),
    part(B(r * 0.34, r * 0.46, 0.16), '#b5542e', 0, r * 0.23, r * 1.0), part(B(r * 0.42, 0.1, 0.2), C.gold, 0, r * 0.47, r * 1.0),
    part(B(0.1, r * 0.46, 0.2), C.gold, r * 0.19, r * 0.23, r * 1.0), part(B(0.1, r * 0.46, 0.2), C.gold, -r * 0.19, r * 0.23, r * 1.0),
    part(B(r * 0.1, r * 0.1, 0.05), C.gold, 0, r * 0.3, r * 1.09, 0, 0, Math.PI / 4),
  ];
  for (let i = 0; i < 14; i++) { // diamonds on the ornament band
    const a = (i / 14) * Math.PI * 2 + 0.22;
    out.push(part(B(r * 0.09, r * 0.09, 0.04), i % 2 ? '#26407a' : C.gold, Math.sin(a) * r * 1.02, r * 0.47, Math.cos(a) * r * 1.02, 0, a, Math.PI / 4));
  }
  return out;
};
const tuu = (x, z, h, color) => [part(CY(0.08, 0.08, h, 5), C.wood, x, h / 2, z), part(new THREE.ConeGeometry(0.35, 1.6, 8), '#1d1b1a', x, h - 0.8, z, Math.PI),
  part(new THREE.SphereGeometry(0.18, 8, 6), C.gold, x, h + 0.1, z), part(B(0.05, 1.1, 1.8), color, x, h - 1.4, z - 0.9)];
const sheep = (x, z, k) => [part(new THREE.SphereGeometry(0.5, 7, 5), k % 5 ? '#efe9dc' : '#6b5a48', x, 0.55, z, 0, k, 0, 1.3, 0.8, 0.8), part(new THREE.SphereGeometry(0.2, 6, 4), '#2b2420', x + Math.sin(k) * 0.65, 0.65, z + Math.cos(k) * 0.65)];
const fence = (r, n) => { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push(part(B(0.14, 1.3, 0.14), C.wood, Math.cos(a) * r, 0.65, Math.sin(a) * r)); }
  out.push(part(new THREE.TorusGeometry(r, 0.05, 4, n * 2), '#8a6a44', 0, 1.05, 0, Math.PI / 2), part(new THREE.TorusGeometry(r, 0.05, 4, n * 2), '#8a6a44', 0, 0.55, 0, Math.PI / 2)); return out; };
const pen = (w, d) => { const out = []; for (let x = -w / 2; x <= w / 2 + 0.01; x += w / 6) out.push(part(B(0.16, 1.4, 0.16), C.wood, x, 0.7, -d / 2), part(B(0.16, 1.4, 0.16), C.wood, x, 0.7, d / 2));
  for (let z = -d / 2 + d / 4; z < d / 2; z += d / 4) out.push(part(B(0.16, 1.4, 0.16), C.wood, -w / 2, 0.7, z), part(B(0.16, 1.4, 0.16), C.wood, w / 2, 0.7, z));
  for (const y of [0.6, 1.15]) out.push(part(B(w, 0.1, 0.1), '#8a6a44', 0, y, -d / 2), part(B(w, 0.1, 0.1), '#8a6a44', 0, y, d / 2), part(B(0.1, 0.1, d), '#8a6a44', -w / 2, y, 0), part(B(0.1, 0.1, d), '#8a6a44', w / 2, y, 0));
  return out; };
const steed = (x, z, a, coat) => [part(B(0.5, 0.6, 1.6), coat, x, 1.2, z, 0, a), part(B(0.25, 0.7, 0.35), coat, x + Math.sin(a) * 0.85, 1.6, z + Math.cos(a) * 0.85, -0.5, a),
  ...[[0.16, 0.55], [-0.16, 0.55], [0.16, -0.55], [-0.16, -0.55]].map(([dx, dz]) => part(B(0.12, 0.95, 0.12), '#3b2a1e', x + Math.cos(a) * dx + Math.sin(a) * dz, 0.47, z - Math.sin(a) * dx + Math.cos(a) * dz))];

// ---------- Kokand detail: glazed tile bands, arched niches, dome ribs, carved doors, yard props ----------
const TILES = ['#2c9f98', '#f1ead8', '#1f4f8f', '#f1ead8'];
// tile band on the four faces of a w×d block at height y
const tileBand = (w, d, y, h = 0.42) => {
  const out = [], s = 0.7;
  for (let x = -w / 2 + s / 2, i = 0; x < w / 2; x += s, i++) out.push(part(B(s * 0.94, h, 0.06), TILES[i % 4], x, y, d / 2 + 0.03), part(B(s * 0.94, h, 0.06), TILES[(i + 2) % 4], x, y, -d / 2 - 0.03));
  for (let z = -d / 2 + s / 2, i = 0; z < d / 2; z += s, i++) out.push(part(B(0.06, h, s * 0.94), TILES[i % 4], w / 2 + 0.03, y, z), part(B(0.06, h, s * 0.94), TILES[(i + 2) % 4], -w / 2 - 0.03, y, z));
  out.push(part(B(w + 0.1, 0.08, d + 0.1), C.gold, 0, y + h / 2 + 0.04, 0), part(B(w + 0.1, 0.08, d + 0.1), C.gold, 0, y - h / 2 - 0.04, 0));
  return out;
};
// pointed-arch niche on a wall facing +z (ry turns it to other faces)
const niche = (x, y, z, w, h, ry = 0) => {
  const g = [part(B(w + 0.3, h + 0.5, 0.08), C.turq, 0, 0.12, 0), part(B(w, h, 0.1), '#3a2a20', 0, 0, 0.03),
    part(B(w * 0.72, w * 0.72, 0.1), '#3a2a20', 0, h / 2, 0.03, 0, 0, Math.PI / 4), part(B(w + 0.3, 0.12, 0.12), C.gold, 0, -h / 2 - 0.1, 0.05)];
  const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
  return g.map((p) => p.applyMatrix4(m));
};
// ribs over a dome of radius r centred at y
const ribs = (r, y, n, col, sy = 1) => [...Array(n)].map((_, i) => part(new THREE.TorusGeometry(r * 1.01, 0.07, 4, 16, Math.PI), col, 0, y, 0, 0, (i / n) * Math.PI, 0, 1, sy, 1));
// double gate leaves with studs
const gate = (w, h, z, x = 0) => {
  const out = [part(B(w / 2 - 0.06, h, 0.1), '#6a4426', x - w / 4, h / 2, z), part(B(w / 2 - 0.06, h, 0.1), '#6a4426', x + w / 4, h / 2, z)];
  for (let yy = 0.4; yy < h - 0.2; yy += 0.5) for (const xx of [-w / 2 + 0.25, -0.25, 0.25, w / 2 - 0.25]) out.push(part(B(0.09, 0.09, 0.06), C.gold, x + xx, yy, z + 0.07));
  return out;
};
const cannonProp = (x, z, ry, y = 0) => {
  const g = [part(B(0.7, 0.35, 1.5), C.wood, 0, 0.45, 0), part(CY(0.13, 0.19, 1.9, 9), '#3d3a36', 0, 0.78, 0.45, Math.PI / 2 - 0.12),
    part(CY(0.42, 0.42, 0.1, 12), '#4a3220', 0.42, 0.42, 0, 0, 0, Math.PI / 2), part(CY(0.42, 0.42, 0.1, 12), '#4a3220', -0.42, 0.42, 0, 0, 0, Math.PI / 2)];
  const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z);
  return g.map((p) => p.applyMatrix4(m));
};
const tandir = (x, y, z) => [part(new THREE.SphereGeometry(0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 1.7), '#b98a5a', x, y, z), part(CY(0.2, 0.22, 0.12, 10), '#3a2a20', x, y + 0.5, z)];
const khum = (x, y, z, s = 1) => [part(new THREE.SphereGeometry(0.3 * s, 8, 6), '#a8673e', x, y + 0.3 * s, z, 0, 0, 0, 1, 1.3, 1), part(CY(0.13 * s, 0.16 * s, 0.14 * s, 8), '#8f532d', x, y + 0.7 * s, z)];
const sack = (x, y, z, a = 0) => part(new THREE.SphereGeometry(0.35, 7, 5), '#d8ccb0', x, y + 0.28, z, 0, a, 0, 1, 0.8, 0.75);
const ladder = (x, z, h, ry = 0) => {
  const g = [part(B(0.07, h, 0.07), C.wood, -0.25, h / 2, 0), part(B(0.07, h, 0.07), C.wood, 0.25, h / 2, 0)];
  for (let y = 0.35; y < h; y += 0.45) g.push(part(B(0.5, 0.05, 0.06), C.wood, 0, y, 0));
  const m = new THREE.Matrix4().makeRotationX(-0.25).premultiply(new THREE.Matrix4().makeRotationY(ry)).setPosition(x, 0, z);
  return g.map((p) => p.applyMatrix4(m));
};
// window with a wooden lattice (panjara)
const lattice = (x, y, z, w, h) => {
  const out = [part(B(w + 0.2, h + 0.2, 0.08), C.wood, x, y, z), part(B(w, h, 0.1), '#2a1d16', x, y, z + 0.02)];
  for (let i = 1; i < 4; i++) out.push(part(B(0.05, h, 0.06), '#9b7a50', x - w / 2 + (w * i) / 4, y, z + 0.08));
  for (let i = 1; i < 3; i++) out.push(part(B(w, 0.05, 0.06), '#9b7a50', x, y - h / 2 + (h * i) / 3, z + 0.08));
  return out;
};

const MODEL = {
  urda: (F) => [
    part(B(18, 2.4, 18), C.brick, 0, -0.9), part(B(14, 7, 14), C.adobe, 0, 3.5), part(B(14.4, 0.6, 14.4), C.adobe2, 0, 7.3), ...merlons(14, 14, 7.9),
    ...[[-7, -7], [7, -7], [-7, 7], [7, 7]].flatMap(([x, z]) => [part(CY(1.7, 2.0, 9.4), C.adobe, x, 4.7, z), part(CY(1.9, 1.9, 0.5), C.adobe2, x, 9.5, z), part(DOME(1.6, 10), C.turq, x, 9.7, z)]),
    ...portal(6.4, 10.5, 7.2), part(CY(3.3, 3.3, 1.6, 18), C.adobe, 0, 8.4), part(DOME(3.5, 18), C.turq, 0, 9.2, 0, 0, 0, 0, 1, 1.05, 1),
    part(new THREE.SphereGeometry(0.35, 8, 6), C.gold, 0, 13), ...flag(F.color, 7, 9.7, -7, 6),
    ...tileBand(14, 14, 6.3), ...ribs(3.5, 9.2, 6, C.turq2, 1.05), part(CY(3.36, 3.36, 0.5, 18), '#f1ead8', 0, 8.7), ...niche(-4.8, 3.4, 7.02, 1.3, 2.4), ...niche(4.8, 3.4, 7.02, 1.3, 2.4),
    ...[-3.6, 0, 3.6].flatMap((z) => [...niche(7.02, 3.4, z, 1.3, 2.4, Math.PI / 2), ...niche(-7.02, 3.4, z, 1.3, 2.4, -Math.PI / 2)]),
    ...gate(2.5, 3.6, 7.95), ...[-2.9, 2.9].flatMap((x) => [part(CY(0.3, 0.34, 2, 8), C.adobe, x, 11.5, 7.2), part(DOME(0.32, 8), C.turq, x, 12.5, 7.2)]),
    ...cannonProp(-4.6, 8.1, 0, 0.3), ...cannonProp(4.6, 8.1, 0, 0.3), ...khum(-8.3, 0.3, 3), ...khum(-8.4, 0.3, 2.2, 0.8)],
  uy: () => [part(B(8, 1.4, 8), C.adobe2, 0, -0.4), part(B(7, 3.4, 7), C.adobe, 0, 1.7), part(B(7.4, 0.35, 7.4), '#a68a62', 0, 3.55),
    part(B(1.1, 1.9, 0.12), C.wood, 0.8, 0.95, 3.52), part(B(0.8, 0.6, 0.1), C.dark, -1.8, 2.2, 3.52),
    part(new THREE.SphereGeometry(1.2, 8, 6), C.hay, -1.6, 3.8, -1.4, 0, 0, 0, 1, 0.6, 1), part(B(1.6, 0.05, 1.1), C.red, 1.4, 3.75, -1.2),
    ...[...Array(9)].map((_, i) => part(B(0.16, 0.16, 0.45), '#6a4426', -3.2 + i * 0.8, 3.25, 3.65)), ...lattice(-1.8, 2.2, 3.53, 0.9, 0.7),
    part(B(2.6, 0.1, 1.2), C.wood, 0.8, 2.35, 4.05), part(B(0.1, 2.3, 0.1), C.wood, -0.35, 1.15, 4.55), part(B(0.1, 2.3, 0.1), C.wood, 1.95, 1.15, 4.55),
    ...tandir(-3.3, 0.2, 4.35), ...khum(3.2, 0.3, 4.1), ...khum(3.85, 0.3, 3.7, 0.8), ...ladder(4.3, -1.5, 3.8, Math.PI / 2),
    part(B(1.4, 0.35, 1), '#8a6a44', -2.4, 0.45, -3.9), part(B(1.3, 0.04, 0.9), '#7a2f2a', -2.4, 0.64, -3.9)],
  tegirmon: () => [part(B(9, 1.4, 9), C.adobe2, 0, -0.4), part(B(7, 4, 7), C.adobe, 0, 2), part(B(6, 2, 6), C.wood, 0, 5), part(B(6.6, 0.4, 6.6), C.roof, 0, 6.2),
    part(new THREE.TorusGeometry(2.4, 0.18, 6, 18), C.wood, 3.9, 2.7, 0, 0, Math.PI / 2, 0), part(CY(0.3, 0.3, 0.8, 8), C.dark, 3.8, 2.7, 0, 0, 0, Math.PI / 2),
    ...[0, 1, 2, 3].map((i) => part(B(0.12, 4.6, 0.25), C.wood, 3.9, 2.7, 0, (i * Math.PI) / 4)),
    part(B(0.9, 0.6, 0.6), '#e8e1cf', -2.5, 0.3, 4), part(B(0.9, 0.6, 0.6), '#e8e1cf', -1.4, 0.3, 4.1), part(B(1.2, 2.1, 0.12), C.wood, 0, 1.05, 3.52),
    ...[[-3.8, 3.8], [-3.3, 4.2], [-3.6, 3.3]].map(([x, z], i) => sack(x, 0.3, z, i)), part(CY(0.9, 0.9, 0.3, 14), '#9a958c', 2.6, 0.45, 4.2, 0.2), ...lattice(-2, 2.6, 3.53, 0.8, 0.6)],
  ombor: () => [part(B(9, 1.2, 9), C.adobe2, 0, -0.4), part(B(8, 3.6, 8), '#a07a4a', 0, 1.8), part(prism(8.6, 5), C.roof, 0, 3.6, 0, 0, 0, 0, 1, 0.45, 1),
    part(B(2.4, 2.4, 0.15), C.dark, 0, 1.2, 4.05), ...[[3, 5], [3.9, 5.4], [-3.4, 5.2]].map(([x, z]) => part(B(0.9, 0.9, 0.9), '#8a6a44', x, 0.45, z)),
    ...[0, 1, 2].map((i) => part(CY(0.3, 0.3, 3, 8), '#6b4a2c', -4.8, 0.3 + i * 0.5, 2 - i * 0.2, 0, 0, Math.PI / 2))],
  kazarma: (F) => [part(B(16, 1.4, 12), C.brick, 0, -0.4), part(B(14, 4.5, 10), C.adobe, 0, 2.25), ...merlons(14, 10, 4.8), ...portal(4.6, 6.4, 5.1),
    ...[[-7, 5], [7, 5]].flatMap(([x, z]) => [part(CY(1.2, 1.4, 6.2), C.adobe, x, 3.1, z), part(DOME(1.1, 10), C.turq, x, 6.2, z)]), ...flag(F.color, -7, 6.6, -5, 5),
    ...[-4, -2.5, 2.5, 4].map((x) => part(B(0.12, 1.8, 0.12), C.wood, x, 0.9, 5.8)), part(B(9, 0.12, 0.12), C.wood, 0, 1.6, 5.8),
    ...tileBand(14, 10, 3.9, 0.36), ...gate(1.8, 2.9, 5.86), ...niche(-4.6, 2.2, 5.02, 1, 1.8), ...niche(4.6, 2.2, 5.02, 1, 1.8),
    ...[-3.7, -3.3, -2.9, 2.9, 3.3, 3.7].map((x) => part(CY(0.03, 0.03, 1.7, 4), '#3d3a36', x, 0.85, 5.95, -0.18)), ...[-5.8, -5.3, 5.3, 5.8].map((x, i) => sack(x, 0.3, 6.1, i))],
  otxona: () => [part(B(16, 1, 12), C.adobe2, 0, -0.4), part(B(14, 3.2, 6), '#a88a60', 0, 1.6, -2.5), part(prism(14.6, 4), C.roof, 0, 3.2, -2.5, 0, 0, 0, 1, 0.4, 1),
    ...[-6.8, -3.4, 0, 3.4, 6.8].map((x) => part(B(0.18, 1.4, 0.18), C.wood, x, 0.7, 5.6)), ...[-5.6, -2.8, 0.1, 2.8].map((z) => part(B(0.18, 1.4, 0.18), C.wood, 6.9, 0.7, z + 2.8)),
    part(B(13.8, 0.14, 0.14), C.wood, 0, 1.2, 5.6), part(B(13.8, 0.14, 0.14), C.wood, 0, 0.7, 5.6),
    part(new THREE.SphereGeometry(1.1, 8, 6), C.hay, -4.5, 0.5, 2.5, 0, 0, 0, 1, 0.7, 1), part(B(3, 0.5, 0.7), C.wood, 3, 0.35, 2.8)],
  topxona: () => [part(B(14, 1.2, 12), C.brick, 0, -0.4), part(B(12, 5, 9), '#a8653a', 0, 2.5, -1), part(B(12.4, 0.5, 9.4), '#8f532d', 0, 5.2, -1),
    part(CY(0.9, 1.1, 9, 10), '#7a4428', 4, 4.5, -3.5), part(B(2.6, 3, 0.15), C.dark, -1, 1.5, 3.55),
    part(B(0.7, 0.35, 1.5), C.wood, -3.5, 0.55, 4.6), part(CY(0.13, 0.18, 1.8, 9), '#a07c3a', -3.5, 0.86, 5.1, Math.PI / 2),
    part(CY(0.46, 0.46, 0.1, 12), '#4a3220', -3.05, 0.46, 4.5, 0, 0, Math.PI / 2), part(CY(0.46, 0.46, 0.1, 12), '#4a3220', -3.95, 0.46, 4.5, 0, 0, Math.PI / 2),
    ...[[2, 4.6], [2.45, 4.6], [2.22, 4.95], [2.22, 4.75]].map(([x, z], i) => part(new THREE.SphereGeometry(0.22, 8, 6), '#2a2a2a', x, i === 3 ? 0.55 : 0.22, z)),
    ...gate(2.4, 2.8, 3.66, -1), ...cannonProp(4.2, 4.6, 0.4, 0.2), part(B(1.6, 0.9, 1), '#6b4a2c', -5, 0.65, 4.6), part(B(1.2, 0.7, 0.9), '#7a5a3a', -5.2, 1.4, 4.5)],
  ordo: (F) => [part(B(14, 0.5, 14), '#9a8a62', 0, -0.15), part(B(6, 0.06, 4), C.red, 0, 0.12, 8.2), ...yurt(5.4, C.felt, true), ...tuu(5, 5, 10, F.color), ...tuu(-5, 5, 8, F.color)],
  boz: () => [...yurt(3, '#e6dcc8'), part(B(1.6, 0.05, 1.1), '#26407a', 2.6, 0.05, 2.8), part(CY(0.35, 0.3, 0.5, 8), '#8a5a32', -2.4, 0.25, 2.6)],
  koroo: () => [...fence(6.6, 22), ...[...Array(13)].flatMap((_, k) => sheep(Math.cos(k * 2.4) * (1 + (k % 4) * 1.3), Math.sin(k * 2.4) * (1 + (k % 4) * 1.3), k)), part(CY(0.4, 0.3, 0.4, 8), '#6b4a2c', 5.5, 0.2, 5.5)],
  ken: () => [...yurt(2.4, '#d9cfb9'), part(B(3, 0.5, 0.7), '#6b4a2c', 3.2, 0.25, -2, 0, 0.4), ...[[2.2, 2.6], [3, 3.2], [2.6, 3.7]].map(([x, z], i) => part(new THREE.DodecahedronGeometry(0.5 - i * 0.08, 0), i ? '#d9a23b' : '#8f8a82', x, 0.35, z)),
    part(B(0.1, 2.4, 0.1), C.wood, -3, 1.2, -2.6), part(B(0.1, 2.4, 0.1), C.wood, -3, 1.2, -1.4), part(B(0.1, 0.1, 1.4), C.wood, -3, 2.3, -2), part(CY(0.2, 0.2, 1.3, 8), '#5a3d22', -3, 1.7, -2, Math.PI / 2)],
  jooker: (F) => [...yurt(3.2).map((g) => g.translate(-2.2, 0, -1)), ...yurt(2.6, '#e6dcc8').map((g) => g.translate(3.4, 0, 1.2)), ...tuu(0, 4.4, 7, F.color),
    ...[-1.2, -0.6, 0, 0.6, 1.2].map((x) => part(CY(0.03, 0.03, 3, 4), C.wood, x + 4, 1.5, -3.6, 0.15)), part(B(3.2, 0.12, 0.12), C.wood, 4, 1.9, -3.4)],
  jylky: () => [...pen(15, 11), ...yurt(2.4, '#e6dcc8').map((g) => g.translate(-5.2, 0, -3.2)), ...steed(1, 1, 0.6, '#6e4529'), ...steed(4, -1.5, 2.2, '#3a2a20'), ...steed(-1.5, 3, -1, '#b38b5a'), ...steed(4.5, 3, 1.4, '#cfc7b8'),
    part(new THREE.SphereGeometry(1, 8, 6), C.hay, 5.5, 0.5, -4, 0, 0, 0, 1, 0.6, 1), part(B(2.6, 0.45, 0.6), C.wood, -1.5, 0.3, -4.6)],
  kurultai: (F) => [part(B(14, 0.4, 14), '#8a7a58', 0, -0.1), ...yurt(5, '#f5f0e4', true), ...[[6, 6], [-6, 6], [6, -6], [-6, -6]].flatMap(([x, z]) => tuu(x, z, 7.5, F.color)),
    part(B(3, 0.05, 2), C.red, -3.5, 0.15, 6.4), part(B(3, 0.05, 2), '#26407a', 3.5, 0.15, 6.4)],
};

const scaffold = (w, d, h) => {
  const out = [];
  for (const [x, z] of [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2], [0, d / 2], [0, -d / 2], [w / 2, 0], [-w / 2, 0]]) out.push(part(B(0.18, h, 0.18), '#8a6a44', x, h / 2, z));
  for (const y of [h * 0.35, h * 0.75]) { out.push(part(B(w, 0.12, 0.25), '#9b7a50', 0, y, d / 2), part(B(w, 0.12, 0.25), '#9b7a50', 0, y, -d / 2), part(B(0.25, 0.12, d), '#9b7a50', w / 2, y, 0), part(B(0.25, 0.12, d), '#9b7a50', -w / 2, y, 0)); }
  return mergeGeos(out);
};

// A field drapes over the ground: furrows of wheat on brown soil.
const fieldGeo = (b) => {
  const n = 16, g = new THREE.PlaneGeometry(b.w, b.d, n, n).rotateX(-Math.PI / 2), p = g.attributes.position, col = [];
  const soil = new THREE.Color('#7c5e3c'), crop = new THREE.Color('#c2a447'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    p.setY(i, groundY(b.x + x, b.z + z) - b.y + 0.18);
    const row = Math.floor(((z + b.d / 2) / b.d) * n);
    c.copy(row % 2 ? crop : soil).multiplyScalar(0.9 + Math.random() * 0.15); col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
};

// Where a home fire smokes: the tandir in a yard, the tunduk of a yurt.
const HEARTH = { uy: [-3.3, 0.9, 4.35], boz: [0, 3.7, 0], ordo: [0, 6.6, 0], kurultai: [0, 6.1, 0], jooker: [-2.2, 3.9, -1] };

export class CityRenderer {
  constructor(scene, sim, eco, trees) {
    this.sim = sim; this.eco = eco; this.trees = trees; this.root = new THREE.Group(); scene.add(this.root);
    this.mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.geos = new Map(); this.views = new Map(); this.selected = null; this.smokeT = 0;
    this.dummy = new THREE.Object3D();
    // deposits
    this.nodeViews = eco.nodes.map((n) => {
      const g = new THREE.Group(), rocks = n.kind === 'gold' ? '#7d6a52' : '#8f8a82';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + n.id, r = i === 0 ? 0 : 1.8 + (i % 3) * 0.9, s = i === 0 ? 2.3 : 1 + ((i * 37) % 10) / 10;
        const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), new THREE.MeshLambertMaterial({ color: rocks, flatShading: true }));
        m.position.set(Math.cos(a) * r, s * 0.45, Math.sin(a) * r); m.rotation.set(i, i * 2, i * 3); m.castShadow = true; g.add(m);
        if (n.kind === 'gold' && i % 2 === 0) {
          const nug = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.45, 0), new THREE.MeshLambertMaterial({ color: '#e0b23e', emissive: '#5a3c05' }));
          nug.position.copy(m.position).add(new THREE.Vector3(0.3, s * 0.45, 0.2)); g.add(nug);
        }
      }
      g.position.set(n.x, groundY(n.x, n.z) - 0.3, n.z); this.root.add(g);
      return g;
    });
    // placement ghost
    this.ghost = null; this.ghostKey = null;
    this.ghostMat = new THREE.MeshBasicMaterial({ color: '#7fe07a', transparent: true, opacity: 0.45, depthWrite: false });
    this.outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#f5f1c8' }));
    this.outline.visible = false; this.root.add(this.outline);
    this.rally = new THREE.Group();
    this.rally.add(new THREE.Mesh(CY(0.05, 0.05, 3, 5).translate(0, 1.5, 0), new THREE.MeshLambertMaterial({ color: '#6b4a2c' })),
      new THREE.Mesh(B(0.04, 0.6, 0.9).translate(0, 2.6, 0.45), new THREE.MeshBasicMaterial({ color: '#7fe8c8' })));
    this.rally.visible = false; this.root.add(this.rally);
  }

  geoFor(key, team) {
    const fk = this.sim.teams[team].faction, k = key + '|' + team;
    if (!this.geos.has(k)) this.geos.set(k, mergeGeos(MODEL[key](fk)));
    return this.geos.get(k);
  }

  viewFor(b) {
    let v = this.views.get(b);
    if (v) return v;
    const grp = new THREE.Group();
    let body;
    if (b.T.field) { body = new THREE.Mesh(fieldGeo(b), this.mat); body.receiveShadow = true; }
    else { body = new THREE.Mesh(this.geoFor(b.key, b.team), this.mat); body.castShadow = true; body.receiveShadow = true; }
    grp.add(body);
    let scaf = null;
    if (!b.done) { scaf = new THREE.Mesh(scaffold(b.w * 0.92, b.d * 0.92, b.T.field ? 1.2 : 6), this.mat); scaf.castShadow = true; grp.add(scaf); }
    grp.position.set(b.x, b.y, b.z);
    this.root.add(grp);
    this.onPlace?.(b);
    v = { grp, body, scaf, sink: 0 };
    this.views.set(b, v);
    return v;
  }

  setGhost(key) {
    if (this.ghost) { this.root.remove(this.ghost); this.ghost = null; }
    this.ghostKey = key;
    if (!key) return;
    const T = BUILDINGS[key];
    this.ghost = T.field ? new THREE.Mesh(B(T.w, 0.3, T.d).translate(0, 0.15, 0), this.ghostMat) : new THREE.Mesh(this.geoFor(key, 0), this.ghostMat);
    this.ghost.renderOrder = 5; this.root.add(this.ghost);
  }
  moveGhost(x, z, ok) {
    if (!this.ghost) return;
    this.ghost.visible = true;
    this.ghost.position.set(x, groundY(x, z), z);
    this.ghostMat.color.set(ok ? '#7fe07a' : '#ff6b5a');
  }
  hideGhost() { if (this.ghost) this.ghost.visible = false; }

  onEvents(events) {
    for (const e of events) if ((e.k === 'packed' || e.k === 'unpacked') && this.onSmoke) for (let i = 0; i < 12; i++) this.onSmoke(e.b.x + (Math.random() - 0.5) * e.b.w, e.b.y + 0.5, e.b.z + (Math.random() - 0.5) * e.b.d, 'dust');
  }

  update(dt) {
    const sim = this.sim, eco = this.eco;
    // felled trees vanish
    for (const t of eco.felled) {
      const tr = this.trees[t.i];
      if (tr) { this.dummy.position.set(0, -50, 0); this.dummy.scale.setScalar(0.0001); this.dummy.updateMatrix(); tr.mesh.setMatrixAt(tr.idx, this.dummy.matrix); tr.mesh.instanceMatrix.needsUpdate = true; }
    }
    eco.felled.length = 0;
    // deposits shrink as they are mined
    eco.nodes.forEach((n, i) => { const g = this.nodeViews[i]; g.visible = n.amount > 0; g.scale.setScalar(0.45 + 0.55 * Math.max(0, n.amount / n.max)); });
    // buildings
    this.smokeT -= dt;
    const puff = this.smokeT <= 0;
    if (puff) this.smokeT = 0.25;
    for (const b of sim.buildings) {
      const v = this.viewFor(b);
      if (b.dead && b.packed) { if (v.grp.parent) this.root.remove(v.grp); continue; }
      if (b.dead) {
        v.sink += dt;
        v.grp.position.y = b.y - v.sink * 1.6; v.grp.rotation.z = Math.min(0.12, v.sink * 0.05);
        if (v.sink > 5 && v.grp.parent) { this.root.remove(v.grp); }
        continue;
      }
      if (!b.done) {
        const p = Math.max(0.08, b.progress);
        v.body.scale.set(1, b.T.field ? 1 : p, 1);
        if (v.scaf) v.scaf.visible = true;
      } else {
        v.body.scale.set(1, 1, 1);
        if (v.scaf) { v.grp.remove(v.scaf); v.scaf = null; }
      }
      if (puff && this.onSmoke) {
        if (b.key === 'topxona' && b.done) this.onSmoke(b.x + 4, b.y + 9.4, b.z - 3.5, 'smoke');
        const h = HEARTH[b.key];
        if (h && b.done && Math.random() < 0.09) this.onSmoke(b.x + h[0], b.y + h[1], b.z + h[2], 'smoke');
        if (b.hp < b.maxHp * 0.5 && b.done && Math.random() < 0.6) this.onSmoke(b.x + (Math.random() - 0.5) * b.w * 0.6, b.y + 3, b.z + (Math.random() - 0.5) * b.d * 0.6, 'impact');
      }
    }
    // selection outline and rally flag
    const s = this.selected;
    if (s && !s.dead) {
      const p = this.outline.geometry.attributes.position, y = s.y + 0.3;
      p.setXYZ(0, s.x - s.w / 2 - 0.6, y, s.z - s.d / 2 - 0.6); p.setXYZ(1, s.x + s.w / 2 + 0.6, y, s.z - s.d / 2 - 0.6);
      p.setXYZ(2, s.x + s.w / 2 + 0.6, y, s.z + s.d / 2 + 0.6); p.setXYZ(3, s.x - s.w / 2 - 0.6, y, s.z + s.d / 2 + 0.6); p.needsUpdate = true;
      this.outline.visible = true;
      this.rally.visible = !!s.rally;
      if (s.rally) this.rally.position.set(s.rally.x, groundY(s.rally.x, s.rally.z), s.rally.z);
    } else { this.outline.visible = false; this.rally.visible = false; }
  }
}
