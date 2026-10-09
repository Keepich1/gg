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
export const MAIN = { kokand: 'urda', kipchak: 'ordo' };
export const BUILD_MENU = {
  kokand: ['uy', 'dala', 'tegirmon', 'ombor', 'kazarma', 'otxona', 'topxona'],
  kipchak: ['boz', 'koroo', 'ken', 'jooker', 'jylky', 'kurultai'],
};
export const costText = (c) => Object.entries(c).map(([k, v]) => `${v} ${RES_NAMES[k].toLowerCase()}`).join(', ');
