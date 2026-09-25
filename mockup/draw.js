// Static scene: sky, terrain and buildings. Every function draws in world pixels.
(() => {
  const { iso, shade, poly, flat, box, cyl, dome, mix, RX, RY } = O;
  const G = O.G;
  const ADOBE = '#d2b78a', WALL = '#cfb080', BRICK = '#b5703c', TURQ = '#2c9f98', TURQ_D = '#17625f', WOOD = '#8a5a32', RED = '#a8322d', INDIGO = '#26407a';
  O.C = { ADOBE, WALL, BRICK, TURQ, TURQ_D, WOOD, RED, INDIGO };
  const top = (c) => (O.pal.snowRoof ? '#f1f4f8' : shade(c, 1.1));
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

  // ---------- sky + far ranges (screen space) ----------
  O.drawSky = (ctx, W, H, cam) => {
    const p = O.pal, z = cam.z;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, p.sky[0]); g.addColorStop(0.55, p.sky[1]); g.addColorStop(1, p.sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    [[-60, 0.35, 0], [60, 0.55, 1]].forEach(([wy, par, i]) => {
      const base = (wy - cam.cy) * z + H / 2;
      const grad = ctx.createLinearGradient(0, base - 380 * z, 0, base);
      grad.addColorStop(0, i ? p.far[1] : '#eef3f8'); grad.addColorStop(0.35, p.far[i]); grad.addColorStop(1, p.far[i]);
      ctx.beginPath(); ctx.moveTo(-10, base + 900 * z);
      for (let sx = -10; sx <= W + 20; sx += 14) {
        const u = (sx - W / 2) / z + cam.cx * par + i * 900;
        const f = O.fbm(u * 0.0045, i * 3.1) * 0.75 + O.noise(u * 0.02, i) * 0.25;
        ctx.lineTo(sx, base - (90 + f * 330) * z);
      }
      ctx.lineTo(W + 20, base + 900 * z); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    });
  };

  // ---------- terrain ----------
  const tileColor = (x, y, t) => {
    const p = O.pal, n = O.fbm(x * 0.22, y * 0.22), h = O.hash(x, y);
    switch (t) {
      case G.GRASS: return shade(mix(p.grass[Math.floor(n * 5) % 3], p.dry, Math.max(0, (n - 0.58) * 1.8)), 0.97 + h * 0.06);
      case G.LUSH: return shade(mix(p.lush, p.grass[0], h * 0.4), 0.98 + h * 0.04);
      case G.DRY: return shade(mix(p.dry, p.grass[1], h * 0.35), 0.97 + h * 0.05);
      case G.ROCK: return shade(mix(p.rock, p.scree, n), 0.95 + h * 0.08);
      case G.WATER: return mix(p.water, p.waterDeep, O.riverDepth[y * O.N + x] * 0.9);
      case G.BANK: return mix(p.bank, p.grass[0], 0.12 + h * 0.18);
      case G.ROAD: return mix(p.road, p.roadEdge, h * 0.5);
      case G.WHEAT: return p.wheat;
      case G.CROP: return p.crop;
      case G.TOWN: return p.groundSnow ? mix('#e6e3dc', '#d3cabb', h * 0.5) : mix('#c9ad83', '#bfa075', h);
      case G.CAMP: return mix(p.dry, p.road, 0.35 + h * 0.25);
    }
    return '#f0f';
  };

  O.tileColor = tileColor;

  O.drawTerrain = (ctx, v) => {
    const N = O.N;
    ctx.lineJoin = 'round';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const [sx, sy] = iso(x + 0.5, y + 0.5);
      if (sx < v.x0 - 40 || sx > v.x1 + 40 || sy < v.y0 - 24 || sy > v.y1 + 24) continue;
      const c = tileColor(x, y, O.tile(x, y));
      const a = iso(x, y), b = iso(x + 1, y), d = iso(x + 1, y + 1), e = iso(x, y + 1);
      poly(ctx, [...a, ...b, ...d, ...e], c, c, 1);
    }
    // grass tufts
    if (!O.pal.groundSnow) {
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(40,60,20,.25)'; ctx.beginPath();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const t = O.tile(x, y);
        if (t !== G.GRASS && t !== G.LUSH) continue;
        for (let k = 0; k < 3; k++) {
          const [sx, sy] = iso(x + O.hash(x * 3 + k, y), y + O.hash(y * 5, x + k));
          if (sx < v.x0 || sx > v.x1 || sy < v.y0 || sy > v.y1) continue;
          ctx.moveTo(sx - 2, sy); ctx.lineTo(sx - 1, sy - 3); ctx.moveTo(sx + 1, sy); ctx.lineTo(sx + 2, sy - 3.5);
        }
      }
      ctx.stroke();
    }
    // field furrows
    const p = O.pal;
    for (const f of O.fields) {
      ctx.strokeStyle = f.k === 'WHEAT' ? p.wheatRow : p.cropRow; ctx.lineWidth = 1.4; ctx.beginPath();
      for (let yy = f.y + 0.2; yy < f.y + f.d; yy += 0.34) { const a = iso(f.x + 0.1, yy), b = iso(f.x + f.w - 0.1, yy); ctx.moveTo(...a); ctx.lineTo(...b); }
      ctx.stroke();
      flat(ctx, f.x, f.y, f.w, f.d, 0, null, 'rgba(90,60,20,.35)');
    }
    // irrigation channels (арык)
    for (const line of O.ariks) {
      for (const [w, c] of [[5, p.groundSnow ? '#b9c8d2' : shade(p.bank, 0.8)], [2.6, p.groundSnow ? '#d7e8ef' : p.water]]) {
        ctx.beginPath(); ctx.lineWidth = w; ctx.strokeStyle = c; ctx.lineCap = 'round';
        line.forEach(([x, y], i) => { const s = iso(x, y); i ? ctx.lineTo(...s) : ctx.moveTo(...s); });
        ctx.stroke();
      }
    }
  };

  // ---------- objects ----------
  const D = (O.DRAW = {});

  D.peak = (ctx, o) => {
    const p = O.pal, r = o.r, h = o.h, rnd = O.rng((o.seed * 1000) | 0);
    const L = iso(o.x - r, o.y + r), F = iso(o.x + r, o.y + r), Rt = iso(o.x + r, o.y - r);
    const A = iso(o.x + (rnd() - 0.5) * r * 0.5, o.y + (rnd() - 0.5) * r * 0.5, h);
    const jag = (a, b, n, amp) => { const out = []; for (let i = 1; i < n; i++) { const q = lerp(a, b, i / n); out.push([q[0] + (rnd() - 0.5) * amp, q[1] + (rnd() - 0.5) * amp * 0.6]); } return out; };
    const leftE = jag(L, A, 4, r * 16), rightE = jag(Rt, A, 4, r * 16), spine = jag(F, A, 3, r * 12);
    const leftFace = [L, ...leftE, A, ...spine.slice().reverse(), F];
    const rightFace = [F, ...spine, A, ...rightE.slice().reverse(), Rt];
    const foothill = h < 130 && !p.groundSnow;
    const lc = foothill ? mix(p.mtnL, p.grass[2], 0.5) : p.mtnL, rc = foothill ? mix(p.mtnR, p.grass[2], 0.4) : p.mtnR;
    const fill = (pts, c1, c2) => {
      const g = ctx.createLinearGradient(0, A[1], 0, F[1]); g.addColorStop(0, c1); g.addColorStop(1, c2);
      poly(ctx, pts.flat(), g);
    };
    fill(leftFace, shade(lc, 1.08), shade(lc, 0.9));
    fill(rightFace, shade(rc, 1.0), shade(rc, 0.82));
    // gullies
    ctx.strokeStyle = 'rgba(40,35,40,.16)'; ctx.lineWidth = 1.3; ctx.beginPath();
    for (let i = 0; i < 5; i++) { const s = lerp(A, lerp(L, F, 0.15 + i * 0.18), 0.25), e = lerp(A, lerp(L, F, 0.1 + i * 0.2), 0.8); ctx.moveTo(...s); ctx.lineTo(e[0] + (rnd() - 0.5) * 8, e[1]); }
    ctx.stroke();
    // snow cap
    if (foothill && !p.groundSnow) return;
    const t = p.snowLine;
    [[leftFace, L, F, p.snow], [rightFace, F, Rt, p.snowShade]].forEach(([face, a, b, col]) => {
      ctx.save(); ctx.beginPath(); face.forEach((q, i) => (i ? ctx.lineTo(...q) : ctx.moveTo(...q))); ctx.closePath(); ctx.clip();
      const s0 = lerp(a, A, t), s1 = lerp(b, A, t);
      ctx.beginPath(); ctx.moveTo(s0[0] - 30, s0[1]);
      for (let i = 0; i <= 10; i++) { const q = lerp(s0, s1, i / 10); ctx.lineTo(q[0], q[1] + (i % 2 ? rnd() * 14 : -rnd() * 6)); }
      ctx.lineTo(s1[0] + 30, s1[1]); ctx.lineTo(A[0] + 60, A[1] - 20); ctx.lineTo(A[0] - 60, A[1] - 20); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.restore();
    });
  };

  const merlonsAlong = (ctx, x0, y0, x1, y1, z, n) => {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, x = x0 + (x1 - x0) * t - 0.13, y = y0 + (y1 - y0) * t - 0.13;
      box(ctx, x, y, 0.26, 0.26, 6, WALL, { z, top: top(WALL), edge: false });
    }
  };
  D.wall = (ctx, o) => {
    box(ctx, o.x, o.y, 1, 1, 8, BRICK, { top: shade(BRICK, 1.1) });
    box(ctx, o.x, o.y, 1, 1, o.h - 8, WALL, { z: 8, top: top(shade(WALL, 0.92)) });
    const z = o.h, s = o.side;
    if (s === 'e') merlonsAlong(ctx, o.x + 0.84, o.y, o.x + 0.84, o.y + 1, z, 2);
    if (s === 'w') merlonsAlong(ctx, o.x + 0.16, o.y, o.x + 0.16, o.y + 1, z, 2);
    if (s === 'n') merlonsAlong(ctx, o.x, o.y + 0.16, o.x + 1, o.y + 0.16, z, 2);
    if (s === 's') merlonsAlong(ctx, o.x, o.y + 0.84, o.x + 1, o.y + 0.84, z, 2);
  };

  D.tower = (ctx, o) => {
    const [sx, sy, rx, ry] = cyl(ctx, o.x, o.y, 0.74, o.h, WALL, { taper: 0.9, bands: [[0, BRICK, 9], [0.8, shade(WALL, 0.8), 3]], top: top(shade(WALL, 0.85)) });
    for (const half of [1, 0]) for (let i = 0; i < 7; i++) {
      const a = (half ? Math.PI : 0) + (i + 0.5) / 7 * Math.PI, mx = sx + Math.cos(a) * rx * 0.93, my = sy + Math.sin(a) * ry * 0.93;
      ctx.fillStyle = top(WALL); ctx.fillRect(mx - 2.4, my - 7, 4.8, 3);
      ctx.fillStyle = half ? shade(WALL, 0.8) : shade(WALL, Math.cos(a) > 0 ? 0.72 : 0.95); ctx.fillRect(mx - 2.4, my - 4, 4.8, 4);
    }
  };

  // Portal (пештак) with pointed arch and turquoise frame
  const portal = (ctx, face, h, opts = {}) => {
    const q = (u, v) => face(u, v);
    const P = (arr) => arr.flatMap(([u, v]) => q(u, v));
    poly(ctx, P([[0.14, 0], [0.86, 0], [0.86, h - 6], [0.14, h - 6]]), TURQ_D);
    poly(ctx, P([[0.2, 0], [0.8, 0], [0.8, h - 11], [0.2, h - 11]]), opts.face || shade(WALL, 0.9));
    const ah = Math.min(h * 0.62, h - 16);
    const arch = [[0.3, 0], [0.7, 0], [0.7, ah * 0.66], [0.62, ah * 0.9], [0.5, ah], [0.38, ah * 0.9], [0.3, ah * 0.66]];
    poly(ctx, P(arch), '#2a1d16');
    if (opts.door) poly(ctx, P([[0.33, 0], [0.49, 0], [0.49, ah * 0.6], [0.33, ah * 0.6]]), WOOD);
    ctx.strokeStyle = '#8fd8d0'; ctx.lineWidth = 1; ctx.beginPath();
    for (let v = 4; v < h - 10; v += 6) { ctx.moveTo(...q(0.15, v)); ctx.lineTo(...q(0.19, v)); ctx.moveTo(...q(0.81, v)); ctx.lineTo(...q(0.85, v)); }
    ctx.stroke();
    poly(ctx, P([[0.14, h - 10], [0.86, h - 10], [0.86, h - 6], [0.14, h - 6]]), '#e7c46a');
  };
  D.gate = (ctx, o) => {
    box(ctx, o.x, o.y, o.w, o.d, o.h, WALL, { top: top(shade(WALL, 0.92)) });
    const face = o.axis === 'x' ? (u, v) => iso(o.x + o.w, o.y + u * o.d, v) : (u, v) => iso(o.x + u * o.w, o.y + o.d, v);
    portal(ctx, face, o.h, { face: shade(WALL, o.axis === 'x' ? 0.72 : 0.9) });
    const corners = o.axis === 'x' ? [[o.x + 0.8, o.y + 0.25], [o.x + 0.8, o.y + o.d - 0.25]] : [[o.x + 0.25, o.y + 0.8], [o.x + o.w - 0.25, o.y + 0.8]];
    for (const [cx, cy] of corners) {
      const [tx, ty, rx, ry] = cyl(ctx, cx, cy, 0.18, 16, WALL, { z: o.h, top: null });
      dome(ctx, tx, ty, rx, ry, 8, TURQ);
    }
  };

  D.palace = (ctx, o) => {
    box(ctx, o.x, o.y, o.w, o.d, 8, BRICK, { top: shade(BRICK, 1.1) });
    box(ctx, o.x, o.y, o.w, o.d, o.h - 8, ADOBE, { z: 8, top: top(shade(ADOBE, 0.95)) });
    portal(ctx, (u, v) => iso(o.x + 0.4 + u * 1.6, o.y + o.d, v), o.h + 8, {});
    box(ctx, o.x + 0.4, o.y + o.d - 0.3, 1.6, 0.3, 8, ADOBE, { z: o.h, top: top(ADOBE) });
    const cx = o.x + o.w / 2 + 0.2, cy = o.y + o.d / 2 - 0.2;
    const [sx, sy, rx, ry] = cyl(ctx, cx, cy, 0.95, 12, ADOBE, { z: o.h, top: null, bands: [[0.3, TURQ, 3]] });
    dome(ctx, sx, sy, rx, ry, 34, TURQ, '#9fe3db');
    ctx.strokeStyle = 'rgba(10,60,60,.35)'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(sx + i * rx * 0.4, sy + ry * 0.7 * Math.cos(i * 0.5)); ctx.quadraticCurveTo(sx + i * rx * 0.33, sy - 22, sx, sy - 34); ctx.stroke(); }
    ctx.fillStyle = '#e7c46a'; ctx.fillRect(sx - 1, sy - 42, 2, 9); ctx.beginPath(); ctx.arc(sx, sy - 43, 2.2, 0, 7); ctx.fill();
    if (O.pal.snowRoof) { ctx.save(); ctx.globalAlpha = 0.85; dome(ctx, sx, sy - 18, rx * 0.55, ry * 0.5, 16, '#f4f7fa', '#ffffff'); ctx.restore(); }
  };

  D.burana = (ctx, o) => {
    box(ctx, o.x - 0.95, o.y - 0.95, 1.9, 1.9, 9, shade(BRICK, 0.92), { top: top(shade(BRICK, 1.05)) });
    const bands = [0.12, 0.3, 0.5, 0.68, 0.84].map((t) => [t, '#dca06a', 3]);
    const [sx, sy, rx, ry] = cyl(ctx, o.x, o.y, 0.62, o.h, BRICK, { z: 9, taper: 0.66, bands, top: shade(BRICK, 1.15) });
    ctx.fillStyle = 'rgba(60,30,10,.28)';
    for (let v = 12; v < o.h; v += 7) { const w = rx * (1 - (v / o.h) * 0.3); ctx.fillRect(sx - w * 0.1, sy + (o.h - v) - 2, w * 0.35, 1); }
    const [lx, ly, lrx, lry] = cyl(ctx, o.x, o.y, 0.34, 13, ADOBE, { z: o.h + 9, top: null });
    ctx.fillStyle = '#2a1d16'; for (const k of [-0.45, 0, 0.45]) ctx.fillRect(lx + k * lrx - 1.5, ly + 4, 3, 7);
    dome(ctx, lx, ly, lrx, lry, 9, TURQ);
  };

  D.granary = (ctx, o) => {
    box(ctx, o.x, o.y, o.w, o.d, o.h, shade(ADOBE, 0.95), { top: top(ADOBE) });
    const [sx, sy] = iso(o.x + o.w / 2, o.y + o.d / 2, o.h);
    dome(ctx, sx, sy, 16, 8, 12, shade(ADOBE, 1.02));
  };

  const HOUSE = ['#d7bd92', '#cdb083', '#dcc59f', '#c9a97a'];
  D.house = (ctx, o) => {
    const c = HOUSE[Math.floor(o.c * 4)];
    box(ctx, o.x, o.y, o.w, o.d, o.h, c, { top: top(shade(c, 0.94)) });
    box(ctx, o.x, o.y, o.w, 0.12, 4, c, { z: o.h, top: top(c), edge: false });
    box(ctx, o.x, o.y, 0.12, o.d, 4, c, { z: o.h, top: top(c), edge: false });
    poly(ctx, [...iso(o.x + o.w * 0.3, o.y + o.d, 0), ...iso(o.x + o.w * 0.52, o.y + o.d, 0), ...iso(o.x + o.w * 0.52, o.y + o.d, 10), ...iso(o.x + o.w * 0.3, o.y + o.d, 10)], o.c > 0.5 ? '#3d6aa8' : '#6b4424');
    poly(ctx, [...iso(o.x + o.w, o.y + o.d * 0.4, 7), ...iso(o.x + o.w, o.y + o.d * 0.62, 7), ...iso(o.x + o.w, o.y + o.d * 0.62, 12), ...iso(o.x + o.w, o.y + o.d * 0.4, 12)], '#3a2a20');
    if (o.c > 0.7 && !O.pal.snowRoof) flat(ctx, o.x + 0.3, o.y + 0.25, 0.5, 0.35, o.h + 0.5, RED);
    if (o.c < 0.25) { const [sx, sy] = iso(o.x + 0.55, o.y + 0.45, o.h); dome(ctx, sx, sy, 7, 3.5, 7, O.pal.snowRoof ? '#eef2f6' : '#c9a24a'); }
  };

  const AWN = [[RED, '#f1e6cf'], [INDIGO, '#f1e6cf'], [TURQ, '#f1e6cf']];
  D.stall = (ctx, o) => {
    box(ctx, o.x, o.y, o.w, o.d, 7, WOOD, {});
    const [c1, c2] = AWN[o.c];
    for (let i = 0; i < 4; i++) flat(ctx, o.x - 0.08 + (i * (o.w + 0.16)) / 4, o.y - 0.08, (o.w + 0.16) / 4, o.d + 0.16, 15, O.pal.snowRoof ? '#eef2f6' : i % 2 ? c2 : c1);
    for (const [u, v, k] of [[0.25, 0.8, '#e8c34a'], [0.5, 0.85, '#d95b3a'], [0.75, 0.8, '#e8c34a']]) {
      const [sx, sy] = iso(o.x + o.w * u, o.y + o.d * v + 0.25, 1.5); ctx.beginPath(); ctx.ellipse(sx, sy, 3.2, 2.2, 0, 0, 7); ctx.fillStyle = k; ctx.fill();
    }
  };

  D.pool = (ctx, o) => {
    box(ctx, o.x, o.y, o.w, o.d, 3, '#a9a39a', { top: '#bdb7ad' });
    flat(ctx, o.x + 0.15, o.y + 0.15, o.w - 0.3, o.d - 0.3, 3, O.pal.groundSnow ? '#cfe3ec' : '#5fb7c0');
  };

  D.tandyr = (ctx, o) => {
    const [sx, sy] = iso(o.x, o.y); O.ellipseShadow(ctx, sx, sy, 12, 6);
    dome(ctx, sx, sy, 10, 5, 13, '#c08d5c'); ctx.fillStyle = '#2a1d16'; ctx.beginPath(); ctx.ellipse(sx, sy - 12, 3.5, 1.6, 0, 0, 7); ctx.fill();
  };

  // ---------- vegetation ----------
  D.poplar = (ctx, o) => {
    const p = O.pal, s = o.s || 1, [sx, sy] = iso(o.x, o.y), H = 64 * s, w = 9 * s;
    O.ellipseShadow(ctx, sx + 6, sy + 1, 10 * s, 4 * s, 0.18);
    ctx.strokeStyle = '#5a4332'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 12 * s); ctx.stroke();
    if (p.bare) {
      ctx.strokeStyle = p.poplar; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = -3; i <= 3; i++) { ctx.moveTo(sx, sy - 8 * s); ctx.quadraticCurveTo(sx + i * 2.4 * s, sy - H * 0.5, sx + i * 1.2 * s, sy - H * (0.85 - Math.abs(i) * 0.05)); }
      ctx.stroke(); return;
    }
    const crown = (x0, col) => { ctx.beginPath(); ctx.moveTo(sx, sy - 7 * s); ctx.bezierCurveTo(sx + x0 * w * 1.1, sy - H * 0.35, sx + x0 * w * 0.8, sy - H * 0.8, sx, sy - H); ctx.lineTo(sx, sy - 7 * s); ctx.fillStyle = col; ctx.fill(); };
    crown(-1, p.poplarHi); crown(1, p.poplar);
  };

  D.fruit = (ctx, o) => {
    const p = O.pal, s = o.s || 1, [sx, sy] = iso(o.x, o.y);
    O.ellipseShadow(ctx, sx + 3, sy + 1, 13 * s, 6 * s, 0.2);
    ctx.strokeStyle = '#5a4332'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 12 * s); ctx.stroke();
    if (p.bare) {
      ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = -2; i <= 2; i++) { ctx.moveTo(sx, sy - 10 * s); ctx.lineTo(sx + i * 6 * s, sy - (22 - Math.abs(i) * 3) * s); }
      ctx.stroke(); return;
    }
    const g = ctx.createRadialGradient(sx - 4 * s, sy - 22 * s, 2, sx, sy - 18 * s, 14 * s);
    g.addColorStop(0, p.fruitHi); g.addColorStop(1, p.fruit);
    ctx.beginPath(); ctx.ellipse(sx, sy - 19 * s, 12 * s, 10 * s, 0, 0, 7); ctx.fillStyle = g; ctx.fill();
    if (p.fruitDot) { ctx.fillStyle = p.fruitDot; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(sx + (O.hash(o.x * 9 + i, o.y) - 0.5) * 16 * s, sy - 19 * s + (O.hash(o.y * 7, i) - 0.5) * 12 * s, 1.5, 0, 7); ctx.fill(); } }
  };

  D.spruce = (ctx, o) => {
    const p = O.pal, s = o.s || 1, [sx, sy] = iso(o.x, o.y), H = 50 * s, w = 9 * s;
    O.ellipseShadow(ctx, sx + 4, sy + 1, 9 * s, 4 * s, 0.2);
    for (let i = 0; i < 4; i++) {
      const b = sy - 4 * s - i * H * 0.2, tipY = b - H * 0.42, ww = w * (1 - i * 0.18);
      poly(ctx, [sx - ww, b, sx, tipY, sx, b + 2], p.spruceHi); poly(ctx, [sx, b + 2, sx, tipY, sx + ww, b], p.spruce);
      if (p.snowRoof) poly(ctx, [sx - ww * 0.8, b - 2, sx, tipY, sx + ww * 0.4, b - 3, sx, b - 4], 'rgba(245,248,252,.9)');
    }
  };
  D.shrub = (ctx, o) => {
    const p = O.pal, s = o.s || 1, [sx, sy] = iso(o.x, o.y);
    ctx.beginPath(); ctx.ellipse(sx, sy - 4 * s, 8 * s, 5 * s, 0, 0, 7); ctx.fillStyle = p.bare ? '#8a7a68' : shade(p.fruit, 0.85); ctx.fill();
  };
  D.rock = (ctx, o) => {
    const s = o.s, [sx, sy] = iso(o.x, o.y);
    poly(ctx, [sx - 10 * s, sy, sx - 6 * s, sy - 8 * s, sx + 3 * s, sy - 10 * s, sx + 10 * s, sy - 2 * s, sx + 4 * s, sy + 3 * s], '#9a958c');
    poly(ctx, [sx - 6 * s, sy - 8 * s, sx + 3 * s, sy - 10 * s, sx + 1 * s, sy - 4 * s], O.pal.snowRoof ? '#f3f6f9' : '#b9b4aa');
  };
  D.sheaf = (ctx, o) => {
    if (!O.pal.sheaves) return;
    const [sx, sy] = iso(o.x, o.y);
    poly(ctx, [sx - 5, sy, sx, sy - 13, sx + 5, sy], '#e3bf64'); poly(ctx, [sx, sy - 13, sx + 5, sy, sx + 1, sy + 1], '#b99035');
  };

  // ---------- works & trade ----------
  D.bridge = (ctx, o) => {
    for (const u of [0.2, 0.5, 0.8]) box(ctx, o.x + o.w * u, o.y + 0.05, 0.14, 0.14, 7, '#5f3f24', { z: -4 });
    box(ctx, o.x, o.y, o.w, o.d, 3, WOOD, { z: 5, top: top('#9b6a3d') });
    ctx.strokeStyle = 'rgba(60,35,15,.5)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = o.x + 0.2; x < o.x + o.w; x += 0.25) { ctx.moveTo(...iso(x, o.y, 8)); ctx.lineTo(...iso(x, o.y + o.d, 8)); }
    ctx.stroke();
    for (const y of [o.y + 0.05, o.y + o.d - 0.05]) { ctx.strokeStyle = '#5f3f24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(...iso(o.x, y, 15)); ctx.lineTo(...iso(o.x + o.w, y, 15)); ctx.stroke(); }
  };
  D.mill = (ctx, o) => {
    box(ctx, o.x, o.y, o.w, o.d, o.h, ADOBE, { top: top(ADOBE) });
    box(ctx, o.x - 0.1, o.y - 0.1, o.w + 0.2, o.d + 0.2, 4, WOOD, { z: o.h, top: top('#9b6a3d') });
  };
  D.quarry = (ctx, o) => {
    flat(ctx, o.x, o.y, o.w, o.d, 0, O.pal.groundSnow ? '#d9dee4' : '#a19a8e');
    box(ctx, o.x, o.y, o.w, 0.6, 16, '#8f897f', { top: top('#a8a296') });
    box(ctx, o.x, o.y + 0.6, o.w * 0.6, 0.5, 8, '#8f897f', { top: top('#a8a296') });
    for (const [x, y] of [[o.x + 2.2, o.y + 1.2], [o.x + 1.4, o.y + 1.5]]) box(ctx, x, y, 0.4, 0.3, 5, '#b3ada2', { top: top('#cbc5ba') });
  };
  D.hut = (ctx, o) => {
    box(ctx, o.x, o.y, o.w, o.d, o.h, '#7a5332', { top: top('#6b4a2c') });
    box(ctx, o.x - 0.1, o.y - 0.1, o.w + 0.2, o.d + 0.2, 3, '#5f3f24', { z: o.h, top: top('#7d5a35') });
  };
  D.logs = (ctx, o) => {
    for (const [dx, dz] of [[0, 0], [0.3, 0], [0.15, 5]]) {
      const [sx, sy] = iso(o.x + dx, o.y, 3 + dz);
      ctx.fillStyle = '#8a5a32'; ctx.fillRect(sx - 14, sy - 3, 20, 6);
      ctx.beginPath(); ctx.ellipse(sx + 6, sy, 3, 3.2, 0, 0, 7); ctx.fillStyle = '#e3b77e'; ctx.fill();
    }
  };
  D.caravanserai = (ctx, o) => {
    const t = 0.6, h = o.h, c = shade(ADOBE, 0.97);
    box(ctx, o.x, o.y, o.w, t, h, c, { top: top(c) });
    box(ctx, o.x, o.y + t, t, o.d - t, h, c, { top: top(c) });
    flat(ctx, o.x + t, o.y + t, o.w - 2 * t, o.d - 2 * t, 0, O.pal.groundSnow ? '#e3e1db' : '#c7a878');
    const [wx, wy] = iso(o.x + o.w / 2, o.y + o.d / 2); ctx.beginPath(); ctx.ellipse(wx, wy, 8, 4, 0, 0, 7); ctx.fillStyle = '#5fb7c0'; ctx.fill();
    box(ctx, o.x + o.w - t, o.y + t, t, o.d - t, h, c, { top: top(c) });
    box(ctx, o.x + t, o.y + o.d - t, o.w - 2 * t, t, h, c, { top: top(c) });
    box(ctx, o.x + o.w / 2 - 0.8, o.y + o.d - t, 1.6, t, h + 12, c, { top: top(c) });
    portal(ctx, (u, v) => iso(o.x + o.w / 2 - 0.8 + u * 1.6, o.y + o.d, v), h + 12, { face: shade(c, 0.9) });
    for (const [x, y] of [[o.x, o.y], [o.x + o.w, o.y], [o.x, o.y + o.d], [o.x + o.w, o.y + o.d]]) cyl(ctx, x, y, 0.42, h + 6, c, { top: top(c) });
  };

  // ---------- nomad camp ----------
  const FELT = ['#ece4d2', '#e0d5bf', '#d6c9ad', '#e8dfcd', '#d9cfbb'];
  D.yurt = (ctx, o) => {
    const s = o.s || 1, r = 0.82 * s, kh = 11 * s, dh = 14 * s;
    const col = o.khan ? '#f5f0e4' : FELT[(o.v || 0) % FELT.length];
    const [bx, by] = iso(o.x, o.y);
    O.ellipseShadow(ctx, bx + 5, by + 2, r * RX * 1.15, r * RY * 1.1, 0.22);
    const [sx, sy, rx, ry] = cyl(ctx, o.x, o.y, r, kh, col, { top: null, bands: [[0.72, RED, 2.6 * s], [0.55, INDIGO, 1.2 * s]] });
    // wooden door facing the viewer
    const dw = 4.2 * s, dhh = 8.5 * s, fx = bx, fy = by + ry;
    ctx.fillStyle = '#b5542e'; ctx.fillRect(fx - dw, fy - dhh, dw * 2, dhh);
    ctx.strokeStyle = '#e7c46a'; ctx.lineWidth = 0.8; ctx.strokeRect(fx - dw + 1.2, fy - dhh + 1.2, dw * 2 - 2.4, dhh - 2.4);
    const roof = O.pal.snowRoof ? '#f6f8fb' : shade(col, 0.96);
    dome(ctx, sx, sy, rx, ry, dh, roof, O.pal.snowRoof ? '#ffffff' : shade(col, 1.12));
    if (o.khan) { ctx.strokeStyle = RED; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(sx, sy - dh * 0.45, rx * 0.78, ry * 0.7, 0, 0.1, Math.PI - 0.1); ctx.stroke(); }
    // ropes over the roof
    ctx.strokeStyle = 'rgba(90,60,40,.45)'; ctx.lineWidth = 0.9; ctx.beginPath();
    for (const k of [-0.6, 0.6]) { ctx.moveTo(sx + k * rx, sy + ry * 0.55); ctx.quadraticCurveTo(sx + k * rx * 0.55, sy - dh * 0.8, sx, sy - dh + 1); }
    ctx.stroke();
    // түндүк
    ctx.beginPath(); ctx.ellipse(sx, sy - dh + 1, rx * 0.2, ry * 0.2, 0, 0, 7); ctx.fillStyle = '#5a3d22'; ctx.fill();
    ctx.strokeStyle = '#c9a064'; ctx.lineWidth = 0.8; ctx.beginPath();
    ctx.moveTo(sx - rx * 0.2, sy - dh + 1); ctx.lineTo(sx + rx * 0.2, sy - dh + 1); ctx.moveTo(sx, sy - dh + 1 - ry * 0.2); ctx.lineTo(sx, sy - dh + 1 + ry * 0.2); ctx.stroke();
  };

  D.arba = (ctx, o) => {
    const [sx, sy] = iso(o.x, o.y);
    O.ellipseShadow(ctx, sx, sy + 1, 18, 7, 0.18);
    ctx.strokeStyle = '#5f3f24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx - 4, sy - 12); ctx.lineTo(sx - 26, sy - 3); ctx.stroke();
    box(ctx, o.x - 0.35, o.y - 0.3, 0.7, 0.6, 3, WOOD, { z: 11, top: top('#a8743f') });
    const [bx, by] = iso(o.x, o.y + 0.36, 11);
    ctx.strokeStyle = '#4a311c'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.ellipse(bx, by, 9, 11, -0.35, 0, 7); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI; ctx.moveTo(bx + Math.cos(a) * 9, by + Math.sin(a) * 11); ctx.lineTo(bx - Math.cos(a) * 9, by - Math.sin(a) * 11); } ctx.stroke();
    if (!O.pal.snowRoof) { const [cx, cy] = iso(o.x, o.y, 16); ctx.fillStyle = '#a8322d'; ctx.fillRect(cx - 8, cy - 4, 14, 5); ctx.fillStyle = '#e0d5bf'; ctx.fillRect(cx - 4, cy - 8, 9, 5); }
  };
  D.tuu = (ctx, o) => {
    const [sx, sy] = iso(o.x, o.y);
    ctx.strokeStyle = '#4a311c'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 74); ctx.stroke();
    ctx.fillStyle = '#e7c46a'; ctx.beginPath(); ctx.arc(sx, sy - 76, 3, 0, 7); ctx.fill();
  };
  D.fire = (ctx, o) => {
    const [sx, sy] = iso(o.x, o.y);
    ctx.fillStyle = '#7d766c'; for (let i = 0; i < 7; i++) { const a = (i / 7) * 6.28; ctx.beginPath(); ctx.ellipse(sx + Math.cos(a) * 9, sy + Math.sin(a) * 4.5, 2.6, 1.8, 0, 0, 7); ctx.fill(); }
    ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx - 9, sy + 2); ctx.lineTo(sx, sy - 18); ctx.lineTo(sx + 9, sy + 2); ctx.stroke();
    ctx.fillStyle = '#23201d'; ctx.beginPath(); ctx.ellipse(sx, sy - 9, 7, 5, 0, 0, Math.PI); ctx.fill(); ctx.fillRect(sx - 7, sy - 11, 14, 2.5);
  };
  D.tether = (ctx, o) => {
    const a = iso(o.x, o.y), b = iso(o.x + o.w, o.y);
    ctx.strokeStyle = '#4a311c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0], a[1] - 12); ctx.moveTo(b[0], b[1]); ctx.lineTo(b[0], b[1] - 12); ctx.stroke();
    ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a[0], a[1] - 10); ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 6, b[0], b[1] - 10); ctx.stroke();
  };

  // Extra shapes used by build-menu thumbnails
  D.barracks = (ctx, o) => { D.house(ctx, { ...o, w: 1.6, d: 1.3, h: 20, c: 0.3 }); const [sx, sy] = iso(o.x + 0.3, o.y + 0.2, 20); ctx.strokeStyle = '#4a311c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx, sy - 22); ctx.stroke(); poly(ctx, [sx, sy - 22, sx + 14, sy - 18, sx, sy - 13], TURQ); };
  D.forge = (ctx, o) => { box(ctx, o.x, o.y, 1.4, 1.2, 16, '#8c7a66', { top: top('#7a6a58') }); cyl(ctx, o.x + 0.35, o.y + 0.3, 0.2, 14, '#6b5a4a', { z: 16 }); };
  D.manjanik = (ctx, o) => {
    box(ctx, o.x, o.y, 1.4, 0.8, 5, WOOD, { top: '#9b6a3d' });
    const [a, b] = iso(o.x + 0.7, o.y + 0.4, 5);
    ctx.strokeStyle = '#5f3f24'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(a - 10, b); ctx.lineTo(a, b - 22); ctx.lineTo(a + 10, b); ctx.moveTo(a - 16, b - 30); ctx.lineTo(a + 18, b - 12); ctx.stroke();
    box(ctx, o.x + 1.05, o.y + 0.2, 0.35, 0.35, 8, '#7d766c', { z: 8 });
  };
  D.field = (ctx, o) => {
    flat(ctx, o.x, o.y, 1.6, 1.6, 0, O.pal.wheat); ctx.strokeStyle = O.pal.wheatRow; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let y = o.y + 0.2; y < o.y + 1.6; y += 0.3) { ctx.moveTo(...iso(o.x + 0.1, y)); ctx.lineTo(...iso(o.x + 1.5, y)); } ctx.stroke();
  };
  D.pen = (ctx, o) => {
    const [sx, sy] = iso(o.x, o.y), rx = 1.1 * RX, ry = 1.1 * RY;
    ctx.strokeStyle = '#6b4a2c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(sx, sy - 6, rx, ry, 0, 0, 7); ctx.stroke();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.28; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * rx, sy + Math.sin(a) * ry); ctx.lineTo(sx + Math.cos(a) * rx, sy + Math.sin(a) * ry - 9); ctx.stroke(); }
  };

  // ---------- static pass ----------
  const sorted = () => (O._sorted ||= O.static.slice().sort((a, b) => a.depth - b.depth));
  O.drawStatic = (ctx, v) => {
    for (const o of sorted()) {
      const [sx, sy] = iso(o.x + (o.w || 0) / 2, o.y + (o.d || 0) / 2);
      const peak = o.t === 'peak', pad = peak ? o.r * 50 : 140;
      const bottom = sy + (peak ? o.r * 20 : 40), topY = sy - (peak ? o.h + 80 : 200);
      if (sx < v.x0 - pad || sx > v.x1 + pad || bottom < v.y0 || topY > v.y1) continue;
      D[o.t](ctx, o);
    }
  };
})();
