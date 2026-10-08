// Headless AI-vs-AI battles to check faction balance: node tools/balance.js [battles] [scale]
import { Sim } from '../src/sim.js';
import { AI } from '../src/ai.js';

const N = +(process.argv[2] || 20), scale = +(process.argv[3] || 1), dt = 0.05;
const res = { kokand: 0, kipchak: 0, draw: 0 }, times = [], left = { kokand: [], kipchak: [] };
const t0 = Date.now();
for (let seed = 1; seed <= N; seed++) {
  // alternate which side starts in the south so map asymmetry averages out
  const f = seed % 2 ? ['kokand', 'kipchak'] : ['kipchak', 'kokand'];
  const sim = new Sim({ factions: f, seed, armyScale: scale });
  const ais = [new AI(sim, 0), new AI(sim, 1)];
  while (!sim.result && sim.time < 900) { ais.forEach((a) => a.update(dt)); sim.step(dt); sim.events.length = 0; }
  if (!sim.result) res.draw++;
  else { res[f[sim.result.winner]]++; times.push(sim.result.time); }
  sim.teams.forEach((t) => left[t.key].push(Math.round((100 * t.alive) / t.initial)));
}
const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(0) : '-');
console.log(`battles ${N}  Коканд ${res.kokand}  Кыпчаки ${res.kipchak}  ничьи ${res.draw}`);
console.log(`avg battle ${avg(times)} s   survivors % — Коканд ${avg(left.kokand)}  Кыпчаки ${avg(left.kipchak)}   (${((Date.now() - t0) / 1000).toFixed(1)} s wall)`);
