import * as THREE from 'three';

/**
 * Tour — 推荐路线自动漫游（文档 F4：相机路径回放）
 * 沿 manifest 中的 waypoint 序列匀速行走并平滑转向；任何用户输入即退出。
 */
export class Tour {
  constructor({ hooks = {} }) {
    this.hooks = hooks;
    this.active = false;
    this.waypoints = [];
    this.idx = 0;
    this._dir = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._c = new THREE.Vector3();
  }

  start(controls, def) {
    const wps = def.tour?.waypoints;
    if (!wps || wps.length < 2) return false;
    // 从距玩家最近的路径点开始
    let ni = 0, nd = Infinity;
    wps.forEach((w, i) => {
      const d = (w.pos[0] - controls.pos.x) ** 2 + (w.pos[1] - controls.pos.y) ** 2 + (w.pos[2] - controls.pos.z) ** 2;
      if (d < nd) { nd = d; ni = i; }
    });
    this.waypoints = wps;
    this.idx = Math.min(ni, wps.length - 2);
    this.active = true;
    this.hooks.onStart?.();
    return true;
  }

  stop(reason) {
    if (!this.active) return;
    this.active = false;
    this.hooks.onStop?.(reason);
  }

  update(dt, controls) {
    if (!this.active) return;
    const wp = this.waypoints;
    const target = wp[Math.min(this.idx + 1, wp.length - 1)];
    _dir.set(target.pos[0], target.pos[1], target.pos[2]).sub(controls.pos);
    const dist = _dir.length();
    const step = (1.15 / (controls.scale || 1)) * dt; // 原始单位/秒

    if (dist < Math.max(step * 1.5, 0.25 / (controls.scale || 1))) {
      if (this.idx + 1 >= wp.length - 1) { this.stop('finished'); return; }
      this.idx++;
      return;
    }
    _dir.multiplyScalar(1 / dist);
    controls.pos.addScaledVector(_dir, step);
    controls.collide();

    // 平滑转向：求把基准朝向 B 转到 D 所需的绕 U 角，再按最短弧逼近
    const f = controls.groundForward(_f2);
    const cross = _c.crossVectors(f, _dir).dot(controls.U);
    const dotv = Math.max(-1, Math.min(1, f.dot(_dir)));
    const delta = Math.atan2(cross, dotv);
    controls.yaw += delta * Math.min(1, 3.5 * dt);
    controls.pitch *= Math.max(0, 1 - 2.5 * dt);
  }
}

const _dir = new THREE.Vector3();
const _f2 = new THREE.Vector3();
const _c = new THREE.Vector3();
