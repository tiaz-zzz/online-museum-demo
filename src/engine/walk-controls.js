import * as THREE from 'three';

/**
 * WalkControls — 步入式第一人称漫游控制（文档 §6.1 / §6.2 的 Demo 简化版）
 *
 * - 桌面：PointerLock 锁定鼠标 + WASD/方向键行走、Shift 疾跑
 * - 移动端：左侧虚拟摇杆移动 + 右半屏拖动环顾
 * - 碰撞：外边界矩形 + 不可见墙体 AABB（正式版为代理网格 + BVH 胶囊体，见文档 6.2）
 * - 坐标系：泼溅网格保持原始坐标（mesh 不旋转），场景"上"方向由 manifest 的 up 字段抽象，
 *   玩家脚点 pos / 热点 / 门洞 / 边界全部使用原始泼溅坐标，由 scale 字段换算米制速度与身高。
 */
const UP_TABLE = {
  '+y': { u: [0, 1, 0], b: [0, 0, -1], h1: 'x', h2: 'z' },
  '-y': { u: [0, -1, 0], b: [0, 0, -1], h1: 'x', h2: 'z' },
  '+z': { u: [0, 0, 1], b: [1, 0, 0], h1: 'x', h2: 'y' },
  '-z': { u: [0, 0, -1], b: [1, 0, 0], h1: 'x', h2: 'y' },
  '+x': { u: [1, 0, 0], b: [0, 0, -1], h1: 'z', h2: 'y' },
  '-x': { u: [-1, 0, 0], b: [0, 0, -1], h1: 'z', h2: 'y' },
};

export class WalkControls {
  constructor({ domElement, joystickEl, lookPadEl, hooks = {} }) {
    this.dom = domElement;
    this.hooks = hooks;
    this.enabled = false;
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    this.pos = new THREE.Vector3();   // 脚点（原始坐标）
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.U = new THREE.Vector3(0, 1, 0);
    this.B = new THREE.Vector3(0, 0, -1);
    this.h1 = 'x'; this.h2 = 'z';
    this.scale = 1;
    this.floorY = 0;
    this.def = null;
    this.locked = false;

    this.keys = new Set();
    this.joy = { x: 0, y: 0 };

    this._bind(joystickEl, lookPadEl);
  }

  /* ---------------- 场景装配 ---------------- */

  setScene(def, entry) {
    this.def = def;
    const t = UP_TABLE[def.up || '+y'];
    this.U.set(...t.u);
    this.B.set(...t.b);
    this.h1 = t.h1; this.h2 = t.h2;
    this.scale = def.scale || 1;
    this.floorY = def.floorY ?? 0;
    const p = entry?.pos || def.spawn.pos;
    this.pos.set(p[0], p[1], p[2]);
    this.pos[this.hVert()] = this.floorY; // 脚点贴地（平面贴地简化）
    this.yaw = ((entry?.yaw ?? def.spawn.yaw ?? 0) * Math.PI) / 180;
    this.pitch = 0;
    this.vel.set(0, 0, 0);
    this.enabled = true;
  }

  hVert() {
    return this.U.x !== 0 ? 'x' : this.U.y !== 0 ? 'y' : 'z';
  }

  /* ---------------- 输入 ---------------- */

  _bind(joystickEl, lookPadEl) {
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        this.keys.add(e.code);
        this._userMove();
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      if (!this.locked) this.hooks.onUnlock?.();
    });

    this.dom.addEventListener('click', () => {
      if (this.enabled && !this.touch && !this.locked && this.hooks.canLock?.()) {
        this.dom.requestPointerLock();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.locked) return;
      this.look(e.movementX, e.movementY);
    });

    // 移动端：右半屏拖动环顾
    if (lookPadEl && this.touch) {
      let id = null, lx = 0, ly = 0;
      lookPadEl.addEventListener('pointerdown', (e) => {
        if (id !== null) return;
        id = e.pointerId; lx = e.clientX; ly = e.clientY;
        lookPadEl.setPointerCapture(id);
      });
      lookPadEl.addEventListener('pointermove', (e) => {
        if (e.pointerId !== id) return;
        this.look((e.clientX - lx) * 2.2, (e.clientY - ly) * 2.2);
        lx = e.clientX; ly = e.clientY;
      });
      const end = (e) => { if (e.pointerId === id) id = null; };
      lookPadEl.addEventListener('pointerup', end);
      lookPadEl.addEventListener('pointercancel', end);
    }

    // 虚拟摇杆
    if (joystickEl) {
      const stick = joystickEl.querySelector('.stick');
      let id = null;
      const setStick = (dx, dy) => { stick.style.transform = `translate(${dx}px, ${dy}px)`; };
      joystickEl.addEventListener('pointerdown', (e) => {
        id = e.pointerId;
        joystickEl.setPointerCapture(id);
        this._joyMove(e, joystickEl, setStick);
        this._userMove();
      });
      joystickEl.addEventListener('pointermove', (e) => {
        if (e.pointerId === id) this._joyMove(e, joystickEl, setStick);
      });
      const end = (e) => {
        if (e.pointerId !== id) return;
        id = null; this.joy.x = 0; this.joy.y = 0; setStick(0, 0);
      };
      joystickEl.addEventListener('pointerup', end);
      joystickEl.addEventListener('pointercancel', end);
    }
  }

  _joyMove(e, el, setStick) {
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy), max = r.width / 2 - 14;
    if (len > max) { dx *= max / len; dy *= max / len; }
    setStick(dx, dy);
    this.joy.x = dx / max;
    this.joy.y = -dy / max;
    this._userMove();
  }

  look(dx, dy) {
    this.yaw -= dx * 0.0022;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * 0.0022));
    if (Math.abs(dx) + Math.abs(dy) > 2) this._userMove();
  }

  _userMove() {
    this.hooks.onUserMove?.();
  }

  /* ---------------- 地面朝向基向量 ---------------- */

  groundForward(out) {
    return out.copy(this.B).applyAxisAngle(this.U, this.yaw).normalize();
  }

  /* ---------------- 主循环 ---------------- */

  update(dt, camera) {
    if (!this.enabled || !this.def) return;
    const F = _fwd.copy(this.B).applyAxisAngle(this.U, this.yaw).normalize();
    const R = _rgt.crossVectors(F, this.U).normalize();

    // 期望速度（米制 → 原始单位）
    let fwd = 0, str = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fwd -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) str += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) str -= 1;
    fwd += this.joy.y; str += this.joy.x;
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const mag = Math.min(1, Math.hypot(fwd, str));
    if (mag > 0.001) {
      const spd = ((run ? 4.6 : 2.4) / this.scale) * mag;
      _tgt.copy(F).multiplyScalar((fwd / mag) * spd).addScaledVector(R, (str / mag) * spd);
    } else _tgt.set(0, 0, 0);

    // 速度阻尼逼近目标速度（起/停平滑）
    const k = 1 - Math.exp(-10 * dt);
    this.vel.lerp(_tgt, k);
    this.pos.addScaledVector(this.vel, dt);

    this.collide();

    // 相机：眼点 = 脚点 + up * 身高；视线 = 地面朝向绕右轴俯仰
    const eyeH = (this.def.eyeHeightM ?? 1.55) / this.scale;
    _eye.copy(this.pos).addScaledVector(this.U, eyeH);
    camera.position.copy(_eye);
    camera.up.copy(this.U);
    _view.copy(F).applyAxisAngle(R, this.pitch);
    camera.lookAt(_tmp.copy(_eye).add(_view));
  }

  collide() {
    const def = this.def;
    const r = 0.32 / this.scale;
    const h1 = this.h1, h2 = this.h2;
    // 外边界
    if (def.bounds) {
      const [mn1, mn2] = def.bounds.min, [mx1, mx2] = def.bounds.max;
      if (this.pos[h1] < mn1 + r) this.pos[h1] = mn1 + r;
      if (this.pos[h1] > mx1 - r) this.pos[h1] = mx1 - r;
      if (this.pos[h2] < mn2 + r) this.pos[h2] = mn2 + r;
      if (this.pos[h2] > mx2 - r) this.pos[h2] = mx2 - r;
    }
    // 墙体 AABB（圆形推出）
    for (const w of def.walls || []) {
      const [w0x, w0y] = w.min, [w1x, w1y] = w.max;
      const px = this.pos[h1], py = this.pos[h2];
      if (px > w0x - r && px < w1x + r && py > w0y - r && py < w1y + r) {
        const dL = px - (w0x - r), dR = (w1x + r) - px;
        const dB = py - (w0y - r), dT = (w1y + r) - py;
        const m = Math.min(dL, dR, dB, dT);
        if (m === dL) this.pos[h1] = w0x - r;
        else if (m === dR) this.pos[h1] = w1x + r;
        else if (m === dB) this.pos[h2] = w0y - r;
        else this.pos[h2] = w1y + r;
      }
    }
  }
}

const _fwd = new THREE.Vector3(), _rgt = new THREE.Vector3(), _tgt = new THREE.Vector3();
const _eye = new THREE.Vector3(), _view = new THREE.Vector3(), _tmp = new THREE.Vector3();
