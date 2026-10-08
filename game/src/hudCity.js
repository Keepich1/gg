// City-mode interface: resource bar, building panel with training queue, build menu for workers, officer commands.
import { icon } from './icons.js';
import { TYPES, FORMATIONS, formationsFor } from './units.js';
import { BUILDINGS, BUILD_MENU, RES, RES_NAMES } from './buildings.js';
import { MAX_SQUAD } from './sim.js';

const $ = (id) => document.getElementById(id);
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const costHtml = (c) => Object.entries(c).map(([k, v]) => `<span data-res="${k}" data-need="${v}">${icon(k)}${v}</span>`).join('');

export class CityPanel {
  constructor({ input }) {
    this.input = input; this.sim = null; this.city = null;
    $('citypanel').addEventListener('click', (e) => this.act(e));
    $('orders').addEventListener('click', (e) => { if (this.city) this.act(e); });
  }
  attach(sim, city) { this.sim = sim; this.city = city; this.render(); }

  act(e) {
    const b = e.target.closest('button[data-act]'); if (!b || !this.city) return;
    const { eco } = this.city, inp = this.input, sel = inp.selB, a = b.dataset.act;
    if (a === 'build') inp.startPlacing(b.dataset.k);
    else if (a === 'train' && sel) { eco.train(sel, b.dataset.k); this.update(); }
    else if (a === 'cancel' && sel) { eco.cancel(sel, +b.dataset.i); this.update(); }
    else if (a === 'formsq') inp.formSquad();
    else if (a === 'disband') inp.disband();
    else if (a === 'idle') inp.selectIdleWorker();
    else return;
    e.stopPropagation();
  }

  // ---------- full rebuild when the selection changes ----------
  render() {
    if (!this.city) return;
    const inp = this.input, b = inp.selB && !inp.selB.dead ? inp.selB : null, sel = inp.selectedLive();
    const panel = $('citypanel'), orders = $('orders');
    if (b) {
      const mine = b.team === inp.team;
      panel.innerHTML = `<div class="bp">
        <div class="bp-head">${icon(BUILDINGS[b.key] && ['xanordo', 'bozuy'].includes(b.key) ? 'crown' : b.key)}<div><b>${b.T.name}</b><span>${b.T.sub}</span></div></div>
        <div class="bp-stats"><i class="hpbar"><i id="b-hp"></i></i><span id="b-hpn"></span><span id="b-prog"></span></div>
        ${mine && b.T.trains ? `<div class="train">${b.T.trains.map((k) => `<button type="button" data-act="train" data-k="${k}" id="tr-${k}" title="${TYPES[k].sub}">
            ${icon(TYPES[k].icon)}<b>${TYPES[k].name}</b><span class="cost">${costHtml(TYPES[k].cost)}</span></button>`).join('')}</div>
          <div class="queue" id="b-queue"></div>` : ''}
      </div>`;
      orders.innerHTML = `<span class="hint">${mine ? (b.T.trains ? 'ПКМ по земле, ресурсу или полю — сборный пункт' : b.T.drop ? `Принимает: ${b.T.drop.map((r) => RES_NAMES[r].toLowerCase()).join(', ')}` : '') : 'Вражеское здание: выберите войска и ПКМ по нему, чтобы атаковать'}</span>${this.idleBtn()}`;
    } else if (sel.length) {
      const workers = sel.filter((q) => q.T.worker), army = sel.filter((q) => !q.T.worker);
      const solos = {}, forms = [];
      for (const q of army) { if (q.solo) (solos[q.key] ||= []).push(q); else forms.push(q); }
      const chips = [];
      if (workers.length) chips.push(`<span class="chip">${icon('worker')}Деҳқон ×${workers.length}<em id="jobsum"></em></span>`);
      for (const [k, list] of Object.entries(solos)) chips.push(`<span class="chip">${icon(TYPES[k].icon)}${TYPES[k].name} ×${list.length}</span>`);
      for (const q of forms) chips.push(`<span class="chip form" id="fchip-${q.id}">${icon(q.T.icon)}Отряд: ${q.T.name} <b class="fn"></b><i class="mor"><i></i></i></span>`);
      panel.innerHTML = `<div class="up"><div class="chips">${chips.join('')}</div>
        ${workers.length ? `<div class="buildmenu">${BUILD_MENU.map((k) => `<button type="button" data-act="build" data-k="${k}" id="bm-${k}" title="${BUILDINGS[k].sub}">${icon(k)}<b>${BUILDINGS[k].name}</b><span class="cost">${costHtml(BUILDINGS[k].cost)}</span></button>`).join('')}</div>` : ''}
      </div>`;
      const off = sel.find((q) => q.T.officer && q.solo), formable = army.filter((q) => q.solo && !q.T.officer && !q.T.artillery);
      const byKey = {}; for (const q of formable) byKey[q.key] = (byKey[q.key] || 0) + 1;
      const best = Object.entries(byKey).sort((a, b) => b[1] - a[1])[0];
      const canForm = off && best && best[1] >= 2;
      const rs = army.filter((q) => q.T.ranged && !q.T.artillery), fm = forms.filter((q) => formationsFor(q.T).length > 1);
      orders.innerHTML = `<span class="hint"><b>${sel.length === 1 ? (sel[0].solo ? sel[0].T.name : 'Отряд: ' + sel[0].T.name) : `Выбрано: ${sel.reduce((a, q) => a + q.alive.length, 0)}`}</b></span>
        <button type="button" data-act="hold" id="ord-hold">Стоп <kbd>H</kbd></button>
        ${fm.length ? `<button type="button" data-act="form" id="ord-form">Строй: ${[...new Set(fm.map((q) => FORMATIONS[q.formation].name))].join(' / ')} <kbd>F</kbd></button>` : ''}
        ${rs.length ? `<button type="button" data-act="melee" id="ord-melee">${rs.every((q) => q.meleeMode) ? 'Рукопашная' : 'Стрельба'} <kbd>R</kbd></button>` : ''}
        ${off ? `<button type="button" data-act="formsq" id="ord-formsq" class="cry" ${canForm ? '' : 'disabled'} title="Юзбоши соберёт до ${MAX_SQUAD} бойцов одного рода из выбранных">${canForm ? `Собрать отряд: ${TYPES[best[0]].name} ×${Math.min(best[1], MAX_SQUAD - 1)}` : 'Собрать отряд: выберите юзбоши и бойцов одного рода'} <kbd>U</kbd></button>` : ''}
        ${forms.length ? `<button type="button" data-act="disband" id="ord-disband">Распустить отряд <kbd>U</kbd></button>` : ''}
        ${this.idleBtn()}`;
    } else {
      panel.innerHTML = `<div class="up"><p class="hint big">Выберите деҳқонов, чтобы строить. Кликните здание, чтобы нанимать войска.<br>ПКМ деҳқонами по лесу, камню, золоту или полю — добывать.</p></div>`;
      orders.innerHTML = `<span class="hint">Войска нанимаются по одному. Юзбоши собирает их в отряд до ${MAX_SQUAD} человек.</span>${this.idleBtn()}`;
    }
    this.update();
  }
  idleBtn() { return `<button type="button" data-act="idle" id="ord-idle" class="idle">Свободные деҳқоны: <b id="idle-n">0</b> <kbd>.</kbd></button>`; }

  // ---------- live numbers ----------
  update() {
    if (!this.city) return;
    const { eco, raid } = this.city, sim = this.sim, st = eco.stock[0];
    for (const r of RES) $('r-' + r).textContent = Math.floor(st[r]);
    $('r-pop').textContent = `${eco.popUsed(0)}/${eco.popCap[0]}`;
    const up = eco.upkeepPerMin();
    $('r-upkeep').textContent = up >= 1 ? `−${Math.round(up)} еды/мин` : '';
    const left = raid.next - sim.time;
    $('r-raid').textContent = raid.wave === 0 ? `Набег через ${fmt(Math.max(0, left))}` : `Набег №${raid.wave + 1} через ${fmt(Math.max(0, left))}`;
    $('r-raid').classList.toggle('soon', left < 60);
    const idle = $('idle-n'); if (idle) idle.textContent = eco.idleWorkers(0).length;
    document.querySelectorAll('#citypanel [data-res]').forEach((el) => el.classList.toggle('short', st[el.dataset.res] < +el.dataset.need));
    const b = this.input.selB;
    if (b && !b.dead) {
      const hp = $('b-hp'); if (hp) { hp.style.width = (100 * b.hp / b.maxHp) + '%'; $('b-hpn').textContent = `${Math.ceil(b.hp)} / ${b.maxHp}`; }
      const pr = $('b-prog');
      if (pr) pr.textContent = !b.done ? `Строится: ${Math.floor(b.progress * 100)}%` : b.T.field ? `Работают: ${b.users.size} из ${b.T.slots}` : b.blocked ? 'Нужно больше домов' : '';
      const q = $('b-queue');
      if (q) q.innerHTML = b.queue.map((k, i) => `<button type="button" class="qchip" data-act="cancel" data-i="${i}" title="Отменить: ${TYPES[k].name}">${icon(TYPES[k].icon)}${i === 0 ? `<i style="width:${(100 * b.qT / TYPES[k].time).toFixed(0)}%"></i>` : ''}</button>`).join('') || '<span class="hint">Очередь пуста</span>';
    }
    const js = $('jobsum');
    if (js) {
      const cnt = {};
      for (const q of this.input.selectedLive()) if (q.T.worker) { const t = eco.jobText(q); cnt[t] = (cnt[t] || 0) + 1; }
      js.textContent = ' · ' + Object.entries(cnt).map(([t, n]) => `${t} ${n}`).join(', ');
    }
    for (const q of this.input.selectedLive()) {
      const el = document.getElementById('fchip-' + q.id); if (!el) continue;
      el.querySelector('.fn').textContent = `${q.alive.length}/${q.initial}`;
      const m = el.querySelector('.mor > i'); m.style.width = q.morale + '%'; m.style.background = q.morale > 60 ? '#7cc46b' : q.morale > 35 ? '#e0b44a' : '#e0645a';
    }
  }
}
