// Isometric math, colors, seasons and drawing primitives.
const O = (window.O = {});

O.TW = 64;          // tile width in world pixels
O.TH = 32;          // tile height
O.N = 44;           // map size in tiles
const RX = O.TW * Math.SQRT1_2; // screen radius of a 1-tile circle
const RY = O.TH * Math.SQRT1_2;

O.iso = (x, y, z = 0) => [(x - y) * O.TW / 2, (x + y) * O.TH / 2 - z];

// ---------- random / noise ----------
O.rng = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
O.hash = hash;
O.noise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const s = (t) => t * t * (3 - 2 * t);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  const u = s(xf), v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
};
O.fbm = (x, y) => O.noise(x, y) * 0.6 + O.noise(x * 2.1, y * 2.1) * 0.3 + O.noise(x * 4.3, y * 4.3) * 0.1;

// ---------- colors ----------
const cache = new Map();
const rgb = (c) => {
  let v = cache.get(c);
  if (!v) {
    v = c[0] === '#' ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : c.match(/[\d.]+/g).slice(0, 3).map(Number);
    cache.set(c, v);
  }
  return v;
};
O.shade = (hex, k, a = 1) => {
  const [r, g, b] = rgb(hex);
  const f = (c) => Math.round(k <= 1 ? c * k : c + (255 - c) * (k - 1));
  return a < 1 ? `rgba(${f(r)},${f(g)},${f(b)},${a})` : `rgb(${f(r)},${f(g)},${f(b)})`;
};
O.mix = (h1, h2, t) => {
  const a = rgb(h1), b = rgb(h2);
  return '#' + a.map((c, i) => Math.round(c + (b[i] - c) * t).toString(16).padStart(2, '0')).join('');
};

// ---------- seasons ----------
O.SEASONS = {
  summer: {
    label: 'Жай', sky: ['#78aee0', '#d9ebf0'], far: ['#8fa9c4', '#a9bdd2'],
    grass: ['#7d9a4c', '#8aa755', '#6d8b43'], lush: '#5f8f3e', dry: '#b9a86c', rock: '#8a8479', scree: '#a39c8e',
    mtnL: '#958e86', mtnR: '#6c6770', snow: '#f5f7fa', snowShade: '#c6d4e2', snowLine: 0.5,
    water: '#4aa5b3', waterDeep: '#2f8499', waterHi: '#c9f0ef', bank: '#cdbd8e',
    road: '#caa979', roadEdge: '#b08f5e',
    wheat: '#d9b44c', wheatRow: '#b98f2e', crop: '#8fb04c', cropRow: '#6e9336',
    poplar: '#4d7a36', poplarHi: '#78a54c', fruit: '#5b8d3b', fruitHi: '#86b55a', fruitDot: '#f0a13a',
    spruce: '#2c4c3a', spruceHi: '#406b50', snowRoof: false, groundSnow: false, bare: false,
  },
  autumn: {
    label: 'Күз', sky: ['#86add6', '#f0e3c6'], far: ['#98a6bb', '#b8bfcb'],
    grass: ['#a49855', '#b3a45f', '#958a4b'], lush: '#8c9a4a', dry: '#c7a868', rock: '#8e8374', scree: '#a79a86',
    mtnL: '#978d82', mtnR: '#6e6770', snow: '#f5f7fa', snowShade: '#c6d4e2', snowLine: 0.36,
    water: '#4a9aaa', waterDeep: '#2f7d92', waterHi: '#cdebea', bank: '#cdb88a',
    road: '#c6a376', roadEdge: '#a8875a',
    wheat: '#c9a86a', wheatRow: '#a8864f', crop: '#8f7148', cropRow: '#735636',
    poplar: '#d9a92f', poplarHi: '#f3cd52', fruit: '#c56f2c', fruitHi: '#e49a45', fruitDot: '#b8412c',
    spruce: '#2c4c3a', spruceHi: '#406b50', snowRoof: false, groundSnow: false, bare: false, sheaves: true,
  },
  winter: {
    label: 'Кыш', sky: ['#9fb6cc', '#e7edf2'], far: ['#b6c4d4', '#d1dbe5'],
    grass: ['#e9eef3', '#dfe6ee', '#f3f6f9'], lush: '#d8e0e9', dry: '#d2d9e1', rock: '#a8adb4', scree: '#c9cfd6',
    mtnL: '#a3a6ad', mtnR: '#7a7d88', snow: '#f7f9fb', snowShade: '#c3d0de', snowLine: 0.02,
    water: '#3b7690', waterDeep: '#2b5e78', waterHi: '#e4f3f7', bank: '#dfe7ee',
    road: '#bdb3a6', roadEdge: '#a39887',
    wheat: '#eef2f6', wheatRow: '#d6dee7', crop: '#eef2f6', cropRow: '#d6dee7',
    poplar: '#6a5848', poplarHi: '#86735f', fruit: '#6a5848', fruitHi: '#86735f', fruitDot: null,
    spruce: '#2b473b', spruceHi: '#3d6450', snowRoof: true, groundSnow: true, bare: true,
  },
};
O.pal = O.SEASONS.summer;

// ---------- primitives (ctx is in world-pixel space) ----------
O.poly = (ctx, pts, fill, stroke, lw = 1) => {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
};

// Parallelogram lying flat at height z covering tiles [x..x+w] × [y..y+d].
O.flat = (ctx, x, y, w, d, z, fill, stroke) => {
  const a = O.iso(x, y, z), b = O.iso(x + w, y, z), c = O.iso(x + w, y + d, z), e = O.iso(x, y + d, z);
  O.poly(ctx, [...a, ...b, ...c, ...e], fill, stroke);
};

// Axis-aligned block. Visible faces: +y (screen left) and +x (screen right) and top.
O.box = (ctx, x, y, w, d, h, color, o = {}) => {
  const z = o.z || 0;
  const top = o.top || O.shade(color, 1.1);
  const L = O.shade(color, o.lk || 0.9), R = O.shade(color, o.rk || 0.7);
  const p = (px, py, pz) => O.iso(px, py, pz);
  // left face (+y)
  O.poly(ctx, [...p(x, y + d, z), ...p(x + w, y + d, z), ...p(x + w, y + d, z + h), ...p(x, y + d, z + h)], L);
  // right face (+x)
  O.poly(ctx, [...p(x + w, y, z), ...p(x + w, y + d, z), ...p(x + w, y + d, z + h), ...p(x + w, y, z + h)], R);
  O.flat(ctx, x, y, w, d, z + h, top);
  if (o.edge !== false) {
    ctx.strokeStyle = 'rgba(40,24,12,.28)'; ctx.lineWidth = 1;
    ctx.beginPath();
    const [ax, ay] = p(x, y + d, z + h), [bx, by] = p(x + w, y + d, z + h), [cx, cy] = p(x + w, y, z + h);
    const [dx, dy] = p(x + w, y + d, z);
    ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.moveTo(bx, by); ctx.lineTo(dx, dy);
    ctx.stroke();
  }
};

// Vertical cylinder (optionally tapered). cx, cy in tiles; r in tiles; h in px.
O.cyl = (ctx, cx, cy, r, h, color, o = {}) => {
  const z = o.z || 0, taper = o.taper || 1;
  const [sx, sy] = O.iso(cx, cy, z);
  const rx = r * RX, ry = r * RY, rx2 = rx * taper, ry2 = ry * taper;
  const g = ctx.createLinearGradient(sx - rx, 0, sx + rx, 0);
  g.addColorStop(0, O.shade(color, 1.05)); g.addColorStop(0.35, O.shade(color, 0.98));
  g.addColorStop(1, O.shade(color, 0.62));
  ctx.beginPath();
  ctx.moveTo(sx - rx, sy);
  ctx.ellipse(sx, sy, rx, ry, 0, Math.PI, 0, true);
  ctx.lineTo(sx + rx2, sy - h);
  ctx.ellipse(sx, sy - h, rx2, ry2, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
  if (o.bands) for (const [t, col, bw] of o.bands) O.band(ctx, sx, sy - h * t, rx + (rx2 - rx) * t, ry + (ry2 - ry) * t, bw, col);
  if (o.top !== null) {
    ctx.beginPath(); ctx.ellipse(sx, sy - h, rx2, ry2, 0, 0, Math.PI * 2);
    ctx.fillStyle = o.top || O.shade(color, 1.12); ctx.fill();
  }
  return [sx, sy - h, rx2, ry2];
};

// A horizontal band on the front half of a cylinder.
O.band = (ctx, sx, sy, rx, ry, bw, col) => {
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI, false);
  ctx.lineTo(sx - rx, sy - bw);
  ctx.ellipse(sx, sy - bw, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fillStyle = col; ctx.fill();
};

// Dome sitting on (sx, sy) screen point with radii rx, ry and height h.
O.dome = (ctx, sx, sy, rx, ry, h, color, hi) => {
  const g = ctx.createRadialGradient(sx - rx * 0.35, sy - h * 0.7, rx * 0.1, sx, sy - h * 0.3, rx * 1.2);
  g.addColorStop(0, hi || O.shade(color, 1.35)); g.addColorStop(0.5, color); g.addColorStop(1, O.shade(color, 0.6));
  ctx.beginPath();
  ctx.moveTo(sx - rx, sy);
  ctx.bezierCurveTo(sx - rx, sy - h * 0.75, sx - rx * 0.45, sy - h, sx, sy - h);
  ctx.bezierCurveTo(sx + rx * 0.45, sy - h, sx + rx, sy - h * 0.75, sx + rx, sy);
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = g; ctx.fill();
};

O.ellipseShadow = (ctx, sx, sy, rx, ry, a = 0.22) => {
  ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(30,25,15,${a})`; ctx.fill();
};

O.RX = RX; O.RY = RY;
