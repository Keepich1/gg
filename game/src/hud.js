// HTML interface: army bars, unit cards, order buttons, minimap, message feed, start and end screens.
import { FORMATIONS, FACTIONS, TYPES, formationsFor } from './units.js';
import { CRY_COOLDOWN } from './sim.js';
import { groundColor } from './terrain.js';
import { HALF, SIZE, groundY, WATER_Y } from './world.js';

const $ = (id) => document.getElementById(id);
const ICONS = {
  musket: '<path d="M3 21L19 5M17 3l4 4M6 15l3 3" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/>',
  spear: '<path d="M4 20L18 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18 6l3-3-1 5z" fill="currentColor"/><circle cx="8" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/>',
  cannon: '<circle cx="8" cy="17" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 17L21 9" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
  cav: '<path d="M4 13c2-3 6-3 9-2l4-5 3 1-1 4-2 1v3c0 2-1 3-2 3v3h-2v-3H9v3H7v-3c-2 0-3-2-3-5z" fill="currentColor"/>',
  bow: '<path d="M6 3c9 3 12 12 15 18" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M6 3l15 18M4 14l12-6" stroke="currentColor" stroke-width="1.4"/>',
  shield: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 16L18 4" stroke="currentColor" stroke-width="1.8"/>',
  crown: '<path d="M3 18l2-10 5 5 2-7 2 7 5-5 2 10z" fill="currentColor"/><path d="M4 21h16" stroke="currentColor" stroke-width="2"/>',
  lance: '<path d="M3 21L20 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 4l1-1-1 5-3-1z" fill="currentColor"/><path d="M14 6l4 1-3 3z" fill="currentColor"/>',
};
const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k]}</svg>`;
const STATE = (q) => q.dead ? 'Разбит' : q.state === 'rout' ? 'Бегут' : q.kiting ? 'Качып атуу' : q.lastEngaged > 0 ? 'Рукопашная'
  : q.fireTarget && !q.meleeMode ? 'Стреляют' : q.stam < 30 ? 'Устали' : q.moving ? (q.running ? 'Бегом' : 'Марш') : q.order.kind === 'hold' ? 'Стоят' : 'Ждут';
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export class HUD {
  constructor({ input, rts, onStart, onPause, onSpeed, onMute }) {
    Object.assign(this, { input, rts, onStart, onPause, onSpeed, onMute });
    this.sim = null; this.t = 0; this.mt = 0; this.feed = [];
    $('cards').addEventListener('click', (e) => {
      const b = e.target.closest('.card'); if (!b) return;
      const q = this.sim.squads[+b.dataset.id];
      if (e.shiftKey) { if (input.sel.has(q)) { input.sel.delete(q); input.onChange(); } else input.select([q], true); }
      else input.select([q]);
    });
    $('cards').addEventListener('dblclick', (e) => { const b = e.target.closest('.card'); if (b) input.focus([this.sim.squads[+b.dataset.id]]); });
    $('orders').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const sqs = input.selectedLive();
      if (b.dataset.act === 'hold') { for (const q of sqs) this.sim.order(q, { kind: 'hold', face: q.face }); input.onChange(); }
      if (b.dataset.act === 'form') input.cycleFormation(sqs);
      if (b.dataset.act === 'skirm') input.toggleSkirmish(sqs);
      if (b.dataset.act === 'melee') input.toggleMelee(sqs);
      if (b.dataset.act === 'cry') input.warCry();
    });
    $('pause').addEventListener('click', () => onPause());
    $('helpbtn').addEventListener('click', () => { const h = $('help'); h.hidden = !h.hidden; $('helpbtn').setAttribute('aria-pressed', !h.hidden); });
    $('speed').addEventListener('click', () => onSpeed());
    $('mute').addEventListener('click', () => { const m = onMute(); $('mute').textContent = m ? '🔇' : '🔊'; $('mute').setAttribute('aria-pressed', m); });
    // minimap
    const mm = $('minimap');
    this.mmBase = null;
    const mmPoint = (e) => { const r = mm.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * SIZE - HALF, ((e.clientY - r.top) / r.height) * SIZE - HALF]; };
    mm.addEventListener('contextmenu', (e) => e.preventDefault());
    mm.addEventListener('pointerdown', (e) => {
      const [x, z] = mmPoint(e);
      if (e.button === 2) { const sqs = input.selectedLive(); input.run = false; if (sqs.length) input.groupMove(sqs, x, z); return; }
      rts.centerOn(x, z); this.mmDrag = true; mm.setPointerCapture(e.pointerId);
    });
    mm.addEventListener('pointermove', (e) => { if (this.mmDrag) rts.centerOn(...mmPoint(e)); });
    mm.addEventListener('pointerup', () => { this.mmDrag = false; });
    this.buildMenu();
  }

  attach(sim) {
    this.sim = sim; this.feed = []; $('feed').innerHTML = '';
    const [a, b] = sim.teams;
    $('f0').textContent = a.faction.name; $('f1').textContent = b.faction.name;
    document.documentElement.style.setProperty('--me', a.faction.color);
    document.documentElement.style.setProperty('--me-light', a.faction.light);
    document.documentElement.style.setProperty('--foe', b.faction.color);
    $('endscreen').hidden = true;
    this.renderCards();
  }

  renderCards() {
    const sim = this.sim; if (!sim) return;
    const mine = sim.squads.filter((q) => q.team === this.input.team);
    const grp = (q) => Object.entries(this.input.groups).filter(([, g]) => g.includes(q)).map(([k]) => k).join('');
    $('cards').innerHTML = mine.map((q) => `<button type="button" class="card${q.T.commander ? ' cmd' : ''}" data-id="${q.id}" id="card-${q.id}" title="${q.T.name}: ${q.T.sub}">
      ${icon(q.T.icon)}<b class="n"></b><span class="nm">${q.T.commander ? q.T.commander.name : q.T.name}</span>
      <i class="mor" title="Мораль"><i></i></i><i class="sta" title="Выносливость"><i></i></i><span class="st"></span><span class="am"></span><span class="grp">${grp(q)}</span></button>`).join('');
    const sel = this.input.selectedLive();
    const o = $('orders');
    if (!sel.length) { o.innerHTML = `<span class="hint">Выберите отряд: клик по солдатам или по карточке. Рамкой — несколько.</span>`; }
    else {
      const forms = [...new Set(sel.map((q) => q.formation))].map((f) => FORMATIONS[f].name).join(' / ');
      const canForm = sel.some((q) => formationsFor(q.T).length > 1), hs = sel.filter((q) => q.T.skirmish && !q.meleeMode);
      const rs = sel.filter((q) => q.T.ranged), cmd = sel.some((q) => q.T.commander);
      o.innerHTML = `<span class="hint"><b>${sel.length === 1 ? sel[0].T.name : `Отрядов: ${sel.length}`}</b> · ${sel.reduce((a, q) => a + q.alive.length, 0)} чел.</span>
        <button type="button" data-act="hold" id="ord-hold">Стоп <kbd>H</kbd></button>
        ${canForm ? `<button type="button" data-act="form" id="ord-form">Строй: ${forms} <kbd>F</kbd></button>` : ''}
        ${hs.length ? `<button type="button" data-act="skirm" id="ord-skirm" aria-pressed="${hs.every((q) => q.skirmish)}">Качып атуу: ${hs.every((q) => q.skirmish) ? 'вкл' : 'выкл'} <kbd>G</kbd></button>` : ''}
        ${rs.length ? `<button type="button" data-act="melee" id="ord-melee" aria-pressed="${rs.every((q) => q.meleeMode)}">${rs.every((q) => q.meleeMode) ? 'Рукопашная' : 'Стрельба'} <kbd>R</kbd></button>` : ''}
        ${cmd ? `<button type="button" data-act="cry" id="ord-cry" class="cry">Клич <kbd>V</kbd></button>` : ''}
        <span class="hint">Двойной ПКМ — бегом</span>`;
    }
    this.updateCards();
  }

  updateCards() {
    for (const q of this.sim.squads) {
      const el = document.getElementById('card-' + q.id); if (!el) continue;
      el.classList.toggle('sel', this.input.sel.has(q)); el.classList.toggle('rout', q.state === 'rout'); el.classList.toggle('dead', q.dead);
      el.querySelector('.n').textContent = q.alive.length;
      const m = el.querySelector('.mor > i'); m.style.width = Math.max(0, Math.min(100, q.morale)) + '%';
      m.style.background = q.morale > 60 ? '#7cc46b' : q.morale > 35 ? '#e0b44a' : '#e0645a';
      el.querySelector('.st').textContent = STATE(q);
      const st = el.querySelector('.sta > i'); st.style.width = Math.max(0, Math.min(100, q.stam)) + '%';
      st.style.background = q.stam > 30 ? '#6fb2e8' : '#e0b44a';
      el.querySelector('.am').textContent = q.T.ranged ? (q.meleeMode ? '⚔ рукопашная' : `${Math.round(q.ammo / Math.max(1, q.alive.length))} стрел`) : '';
    }
    const cry = document.getElementById('ord-cry');
    if (cry) {
      const tm = this.sim.teams[this.input.team], left = Math.ceil(tm.cryReady - this.sim.time);
      cry.disabled = !tm.cmd || left > 0;
      cry.innerHTML = !tm.cmd ? 'Клич (командир погиб)' : left > 0 ? `Клич через ${left} с` : 'Клич <kbd>V</kbd>';
    }
  }

  onEvents(events) {
    for (const e of events) {
      if (e.k === 'rout') this.say(e.sq.team === this.input.team ? `Наши «${e.sq.T.name}» бегут!` : `Враг бежит: «${e.sq.T.name}»`, e.sq.team === this.input.team ? 'bad' : 'good');
      if (e.k === 'noAmmo') this.say(e.sq.team === this.input.team ? `«${e.sq.T.name}»: стрелы кончились, взялись за сабли` : `У врага кончились стрелы: «${e.sq.T.name}»`, e.sq.team === this.input.team ? '' : 'good');
      if (e.k === 'cry') this.say(e.team === this.input.team ? 'Боевой клич! Дух и силы отрядов рядом с командиром выросли' : 'Враг поднял боевой клич', e.team === this.input.team ? 'good' : 'bad');
      if (e.k === 'cmdDead') this.say(e.team === this.input.team ? `Наш ${e.name.toLowerCase()} погиб! Мораль армии падает` : `Вражеский ${e.name.toLowerCase()} убит!`, e.team === this.input.team ? 'bad' : 'good');
      if (e.k === 'end') this.showEnd(e.result);
    }
  }
  say(text, cls) {
    const el = document.createElement('div'); el.className = 'msg ' + cls; el.textContent = text;
    $('feed').prepend(el);
    setTimeout(() => el.classList.add('fade'), 5000); setTimeout(() => el.remove(), 6000);
    while ($('feed').children.length > 4) $('feed').lastChild.remove();
  }

  update(dt, fps, paused, speed) {
    if (!this.sim) return;
    this.t -= dt; this.mt -= dt;
    if (this.t <= 0) {
      this.t = 0.2;
      const [a, b] = this.sim.teams, tot = a.initial + b.initial;
      $('b0').style.width = (100 * a.alive / tot) + '%'; $('b1').style.width = (100 * b.alive / tot) + '%';
      $('n0').textContent = a.alive; $('n1').textContent = b.alive;
      $('clock').textContent = fmt(this.sim.time);
      $('fps').textContent = `${fps.toFixed(0)} FPS · ${this.sim.soldiers.length} бойцов`;
      $('pause').textContent = paused ? '▶' : '❚❚'; $('pause').setAttribute('aria-pressed', paused);
      $('speed').textContent = '×' + speed;
      this.updateCards();
    }
    if (this.mt <= 0) { this.mt = 0.12; this.drawMinimap(); }
  }

  drawMinimap() {
    const mm = $('minimap'), g = mm.getContext('2d'), S = mm.width;
    if (!this.mmBase) {
      this.mmBase = document.createElement('canvas'); this.mmBase.width = this.mmBase.height = S;
      const bg = this.mmBase.getContext('2d'), img = bg.createImageData(S, S);
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const x = -HALF + ((i + 0.5) / S) * SIZE, z = -HALF + ((j + 0.5) / S) * SIZE, h = groundY(x, z);
        const c = h < WATER_Y ? { r: 0.18, g: 0.36, b: 0.42 } : groundColor(x, z, h);
        const k = (j * S + i) * 4;
        img.data[k] = Math.sqrt(c.r) * 255; img.data[k + 1] = Math.sqrt(c.g) * 255; img.data[k + 2] = Math.sqrt(c.b) * 255; img.data[k + 3] = 255;
      }
      bg.putImageData(img, 0, 0);
    }
    g.drawImage(this.mmBase, 0, 0);
    const m = (x, z) => [((x + HALF) / SIZE) * S, ((z + HALF) / SIZE) * S];
    for (const q of this.sim.squads) {
      if (q.dead) continue;
      const [x, y] = m(q.mx, q.mz), mine = q.team === this.input.team;
      g.fillStyle = mine ? (this.input.sel.has(q) ? '#fff6c8' : this.sim.teams[q.team].faction.light) : '#ff5040';
      g.beginPath(); g.arc(x, y, 1.5 + Math.sqrt(q.alive.length) * 0.45, 0, 7); g.fill();
    }
    const W = this.rts.dom.clientWidth, H = this.rts.dom.clientHeight;
    const pts = [[0, H * 0.18], [W, H * 0.18], [W, H], [0, H]].map(([x, y]) => this.rts.groundAt(x, y)).filter(Boolean);
    if (pts.length > 2) {
      g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 1.2; g.beginPath();
      pts.forEach((p, i) => { const [x, y] = m(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.stroke();
    }
  }

  buildMenu() {
    const card = (k) => {
      const F = FACTIONS[k], comp = {};
      for (const [t] of F.army) comp[t] = (comp[t] || 0) + 1;
      return `<button type="button" class="side" id="side-${k}" data-side="${k}" style="--c:${F.color}">
        <span class="side-name">${F.name}</span><span class="side-blurb">${F.blurb}</span>
        <span class="side-army">${Object.entries(comp).map(([t, n]) => `<span>${icon(TYPES[t].icon)}${n}× ${TYPES[t].name}</span>`).join('')}</span>
        <span class="side-go">Играть за ${F.name}</span></button>`;
    };
    $('sides').innerHTML = card('kokand') + card('kipchak');
    $('sides').addEventListener('click', (e) => { const b = e.target.closest('.side'); if (b) { $('menu').hidden = true; this.onStart(b.dataset.side); } });
  }

  showEnd(r) {
    const me = this.input.team, win = r.winner === me, [a, b] = this.sim.teams;
    const row = (t) => `<tr><td>${t.faction.name}</td><td>${t.initial}</td><td>${t.losses}</td><td>${t.kills}</td></tr>`;
    $('end-body').innerHTML = `<h2 class="${win ? 'win' : 'lose'}">${win ? 'Победа' : 'Поражение'}</h2>
      <p>Бой длился ${fmt(r.time)}.</p>
      <table><thead><tr><th></th><th>Было</th><th>Потери</th><th>Убито врагов</th></tr></thead><tbody>${row(a)}${row(b)}</tbody></table>`;
    $('endscreen').hidden = false;
    $('again').onclick = () => { $('endscreen').hidden = true; this.onStart(a.key); };
    $('swap').onclick = () => { $('endscreen').hidden = true; this.onStart(b.key); };
  }
}
