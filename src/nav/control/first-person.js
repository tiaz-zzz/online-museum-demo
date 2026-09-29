import * as THREE from 'three';
import { fromFrame } from '../core/calibrate.js';
import { createInputGuards } from '../core/input-guards.js';

/**
 * FirstPersonControls — 步入式第一人称控制（操控对齐 arrival.space，见《arrival.space场景操作实现解析.md》）
 *
 * 桌面（Arrival 同款分工）：
 *   · 右键点击画布（按下抬起 ≤6px）→ 切换指针锁定；锁定后移动鼠标环顾
 *   · 未锁定时按住左键拖拽 → 环顾；左键短点击 → 点击地面自动行走（ClickToGo，见 click-to-go.js）
 *   · W A S D / 方向键 行走，Shift 疾行，滚轮调基础速度
 *   · Space 跳跃（行走模式，500ms 防连跳）；F 切换 行走/飞行（飞行沿视线移动，Q/E 升降）
 * 手柄：左摇杆移动、右摇杆视角（≤100°/s）、A 跳跃（标准映射，§8）
 * 仰角限位 [−80°, +70°]（§3），避免万向节翻转观感
 *
 * 与导航层的契约（可复用关键）：控制器只消费
 *   frame（U/F0/R0 标架 + floorU + mPerUnit + bounds2D + vLo/vHi）
 *   grid（OccupancyGrid，可为 null → 退化为仅边界约束）
 * 输入守卫：guards（CallerStack，UI 浮层 acquire 后键盘/锁定被压住，§9）
 */

const MOVE_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'ShiftLeft', 'ShiftRight', 'Space', 'KeyQ', 'KeyE',
]);

const FLY_SPEED_MAX_M = 24;
const PITCH_MIN = -80 * Math.PI / 180;  // 俯视下限（−80°）
const PITCH_MAX = 70 * Math.PI / 180;   // 仰视上限（+70°）
const JUMP_SPEED_M = 3.0;               // 起跳速度（峰值 ≈0.46m，Arrival 实测 0.43m）
const JUMP_COOLDOWN_S = 0.5;            // 防连跳
const GRAVITY_M = 9.81;

export class FirstPersonControls {
  constructor({ domElement, hooks = {}, guards = null } = {}) {
    this.dom = domElement;
    this.hooks = hooks;
    this.guards = guards || createInputGuards();
    this.enabled = false;
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

    // 姿态：pos 在行走模式=脚点，飞行模式=眼点（均为原始泼溅坐标）
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.mode = 'walk';          // walk | fly
    this.viewMode = 'fp';        // fp 第一人称 | tp 第三人称（V 切换，§6）
    this.tpDistM = 2.2;          // 第三人称相机距离（米，0.8~4 弹簧缩放）
    this.speedM = 2.6;           // 基础速度（米/秒）
    this.eyeHM = 1.55;           // 眼高（米）
    this.locked = false;
    this.nolock = false;
    this.avatar = null;          // 第三人称人物标记（app 注入并 add 到场景）

    // 跳跃（行走模式竖直自由度）
    this._airM = 0;              // 离地高度（米）
    this._vertVelM = 0;
    this._jumpCd = 0;
    this._joyBoost = false;      // 左摇杆拉出 3× 半径 → 自动疾跑（§8）
    this._lastTap = 0;           // 触屏右区双击跳（§8）
    this._pinch = null;          // { dist } 双指捏合调速度（§8）

    // 自动行走通道（ClickToGo 复用移动通道，§7）
    this.auto = { fwd: 0, str: 0, active: false };

    this.frame = null;
    this.grid = null;

    this.keys = new Set();
    this.joy = { x: 0, y: 0 };   // 触屏摇杆 [-1,1]
    this._bound = [];            // [target, type, fn, opts] 便于 dispose
    this._drag = null;           // { id, x, y } 拖拽/触屏环顾
    this._joyOrigin = null;      // { id, x, y }
    this._rightDown = null;      // { x, y } 右键按下位置（判"点击"还是"拖动"）
    this._padLook = { x: 0, y: 0 };

    this._bind();
  }

  /* ---------------- 场景装配 ---------------- */

  setScene({ frame, grid, spawnPos, yawDeg = 0, mode = 'walk', speedM, eyeHM }) {
    this.frame = frame;
    this.grid = grid || null;
    this.mode = mode === 'fly' ? 'fly' : 'walk';
    this.viewMode = 'fp';
    if (speedM > 0) this.speedM = Math.min(speedM, FLY_SPEED_MAX_M);
    if (eyeHM > 0) this.eyeHM = eyeHM;
    this.pos.copy(spawnPos);
    this._airM = 0;
    this._vertVelM = 0;
    if (this.mode === 'walk') this._snapToFloor();
    this.yaw = (yawDeg * Math.PI) / 180;
    this.pitch = 0;
    this.vel.set(0, 0, 0);
    this.auto.fwd = 0;
    this.auto.str = 0;
    this.auto.active = false;
    this.enabled = true;
  }

  dispose() {
    this.enabled = false;
    for (const [t, type, fn, opts] of this._bound) t.removeEventListener(type, fn, opts);
    this._bound.length = 0;
  }

  /* ---------------- 输入绑定 ---------------- */

  _on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this._bound.push([target, type, fn, opts]);
  }

  _bind() {
    this._on(window, 'keydown', (e) => {
      if (!this.enabled || this.guards.keyboard.blocked || _isTypingTarget(e)) return;
      if (!MOVE_KEYS.has(e.code) || e.repeat) return; // repeat 忽略：持续移动靠状态位（§2 防呆）
      this.keys.add(e.code);
      if (e.code === 'Space' && this.mode === 'walk') this._queueJump();
      if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      this.hooks.onUserGesture?.();
    });
    this._on(window, 'keyup', (e) => this.keys.delete(e.code));
    // blur / 页面隐藏清零所有方向状态，防止切标签页"按键卡死"（§2 防呆）
    const reset = () => {
      this.keys.clear();
      this.joy.x = 0;
      this.joy.y = 0;
      this.auto.fwd = 0;
      this.auto.str = 0;
    };
    this._on(window, 'blur', reset);
    this._on(document, 'visibilitychange', () => { if (document.hidden) reset(); });

    this._on(document, 'pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
      this.hooks.onLockChange?.(this.locked);
    });

    // 右键点击（非拖动）切换指针锁定（§3）；左键不再锁定（留给点击行走）
    this._on(this.dom, 'pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.pointerType !== 'touch' && e.button === 2) {
        this._rightDown = { x: e.clientX, y: e.clientY };
      }
    });
    this._on(this.dom, 'pointerup', (e) => {
      if (!this.enabled || e.pointerType === 'touch' || e.button !== 2 || !this._rightDown) return;
      const moved = Math.hypot(e.clientX - this._rightDown.x, e.clientY - this._rightDown.y);
      this._rightDown = null;
      if (moved > 6 || this.guards.lock.blocked) return;
      if (document.pointerLockElement === this.dom) document.exitPointerLock?.();
      else if (!this.touch && !this.nolock && (!this.hooks.canLock || this.hooks.canLock())) {
        this.dom.requestPointerLock?.();
      }
    });
    this._on(this.dom, 'contextmenu', (e) => e.preventDefault());

    // 鼠标滚轮分级（§3）：行走+第三人称 → 弹簧距离；行走第一人称/飞行 → 基础速度
    this._on(this.dom, 'wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      if (this.mode === 'walk' && this.viewMode === 'tp') {
        this.tpDistM = Math.min(4, Math.max(0.8, this.tpDistM * f));
        this.hooks.onTpDist?.(this.tpDistM);
        return;
      }
      const max = this.mode === 'fly' ? FLY_SPEED_MAX_M : 8;
      this.speedM = Math.min(max, Math.max(0.3, this.speedM * f));
      this.hooks.onSpeed?.(this.speedM);
    }, { passive: false });

    // 锁定 → mousemove 环顾；未锁定 → 左键拖拽 / 触屏右区环顾（§3 两条路径汇入同一 look）
    this._on(window, 'mousemove', (e) => {
      if (!this.enabled || !this.locked) return;
      this.look(e.movementX, e.movementY);
    });
    this._on(this.dom, 'pointerdown', (e) => {
      if (!this.enabled || this.locked) return;
      const isTouch = e.pointerType === 'touch';
      if (e.pointerType !== 'touch' && e.button !== 0) return;
      const moveZone = isTouch && e.clientX < innerWidth * 0.45;
      if (moveZone && this._joyOrigin == null) {
        this._joyOrigin = { id: e.pointerId, x: e.clientX, y: e.clientY };
      } else if (isTouch && this._drag && this._touch2 == null) {
        this._touch2 = { id: e.pointerId, x: e.clientX, y: e.clientY }; // 第二根手指 → 捏合
      } else if (this._drag == null) {
        this._drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
      } else return;
      this.dom.setPointerCapture?.(e.pointerId);
      this.hooks.onUserGesture?.();
    });
    this._on(this.dom, 'pointermove', (e) => {
      if (!this.enabled) return;
      if (this._joyOrigin && e.pointerId === this._joyOrigin.id) {
        const o = this._joyOrigin;
        const dx = (e.clientX - o.x) / 70;
        const dy = (e.clientY - o.y) / 70;
        const len = Math.hypot(dx, dy);
        const k = len > 1 ? 1 / len : 1;
        this.joy.x = dx * k;
        this.joy.y = -dy * k;
        // 摇杆拉出超过 3× 半径 → 自动疾跑（§8）
        this._joyBoost = len > 3;
      } else if (this._drag && e.pointerId === this._drag.id) {
        if (this._touch2) {
          this._drag.x = e.clientX;
          this._drag.y = e.clientY;
        } else {
          this.look((e.clientX - this._drag.x) * 1.7, (e.clientY - this._drag.y) * 1.7);
          this._drag.x = e.clientX;
          this._drag.y = e.clientY;
        }
      }
      // 双指捏合 → 调基础速度（§8 双指手势的移植）
      if (this._drag && this._touch2) {
        const d = Math.hypot(this._drag.x - this._touch2.x, this._drag.y - this._touch2.y);
        if (this._pinch) {
          const ratio = d / this._pinch.dist;
          if (Math.abs(ratio - 1) > 0.02) {
            const max = this.mode === 'fly' ? FLY_SPEED_MAX_M : 8;
            this.speedM = Math.min(max, Math.max(0.3, this.speedM * ratio));
            this.hooks.onSpeed?.(this.speedM);
          }
        }
        this._pinch = { dist: d };
      }
    });
    const endPointer = (e) => {
      // 触屏右区 300ms 内双击 → 跳跃（§8）
      if (e.pointerType === 'touch' && e.clientX >= innerWidth * 0.45) {
        const now = performance.now();
        if (now - this._lastTap < 300 && this.mode === 'walk') this._queueJump();
        this._lastTap = now;
      }
      if (this._joyOrigin && e.pointerId === this._joyOrigin.id) {
        this._joyOrigin = null;
        this.joy.x = 0;
        this.joy.y = 0;
        this._joyBoost = false;
      }
      if (this._drag && e.pointerId === this._drag.id) this._drag = null;
      if (this._touch2 && e.pointerId === this._touch2.id) { this._touch2 = null; this._pinch = null; }
      if (!this._drag || !this._touch2) this._pinch = null;
    };
    this._on(this.dom, 'pointerup', endPointer);
    this._on(this.dom, 'pointercancel', endPointer);
  }

  /* ---------------- 视角 / 跳跃 / 模式 ---------------- */

  look(dx, dy) {
    const s = 0.0022;
    this.yaw -= dx * s;
    this.pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, this.pitch - dy * s));
  }

  _queueJump() {
    if (this.mode !== 'walk' || this._jumpCd > 0 || this._airM > 0) return;
    this._vertVelM = JUMP_SPEED_M;
    this._airM = 0.0001; // 离地
    this._jumpCd = JUMP_COOLDOWN_S;
  }

  toggleMode() {
    this.mode = this.mode === 'walk' ? 'fly' : 'walk';
    if (this.mode === 'walk' && this.frame) {
      this._airM = 0;
      this._vertVelM = 0;
    }
    this.hooks.onMode?.(this.mode);
    return this.mode;
  }

  /** V：第一 ⇄ 第三人称（仅行走模式有意义，§6） */
  toggleView() {
    if (this.mode !== 'walk') return this.viewMode;
    this.viewMode = this.viewMode === 'fp' ? 'tp' : 'fp';
    this.hooks.onView?.(this.viewMode);
    return this.viewMode;
  }

  /* ---------------- 每帧更新 ---------------- */

  update(dt, camera) {
    if (!this.enabled || !this.frame) return;

    // 手柄轮询（标准映射：左摇杆移动 / 右摇杆视角 ≤100°/s / A 跳跃，§8）
    this._pollGamepad(dt);

    const { U, F0 } = this.frame;
    const F = _fwd.copy(F0).applyAxisAngle(U, this.yaw).normalize();
    const R = _rgt.crossVectors(F, U).normalize();

    // 键盘/摇杆/自动通道 → 期望移动量（米/秒）
    let fwd = 0;
    let str = 0;
    let vert = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) fwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) fwd -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) str += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) str -= 1;
    if (this.mode === 'fly') {
      if (this.keys.has('KeyE') || this.keys.has('Space')) vert += 1;
      if (this.keys.has('KeyQ')) vert -= 1;
    }
    fwd += this.joy.y;
    str += this.joy.x;
    if (this.auto.active) { fwd += this.auto.fwd; str += this.auto.str; }
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this._joyBoost;
    const runK = this.mode === 'fly' ? 3 : 2.2;
    const mag = Math.min(1, Math.hypot(fwd, str, vert));

    const rawSpeed = (this.speedM * (run ? runK : 1)) / this.frame.mPerUnit; // 原始单位/秒
    const tgt = _tgt.set(0, 0, 0);
    if (mag > 1e-3) {
      if (this.mode === 'fly') {
        // 沿视线（含俯仰）移动
        const V = _view.copy(F).applyAxisAngle(R, this.pitch).normalize();
        tgt.addScaledVector(V, (fwd / mag) * rawSpeed)
          .addScaledVector(R, (str / mag) * rawSpeed)
          .addScaledVector(U, (vert / mag) * rawSpeed);
      } else {
        // 水平面移动（低头不减速，§4）；竖直自由度由跳跃物理单独管
        tgt.addScaledVector(F, (fwd / mag) * rawSpeed)
          .addScaledVector(R, (str / mag) * rawSpeed);
      }
    }

    // 指数阻尼逼近目标速度（起/停平滑）
    const k = 1 - Math.exp(-10 * dt);
    this.vel.lerp(tgt, k);
    _delta.copy(this.vel).multiplyScalar(dt);

    if (this.mode === 'fly') {
      this.pos.add(_delta);
      this._clampFly();
    } else {
      if (this.grid) {
        this.grid.resolveMove(this.pos, _delta, this.frame);
      } else {
        // 无网格（推断失败兜底）：仅边界矩形约束
        const t = _pt.copy(this.pos).add(_delta);
        const a = t.dot(this.frame.R0);
        const b = t.dot(this.frame.F0);
        const bd = this.frame.bounds2D;
        const ca = Math.min(Math.max(a, bd.minA), bd.maxA);
        const cb = Math.min(Math.max(b, bd.minB), bd.maxB);
        fromFrame(this.frame, ca, cb, this.frame.floorU, this.pos);
      }
      this._updateJump(dt);
      this._snapToFloor();
    }

    // 相机
    const airRaw = this.mode === 'walk' ? this._airM / this.frame.mPerUnit : 0;
    const eyeRaw = this.mode === 'fly' ? 0 : (this.eyeHM / this.frame.mPerUnit);
    _eye.copy(this.pos).addScaledVector(U, eyeRaw + airRaw);
    camera.up.copy(U);
    _view.copy(F).applyAxisAngle(R, this.pitch);
    if (this.mode === 'walk' && this.viewMode === 'tp') {
      // 第三人称（§6）：相机沿视线后移，步进查网格防穿墙，命中即拉近
      let distRaw = this.tpDistM / this.frame.mPerUnit;
      if (this.grid) {
        const n = Math.max(1, Math.ceil(distRaw / (0.25 / this.frame.mPerUnit)));
        for (let i = 1; i <= n; i++) {
          _probe.copy(_eye).addScaledVector(_view, -(distRaw * i) / n);
          if (!this.grid.isWalkableRaw(_probe)) {
            distRaw = Math.max(0.8 / this.frame.mPerUnit, (distRaw * (i - 1)) / n);
            break;
          }
        }
      }
      camera.position.copy(_eye).addScaledVector(_view, -distRaw);
      camera.lookAt(_eye);
    } else {
      camera.position.copy(_eye);
      camera.lookAt(_tmp.copy(_eye).add(_view));
    }
    // 人物标记（第三人称显示；无虚拟形象用胶囊占位）
    if (this.avatar) {
      const show = this.enabled && this.mode === 'walk' && this.viewMode === 'tp';
      this.avatar.visible = show;
      if (show) {
        this.avatar.position.copy(this.pos).addScaledVector(U, 0.73 / this.frame.mPerUnit);
        this.avatar.quaternion.setFromUnitVectors(_axis.set(0, 1, 0), U);
      }
    }
  }

  /** 跳跃竖直物理：v = v0 − g·t，落地吸附（§5 的运动学简化版） */
  _updateJump(dt) {
    this._jumpCd = Math.max(0, this._jumpCd - dt);
    if (this._airM <= 0) return;
    this._vertVelM -= GRAVITY_M * dt;
    this._airM += this._vertVelM * dt;
    if (this._airM <= 0) {
      this._airM = 0;
      this._vertVelM = 0;
      this.hooks.onLand?.();
    }
  }

  _snapToFloor() {
    const { U, floorU } = this.frame;
    const u = this.pos.dot(U);
    const targetU = floorU + this._airM / this.frame.mPerUnit;
    if (Math.abs(u - targetU) > 1e-9) this.pos.addScaledVector(U, targetU - u);
  }

  _clampFly() {
    const { R0, F0, U, bounds2D, vLo, vHi, mPerUnit } = this.frame;
    const a = this.pos.dot(R0);
    const b = this.pos.dot(F0);
    const u = this.pos.dot(U);
    const m = 0.5 / mPerUnit;
    const ca = Math.min(Math.max(a, bounds2D.minA - m), bounds2D.maxA + m);
    const cb = Math.min(Math.max(b, bounds2D.minB - m), bounds2D.maxB + m);
    const cu = Math.min(Math.max(u, vLo - 2 / mPerUnit), vHi + 8 / mPerUnit);
    fromFrame(this.frame, ca, cb, cu, this.pos);
  }

  _pollGamepad(dt) {
    const pads = navigator.getGamepads?.() || [];
    const pad = pads && [...pads].find((p) => p && p.connected && p.axes.length >= 4);
    if (!pad) return;
    const dz = (v) => (Math.abs(v) < 0.12 ? 0 : (v - Math.sign(v) * 0.12) / 0.88);
    this.joy.x = dz(pad.axes[0]);
    this.joy.y = -dz(pad.axes[1]);
    // 右摇杆视角：满偏 100°/s → 折算成 look 像素增量（sens 0.0022 rad/px）
    const ratePx = (100 * Math.PI / 180) / 0.0022;
    const lx = dz(pad.axes[2]);
    const ly = dz(pad.axes[3]);
    if (lx || ly) this.look(ratePx * lx * dt, ratePx * ly * dt);
    if (pad.buttons[0]?.pressed && this.mode === 'walk') this._queueJump();
  }

  get speedShown() {
    return this.speedM * (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
      ? (this.mode === 'fly' ? 3 : 2.2) : 1);
  }
}

const _fwd = new THREE.Vector3();
const _rgt = new THREE.Vector3();
const _tgt = new THREE.Vector3();
const _view = new THREE.Vector3();
const _eye = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _delta = new THREE.Vector3();
const _pt = new THREE.Vector3();
const _probe = new THREE.Vector3();
const _axis = new THREE.Vector3();

/** 焦点在输入框/文本域/可编辑元素时不拦截按键（校准面板可正常打字） */
function _isTypingTarget(e) {
  const t = e.target;
  if (!t) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
