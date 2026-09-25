// Animated layer: people, herds, smoke, water, snow, selection and the build ghost.
(() => {
  const { iso, shade, poly, RX, RY } = O;
  const SKIN = '#d6a276';
  const TEAM = { city: { cloth: '#2c9f98', dark: '#17625f', ring: '#7ff3e6' }, nomad: { cloth: '#a8322d', dark: '#26407a', ring: '#ffb09f' } };
  const HORSE = ['#6b3e22', '#8a4f28', '#cfc7b8', '#2b221d', '#b38b5a'];

  const person = (ctx, sx, sy, o) => {
    const b = o.bob || 0;
    ctx.strokeStyle = '#2d241d'; ctx.lineWidth = 1.6; ctx.beginPath();
    ctx.moveTo(sx - 1.5, sy); ctx.lineTo(sx - 1.2, sy - 5); ctx.moveTo(sx + 1.5, sy); ctx.lineTo(sx + 1.2, sy - 5); ctx.stroke();
    ctx.fillStyle = o.cloth; ctx.beginPath(); ctx.roundRect(sx - 3.2, sy - 12 + b, 6.4, 8, 2); ctx.fill();
    ctx.fillStyle = SKIN; ctx.beginPath(); ctx.arc(sx, sy - 14.5 + b, 2.4, 0, 7); ctx.fill();
    if (o.hat === 'helm') { poly(ctx, [sx - 2.8, sy - 15 + b, sx, sy - 20 + b, sx + 2.8, sy - 15 + b], '#9aa3ad'); }
    else if (o.hat === 'kalpak') { poly(ctx, [sx - 3, sy - 15 + b, sx - 0.5, sy - 21 + b, sx + 3, sy - 15 + b], '#f4efe2'); ctx.fillStyle = '#1a1a1a'; ctx.fillRect(sx - 3, sy - 15.6 + b, 6, 1.2); }
    else { ctx.fillStyle = o.hatColor || '#f1e6cf'; ctx.beginPath(); ctx.arc(sx, sy - 15.6 + b, 2.4, Math.PI, 0); ctx.fill(); }
  };

  const horse = (ctx, sx, sy, o) => {
    const f = o.face || 1, col = HORSE[o.c || 0], t = o.gait || 0;
    O.ellipseShadow(ctx, sx, sy + 1, 11, 3.5, 0.2);
    ctx.strokeStyle = shade(col, 0.7); ctx.lineWidth = 1.8; ctx.beginPath();
    const legs = [-6, -3.5, 3.5, 6];
    legs.forEach((lx, i) => { const sw = o.moving ? Math.sin(t + i * 1.6) * 3 : 0; ctx.moveTo(sx + lx * f, sy - 7); ctx.lineTo(sx + (lx + sw) * f, sy); });
    ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(sx, sy - 9, 8.5, 4.2, 0, 0, 7); ctx.fill();
    const hd = o.graze ? 5 : -5; // head down while grazing
    ctx.beginPath(); ctx.moveTo(sx - 6 * f, sy - 11); ctx.lineTo(sx - 10 * f, sy - 13 + hd); ctx.lineTo(sx - 13 * f, sy - 11 + hd); ctx.lineTo(sx - 12 * f, sy - 9 + hd); ctx.lineTo(sx - 6 * f, sy - 7); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = shade(col, 0.55); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(sx + 8 * f, sy - 10); ctx.quadraticCurveTo(sx + 12 * f, sy - 8, sx + 11 * f, sy - 3); ctx.stroke();
  };

  const DRAW = {
    soldier(ctx, o, t) {
      const [sx, sy] = iso(o.x, o.y), bob = Math.sin(t * 2 + o.x * 5) * 0.4, tm = TEAM.city;
      O.ellipseShadow(ctx, sx, sy + 1, 5, 2, 0.25);
      ctx.strokeStyle = '#c9b58a'; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(sx + 4, sy + 1); ctx.lineTo(sx + 4, sy - 25); ctx.stroke();
      poly(ctx, [sx + 2.8, sy - 25, sx + 4, sy - 30, sx + 5.2, sy - 25], '#e5e9ef');
      person(ctx, sx, sy, { cloth: tm.cloth, hat: 'helm', bob });
      ctx.beginPath(); ctx.arc(sx - 3.5, sy - 8 + bob, 3.6, 0, 7); ctx.fillStyle = tm.dark; ctx.fill(); ctx.strokeStyle = '#e7c46a'; ctx.lineWidth = 0.8; ctx.stroke();
    },
    wallArcher(ctx, o, t) {
      const [sx, sy] = iso(o.x, o.y, O.wallH);
      person(ctx, sx, sy, { cloth: TEAM.city.cloth, hat: 'helm', bob: Math.sin(t * 1.5 + o.y) * 0.3 });
      ctx.strokeStyle = '#8a5a32'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(sx + 3, sy - 10, 5, -1.2, 1.2); ctx.stroke();
    },
    rider(ctx, o, t) {
      const moving = !o.shepherd, f = o.shepherd ? -1 : 1;
      const [sx, sy] = iso(o.x + (moving ? Math.sin(t * 0.6 + o.ph) * 0.05 : 0), o.y);
      const gallop = moving ? Math.abs(Math.sin(t * 7 + o.ph)) * 2 : 0;
      const wet = O.tile(Math.floor(o.x), Math.floor(o.y)) === O.G.WATER;
      if (moving && !wet && !O.pal.groundSnow) for (let k = 0; k < 3; k++) { const ph = (t * 1.3 + k / 3 + o.ph * 0.1) % 1; ctx.fillStyle = `rgba(200,180,140,${0.35 * (1 - ph)})`; ctx.beginPath(); ctx.arc(sx + 12 + ph * 16, sy - 2 - ph * 6, 3 + ph * 6, 0, 7); ctx.fill(); }
      horse(ctx, sx, sy - gallop, { c: (o.ph % 3) + (o.shepherd ? 2 : 0), moving, gait: t * 9 + o.ph, face: f });
      if (wet) for (let k = 0; k < 2; k++) { const ph = (t * 2 + k / 2 + o.ph * 0.2) % 1; ctx.strokeStyle = `rgba(235,250,250,${0.8 * (1 - ph)})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.ellipse(sx, sy, 9 + ph * 10, 3 + ph * 3, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
      const tm = TEAM.nomad;
      person(ctx, sx + 1 * f, sy - 10 - gallop, { cloth: o.ph % 2 ? tm.cloth : tm.dark, hat: 'kalpak' });
      ctx.strokeStyle = '#8a5a32'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(sx - 3 * f, sy - 21 - gallop, 6, f > 0 ? 2 : -1.1, f > 0 ? 4.2 : 1.1); ctx.stroke();
    },
    horse(ctx, o, t) {
      const [sx, sy] = iso(o.x, o.y);
      horse(ctx, sx, sy, { c: o.c, graze: !o.tied && Math.sin(t * 0.5 + o.ph) > -0.3, face: o.ph > 3 ? -1 : 1 });
    },
    sheep(ctx, o, t) {
      const [sx, sy] = iso(o.x + Math.sin(t * 0.2 + o.ph) * 0.08, o.y);
      O.ellipseShadow(ctx, sx, sy + 1, 5, 2, 0.18);
      ctx.fillStyle = o.ph > 5 ? '#8a6a4a' : '#f2ede2'; ctx.beginPath(); ctx.ellipse(sx, sy - 4, 5, 3.4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#3a2f28'; ctx.beginPath(); ctx.ellipse(sx - 5, sy - 4 + (Math.sin(t + o.ph) > 0 ? 1.5 : 0), 1.8, 1.5, 0, 0, 7); ctx.fill();
    },
    peasant(ctx, o, t) {
      const [sx, sy] = iso(o.x, o.y), bend = Math.max(0, Math.sin(t * 2 + o.ph)) * 2;
      O.ellipseShadow(ctx, sx, sy + 1, 4, 1.6, 0.2);
      person(ctx, sx, sy, { cloth: ['#e9e1cf', '#3d6aa8', '#8a5a32'][Math.floor(o.ph) % 3], bob: bend, hatColor: '#f4efe2' });
      ctx.strokeStyle = '#6b4a2c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx + 3, sy - 9 + bend); ctx.lineTo(sx + 8, sy - 1 + bend * 0.5); ctx.stroke();
    },
    camel(ctx, o, t) {
      const [sx, sy] = iso(o.x, o.y), f = o.face, sw = Math.sin(t * 3 + o.k);
      if (o.lead) { person(ctx, sx - 16 * f, sy + 2, { cloth: '#26407a', hat: 'kalpak' }); ctx.strokeStyle = '#5f3f24'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(sx - 13 * f, sy - 8); ctx.lineTo(sx - 9 * f, sy - 16); ctx.stroke(); }
      O.ellipseShadow(ctx, sx, sy + 1, 11, 3.5, 0.2);
      ctx.strokeStyle = '#9a7442'; ctx.lineWidth = 2; ctx.beginPath();
      for (const [lx, p] of [[-5, 0], [-3, 2], [4, 1], [6, 3]]) { ctx.moveTo(sx + lx * f, sy - 9); ctx.lineTo(sx + (lx + Math.sin(t * 3 + p + o.k) * 2) * f, sy); }
      ctx.stroke();
      ctx.fillStyle = '#c9a164'; ctx.beginPath(); ctx.ellipse(sx, sy - 12, 9, 4.5, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx - 3 * f, sy - 16, 3, 3.4, 0, 0, 7); ctx.ellipse(sx + 3 * f, sy - 16, 3, 3.4, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#c9a164'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx - 7 * f, sy - 13); ctx.quadraticCurveTo(sx - 13 * f, sy - 12, sx - 12 * f, sy - 20 + sw * 0.5); ctx.stroke();
      ctx.fillStyle = '#b48d52'; ctx.beginPath(); ctx.ellipse(sx - 13 * f, sy - 21 + sw * 0.5, 2.8, 1.8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = o.k % 2 ? '#a8322d' : '#26407a'; ctx.fillRect(sx - 6, sy - 16, 12, 5); ctx.fillStyle = '#e7c46a'; ctx.fillRect(sx - 6, sy - 14, 12, 1);
    },
    pen(ctx, o, t) {
      const [sx, sy] = iso(o.x, o.y), rx = 1.1 * RX, ry = 1.1 * RY;
      const stakes = (from, to) => { ctx.strokeStyle = '#6b4a2c'; ctx.lineWidth = 1.6; for (let i = 0; i < 18; i++) { const a = (i / 18) * 6.283; if (Math.sin(a) < from || Math.sin(a) > to) continue; ctx.beginPath(); ctx.moveTo(sx + Math.cos(a) * rx, sy + Math.sin(a) * ry); ctx.lineTo(sx + Math.cos(a) * rx, sy + Math.sin(a) * ry - 9); ctx.stroke(); } };
      ctx.strokeStyle = '#6b4a2c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(sx, sy - 6, rx, ry, 0, Math.PI, 0); ctx.stroke();
      stakes(-1.1, 0);
      for (let i = 0; i < o.n; i++) DRAW.sheep(ctx, { x: o.x + (O.hash(i, 7) - 0.5) * 1.3, y: o.y + (O.hash(7, i) - 0.5) * 1.3, ph: O.hash(i, i) * 6 }, t);
      ctx.strokeStyle = '#6b4a2c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(sx, sy - 6, rx, ry, 0, 0, Math.PI); ctx.stroke();
      stakes(0, 1.1);
    },
  };

  // Caravan position along its path
  const path = () => O.caravanPath;
  const pathLen = () => { let L = 0; const p = path(); for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return L; };
  const along = (s) => {
    const p = path();
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1], [bx, by] = p[i], l = Math.hypot(bx - ax, by - ay);
      if (s <= l) return [ax + (bx - ax) * (s / l), ay + (by - ay) * (s / l), (bx - ax) - (by - ay)];
      s -= l;
    }
    const q = p[p.length - 1]; return [q[0], q[1], -1];
  };

  O.drawLive = (ctx, v, t) => {
    const L = pathLen(), items = [];
    for (const o of O.live) {
      if (o.t === 'camel') {
        const s = (t * 0.45 + (4 - o.k) * 0.95) % (L + 3);
        if (s > L) continue;
        const [x, y, dir] = along(s);
        items.push({ ...o, x, y, face: dir < 0 ? 1 : -1 });
      } else items.push(o);
    }
    items.sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const o of items) {
      const [sx, sy] = iso(o.x, o.y);
      if (sx < v.x0 - 60 || sx > v.x1 + 60 || sy < v.y0 - 40 || sy > v.y1 + 60) continue;
      DRAW[o.t](ctx, o, t);
    }
  };

  // Smoke, fire, banner, mill wheel, sparkles
  O.drawAmbient = (ctx, v, t) => {
    const p = O.pal;
    for (const [x, y, z] of O.smokes) {
      const [sx, sy] = iso(x, y, z);
      for (let i = 0; i < 7; i++) {
        const ph = (t * 0.22 + i / 7) % 1;
        ctx.fillStyle = `rgba(236,233,226,${0.42 * (1 - ph)})`;
        ctx.beginPath(); ctx.arc(sx + ph * 22 + Math.sin(t + i) * 2, sy - ph * 70, 3 + ph * 11, 0, 7); ctx.fill();
      }
    }
    const fire = O.static.find((o) => o.t === 'fire');
    if (fire) {
      const [fx, fy] = iso(fire.x, fire.y);
      for (let i = 0; i < 3; i++) { const fl = 5 + Math.sin(t * 12 + i * 2) * 2; poly(ctx, [fx - 4 + i * 3, fy, fx - 2 + i * 3, fy - fl, fx + i * 3, fy], i === 1 ? '#ffd35a' : '#f07a2a'); }
    }
    const tuu = O.static.find((o) => o.t === 'tuu');
    if (tuu) {
      const [tx, ty] = iso(tuu.x, tuu.y, 72);
      ctx.strokeStyle = '#1e1a18'; ctx.lineWidth = 1.4;
      for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(tx, ty); const sw = Math.sin(t * 2 + i * 0.4) * 6; ctx.quadraticCurveTo(tx + 6 + sw, ty + 6, tx + 9 + sw * 1.4 + i, ty + 20); ctx.stroke(); }
      ctx.fillStyle = '#a8322d'; ctx.beginPath(); ctx.moveTo(tx, ty + 4); const w = Math.sin(t * 3) * 3; ctx.quadraticCurveTo(tx + 10, ty + 2 + w, tx + 20, ty + 6 + w); ctx.lineTo(tx + 18, ty + 13 + w); ctx.quadraticCurveTo(tx + 9, ty + 11 - w, tx, ty + 14); ctx.fill();
    }
    const mill = O.static.find((o) => o.t === 'mill');
    if (mill) {
      const cx = mill.x + mill.w + 0.12, cy = mill.y + mill.d / 2, a = t * 1.2;
      ctx.strokeStyle = '#5f3f24'; ctx.lineWidth = 2;
      ctx.beginPath(); for (let k = 0; k <= 24; k++) { const th = (k / 24) * 6.283; const q = iso(cx, cy + Math.cos(th) * 0.5, 11 + Math.sin(th) * 12); k ? ctx.lineTo(...q) : ctx.moveTo(...q); } ctx.stroke();
      ctx.lineWidth = 1.4; ctx.beginPath();
      for (let k = 0; k < 8; k++) { const th = a + (k / 8) * 6.283; ctx.moveTo(...iso(cx, cy, 11)); ctx.lineTo(...iso(cx, cy + Math.cos(th) * 0.55, 11 + Math.sin(th) * 13)); }
      ctx.stroke();
    }
    // sparkles on the river
    if (!p.groundSnow) {
      ctx.strokeStyle = p.waterHi; ctx.lineWidth = 1.4;
      for (let y = 0; y < O.N; y++) for (let x = 0; x < O.N; x++) {
        if (O.tile(x, y) !== O.G.WATER) continue;
        for (let k = 0; k < 2; k++) {
          const h = O.hash(x * 7 + k, y * 3), a = Math.sin(t * 1.8 + h * 20);
          if (a < 0.3) continue;
          const [sx, sy] = iso(x + h, y + O.hash(y, x + k), 0);
          if (sx < v.x0 || sx > v.x1 || sy < v.y0 || sy > v.y1) continue;
          ctx.globalAlpha = (a - 0.3) * 1.2; ctx.beginPath(); ctx.moveTo(sx - 4, sy); ctx.lineTo(sx + 4, sy + 1); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }
  };

  // Selection rings + order arrow for the player's squad
  O.drawSelection = (ctx, faction, t) => {
    const squad = faction === 'city' ? 'sarbaz' : 'jaachy', tm = TEAM[faction];
    const units = O.live.filter((o) => o.squad === squad);
    let mx = 0, my = 0;
    ctx.strokeStyle = tm.ring; ctx.lineWidth = 1.6;
    for (const u of units) { const [sx, sy] = iso(u.x, u.y); mx += u.x; my += u.y; ctx.beginPath(); ctx.ellipse(sx, sy, 7, 3.5, 0, 0, 7); ctx.stroke(); }
    mx /= units.length; my /= units.length;
    const target = faction === 'city' ? [26.3, 25.4] : [22.6, 30.4];
    const a = iso(mx, my), b = iso(...target), c = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 30];
    ctx.save(); ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 20; ctx.lineWidth = 2.4; ctx.strokeStyle = tm.ring;
    ctx.beginPath(); ctx.moveTo(...a); ctx.quadraticCurveTo(...c, ...b); ctx.stroke(); ctx.restore();
    const pulse = 1 + (t % 1) * 0.6;
    ctx.globalAlpha = 1 - (t % 1) * 0.7; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(b[0], b[1], 12 * pulse, 6 * pulse, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(b[0], b[1], 5, 2.5, 0, 0, 7); ctx.fillStyle = tm.ring; ctx.fill();
    // squad banner
    const [bx, by] = iso(mx, my, 34);
    ctx.fillStyle = 'rgba(11,15,28,.82)'; ctx.beginPath(); ctx.roundRect(bx - 17, by - 10, 34, 16, 4); ctx.fill();
    ctx.fillStyle = tm.ring; ctx.font = '700 12px "PT Sans Narrow", sans-serif'; ctx.textAlign = 'center'; ctx.fillText(String(units.length), bx, by + 2);
    ctx.fillStyle = 'rgba(11,15,28,.82)'; ctx.fillRect(bx - 15, by + 7, 30, 3); ctx.fillStyle = '#7cc46b'; ctx.fillRect(bx - 15, by + 7, 30 * (faction === 'city' ? 0.92 : 0.78), 3);
  };

  O.GHOSTS = {
    city: { t: 'tower', x: 24.6, y: 14.1, r: 0.8, label: 'Мунара', note: 'орун бош' },
    nomad: { t: 'yurt', x: 35.4, y: 25.2, r: 0.9, label: 'Боз үй', note: 'орун бош' },
  };
  const ghostObjs = (g) => ((O.THUMBS && O.THUMBS[g.t]) || [[{ t: g.t, x: 0, y: 0 }]])[0].map((o) => ({ w: 0, d: 0, ...o, x: o.x + g.x, y: o.y + g.y }));
  O.ghostRadius = (g) => Math.max(0.8, ...ghostObjs(g).map((o) => Math.max(Math.abs(o.x - g.x), Math.abs(o.x + o.w - g.x), Math.abs(o.y - g.y), Math.abs(o.y + o.d - g.y)) + 0.2));
  O.drawGhost = (ctx, faction, t) => {
    const g = O.GHOSTS[faction], [sx, sy] = iso(g.x, g.y), r = O.ghostRadius(g);
    ctx.beginPath(); ctx.ellipse(sx, sy, r * RX * 1.2, r * RY * 1.2, 0, 0, 7);
    ctx.fillStyle = 'rgba(110,220,110,.28)'; ctx.fill(); ctx.strokeStyle = 'rgba(150,240,140,.9)'; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.globalAlpha = 0.55 + Math.sin(t * 3) * 0.1;
    for (const o of ghostObjs(g)) O.DRAW[o.t](ctx, o);
    ctx.restore();
  };

  // Snowfall in screen space
  const flakes = Array.from({ length: 110 }, (_, i) => [O.hash(i, 1), O.hash(1, i), 0.6 + O.hash(i, i) * 1.6]);
  O.drawSnow = (ctx, W, H, t) => {
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const [a, b, s] of flakes) {
      const x = ((a * W + Math.sin(t * 0.8 + b * 9) * 20 + t * 12 * s) % (W + 20)) - 10;
      const y = ((b * H + t * 26 * s) % (H + 20)) - 10;
      ctx.beginPath(); ctx.arc(x, y, s, 0, 7); ctx.fill();
    }
  };
})();
