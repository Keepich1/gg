// Entry point: scene, lights, world, and the game loop.
import * as THREE from '../vendor/three.module.min.js';
import { buildTerrain, buildWater, buildOuterGround, buildSky, buildTrees, TIME } from './terrain.js';
import { GrassField, buildScatter } from './scenery.js';
import { Sim } from './sim.js';
import { AI } from './ai.js';
import { Renderer3D } from './render.js';
import { RTSCamera } from './camera.js';
import { Input } from './input.js';
import { HUD } from './hud.js';
import { BattleAudio } from './audio.js';
import { Economy } from './economy.js';
import { RaidAI } from './raid.js';
import { CityRenderer } from './renderCity.js';
import { BASES } from './world.js';

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#d6dccf', 700, 3200);
const camera = new THREE.PerspectiveCamera(42, 1, 1, 12000);

const hemi = new THREE.HemisphereLight('#dbe8f5', '#6f6142', 1.25);
const sun = new THREE.DirectionalLight('#fff0d8', 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5;
scene.add(hemi, sun, sun.target);
scene.add(buildSky(), buildOuterGround(), buildTerrain(), buildWater());
let trees = buildTrees(); scene.add(trees);
let scatter = buildScatter(); scene.add(scatter);
const grass = new GrassField(scene);

const rts = new RTSCamera(camera, canvas);
let sim = null, ai = null, r3d = null, city = null, paused = false, speed = 1;
const SPEEDS = [0.5, 1, 2, 3];
const audio = new BattleAudio();
const input = new Input({ dom: canvas, rts, scene, onChange: () => hud.renderCards() });
const hud = new HUD({
  input, rts,
  onStart: (mode, opt) => (mode === 'city' ? startCity(opt) : start(opt.side)),
  onPause: () => { paused = !paused; },
  onSpeed: () => { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; },
  onMute: () => { audio.setMuted(!audio.muted); return audio.muted; },
});

function cleanup() {
  if (r3d) { scene.remove(r3d.root); r3d.root.traverse((o) => { o.geometry?.dispose(); }); r3d = null; }
  if (city) { scene.remove(city.cityR.root); city = null; }
  input.stopPlacing?.();
}

function startCity({ peace = 480, side = 'kokand' } = {}) {
  cleanup();
  // fresh forest: trees felled in the previous game grow back
  scene.remove(trees); trees = buildTrees(); scene.add(trees);
  scene.remove(scatter); scatter = buildScatter(); scene.add(scatter);
  sim = new Sim({ factions: [side, side === 'kokand' ? 'kipchak' : 'kokand'], seed: (Date.now() % 100000) + 1, mode: 'city' });
  const eco = new Economy(sim);
  eco.setupPlayer();
  const raid = new RaidAI(sim, eco, { peace });
  ai = null;
  r3d = new Renderer3D(scene, sim);
  const cityR = new CityRenderer(scene, sim, eco, trees.userData.trees);
  cityR.onSmoke = (x, y, z, k) => r3d.puff(x, y, z, k);
  cityR.onPlace = (b) => scatter.userData.clearRect(b.x, b.z, b.w, b.d);
  grass.blocked = (x, z) => !!eco.buildingAt(x, z, 0.6);
  sim.events.length = 0;
  city = { eco, raid, cityR };
  input.attach(sim, r3d, 0, city);
  hud.attach(sim, city);
  rts.yaw = 0; rts.dist = 150; rts.centerOn(BASES.player[0], BASES.player[1] + 12);
  paused = false; speed = 1;
  audio.init();
  setTimeout(() => audio.horn(rts.tx, rts.tz, side, 0.8), 400);
}

function start(side) {
  cleanup();
  const other = side === 'kokand' ? 'kipchak' : 'kokand';
  sim = new Sim({ factions: [side, other], seed: (Date.now() % 100000) + 1 });
  ai = new AI(sim, 1);
  r3d = new Renderer3D(scene, sim);
  grass.blocked = null;
  input.attach(sim, r3d, 0, null);
  hud.attach(sim, null);
  const mine = sim.squads.filter((q) => q.team === 0);
  rts.yaw = 0; rts.dist = 240;
  rts.centerOn(mine.reduce((a, q) => a + q.cx, 0) / mine.length, mine.reduce((a, q) => a + q.cz, 0) / mine.length - 40);
  paused = false; speed = 1;
  // horns open the battle: ours close by, theirs far off
  audio.init();
  const theirs = sim.squads.filter((q) => q.team === 1);
  setTimeout(() => audio.horn(rts.tx, rts.tz, side, 0.9), 400);
  setTimeout(() => audio.horn(theirs[0].cx, theirs[0].cz, other, 2.5), 1900);
}

addEventListener('keydown', (e) => {
  if (e.code === 'KeyP') paused = !paused;
  if (e.code === 'KeyM') document.getElementById('mute').click();
  if (e.key === '+' || e.key === '=') speed = SPEEDS[Math.min(SPEEDS.length - 1, SPEEDS.indexOf(speed) + 1)];
  if (e.key === '-' || e.key === '_') speed = SPEEDS[Math.max(0, SPEEDS.indexOf(speed) - 1)];
});

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

const clock = new THREE.Clock();
let fps = 60, acc = 0, frames = 0, bedT = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, clock.getDelta());
  acc += dt; frames++;
  if (acc > 0.5) { fps = frames / acc; acc = 0; frames = 0; }
  rts.update(dt);
  TIME.value += dt;
  grass.update(rts.tx, rts.tz, rts.dist, city ? sim.buildings.length * 1000 + sim.buildings.filter((b) => !b.dead).length : 0);
  let simDt = 0;
  if (sim && !paused && !sim.result) {
    simDt = dt * speed;
    const n = Math.ceil(simDt / 0.034), h = simDt / n;
    for (let i = 0; i < n; i++) {
      if (city) { city.eco.update(h); city.raid.update(h); } else ai.update(h);
      sim.step(h);
    }
  }
  if (sim) {
    audio.listener(rts.tx, rts.tz, rts.dist, rts.yaw);
    audio.onEvents(sim.events, sim, dt);
    bedT -= dt; if (bedT <= 0) { bedT = 0.2; audio.updateBeds(sim); }
    if (city) city.eco.onEvents(sim.events);
    r3d.onEvents(sim.events); hud.onEvents(sim.events); if (city) city.cityR.onEvents(sim.events); sim.events.length = 0;
    r3d.update(simDt, camera, renderer.domElement.height);
    if (city) city.cityR.update(simDt);
    hud.update(dt, fps, paused, speed);
  }
  // keep the shadow box around what the camera looks at
  const half = Math.max(90, Math.min(320, rts.dist * 1.1)), sc = sun.shadow.camera;
  if (sc.right !== half) { sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 10; sc.far = 1600; sc.updateProjectionMatrix(); }
  const texel = (2 * half) / 2048, tx = Math.round(rts.tx / texel) * texel, tz = Math.round(rts.tz / texel) * texel;
  sun.target.position.set(tx, rts.ty, tz); sun.position.set(tx - 260, rts.ty + 480, tz + 200);
  renderer.render(scene, camera);
}
frame();
window.__game = { get sim() { return sim; }, get city() { return city; }, rts, start, startCity, input };
