// Heightfield of the battle map. Pure math, no rendering: also used by headless balance runs.
export const SIZE = 1600;          // metres
export const HALF = SIZE / 2;
export const RES = 320;            // grid cells per side
export const STEP = SIZE / RES;    // 5 m
export const WATER_Y = 0.4;

const hash = (x, z) => {
  let h = (x * 374761393 + z * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const smooth = (t) => t * t * (3 - 2 * t);
export const noise = (x, z) => {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  const u = smooth(xf), v = smooth(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
export const fbm = (x, z, oct = 4) => {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += noise(x * f + i * 17.3, z * f - i * 9.1) * a; n += a; a *= 0.5; f *= 2.03; }
  return s / n;
};
const ridged = (x, z) => {
  let s = 0, a = 0.55, f = 1;
  for (let i = 0; i < 4; i++) { s += (1 - Math.abs(noise(x * f, z * f) * 2 - 1)) * a; a *= 0.5; f *= 2.1; }
  return s;
};
const clamp01 = (t) => Math.max(0, Math.min(1, t));

// River runs north–south along the east side of the battlefield.
export const riverX = (z) => 330 + 55 * Math.sin(z * 0.0042) + 22 * Math.sin(z * 0.013 + 1.3);

// Gentle hills on the field: [x, z, radius, height]
export const HILLS = [[-140, 60, 95, 16], [190, -40, 110, 20], [-320, -210, 150, 28], [40, 250, 120, 12], [-30, -260, 90, 14], [260, 290, 130, 18]];

// Mountain weight: 0 on the field, 1 deep in the ranges (north and west edges).
export const mountainW = (x, z) => {
  const n = (fbm(x * 0.003, z * 0.003, 3) - 0.5) * 140;
  return Math.max(smooth(clamp01((-z - 470 + n) / 260)), smooth(clamp01((-x - 520 + n) / 260)));
};

const rawHeight = (x, z) => {
  let h = 8 + (fbm(x * 0.0045, z * 0.0045) - 0.5) * 14;
  for (const [hx, hz, r, hh] of HILLS) { const d2 = (x - hx) ** 2 + (z - hz) ** 2; h += hh * Math.exp(-d2 / (r * r)); }
  const m = mountainW(x, z);
  if (m > 0) h += m * m * (110 + 190 * ridged(x * 0.0055, z * 0.0055));
  const dr = Math.abs(x - riverX(z));
  if (dr < 44) {
    const t = smooth(clamp01(1 - (dr - 9) / 35));
    h = h * (1 - t) + -2.4 * t;
  }
  return h;
};

// Precomputed grid; every height query and the terrain mesh read from it, so feet match the ground.
export const grid = new Float32Array((RES + 1) * (RES + 1));
for (let j = 0; j <= RES; j++) for (let i = 0; i <= RES; i++) grid[j * (RES + 1) + i] = rawHeight(-HALF + i * STEP, -HALF + j * STEP);

export const groundY = (x, z) => {
  const gx = Math.max(0, Math.min(RES - 1e-4, (x + HALF) / STEP)), gz = Math.max(0, Math.min(RES - 1e-4, (z + HALF) / STEP));
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j, W = RES + 1;
  const a = grid[j * W + i], b = grid[j * W + i + 1], c = grid[(j + 1) * W + i], d = grid[(j + 1) * W + i + 1];
  return (a * (1 - fx) + b * fx) * (1 - fz) + (c * (1 - fx) + d * fx) * fz;
};
export const slopeAt = (x, z) => {
  const e = STEP;
  const dx = (groundY(x + e, z) - groundY(x - e, z)) / (2 * e), dz = (groundY(x, z + e) - groundY(x, z - e)) / (2 * e);
  return Math.hypot(dx, dz);
};
export const inWater = (x, z) => groundY(x, z) < WATER_Y - 0.2;

// Movement cost multiplier for a position: water and steep slopes slow everyone down.
export const terrainSpeed = (x, z) => {
  if (inWater(x, z)) return 0.45;
  const s = slopeAt(x, z);
  return s > 0.9 ? 0.15 : s > 0.45 ? 0.6 : 1 - s * 0.5;
};

// Seeded RNG so balance runs are reproducible.
export const rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------- city mode layout ----------
export const BASES = { player: [-40, 560], enemy: [40, -400] };
// Mineable deposits: [kind, x, z]. Player side first, then contested ground and the enemy side.
export const DEPOSITS = [
  ['stone', 110, 515], ['stone', -235, 485], ['gold', 40, 410], ['gold', -300, 360],
  ['stone', 205, 300], ['gold', 225, 130], ['stone', -260, 120], ['gold', -60, 60],
  ['stone', -130, -320], ['gold', 170, -290],
];
const nearAny = (x, z, pts, r) => pts.some(([px, pz]) => (x - px) ** 2 + (z - pz) ** 2 < r * r);
// Forest groves near the player's base so wood is close at hand.
const GROVES = [[-175, 620, 42], [195, 650, 38], [-95, 705, 34], [250, 545, 30], [-310, 560, 36], [70, 720, 30], [-20, 430, 22]];

// Tree spots for rendering and wood gathering: [kind, x, y, z, scale]
export function treeSpots() {
  const out = [], clear = [BASES.player, BASES.enemy];
  const ok = (x, z) => !nearAny(x, z, clear, 75) && !nearAny(x, z, DEPOSITS.map(([, a, b]) => [a, b]), 12);
  for (let z = -HALF + 6; z < HALF - 6; z += 9) for (let x = -HALF + 6; x < HALF - 6; x += 9) {
    const jx = x + (noise(x * 0.7, z * 0.3) - 0.5) * 8, jz = z + (noise(x * 0.3, z * 0.7) - 0.5) * 8;
    const h = groundY(jx, jz), s = slopeAt(jx, jz), m = mountainW(jx, jz), n = fbm(jx * 0.01, jz * 0.01, 3);
    if (h < WATER_Y + 0.6 || !ok(jx, jz)) continue;
    const dr = Math.abs(jx - riverX(jz));
    if (m > 0.15 && h < 150 && s < 0.9 && n > 0.42) out.push(['pine', jx, h, jz, 0.8 + noise(jx, jz) * 0.6]);
    else if (dr > 24 && dr < 40 && noise(jz * 0.08, 3) > 0.3) out.push(['poplar', jx, h, jz, 0.8 + noise(jz, jx) * 0.4]);
    else if (m < 0.05 && n > 0.66 && noise(jx * 0.05, jz * 0.05) > 0.55) out.push(['elm', jx, h, jz, 0.7 + noise(jx, jz) * 0.6]);
  }
  for (const [cx, cz, r] of GROVES) for (let z = cz - r; z <= cz + r; z += 5.5) for (let x = cx - r; x <= cx + r; x += 5.5) {
    const jx = x + (noise(x * 0.9, z * 0.4) - 0.5) * 4, jz = z + (noise(x * 0.4, z * 0.9) - 0.5) * 4;
    const d = Math.hypot(jx - cx, jz - cz) / r;
    if (d > 1 || noise(jx * 0.12, jz * 0.12) < 0.25 + d * 0.35 || !ok(jx, jz) || groundY(jx, jz) < WATER_Y + 0.6) continue;
    out.push([noise(jx, jz * 2) > 0.6 ? 'poplar' : 'elm', jx, groundY(jx, jz), jz, 0.75 + noise(jx, jz) * 0.5]);
  }
  return out;
}
