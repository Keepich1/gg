// Unit types, factions, starting armies and formation geometry. Pure data + math.

// acc = hit chance at point-blank and at max range. reload/rate in seconds, speed in m/s.
export const TYPES = {
  sarbaz: {
    key: 'sarbaz', name: 'Сарбаздар', sub: 'пехота с мылтыками', model: 'musket', icon: 'musket',
    hp: 100, speed: 3.3, armor: 1, count: 60, ranks: 3, spacing: 1.3,
    melee: { dmg: 9, rate: 1.5, reach: 1.7 },
    ranged: { kind: 'musket', range: 95, reload: 9, dmg: 62, acc: [0.55, 0.12] },
  },
  naizachy: {
    key: 'naizachy', name: 'Найзачылар', sub: 'копейщики, держат конницу', model: 'spear', icon: 'spear',
    hp: 120, speed: 3.3, armor: 2, count: 60, ranks: 4, spacing: 1.2,
    melee: { dmg: 15, rate: 1.4, reach: 2.8, vsCav: 2.4 },
  },
  zarbzan: {
    key: 'zarbzan', name: 'Зарбзандар', sub: 'лёгкие пушки', model: 'cannon', icon: 'cannon', artillery: true,
    hp: 220, speed: 2.3, armor: 4, count: 3, ranks: 1, spacing: 7,
    ranged: { kind: 'ball', range: 300, minRange: 30, reload: 13, dmg: 120, splash: 7, acc: [0.9, 0.45] },
  },
  jaldanma: {
    key: 'jaldanma', name: 'Жалданма атчандар', sub: 'наёмная конница', model: 'cav', icon: 'cav', mounted: true,
    hp: 150, speed: 8.5, armor: 2, count: 30, ranks: 2, spacing: 2.4,
    melee: { dmg: 17, rate: 1.3, reach: 2.4, charge: 2.2 },
  },
  atchan: {
    key: 'atchan', name: 'Атчан жаачылар', sub: 'конные лучники', model: 'horsearcher', icon: 'bow', mounted: true, skirmish: true,
    hp: 115, speed: 9.5, armor: 1, count: 40, ranks: 2, spacing: 2.6,
    melee: { dmg: 7, rate: 1.5, reach: 2.2 },
    ranged: { kind: 'arrow', range: 110, reload: 3.0, dmg: 14, acc: [0.5, 0.08], ammo: 30 },
  },
  saiyskar: {
    key: 'saiyskar', name: 'Сайыскерлер', sub: 'тяжёлые копейщики', model: 'lancer', icon: 'lance', mounted: true,
    hp: 200, speed: 9, armor: 3, count: 36, ranks: 2, spacing: 2.5,
    melee: { dmg: 19, rate: 1.3, reach: 2.8, charge: 3 },
  },
};

// Army layout: [type, lateral offset (m, + = right), depth offset (m, + = forward)]
export const FACTIONS = {
  kokand: {
    key: 'kokand', name: 'Коканд', color: '#2f8f74', light: '#7fe8c8', dark: '#17463a',
    blurb: 'Пехота с мылтыками, копейщики, пушки и наёмная конница. Сильны в обороне и огнём.',
    army: [['sarbaz', -125, 0], ['sarbaz', -42, 0], ['sarbaz', 42, 0], ['sarbaz', 125, 0],
      ['naizachy', -84, -16], ['naizachy', 84, -16], ['zarbzan', -40, -48], ['zarbzan', 40, -48],
      ['jaldanma', -215, -12], ['jaldanma', 215, -12]],
  },
  kipchak: {
    key: 'kipchak', name: 'Кыпчаки', color: '#b0392f', light: '#ffa597', dark: '#5a1712',
    blurb: 'Только конница: лучники с «качып атуу» и тяжёлые сайыскеры. Скорость и удар во фланг.',
    army: [['atchan', -210, 0], ['atchan', -126, 0], ['atchan', -42, 0], ['atchan', 42, 0], ['atchan', 126, 0], ['atchan', 210, 0],
      ['saiyskar', -90, -34], ['saiyskar', 0, -34], ['saiyskar', 90, -34]],
  },
};

export const FORMATIONS = {
  line: { name: 'Линия', speed: 1 },
  column: { name: 'Колонна', speed: 1.15 },
  square: { name: 'Каре', speed: 0.35 },
  loose: { name: 'Рассыпной', speed: 1.05 },
};
export const formationsFor = (T) => (T.artillery ? ['line'] : T.mounted ? ['line', 'loose', 'column'] : ['line', 'column', 'square']);

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
