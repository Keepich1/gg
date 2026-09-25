// Map layout: terrain grid, static objects and living things. Positions in tiles.
(() => {
  const N = O.N;
  const R = O.rng(7);
  const T = new Uint8Array(N * N);
  const G = { GRASS: 0, LUSH: 1, DRY: 2, ROCK: 3, WATER: 5, BANK: 6, ROAD: 7, WHEAT: 8, CROP: 9, TOWN: 11, CAMP: 12 };
  O.G = G;
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < N && y < N) T[y * N + x] = v; };
  const get = (x, y) => T[y * N + x];

  // ---- river (glacier-fed, milky turquoise) ----
  const river = [[27, -2], [26, 7], [28.5, 14], [27.8, 21], [29.5, 29], [28.6, 37], [30, 46]];
  const segDist = (px, py, [ax, ay], [bx, by]) => {
    const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(px - ax - t * dx, py - ay - t * dy);
  };
  const riverDist = (x, y) => { let d = 1e9; for (let i = 1; i < river.length; i++) d = Math.min(d, segDist(x, y, river[i - 1], river[i])); return d; };
  O.riverX = (y) => { // x of river centre at row y
    for (let i = 1; i < river.length; i++) {
      const [ax, ay] = river[i - 1], [bx, by] = river[i];
      if (y >= ay && y <= by) return ax + (bx - ax) * (y - ay) / (by - ay);
    }
    return 28;
  };
  O.riverDepth = new Float32Array(N * N);

  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const cx = x + 0.5, cy = y + 0.5;
    const edge = Math.min(cx, cy) + (O.fbm(cx * 0.3, cy * 0.3) - 0.5) * 2.5;
    const rd = riverDist(cx, cy);
    let t = O.fbm(cx * 0.18 + 5, cy * 0.18) > 0.62 ? G.DRY : G.GRASS;
    if (edge < 6) t = G.ROCK;
    if (rd < 3.4 && edge >= 6) t = G.LUSH;
    if (rd < 1.95) t = G.BANK;
    if (rd < 1.2) { t = G.WATER; O.riverDepth[y * N + x] = 1 - rd / 1.2; }
    set(x, y, t);
  }

  // ---- fortress ground, roads, fields ----
  for (let y = 13; y <= 21; y++) for (let x = 12; x <= 20; x++) set(x, y, G.TOWN);
  for (let x = 12; x <= 31; x++) if (get(x, 17) !== G.WATER) set(x, 17, G.ROAD);           // main street → bridge
  for (let x = 31; x <= 34; x++) set(x, 17, G.CAMP);
  for (let y = 17; y <= 30; y++) set(16, y, G.ROAD);                                      // south street
  for (let i = 0; i <= 14; i++) { const x = Math.round(16 - i * 0.55), y = 30 + i; set(x, y, G.ROAD); set(x - 1, y, G.ROAD); }
  const fields = [
    { x: 17, y: 24, w: 4, d: 4, k: 'WHEAT' }, { x: 21.2, y: 24, w: 4, d: 4, k: 'CROP' },
    { x: 17, y: 28.4, w: 4, d: 4.6, k: 'CROP' }, { x: 21.2, y: 28.4, w: 4.6, d: 4.6, k: 'WHEAT' },
    { x: 9.6, y: 24, w: 4.6, d: 4, k: 'WHEAT' },
  ];
  O.fields = fields;
  for (const f of fields) for (let y = Math.floor(f.y); y < f.y + f.d; y++) for (let x = Math.floor(f.x); x < f.x + f.w; x++) set(x, y, G[f.k]);
  for (let y = 11; y <= 25; y++) for (let x = 32; x <= 41; x++) if (Math.hypot(x - 36.5, y - 17.5) < 5.2) set(x, y, G.CAMP);

  O.T = T; O.tile = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? G.ROCK : T[y * N + x]);

  // Irrigation channels (арык): drawn as thin water lines on the ground
  O.ariks = [
    [[27.6, 23.6], [22, 23.6], [16.6, 23.6]],
    [[21.1, 23.6], [21.1, 33.2]],
    [[16.6, 23.6], [16.6, 23.6]],
    [[12, 23.6], [9.5, 23.6], [9.5, 28.2]],
  ];

  // ---- static objects ----
  const S = [];
  const add = (o) => { o.depth = o.depth ?? (o.x + (o.w || 1) / 2) + (o.y + (o.d || 1) / 2); S.push(o); };

  // Mountains along the two back edges (Ala-Too ridge)
  add({ t: 'peak', x: 1.5, y: 1.5, r: 6, h: 420, seed: 1, depth: -10 });
  for (let x = 5; x < N + 2; x += 3.1) {
    if (x > 22.5 && x < 31.5) { add({ t: 'peak', x, y: 0.5, r: 2.6, h: 150 + R() * 40, seed: x * 3 }); continue; }
    add({ t: 'peak', x, y: 0.8 + R() * 1.4, r: 3 + R() * 1.6, h: 190 + R() * 170, seed: x * 7 });
    if (R() > 0.35) add({ t: 'peak', x: x + 1.5, y: 3.6 + R(), r: 1.8 + R(), h: 70 + R() * 60, seed: x * 11 });
  }
  for (let y = 5; y < N + 2; y += 3.1) {
    add({ t: 'peak', x: 0.8 + R() * 1.4, y, r: 3 + R() * 1.6, h: 190 + R() * 160, seed: y * 13 });
    if (R() > 0.35) add({ t: 'peak', x: 3.6 + R(), y: y + 1.5, r: 1.8 + R(), h: 70 + R() * 60, seed: y * 17 });
  }

  // Spruce (карагай) forests on the slopes
  for (let y = 4; y < N; y++) for (let x = 4; x < N; x++) {
    const e = Math.min(x, y), n = O.fbm(x * 0.35, y * 0.35);
    if (e >= 5 && e <= 9 && n > 0.45 && O.tile(x, y) === G.GRASS && O.hash(x, y) > 0.35 && !(x > 22 && x < 33 && y < 12)
        && !(x >= 5 && x <= 10 && y >= 12 && y <= 22) && !(x >= 5 && x <= 11 && y >= 32 && y <= 38) && !(x >= 7 && x <= 10 && y >= 8 && y <= 11))
      add({ t: 'spruce', x: x + O.hash(y, x) * 0.6 + 0.2, y: y + O.hash(x + 3, y) * 0.6 + 0.2, s: 0.8 + O.hash(x, y + 9) * 0.5, w: 0, d: 0 });
  }

  // Fortress walls, towers, gates
  const WX0 = 11, WX1 = 21, WY0 = 12, WY1 = 22, WH = 30;
  const towers = [[11, 12], [21, 12], [11, 22], [21, 22], [16, 12], [11, 17], [21, 15], [21, 19], [14, 22], [18, 22]];
  const isTower = (x, y) => towers.some(([a, b]) => a === x && b === y);
  const isGate = (x, y) => (x === WX1 && y >= 16 && y <= 18) || (y === WY1 && x >= 15 && x <= 17);
  for (let x = WX0; x <= WX1; x++) for (let y = WY0; y <= WY1; y++) {
    if (x !== WX0 && x !== WX1 && y !== WY0 && y !== WY1) continue;
    if (isTower(x, y) || isGate(x, y)) continue;
    add({ t: 'wall', x, y, h: WH, side: x === WX0 ? 'w' : x === WX1 ? 'e' : y === WY0 ? 'n' : 's' });
  }
  for (const [x, y] of towers) add({ t: 'tower', x: x + 0.5, y: y + 0.5, w: 0, d: 0, h: 50 });
  add({ t: 'gate', x: WX1, y: 16, w: 1, d: 3, h: 58, axis: 'x' });
  add({ t: 'gate', x: 15, y: WY1, w: 3, d: 1, h: 46, axis: 'y' });
  O.wallH = WH;

  // Inside the walls
  add({ t: 'palace', x: 12.3, y: 13.2, w: 3.2, d: 3.2, h: 30 });
  add({ t: 'burana', x: 18.8, y: 13.8, w: 0, d: 0, h: 150 });
  add({ t: 'granary', x: 16.2, y: 13.4, w: 1.3, d: 1.2, h: 22 });
  for (const [x, y, w, d, h] of [[19.9, 13.1, 1, 1, 16], [17.1, 15, 1.2, 0.9, 18], [19.2, 15.1, 1, 1, 15], [12.1, 18.1, 1.1, 1.1, 17],
    [14.1, 18.1, 1.2, 1, 15], [18.1, 19.1, 1.1, 1, 18], [20, 19.3, 0.9, 1.1, 15], [12.1, 20.1, 1.3, 1, 16], [14.1, 20.9, 1, 1, 15],
    [18.1, 20.9, 1.2, 1, 17]]) add({ t: 'house', x, y, w, d, h, c: O.hash(x * 10, y * 10) });
  for (const [x, y, c] of [[16.9, 16.15, 0], [18.1, 16.15, 1], [19.3, 16.15, 2], [17.5, 18.1, 2], [18.7, 18.1, 0]])
    add({ t: 'stall', x, y, w: 0.9, d: 0.7, h: 10, c });
  add({ t: 'pool', x: 14.6, y: 19.5, w: 1.2, d: 1.2 });
  add({ t: 'tandyr', x: 19.6, y: 20.6, w: 0, d: 0 });
  for (const [x, y] of [[14.4, 19.3], [16.0, 19.3], [14.4, 20.9]]) add({ t: 'poplar', x, y, w: 0, d: 0, s: 0.8 });

  // Outside: roads lined with poplars (терек), orchard, mill, bridge, quarry, woodcutter, caravanserai
  for (let x = 23; x <= 26; x += 1) { add({ t: 'poplar', x: x + 0.5, y: 16.3, w: 0, d: 0, s: 1 }); add({ t: 'poplar', x: x + 0.5, y: 18.7, w: 0, d: 0, s: 1 }); }
  for (let y = 25; y <= 29; y += 1) add({ t: 'poplar', x: 15.3, y: y + 0.5, w: 0, d: 0, s: 1 });
  for (let x = 17.5; x <= 25; x += 1.25) add({ t: 'poplar', x, y: 23.1, w: 0, d: 0, s: 0.9 });
  for (let y = 13.4; y <= 20.6; y += 1.25) for (let x = 5.6; x <= 9; x += 1.2)
    add({ t: 'fruit', x: x + (O.hash(x * 9, y * 9) - 0.5) * 0.3, y, w: 0, d: 0, s: 0.9 });
  add({ t: 'bridge', x: 26.4, y: 16.55, w: 3.6, d: 0.9 });
  add({ t: 'mill', x: 26.2, y: 22.4, w: 1.1, d: 1, h: 20 });
  add({ t: 'quarry', x: 13.5, y: 5.2, w: 3, d: 2 });
  add({ t: 'hut', x: 8.2, y: 9.2, w: 1.2, d: 1, h: 16 });
  add({ t: 'logs', x: 9.6, y: 10.4, w: 0, d: 0 });
  add({ t: 'caravanserai', x: 6.2, y: 33.2, w: 4.2, d: 4.2, h: 22 });
  for (const f of fields) if (f.k === 'WHEAT') for (let i = 0; i < 5; i++)
    add({ t: 'sheaf', x: f.x + 0.6 + O.hash(i, f.x) * (f.w - 1.2), y: f.y + 0.6 + O.hash(f.y, i) * (f.d - 1.2), w: 0, d: 0 });
  for (let i = 0; i < 26; i++) {
    const x = 4 + R() * 40, y = 4 + R() * 40, t = O.tile(Math.floor(x), Math.floor(y));
    if ((t === G.GRASS || t === G.DRY) && Math.min(x, y) > 6) add({ t: 'rock', x, y, w: 0, d: 0, s: 0.5 + R() * 0.6 });
  }
  for (let i = 0; i < 40; i++) {
    const x = 30 + R() * 14, y = 24 + R() * 20, t = O.tile(Math.floor(x), Math.floor(y));
    if (t === G.GRASS || t === G.LUSH) add({ t: R() > 0.4 ? 'shrub' : 'poplar', x, y, w: 0, d: 0, s: 0.7 + R() * 0.4 });
  }

  // Nomad ordo: ring of yurts around the khan's yurt
  const C = [36.5, 17.5];
  add({ t: 'yurt', x: C[0], y: C[1], w: 0, d: 0, s: 1.45, khan: true });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3;
    add({ t: 'yurt', x: C[0] + Math.cos(a) * 3.4, y: C[1] + Math.sin(a) * 3.4, w: 0, d: 0, s: 0.95 + O.hash(i, 3) * 0.15, v: i });
  }
  add({ t: 'arba', x: 40.6, y: 13.8, w: 0, d: 0 }); add({ t: 'arba', x: 32.4, y: 13.2, w: 0, d: 0 }); add({ t: 'arba', x: 41.3, y: 21, w: 0, d: 0 });
  add({ t: 'tuu', x: 36.5, y: 15.6, w: 0, d: 0 });
  add({ t: 'fire', x: 36.8, y: 19.9, w: 0, d: 0 });
  add({ t: 'tether', x: 32.6, y: 22.3, w: 2.2, d: 0 });
  O.static = S;

  // ---- living things (drawn on the animated layer) ----
  const L = [];
  // City squad (сарбаздар) outside the main gate
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) L.push({ t: 'soldier', x: 23.1 + r * 0.46, y: 19.4 + c * 0.46, team: 'city', squad: 'sarbaz' });
  for (const y of [13.3, 14.2, 20.2, 21.1]) L.push({ t: 'wallArcher', x: 21.5, y, team: 'city' });
  for (const x of [12.8, 19.6]) L.push({ t: 'wallArcher', x, y: 22.5, team: 'city' });
  // Nomad horse archers crossing toward the fields
  for (let i = 0; i < 9; i++) L.push({ t: 'rider', x: 29.3 + (i % 3) * 0.62 + (Math.floor(i / 3) % 2) * 0.3, y: 24.3 + Math.floor(i / 3) * 0.62, team: 'nomad', squad: 'jaachy', ph: i });
  // Herds
  for (let i = 0; i < 14; i++) L.push({ t: 'horse', x: 32.5 + R() * 6, y: 27 + R() * 6, ph: R() * 6, c: Math.floor(R() * 4) });
  for (let i = 0; i < 3; i++) L.push({ t: 'horse', x: 33 + i * 0.7, y: 22.5, ph: i, c: i + 1, tied: true });
  for (let i = 0; i < 26; i++) L.push({ t: 'sheep', x: 38 + R() * 4.5, y: 6.5 + R() * 4, ph: R() * 6 });
  L.push({ t: 'rider', x: 37.2, y: 9.2, team: 'nomad', ph: 2, shepherd: true });
  L.push({ t: 'pen', x: 40.8, y: 25.6, n: 12 });
  // People at work
  L.push({ t: 'peasant', x: 18.6, y: 25.8, ph: 0 }, { t: 'peasant', x: 23.2, y: 30.6, ph: 2 }, { t: 'peasant', x: 11.4, y: 26, ph: 4 });
  L.push({ t: 'peasant', x: 9.4, y: 10.1, ph: 1 }, { t: 'peasant', x: 15.1, y: 6.4, ph: 3 });
  L.push({ t: 'peasant', x: 17.6, y: 17.4, ph: 5 }, { t: 'peasant', x: 13.4, y: 17.3, ph: 2.5 });
  // Camel caravan walking the south road toward the gate
  O.caravanPath = [[9.4, 44], [11.2, 37.5], [13.2, 34.6], [16.4, 30.5], [16.4, 23.4]];
  for (let i = 0; i < 5; i++) L.push({ t: 'camel', k: i, lead: i === 0 });
  O.live = L;

  O.smokes = [[19.6, 20.6, 14], [36.8, 19.9, 6], [36.5, 17.5, 40], [34.9, 20.6, 22], [8.8, 9.6, 20]];
})();
