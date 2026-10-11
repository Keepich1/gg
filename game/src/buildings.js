// Building types for the city mode. Sizes in metres (axis-aligned footprint w × d), time in seconds for one worker.
// `main` marks the capital: lose it and the game is lost. `pack` marks nomad buildings that fold into a wagon.
export const RES = ['food', 'wood', 'stone', 'gold'];
export const RES_NAMES = { food: 'Еда', wood: 'Дерево', stone: 'Камень', gold: 'Золото' };

export const BUILDINGS = {
  // ---------------- Коканд: оседлый город ----------------
  urda: {
    key: 'urda', name: 'Урда', sub: 'ставка: обучает деҳқонов, принимает все ресурсы', w: 18, d: 18, hp: 4000, pop: 25, main: true,
    drop: ['food', 'wood', 'stone', 'gold'], trains: ['dehqon'], cost: {}, time: 0,
  },
  uy: { key: 'uy', name: 'Уй', sub: 'жилой дом: +15 к населению', w: 8, d: 8, hp: 600, pop: 15, cost: { wood: 80, stone: 20 }, time: 30 },
  dala: { key: 'dala', name: 'Дала', sub: 'поле: до 4 деҳқонов растят пшеницу', w: 16, d: 16, hp: 300, walk: true, field: true, slots: 4, cost: { wood: 60 }, time: 20 },
  tegirmon: { key: 'tegirmon', name: 'Тегирмон', sub: 'мельница: сюда носят урожай', w: 9, d: 9, hp: 800, drop: ['food'], cost: { wood: 120 }, time: 40 },
  ombor: { key: 'ombor', name: 'Омбор', sub: 'склад: дерево, камень и золото', w: 9, d: 9, hp: 800, drop: ['wood', 'stone', 'gold'], cost: { wood: 100 }, time: 35 },
  kazarma: {
    key: 'kazarma', name: 'Казарма', sub: 'пехота и юзбоши', w: 16, d: 12, hp: 1500,
    trains: ['sarbaz', 'kamonchi', 'naizachi', 'kilichboz', 'yuzboshi'], cost: { wood: 200, stone: 100 }, time: 60,
  },
  otxona: { key: 'otxona', name: 'Отхона', sub: 'конюшня: навкары и конные юзбоши', w: 16, d: 12, hp: 1400, trains: ['navkar', 'yuzboshi'], cost: { wood: 220, stone: 60 }, time: 60 },
  topxona: { key: 'topxona', name: 'Тўпхона', sub: 'пушечный двор: зарбзаны', w: 14, d: 12, hp: 1600, trains: ['zarbzan'], cost: { wood: 200, stone: 200, gold: 100 }, time: 80 },

  // ---------------- Кыпчаки: кочевой лагерь (всё сворачивается в арбу) ----------------
  ordo: {
    key: 'ordo', name: 'Хан ордосу', sub: 'ставка хана: обучает малчы, принимает всё. Может свернуть весь лагерь', w: 14, d: 14, hp: 2600, pop: 25, main: true, pack: true,
    drop: ['food', 'wood', 'stone', 'gold'], trains: ['malchy'], cost: {}, time: 0,
  },
  boz: { key: 'boz', name: 'Боз үй', sub: 'юрта: +10 к населению, ставится быстро', w: 7, d: 7, hp: 350, pop: 10, pack: true, cost: { wood: 40 }, time: 12 },
  koroo: { key: 'koroo', name: 'Короо', sub: 'отара: сама даёт еду, пока вокруг есть трава', w: 14, d: 14, hp: 300, walk: true, herd: true, pack: true, cost: { wood: 60 }, time: 15 },
  ken: { key: 'ken', name: 'Кен', sub: 'стан у месторождения: золото и дерево сюда, добыча рядом +50%', w: 8, d: 8, hp: 420, drop: ['gold', 'wood', 'stone'], mine: true, pack: true, cost: { wood: 80 }, time: 15 },
  jooker: { key: 'jooker', name: 'Жоокер үйү', sub: 'пешие жоокеры, мергены, жүз башы', w: 12, d: 10, hp: 600, pack: true, trains: ['joo', 'mergen', 'juzbashy'], cost: { wood: 120 }, time: 25 },
  jylky: { key: 'jylky', name: 'Жылкы короосу', sub: 'конный двор: атчан жаачылар, чабуулчулар, сайыскерлер', w: 16, d: 12, hp: 700, pack: true, trains: ['atchan', 'chabuul', 'saiyskar', 'juzbashy'], cost: { wood: 150, gold: 40 }, time: 30 },
  kurultai: { key: 'kurultai', name: 'Курултай', sub: 'совет родов: батырлар', w: 14, d: 14, hp: 900, pack: true, trains: ['batyr'], cost: { wood: 200, gold: 150 }, time: 45 },
};

// ---------------- Укрепления ----------------
// A wall is laid as a chain of short pieces (`seg`), each `len` long along the line and `thick` across it.
// A gate lets its owner through and stops the enemy; a tower holds up to `cap` foot soldiers at height `top`.
Object.assign(BUILDINGS, {
  devor: { key: 'devor', name: 'Пахса девор', sub: 'глинобитная стена: дёшево, держит пехоту и конницу', wall: true, seg: true, len: 3.6, thick: 1.8, hp: 420, cost: { wood: 3 }, time: 4 },
  tosh: { key: 'tosh', name: 'Тош девор', sub: 'каменная стена: втрое крепче глиняной', wall: true, seg: true, len: 3.6, thick: 2.2, hp: 1200, cost: { stone: 8 }, time: 7 },
  darvoza: { key: 'darvoza', name: 'Дарвоза', sub: 'ворота: свои проходят, чужие ломают. Ставьте на стену', gate: true, len: 7.2, thick: 3, hp: 1600, cost: { wood: 40, stone: 30 }, time: 25 },
  burj: { key: 'burj', name: 'Бурж', sub: 'башня на 10 пеших воинов: лучники и мушкеты бьют дальше, стены укрывают', tower: true, w: 7, d: 7, hp: 2000, cap: 10, top: 8.4, cost: { stone: 80, wood: 30 }, time: 35 },
  chep: { key: 'chep', name: 'Жыгач чеп', sub: 'частокол из брёвен: быстро и дёшево, но слабее глины', wall: true, seg: true, len: 3.4, thick: 1.2, hp: 260, cost: { wood: 5 }, time: 3 },
  darbaza: { key: 'darbaza', name: 'Дарбаза', sub: 'ворота в частоколе. Ставьте на частокол', gate: true, len: 6.4, thick: 2.4, hp: 700, cost: { wood: 45 }, time: 14 },
  munara: { key: 'munara', name: 'Күзөт мунарасы', sub: 'дозорная вышка на 6 пеших воинов; сворачивается в арбу', tower: true, w: 5, d: 5, hp: 700, cap: 6, top: 7, pack: true, cost: { wood: 70 }, time: 18 },
});
// Axis-aligned box of a piece turned by `ang` (rotation about the vertical, 0 = along x).
export const footprint = (T, ang = 0) => {
  if (!T.len) return [T.w, T.d];
  const c = Math.abs(Math.cos(ang)), s = Math.abs(Math.sin(ang));
  return [T.len * c + T.thick * s, T.len * s + T.thick * c];
};
export const MAIN = { kokand: 'urda', kipchak: 'ordo' };
export const BUILD_MENU = {
  kokand: ['uy', 'dala', 'tegirmon', 'ombor', 'kazarma', 'otxona', 'topxona'],
  kipchak: ['boz', 'koroo', 'ken', 'jooker', 'jylky', 'kurultai'],
};
export const FORT_MENU = { kokand: ['devor', 'tosh', 'darvoza', 'burj'], kipchak: ['chep', 'darbaza', 'munara'] };
export const costText = (c) => Object.entries(c).map(([k, v]) => `${v} ${RES_NAMES[k].toLowerCase()}`).join(', ');
