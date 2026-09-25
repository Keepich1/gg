// HUD, camera, input and the frame loop.
(() => {
  const $ = (id) => document.getElementById(id);
  const app = $('app'), game = $('game'), cvW = $('cv-world'), cvF = $('cv-fx'), cvM = $('cv-mini');
  const ctxW = cvW.getContext('2d'), ctxF = cvF.getContext('2d'), ctxM = cvM.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const use = (id, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;

  // ---------- content ----------
  const RES = {
    city: [['i-gold', 'Алтын', '1 240', 'Золото'], ['i-bread', 'Нан', '86', 'Хлеб'], ['i-wood', 'Жыгач', '142', 'Дерево'], ['i-stone', 'Таш', '95', 'Камень'],
      ['i-meat', 'Эт', '34', 'Мясо'], ['i-brick', 'Кыш', '60', 'Жжёный кирпич'], ['i-iron', 'Темир', '8', 'Железо', 'low']],
    nomad: [['i-gold', 'Алтын', '610', 'Золото'], ['i-meat', 'Эт', '120', 'Мясо'], ['i-kumys', 'Кымыз', '74', 'Кумыс'], ['i-wood', 'Жыгач', '38', 'Дерево'],
      ['i-iron', 'Темир', '22', 'Железо'], ['i-bread', 'Нан', '6', 'Хлеб', 'low']],
  };
  const c = (n, ru, th, cost) => ({ n, ru, th, cost });
  const TABS = {
    city: [
      { n: 'Сепил', ru: 'Стены и башни', i: 'i-wall', cards: [c('Саман дубал', 'Глинобитная стена', 'wall', [['i-wood', 2]]), c('Мунара', 'Башня', 'tower', [['i-stone', 10], ['i-brick', 6]]), c('Дарбаза', 'Ворота-пештак', 'gate', [['i-brick', 14], ['i-wood', 6]]), c('Бурана', 'Дозорный минарет', 'burana', [['i-brick', 30]]), c('Манжаник', 'Катапульта на стене', 'manjanik', [['i-wood', 15], ['i-iron', 4]])] },
      { n: 'Чарба', ru: 'Добыча', i: 'i-hammer', cards: [c('Жыгачкана', 'Лесоруб', 'hut', [['i-wood', 3]]), c('Таш кени', 'Каменоломня', 'quarry', [['i-wood', 6]]), c('Кыш бышыруу', 'Печь для кирпича', 'forge', [['i-stone', 8]]), c('Тегирмен', 'Мельница на арыке', 'mill', [['i-wood', 10]])] },
      { n: 'Тамак-аш', ru: 'Еда', i: 'i-wheat', cards: [c('Буудай', 'Пшеничное поле', 'field', [['i-wood', 4]]), c('Бак', 'Абрикосовый сад', 'fruit', [['i-wood', 2]]), c('Тандыр', 'Пекарня', 'tandyr', [['i-brick', 3]]), c('Кампа', 'Амбар', 'granary', [['i-wood', 8]]), c('Короо', 'Загон для скота', 'pen', [['i-wood', 5]])] },
      { n: 'Шаар', ru: 'Город', i: 'i-dome', cards: [c('Үй', 'Жилой дом', 'house', [['i-wood', 4]]), c('Базар', 'Торговые ряды', 'stall', [['i-wood', 6]]), c('Хауз', 'Пруд с садом', 'pool', [['i-stone', 6]]), c('Терек', 'Тополя', 'poplar', [['i-gold', 5]]), c('Ак сарай', 'Дворец', 'palace', [['i-brick', 60], ['i-gold', 400]])] },
      { n: 'Аскер', ru: 'Армия', i: 'i-sword', cards: [c('Казарма', 'Казарма', 'barracks', [['i-wood', 12]]), c('Куралкана', 'Оружейная', 'forge', [['i-iron', 6]]), c('Манжаник', 'Катапульта', 'manjanik', [['i-wood', 15], ['i-iron', 4]])] },
      { n: 'Соода', ru: 'Торговля', i: 'i-trade', cards: [c('Кербен сарай', 'Караван-сарай', 'caravanserai', [['i-brick', 20], ['i-wood', 10]]), c('Базар', 'Торговые ряды', 'stall', [['i-wood', 6]])] },
    ],
    nomad: [
      { n: 'Ордо', ru: 'Ставка', i: 'i-yurt', cards: [c('Боз үй', 'Юрта', 'yurt', [['i-wood', 4], ['i-gold', 20]]), c('Хан ордосу', 'Ханская юрта', 'khan', [['i-wood', 10], ['i-gold', 120]]), c('Туу', 'Бунчук ставки', 'tuu', [['i-gold', 30]]), c('Арба', 'Телега', 'arba', [['i-wood', 6]]), c('Казан', 'Очаг', 'fire', [['i-iron', 2]])] },
      { n: 'Мал', ru: 'Скот', i: 'i-horse', cards: [c('Короо', 'Загон для овец', 'pen', [['i-wood', 5]]), c('Желе', 'Привязь для коней', 'tether', [['i-wood', 2]]), c('Жайыт', 'Пастбище', 'shrub', [['i-gold', 10]])] },
      { n: 'Өнөр', ru: 'Ремёсла', i: 'i-hammer', cards: [c('Кийизчи', 'Валяльщица войлока', 'yurtS', [['i-wood', 3]]), c('Темирчи', 'Кузнец', 'forge', [['i-iron', 4]]), c('Жыгаччы', 'Лесоруб', 'hut', [['i-wood', 3]])] },
      { n: 'Аскер', ru: 'Армия', i: 'i-sword', cards: [c('Атчандар', 'Конюшня лучников', 'tether', [['i-wood', 8], ['i-gold', 40]]), c('Жаачы', 'Мастер луков', 'forge', [['i-wood', 6]])] },
      { n: 'Көч', ru: 'Откочевать', i: 'i-move', kochh: true, cards: [] },
    ],
  };
  const UNIT = {
    city: { badge: 'i-spear', name: 'Сарбаздар', sub: 'Найзачылар · 12 жоокер', hp: 92, morale: 80, orders: [['i-hold', 'Кармоо', 'Держать позицию'], ['i-attack', 'Чабуул', 'Атаковать', 1], ['i-back', 'Кайт', 'Отступить']], hero: ['Бакай', 'Акыл −20%', 'Мудрый советник: стройка на 20% дешевле'] },
    nomad: { badge: 'i-bow', name: 'Атчан жаачылар', sub: 'Конные лучники · 9 атчан', hp: 78, morale: 90, orders: [['i-hold', 'Кармоо', 'Держать позицию'], ['i-attack', 'Чабуул', 'Атаковать', 1], ['i-back', 'Качып атуу', 'Ложное отступление со стрельбой']], hero: ['Алмамбет', 'Жай таш', 'Камень погоды: снежная буря над врагом'] },
  };
  const SEASON = {
    summer: { name: 'Жай · 2-жыл', pop: 72, d: '+4', tip: 'Жай: жайлоо чөбү эки эсе көп' },
    autumn: { name: 'Күз · 2-жыл', pop: 78, d: '+2', tip: 'Күз: жармаңке, базарда 3:1' },
    winter: { name: 'Кыш · 2-жыл', pop: 61, d: '−3', tip: 'Кыш: ар бир үйгө 1 чөп керек' },
  };
  const ALERT = { city: 'Чыгыштан атчан жаачылар келатат', nomad: 'Шаардын сарбаздары дарбазадан чыкты' };

  const S = { season: 'summer', faction: 'city', device: 'pc', tab: 0, card: 1, ghost: true };

  // ---------- HUD rendering ----------
  const renderRes = () => {
    $('res-bar').innerHTML = RES[S.faction].map(([i, n, v, ru, low], k) =>
      `<div class="res${k >= 4 ? ' extra' : ''}${low ? ' low' : ''}" title="${n} — ${ru}${low ? ' (мало!)' : ''}">${use(i)}<span class="v"><b>${v}</b><small>${n}</small></span></div>`).join('');
  };
  const renderTabs = () => {
    const tabs = TABS[S.faction];
    $('tabs').innerHTML = tabs.map((t, k) => `<button type="button" class="tab" role="tab" id="tab-${k}" aria-selected="${k === S.tab}" title="${t.ru}" data-k="${k}">${use(t.i)}${t.n}</button>`).join('');
    renderCards();
  };
  const renderCards = () => {
    const tab = TABS[S.faction][S.tab];
    const box = $('cards');
    if (tab.kochh) {
      box.innerHTML = `<div class="card" style="width:auto;max-width:420px;flex-direction:row;gap:12px;padding:8px 12px;text-align:left;align-items:center">
        <canvas width="92" height="56" data-th="arba"></canvas>
        <div><div class="nm" style="font-family:var(--display);font-size:17px">Ордону көчүрүү</div>
        <div class="cost" style="justify-content:flex-start;margin-top:4px">Ставка сворачивается и переезжает. 1 жылкы на юрту, 40 сек.</div></div></div>`;
    } else {
      box.innerHTML = tab.cards.map((cd, k) => `<button type="button" class="card" id="card-${k}" aria-pressed="${k === S.card}" title="${cd.ru}" data-k="${k}">
        <canvas width="92" height="56" data-th="${cd.th}"></canvas><span class="nm">${cd.n}</span>
        <span class="cost">${cd.cost.map(([i, v]) => `<span>${use(i)}${v}</span>`).join('')}</span></button>`).join('');
    }
    box.querySelectorAll('canvas').forEach((cv) => thumb(cv, cv.dataset.th));
  };
  const renderUnit = () => {
    const u = UNIT[S.faction];
    $('unit-panel').innerHTML = `
      <div class="unit-head"><div class="unit-badge">${use(u.badge)}</div><div><div class="unit-name">${u.name}</div><div class="unit-sub">${u.sub}</div></div></div>
      <div class="bars"><span>Ден соолук</span><span class="bar"><i style="width:${u.hp}%;background:#7cc46b"></i></span><b>${u.hp}%</b>
        <span>Рух</span><span class="bar"><i style="width:${u.morale}%;background:var(--ochre)"></i></span><b>${u.morale}%</b></div>
      <div class="orders">${u.orders.map(([i, n, ru, on], k) => `<button type="button" class="order" id="ord-${k}" title="${ru}" aria-pressed="${!!on}">${use(i)}${n}</button>`).join('')}
        <button type="button" class="hero-btn" id="hero" title="${u.hero[2]}">${use('i-kalpak')}<span><b>${u.hero[0]}</b><small>${u.hero[1]}</small></span></button></div>`;
    $('touch-actions').innerHTML = u.orders.map(([i, n, ru, on], k) => `<button type="button" id="t-ord-${k}" title="${ru}" aria-label="${n}" style="${on ? 'background:var(--accent)' : ''}">${use(i)}</button>`).join('')
      + `<button type="button" class="hero" id="t-hero" title="${u.hero[0]} — ${u.hero[2]}" aria-label="${u.hero[0]}">${use('i-kalpak')}</button>`;
  };
  const renderStatus = () => {
    const s = SEASON[S.season];
    $('season-name').textContent = s.name;
    $('pop-val').textContent = s.pop;
    const d = $('pop-delta'); d.textContent = s.d; d.className = 'delta ' + (s.d.startsWith('+') ? 'up' : 'down');
    const arc = $('gauge-arc'); arc.setAttribute('stroke-dasharray', `${(s.pop / 100) * 88} 88`); arc.setAttribute('stroke', s.pop > 65 ? '#7cc46b' : '#d9a23b');
    $('toast-alert-text').textContent = ALERT[S.faction];
    $('toast-info-text').textContent = S.faction === 'city' ? 'Кербен келди: +120 алтын, 20 жибек' : s.tip;
  };

  // Build-card thumbnails reuse the scene renderer
  const TH = {
    wall: [[{ t: 'wall', x: -1.5, y: -0.5, h: 30, side: 's' }, { t: 'wall', x: -0.5, y: -0.5, h: 30, side: 's' }, { t: 'wall', x: 0.5, y: -0.5, h: 30, side: 's' }], 0.62],
    tower: [[{ t: 'tower', x: 0, y: 0, h: 50 }], 0.62], gate: [[{ t: 'gate', x: -0.5, y: -1.5, w: 1, d: 3, h: 58, axis: 'x' }], 0.5],
    burana: [[{ t: 'burana', x: 0, y: 0, h: 150 }], 0.24], manjanik: [[{ t: 'manjanik', x: -0.7, y: -0.4 }], 0.9],
    hut: [[{ t: 'hut', x: -0.6, y: -0.5, w: 1.2, d: 1, h: 16 }, { t: 'logs', x: 0.9, y: 0.6 }], 0.8], quarry: [[{ t: 'quarry', x: -1.5, y: -1, w: 3, d: 2 }], 0.6],
    forge: [[{ t: 'forge', x: -0.7, y: -0.6 }], 0.95], mill: [[{ t: 'mill', x: -0.55, y: -0.5, w: 1.1, d: 1, h: 20 }], 1],
    field: [[{ t: 'field', x: -0.8, y: -0.8 }], 0.8], fruit: [[{ t: 'fruit', x: -0.4, y: 0.3, s: 0.9 }, { t: 'fruit', x: 0.5, y: -0.4, s: 0.9 }], 0.95],
    tandyr: [[{ t: 'tandyr', x: 0, y: 0 }], 1.5], granary: [[{ t: 'granary', x: -0.65, y: -0.6, w: 1.3, d: 1.2, h: 22 }], 0.9],
    pen: [[{ t: 'pen', x: 0, y: 0 }], 0.75], house: [[{ t: 'house', x: -0.6, y: -0.5, w: 1.2, d: 1, h: 17, c: 0.8 }], 1],
    stall: [[{ t: 'stall', x: -0.45, y: -0.35, w: 0.9, d: 0.7, h: 10, c: 0 }], 1.3], pool: [[{ t: 'pool', x: -0.6, y: -0.6, w: 1.2, d: 1.2 }], 1.1],
    poplar: [[{ t: 'poplar', x: -0.5, y: 0.5, s: 1 }, { t: 'poplar', x: 0.5, y: -0.5, s: 1 }], 0.62], palace: [[{ t: 'palace', x: -1.6, y: -1.6, w: 3.2, d: 3.2, h: 30 }], 0.42],
    barracks: [[{ t: 'barracks', x: -0.8, y: -0.6 }], 0.9], caravanserai: [[{ t: 'caravanserai', x: -2.1, y: -2.1, w: 4.2, d: 4.2, h: 22 }], 0.36],
    yurt: [[{ t: 'yurt', x: 0, y: 0, s: 1 }], 1.05], yurtS: [[{ t: 'yurt', x: 0, y: 0, s: 0.9, v: 2 }], 1.05], khan: [[{ t: 'yurt', x: 0, y: 0, s: 1.45, khan: true }], 0.8],
    tuu: [[{ t: 'tuu', x: 0, y: 0 }], 0.58], arba: [[{ t: 'arba', x: 0, y: 0 }], 1.1], fire: [[{ t: 'fire', x: 0, y: 0 }], 1.4],
    tether: [[{ t: 'tether', x: -1, y: 0, w: 2 }], 0.9], shrub: [[{ t: 'shrub', x: -0.4, y: 0.2, s: 1 }, { t: 'shrub', x: 0.4, y: -0.3, s: 0.8 }, { t: 'rock', x: 0.3, y: 0.5, s: 0.6 }], 1.2],
  };
  O.THUMBS = TH;
  const GHOST0 = { city: { ...O.GHOSTS.city }, nomad: { ...O.GHOSTS.nomad } };
  const thumb = (cv, type) => {
    const dpr = Math.min(devicePixelRatio || 1, 2), W = 92, H = 56;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext('2d'), [objs, s] = TH[type] || TH.house;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * W / 2, dpr * H * 0.74);
    O.flat(ctx, -1.3, -1.3, 2.6, 2.6, 0, O.shade(O.pal.grass[0], 0.9, 0.55));
    for (const o of objs) O.DRAW[o.t](ctx, { w: 0, d: 0, ...o });
  };

  // ---------- canvases & camera ----------
  let W = 0, H = 0, dpr = 1, staticDirty = true;
  const cam = { cx: 0, cy: 0, z: 1 }, tween = { to: null };
  const compact = () => W <= 760;
  const focusFor = () => {
    const f = S.faction === 'city' ? (compact() ? [21.6, 17.2] : [20.2, 18.6]) : (compact() ? [33.6, 22.4] : [34.2, 20.6]);
    const [x, y] = O.iso(...f);
    const z = compact() ? Math.min(1, Math.max(0.5, W / 640)) : Math.min(1.15, Math.max(0.55, W / 1650));
    const top = compact() ? 96 : 70, bottom = compact() ? 184 : 196;
    return { cx: x, cy: y + (H / 2 - (top + (H - bottom)) / 2) / z, z };
  };
  const clampCam = () => {
    const lim = O.N * O.TW / 2 - W / (2 * cam.z) - 60;
    cam.cx = Math.max(-Math.max(0, lim), Math.min(Math.max(0, lim), cam.cx));
    cam.cy = Math.max(160, Math.min(O.N * O.TH - H / (2 * cam.z) + 60, cam.cy));
  };
  const resize = () => {
    const r = game.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height); dpr = Math.min(devicePixelRatio || 1, 2);
    for (const cv of [cvW, cvF]) { cv.width = W * dpr; cv.height = H * dpr; }
    const ms = cvM.getBoundingClientRect().width || 158;
    cvM.width = ms * dpr; cvM.height = ms * dpr; miniBase = null;
    Object.assign(cam, focusFor()); clampCam(); staticDirty = true;
  };
  const worldTf = (ctx) => ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (W / 2 - cam.cx * cam.z), dpr * (H / 2 - cam.cy * cam.z));
  const view = () => ({ x0: cam.cx - W / 2 / cam.z, x1: cam.cx + W / 2 / cam.z, y0: cam.cy - H / 2 / cam.z, y1: cam.cy + H / 2 / cam.z });
  const toScreen = (wx, wy) => [(wx - cam.cx) * cam.z + W / 2, (wy - cam.cy) * cam.z + H / 2];

  const drawWorld = () => {
    ctxW.setTransform(dpr, 0, 0, dpr, 0, 0);
    O.drawSky(ctxW, W, H, cam);
    worldTf(ctxW);
    const v = view();
    O.drawTerrain(ctxW, v); O.drawStatic(ctxW, v);
    drawMini();
  };
  const drawFx = (t) => {
    ctxF.setTransform(1, 0, 0, 1, 0, 0); ctxF.clearRect(0, 0, cvF.width, cvF.height);
    worldTf(ctxF);
    const v = view();
    O.drawAmbient(ctxF, v, t);
    if (S.ghost) O.drawGhost(ctxF, S.faction, t);
    O.drawSelection(ctxF, S.faction, t);
    O.drawLive(ctxF, v, t);
    if (O.pal.groundSnow) { ctxF.setTransform(dpr, 0, 0, dpr, 0, 0); O.drawSnow(ctxF, W, H, t); }
  };
  const placeGhostUI = () => {
    const ui = $('ghost-ui'), tag = $('ghost-tag');
    ui.hidden = tag.hidden = !S.ghost;
    if (!S.ghost) return;
    const g = O.GHOSTS[S.faction];
    const r = O.ghostRadius(g), zt = { yurt: 34, yurtS: 32, khan: 44, burana: 180, palace: 95, tuu: 86, fire: 30, shrub: 26, field: 22, pen: 26, tether: 26, stall: 32, pool: 18, tandyr: 26, fruit: 42, poplar: 70, gate: 70, caravanserai: 50 }[g.t] ?? 60;
    const [bx, by] = toScreen(...O.iso(g.x + r * 0.9, g.y + r * 0.9));
    const [tx, ty] = toScreen(...O.iso(g.x, g.y, zt));
    ui.style.left = bx + 'px'; ui.style.top = by + 'px';
    tag.style.left = tx + 'px'; tag.style.top = ty + 'px';
    tag.innerHTML = `${g.label} · <b>${g.note}</b>`;
  };

  // ---------- minimap ----------
  let miniBase = null;
  const drawMini = () => {
    const S2 = cvM.width, N = O.N, half = O.N * O.TW / 2, sc = (S2 * 1.45) / (2 * half);
    const m = (wx, wy) => [S2 / 2 + wx * sc, S2 / 2 + (wy - N * O.TH / 2) * sc];
    if (!miniBase) {
      miniBase = document.createElement('canvas'); miniBase.width = miniBase.height = S2;
      const c = miniBase.getContext('2d');
      c.fillStyle = O.pal.mtnR; c.fillRect(0, 0, S2, S2);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const pts = [O.iso(x, y), O.iso(x + 1, y), O.iso(x + 1, y + 1), O.iso(x, y + 1)].map(([a, b]) => m(a, b));
        c.fillStyle = c.strokeStyle = O.tileColor(x, y, O.tile(x, y));
        c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(a, b) : c.moveTo(a, b))); c.closePath(); c.fill(); c.stroke();
      }
      const shape = (xs, col) => { c.fillStyle = col; c.beginPath(); xs.forEach(([x, y], i) => { const [a, b] = m(...O.iso(x, y)); i ? c.lineTo(a, b) : c.moveTo(a, b); }); c.closePath(); c.fill(); };
      shape([[11, 12], [22, 12], [22, 23], [11, 23]], '#cfb080'); shape([[12, 13], [21, 13], [21, 22], [12, 22]], '#b99a70');
      for (const o of O.static) if (o.t === 'yurt') { const [a, b] = m(...O.iso(o.x, o.y)); c.fillStyle = '#f4efe2'; c.beginPath(); c.arc(a, b, S2 * 0.012, 0, 7); c.fill(); }
      for (const o of O.static) if (o.t === 'peak') { const [a, b] = m(...O.iso(o.x, o.y)); c.fillStyle = 'rgba(245,247,250,.55)'; c.beginPath(); c.arc(a, b, S2 * 0.02, 0, 7); c.fill(); }
    }
    ctxM.setTransform(1, 0, 0, 1, 0, 0); ctxM.drawImage(miniBase, 0, 0);
    for (const [sq, col] of [['sarbaz', '#7ff3e6'], ['jaachy', '#ff8a7a']]) {
      const u = O.live.find((o) => o.squad === sq); const [a, b] = m(...O.iso(u.x, u.y));
      ctxM.fillStyle = col; ctxM.beginPath(); ctxM.arc(a, b, S2 * 0.022, 0, 7); ctxM.fill();
    }
    const v = view(), [x0, y0] = m(v.x0, v.y0), [x1, y1] = m(v.x1, v.y1);
    ctxM.strokeStyle = '#fff'; ctxM.lineWidth = Math.max(1.5, S2 * 0.012); ctxM.strokeRect(x0, y0, x1 - x0, y1 - y0);
  };

  // ---------- input: drag, wheel, pinch ----------
  const pts = new Map();
  let pinch0 = null;
  cvW.addEventListener('pointerdown', (e) => { cvW.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); game.classList.add('dragging'); tween.to = null; });
  cvW.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 1) { cam.cx -= (e.clientX - prev[0]) / cam.z; cam.cy -= (e.clientY - prev[1]) / cam.z; }
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch0) cam.z = Math.max(0.4, Math.min(2, cam.z * (d / pinch0)));
      pinch0 = d;
    }
    clampCam(); staticDirty = true;
  });
  const up = (e) => { pts.delete(e.pointerId); pinch0 = null; if (!pts.size) game.classList.remove('dragging'); };
  cvW.addEventListener('pointerup', up); cvW.addEventListener('pointercancel', up);
  cvW.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = game.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const wx = (mx - W / 2) / cam.z + cam.cx, wy = (my - H / 2) / cam.z + cam.cy;
    cam.z = Math.max(0.4, Math.min(2, cam.z * Math.exp(-e.deltaY * 0.0015)));
    cam.cx = wx - (mx - W / 2) / cam.z; cam.cy = wy - (my - H / 2) / cam.z;
    clampCam(); staticDirty = true;
  }, { passive: false });

  // ---------- controls ----------
  const press = (sel, attr, val) => document.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === val)));
  document.querySelectorAll('[data-season]').forEach((b) => b.addEventListener('click', () => {
    S.season = b.dataset.season; O.pal = O.SEASONS[S.season]; press('[data-season]', 'season', S.season);
    miniBase = null; staticDirty = true; renderStatus(); renderCards();
  }));
  document.querySelectorAll('#meta [data-faction]').forEach((b) => b.addEventListener('click', () => {
    S.faction = b.dataset.faction; app.dataset.faction = S.faction; press('#meta [data-faction]', 'faction', S.faction);
    S.tab = 0; S.card = S.faction === 'city' ? 1 : 0; Object.assign(O.GHOSTS[S.faction], GHOST0[S.faction]); S.ghost = true;
    renderAll(); tween.to = focusFor();
  }));
  document.querySelectorAll('[data-device]').forEach((b) => b.addEventListener('click', () => {
    S.device = b.dataset.device; press('[data-device]', 'device', S.device);
    game.className = 'device-' + S.device; requestAnimationFrame(resize);
  }));
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (!b) return; S.tab = +b.dataset.k; S.card = -1; renderTabs(); });
  $('cards').addEventListener('click', (e) => {
    const b = e.target.closest('.card[data-k]'); if (!b) return;
    S.card = +b.dataset.k; renderCards();
    const cd = TABS[S.faction][S.tab].cards[S.card], g = O.GHOSTS[S.faction];
    g.t = cd.th; g.label = cd.n; S.ghost = true;
  });
  $('ghost-ok').addEventListener('click', () => { S.ghost = false; const i = $('toast-info-text'); i.textContent = `Курулуш башталды: ${O.GHOSTS[S.faction].label}`; });
  $('ghost-no').addEventListener('click', () => { S.ghost = false; });
  const renderAll = () => { renderRes(); renderTabs(); renderUnit(); renderStatus(); miniBase = null; staticDirty = true; };

  // ---------- loop ----------
  let last = 0;
  const frame = (ts) => {
    requestAnimationFrame(frame);
    if (tween.to) {
      const k = 0.14; cam.cx += (tween.to.cx - cam.cx) * k; cam.cy += (tween.to.cy - cam.cy) * k; cam.z += (tween.to.z - cam.z) * k;
      if (Math.abs(tween.to.cx - cam.cx) + Math.abs(tween.to.cy - cam.cy) < 1) tween.to = null;
      clampCam(); staticDirty = true;
    }
    const moved = staticDirty;
    if (staticDirty) { drawWorld(); staticDirty = false; }
    if (reduced ? moved : ts - last > 33) { last = ts; drawFx(reduced ? 2 : ts / 1000); }
    placeGhostUI();
  };

  new ResizeObserver(() => resize()).observe(game);
  renderAll(); resize();
  if (document.fonts) document.fonts.ready.then(() => { staticDirty = true; });
  requestAnimationFrame(frame);
})();
