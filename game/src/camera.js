// RTS camera: arrows/WASD or screen edges to pan, Q/E to rotate, wheel to zoom, middle mouse to drag.
import * as THREE from '../vendor/three.module.min.js';
import { groundY, HALF } from './world.js';

export class RTSCamera {
  constructor(camera, dom) {
    this.cam = camera; this.dom = dom;
    this.tx = 0; this.tz = 300; this.ty = 8; this.dist = 230; this.yaw = 0;
    this.keys = new Set(); this.mouse = { x: -1, y: -1, inside: false }; this.drag = null;
    this.ray = new THREE.Raycaster(); this.v = new THREE.Vector2();
    this.enabled = true;
    addEventListener('keydown', (e) => { if (!e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA/.test(e.target.tagName)) this.keys.add(e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('wheel', (e) => { e.preventDefault(); this.dist = Math.max(35, Math.min(620, this.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
    dom.addEventListener('pointermove', (e) => { const r = dom.getBoundingClientRect(); this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true }; });
    dom.addEventListener('pointerleave', () => { this.mouse.inside = false; });
    dom.addEventListener('pointerdown', (e) => { if (e.button === 1) { e.preventDefault(); this.drag = { x: e.clientX, y: e.clientY }; dom.setPointerCapture(e.pointerId); } });
    dom.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      const k = this.dist / 600, dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.pan(-dx * k, dy * k); this.drag = { x: e.clientX, y: e.clientY };
    });
    dom.addEventListener('pointerup', (e) => { if (e.button === 1) this.drag = null; });
  }

  pitch() { return 0.72 + Math.min(1, (this.dist - 35) / 500) * 0.38; }

  pan(right, fwd) {
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    this.tx += c * right - s * fwd; this.tz += -s * right - c * fwd;
    this.tx = Math.max(-HALF + 30, Math.min(HALF - 30, this.tx)); this.tz = Math.max(-HALF + 30, Math.min(HALF - 30, this.tz));
  }
  centerOn(x, z) { this.tx = x; this.tz = z; }

  update(dt) {
    if (this.enabled) {
      const K = this.keys, sp = this.dist * 1.1 * dt;
      let r = 0, f = 0;
      if (K.has('ArrowLeft') || K.has('KeyA')) r -= sp;
      if (K.has('ArrowRight') || K.has('KeyD')) r += sp;
      if (K.has('ArrowUp') || K.has('KeyW')) f += sp;
      if (K.has('ArrowDown') || K.has('KeyS')) f -= sp;
      const m = this.mouse, W = this.dom.clientWidth, H = this.dom.clientHeight, e = 6;
      if (m.inside && document.hasFocus() && !this.drag) {
        if (m.x < e) r -= sp; else if (m.x > W - e) r += sp;
        if (m.y < e) f += sp; else if (m.y > H - e) f -= sp;
      }
      if (r || f) this.pan(r, f);
      if (K.has('KeyQ')) this.yaw += 1.4 * dt;
      if (K.has('KeyE')) this.yaw -= 1.4 * dt;
    }
    this.ty += (groundY(this.tx, this.tz) - this.ty) * Math.min(1, dt * 4);
    const p = this.pitch(), h = Math.cos(p) * this.dist;
    const cx = this.tx + Math.sin(this.yaw) * h, cz = this.tz + Math.cos(this.yaw) * h;
    const cy = Math.max(this.ty + Math.sin(p) * this.dist, groundY(cx, cz) + 6);
    this.cam.position.set(cx, cy, cz);
    this.cam.lookAt(this.tx, this.ty, this.tz);
  }

  // Point on the terrain under a screen position (CSS px), or null.
  groundAt(px, py) {
    const W = this.dom.clientWidth, H = this.dom.clientHeight;
    this.v.set((px / W) * 2 - 1, -(py / H) * 2 + 1);
    this.ray.setFromCamera(this.v, this.cam);
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    let t = 0, step = 3;
    for (let i = 0; i < 2000; i++) {
      const nt = t + step, x = o.x + d.x * nt, y = o.y + d.y * nt, z = o.z + d.z * nt;
      if (Math.abs(x) > HALF * 1.5 || Math.abs(z) > HALF * 1.5) return null;
      if (y < groundY(x, z)) {
        let a = t, b = nt;
        for (let k = 0; k < 12; k++) { const m = (a + b) / 2; if (o.y + d.y * m < groundY(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
        return { x: o.x + d.x * b, z: o.z + d.z * b };
      }
      t = nt; step = Math.min(12, step * 1.02);
    }
    return null;
  }
}
