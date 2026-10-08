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
