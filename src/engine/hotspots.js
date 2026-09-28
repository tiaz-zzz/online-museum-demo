import * as THREE from 'three';

/**
 * HotspotLayer — 展品热点与门洞的 HTML 覆层（文档 §6.4）
 * 热点渲染为 DOM 标记（CSS2D 方案：样式统一、可访问性好、点击即命中），
 * 按距离衰减显示；不做对高斯点的拾取（文档明确热点命中走 HTML 覆层）。
 */
export class HotspotLayer {
  constructor({ container, hooks = {} }) {
    this.container = container;
    this.hooks = hooks;
    this.items = [];   // { el, pos:Vector3, data }
    this.doors = [];   // { el, pos:Vector3, data }
    this.def = null;
    this._v = new THREE.Vector3();
  }

  setScene(def) {
    this.def = def;
    for (const { el } of [...this.items, ...this.doors]) el.remove();
    this.items = []; this.doors = [];
    if (!def) return;

    for (const h of def.hotspots || []) {
      const el = document.createElement('button');
      el.className = 'hotspot';
      el.textContent = h.icon || '◆';
      el.title = h.title;
      el.setAttribute('aria-label', `展品讲解：${h.title}`);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hooks.onHotspotOpen?.(h, def);
      });
      this.container.appendChild(el);
      this.items.push({ el, pos: new THREE.Vector3(...h.pos), data: h });
    }

    for (const n of def.neighbors || []) {
      const el = document.createElement('button');
      el.className = 'door-marker';
      el.textContent = `⇥ ${n.label}`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hooks.onDoorEnter?.(n);
      });
      this.container.appendChild(el);
      this.doors.push({ el, pos: new THREE.Vector3(...n.doorPos), data: n });
    }
  }

  /** 每帧：投影到屏幕、距离衰减、近距高亮 */
  update(camera, eyeRaw) {
    const w = innerWidth, h = innerHeight;
    const scale = this.def?.scale || 1;
    const maxDist = 18 / scale;
    const nearDist = 2.8 / scale;
    const camDir = _dir.set(0, 0, -1).applyQuaternion(camera.quaternion);

    for (const it of this.items) {
      _mv.copy(it.pos).sub(eyeRaw);
      const dist = _mv.length();
      const inFront = _mv.dot(camDir) > 0;
      this._place(it.el, it.pos, camera, w, h, inFront && dist < maxDist);
      if (it.el.style.visibility !== 'hidden') {
        const t = Math.max(0, 1 - dist / maxDist);
        it.el.style.opacity = (0.35 + 0.65 * t).toFixed(2);
        it.el.classList.toggle('near', dist < nearDist);
      } else it.el.classList.remove('near');
    }

    for (const it of this.doors) {
      _mv.copy(it.pos).sub(eyeRaw);
      const dist = _mv.length();
      const inFront = _mv.dot(camDir) > 0;
      this._place(it.el, it.pos, camera, w, h, inFront && dist < maxDist * 1.4);
    }
  }

  _place(el, pos, camera, w, h, visible) {
    if (!visible) { el.style.visibility = 'hidden'; return; }
    _v.copy(pos).project(camera);
    if (_v.z > 1 || _v.x < -1.15 || _v.x > 1.15 || _v.y < -1.15 || _v.y > 1.15) {
      el.style.visibility = 'hidden';
      return;
    }
    el.style.visibility = 'visible';
    el.style.left = ((_v.x * 0.5 + 0.5) * w).toFixed(1) + 'px';
    el.style.top = ((-_v.y * 0.5 + 0.5) * h).toFixed(1) + 'px';
  }

  /** 找最近的可交互热点（E 键互动） */
  nearestWithin(eyeRaw, distRaw) {
    let best = null, bd = distRaw;
    for (const it of this.items) {
      if (it.el.style.visibility === 'hidden') continue;
      const d = it.pos.distanceTo(eyeRaw);
      if (d < bd) { bd = d; best = it.data; }
    }
    return best;
  }

  hideAll() {
    for (const { el } of [...this.items, ...this.doors]) el.style.visibility = 'hidden';
  }
}

const _v = new THREE.Vector3(), _mv = new THREE.Vector3(), _dir = new THREE.Vector3();
