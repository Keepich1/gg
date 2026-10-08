// Building types for the city mode. Sizes in metres (axis-aligned footprint w × d), time in seconds for one worker.
export const RES = ['food', 'wood', 'stone', 'gold'];
export const RES_NAMES = { food: 'Еда', wood: 'Дерево', stone: 'Камень', gold: 'Золото' };

export const BUILDINGS = {
  urda: {
    key: 'urda', name: 'Урда', sub: 'ставка: обучает деҳқонов, принимает все ресурсы', w: 18, d: 18, hp: 4000, pop: 25,
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

  // Kipchak camp (computer side)
  xanordo: { key: 'xanordo', name: 'Хан ордосу', sub: 'ставка колбашчы: разрушьте её, чтобы победить', w: 14, d: 14, hp: 3500, enemy: true },
  bozuy: { key: 'bozuy', name: 'Боз үй', sub: 'юрта кочевников', w: 7, d: 7, hp: 500, enemy: true },
};
export const BUILD_MENU = ['uy', 'dala', 'tegirmon', 'ombor', 'kazarma', 'otxona', 'topxona'];
export const costText = (c) => Object.entries(c).map(([k, v]) => `${v} ${RES_NAMES[k].toLowerCase()}`).join(', ');
