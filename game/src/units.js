// Unit types, factions, starting armies and formation geometry. Pure data + math.
//
// speed  = top speed (run / gallop), m/s. Walking or trotting uses `walk` × speed.
// drain  = stamina spent per second while running or galloping (stamina is 0–100).
// acc    = hit chance at point-blank and at max range. reload / rate in seconds.
// ammo   = arrows per soldier; when the whole squad is out, it switches to melee.
// cost / time = price and training time in the city mode.

export const TYPES = {
  // ---------------- Коканд ----------------
  dehqon: {
    key: 'dehqon', name: 'Деҳқон', sub: 'крестьянин: добывает ресурсы и строит', model: 'worker', icon: 'worker', worker: true,
    hp: 60, speed: 3.8, armor: 0, count: 1, ranks: 1, spacing: 1.2, drain: 0,
    melee: { dmg: 4, rate: 1.6, reach: 1.5 }, cost: { food: 50 }, time: 7,
  },
  yuzboshi: {
    key: 'yuzboshi', name: 'Юзбоши', sub: 'конный офицер: собирает бойцов одного рода в отряд до 100', model: 'officer', icon: 'officer', officer: true, mounted: true,
    hp: 170, speed: 8.5, armor: 4, count: 1, ranks: 1, spacing: 2.4, drain: 1.8,
    melee: { dmg: 16, rate: 1.2, reach: 2.4, charge: 2 }, cost: { food: 60, gold: 60 }, time: 14,
  },
  sarbaz: {
    key: 'sarbaz', name: 'Сарбозлар', sub: 'пехота с мылтыками', model: 'musket', icon: 'musket',
    hp: 100, speed: 3.4, armor: 1, count: 40, ranks: 3, spacing: 1.3, drain: 1.2,
    melee: { dmg: 9, rate: 1.5, reach: 1.7 },
    ranged: { kind: 'musket', range: 90, reload: 11, dmg: 50, acc: [0.45, 0.08] }, cost: { food: 30, wood: 10, gold: 25 }, time: 9,
  },
  zarbzan: {
    key: 'zarbzan', name: 'Зарбзанлар', sub: 'лёгкие пушки, ломают стены', model: 'cannon', icon: 'cannon', artillery: true,
    hp: 220, speed: 2.3, armor: 4, count: 3, ranks: 1, spacing: 7, drain: 0.5,
    ranged: { kind: 'ball', range: 300, minRange: 30, reload: 15, dmg: 100, splash: 5.5, acc: [0.85, 0.4] }, cost: { wood: 150, gold: 120 }, time: 25,
  },
  kamonchi: {
    key: 'kamonchi', name: 'Камончилар', sub: 'пешие лучники', model: 'archer', icon: 'bow',
    hp: 90, speed: 3.6, armor: 1, count: 50, ranks: 3, spacing: 1.3, drain: 1.1,
    melee: { dmg: 7, rate: 1.5, reach: 1.6 },
    ranged: { kind: 'arrow', range: 125, reload: 4.2, dmg: 13, acc: [0.5, 0.1], ammo: 24 }, cost: { food: 30, wood: 25 }, time: 8,
  },
  naizachi: {
    key: 'naizachi', name: 'Найзачилар', sub: 'копейщики, держат удар конницы', model: 'spear', icon: 'spear',
    hp: 120, speed: 3.5, armor: 3, count: 60, ranks: 4, spacing: 1.2, drain: 1.2,
    melee: { dmg: 15, rate: 1.4, reach: 2.8, vsCav: 2.4 }, cost: { food: 30, wood: 20 }, time: 8,
  },
  kilichboz: {
    key: 'kilichboz', name: 'Киличбозлар', sub: 'мечники со щитами', model: 'sword', icon: 'shield', shield: true,
    hp: 130, speed: 3.7, armor: 4, count: 50, ranks: 3, spacing: 1.25, drain: 1.3,
    melee: { dmg: 17, rate: 1.2, reach: 1.8 }, cost: { food: 35, gold: 20 }, time: 9,
  },
  navkar: {
    key: 'navkar', name: 'Навкарлар', sub: 'конница с саблями', model: 'cav', icon: 'cav', mounted: true,
    hp: 150, speed: 9, armor: 3, count: 30, ranks: 2, spacing: 2.4, drain: 2.6,
    melee: { dmg: 17, rate: 1.3, reach: 2.4, charge: 2.2 }, cost: { food: 60, gold: 45 }, time: 12,
  },
  xos: {
    key: 'xos', name: 'Хос навкарлар', sub: 'сверхтяжёлая гвардия, с ними лашкарбоши', model: 'guard', icon: 'crown', mounted: true,
    commander: { name: 'Лашкарбоши', model: 'commander' },
    hp: 280, speed: 7.6, armor: 7, count: 12, ranks: 2, spacing: 2.7, drain: 3.4,
    melee: { dmg: 24, rate: 1.25, reach: 2.8, charge: 3.2 },
  },

  // ---------------- Кыпчаки ----------------
  atchan: {
    key: 'atchan', name: 'Атчан жаачылар', sub: 'конные лучники, без стрел рубятся саблей', model: 'horsearcher', icon: 'bow', mounted: true, skirmish: true,
    hp: 115, speed: 9.5, armor: 1, count: 36, ranks: 2, spacing: 2.6, drain: 2.2,
    melee: { dmg: 12, rate: 1.3, reach: 2.3, charge: 1.6 },
    ranged: { kind: 'arrow', range: 100, reload: 3.0, dmg: 14, acc: [0.5, 0.09], ammo: 15 },
  },
  joo: {
    key: 'joo', name: 'Жөө жоокерлер', sub: 'пехота с мечом и щитом', model: 'sword', icon: 'shield', shield: true,
    hp: 115, speed: 3.8, armor: 3, count: 50, ranks: 3, spacing: 1.25, drain: 1.2,
    melee: { dmg: 15, rate: 1.25, reach: 1.8 },
  },
  mergen: {
    key: 'mergen', name: 'Мергендер', sub: 'меткие пешие стрелки', model: 'archer', icon: 'bow', loose: true,
    hp: 85, speed: 4, armor: 0, count: 30, ranks: 2, spacing: 1.4, drain: 1.0,
    melee: { dmg: 6, rate: 1.5, reach: 1.6 },
    ranged: { kind: 'arrow', range: 135, reload: 4.5, dmg: 20, acc: [0.65, 0.16], ammo: 20 },
  },
  saiyskar: {
    key: 'saiyskar', name: 'Сайыскерлер', sub: 'тяжёлые копейщики', model: 'lancer', icon: 'lance', mounted: true,
    hp: 200, speed: 9, armor: 4, count: 32, ranks: 2, spacing: 2.5, drain: 3.0,
    melee: { dmg: 19, rate: 1.3, reach: 2.8, charge: 3 },
  },
  chabuul: {
    key: 'chabuul', name: 'Чабуулчулар', sub: 'лёгкая конница для налётов', model: 'cav', icon: 'cav', mounted: true,
    hp: 110, speed: 11, armor: 1, count: 30, ranks: 2, spacing: 2.4, drain: 1.6,
    melee: { dmg: 13, rate: 1.1, reach: 2.3, charge: 1.8 },
  },
  batyr: {
    key: 'batyr', name: 'Батырлар', sub: 'сверхтяжёлая гвардия, с ними колбашчы', model: 'guard', icon: 'crown', mounted: true,
    commander: { name: 'Колбашчы', model: 'commander' },
    hp: 290, speed: 7.8, armor: 7, count: 12, ranks: 2, spacing: 2.7, drain: 3.4,
    melee: { dmg: 25, rate: 1.25, reach: 2.8, charge: 3.2 },
  },
};
for (const T of Object.values(TYPES)) T.walk = T.worker ? 1 : T.mounted ? 0.5 : 0.62;

// Army layout: [type, lateral offset (m, + = right), depth offset (m, + = forward)]
export const FACTIONS = {
  kokand: {
    key: 'kokand', name: 'Коканд', color: '#2f8f74', light: '#7fe8c8', dark: '#17463a', cry: 'kokand',
    blurb: 'Сарбозы с мылтыками и пушки-зарбзаны, пешие лучники, копейщики против конницы, мечники со щитами. Навкары на флангах, позади лашкарбоши со сверхтяжёлой гвардией.',
    army: [['sarbaz', 0, 6], ['kamonchi', -110, 6], ['kamonchi', 110, 6], ['naizachi', -55, -10], ['naizachi', 55, -10],
      ['kilichboz', -175, -2], ['kilichboz', 175, -2], ['zarbzan', 0, -38], ['navkar', -255, -18], ['navkar', 255, -18], ['xos', 0, -70]],
  },
  kipchak: {
    key: 'kipchak', name: 'Кыпчаки', color: '#b0392f', light: '#ffa597', dark: '#5a1712', cry: 'kipchak',
    blurb: 'Конные лучники с «качып атуу», лёгкие налётчики и тяжёлые сайыскеры. Пешие мечники и мергены держат центр. Колбашчы ведёт батыров.',
    army: [['atchan', -205, 0], ['atchan', -125, 0], ['atchan', 125, 0], ['atchan', 205, 0], ['atchan', 0, -20], ['joo', -42, 0], ['joo', 42, 0],
      ['mergen', 0, 14], ['saiyskar', -85, -32], ['saiyskar', 85, -32], ['chabuul', -285, -10], ['chabuul', 285, -10], ['batyr', 0, -62]],
  },
};

export const FORMATIONS = {
  line: { name: 'Линия', speed: 1 },
  column: { name: 'Колонна', speed: 1.15 },
  square: { name: 'Каре', speed: 0.35 },
  loose: { name: 'Рассыпной', speed: 1.05 },
};
export const formationsFor = (T) => (T.artillery || T.worker || T.officer ? ['line'] : T.mounted ? ['line', 'loose', 'column'] : T.ranged?.kind === 'arrow' ? ['loose', 'line', 'column'] : ['line', 'column', 'square']);
export const defaultFormation = (T) => (T.skirmish || T.loose ? 'loose' : 'line');

const spacingOf = (sq) => sq.T.spacing * (sq.formation === 'loose' ? 1.8 : 1);
export const filesOf = (sq, n) => {
  if (sq.formation === 'column') return Math.min(n, sq.T.mounted ? 3 : 4);
  if (sq.files) return Math.max(1, Math.min(n, sq.files));
  return Math.max(1, Math.ceil(n / sq.T.ranks));
};
export const frontage = (sq, n = sq.alive.length) => (sq.formation === 'square' ? Math.sqrt(n) * sq.T.spacing * 1.2 : (filesOf(sq, n) - 1) * spacingOf(sq) + 2);

// Local slot offset [right, forward] of soldier idx in a squad of n soldiers.
export const slotLocal = (sq, idx, n) => {
  const sp = spacingOf(sq);
  if (sq.formation === 'square') {
    const perRank = Math.ceil(n / 2), rank = idx < perRank ? 0 : 1, k = rank ? idx - perRank : idx;
    const m = rank ? n - perRank : perRank;
    const half = Math.max(sp * 1.5, (perRank * sp) / 8) - rank * sp;
    const t = (k / Math.max(1, m)) * 4, side = Math.floor(t) % 4, u = t - Math.floor(t);
    const a = -half + u * 2 * half;
    return side === 0 ? [a, half] : side === 1 ? [half, -a] : side === 2 ? [-a, -half] : [-half, a];
  }
  const files = filesOf(sq, n), ranks = Math.ceil(n / files);
  const f = idx % files, r = Math.floor(idx / files);
  const inRow = r === ranks - 1 ? n - r * files : files; // centre the last, partial rank
  return [(f - (inRow - 1) / 2) * sp, ((ranks - 1) / 2 - r) * sp];
};
