import * as THREE from 'three';

/**
 * ClickToGo — 点击地面自动行走（移植 Arrival.Space clickToHighlight + goToPosition，§7）
 *
 * 流程：左键短点击（≤6px 位移）→ 从相机打过地面射线（行走模式=floorU 平面）
 *   → 目标格必须可行走 → 放置落点标记 → 每帧把方向写进 controls.auto（复用移动通道）
 * 中断：任何用户输入（onUserGesture）、模式切换、卡住（0.6s 位移 <5cm）自动放弃；
 * 到达：距目标 ≤0.22m 停止。指针锁定时点击视为屏幕中心（锁定下鼠标无坐标）。
 */
export class ClickToGo {
  /**
   * @param {object} opts
   * @param {object} opts.controls  FirstPersonControls 实例（写入 auto 通道）
   * @param {object} opts.app       NavApp（取 camera/grid/frame/scene/renderer 前清空标记）
   * @param {object} opts.hooks     { onArrive, onAbort(reason), onSeek(target) }
   */
  constructor({ controls, app, hooks = {} }) {
    this.controls = controls;
    this.app = app;
    this.hooks = hooks;
    this.target = null;        // { a, b, world: Vector3 }
    this.marker = null;
    this._stuckT = 0;
    this._lastDistM = Infinity;
    this._down = null;
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane();
    this._hit = new THREE.Vector3();
    this._m4 = new THREE.Matrix4();
  }

  attach(dom) {
    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      this._down = { x: e.clientX, y: e.clientY };
    });
    dom.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0 || !this._down) return;
      const moved = Math.hypot(e.clientX - this._down.x, e.clientY - this._down.y);
      this._down = null;
      if (moved > 6 || !this.controls.enabled) return;
      // 指针锁定下 clientX/Y 无意义 → 屏幕中心
      const locked = document.pointerLockElement === dom;
      this.seek(
        locked ? dom.clientWidth / 2 : e.clientX,
        locked ? dom.clientHeight / 2 : e.clientY
      );
    });
  }

  /** 从屏幕坐标发射地面射线，可行走则开始自动行走 */
  seek(clientX, clientY) {
    const { controls, app } = this;
    if (!controls.enabled || controls.mode !== 'walk' || !controls.grid || !controls.frame) {
      app.hud.toast('当前模式不支持点击行走（需行走模式 + 可行走网格）');
      return;
    }
    if (app.hud.anyOverlayOpen()) return;
    const ndc = new THREE.Vector2(
      (clientX / dom_width(app)) * 2 - 1,
      -(clientY / dom_height(app)) * 2 + 1
    );
    this._ray.setFromCamera(ndc, app.camera);
    const f = controls.frame;
    // 地面平面：p·U = floorU
    this._plane.normal.copy(f.U);
    this._plane.constant = -f.floorU;
    if (!this._ray.ray.intersectPlane(this._plane, this._hit)) {
      app.hud.toast('请点击脚下的地面');
      return;
    }
    const t = { a: 0, b: 0, u: 0 };
    t.a = this._hit.x * f.R0.x + this._hit.y * f.R0.y + this._hit.z * f.R0.z;
    t.b = this._hit.x * f.F0.x + this._hit.y * f.F0.y + this._hit.z * f.F0.z;
    const distM = this._ray.ray.origin.distanceTo(this._hit) * f.mPerUnit;
    if (distM > 14) {
      app.hud.toast('目标太远（>14m），走近一点再点');
      return;
    }
    if (!controls.grid.isWalkableAB(t.a, t.b)) {
      app.hud.toast('那里走不过去（障碍或地面未知）');
      return;
    }
    this.target = { a: t.a, b: t.b, world: this._hit.clone() };
    this._stuckT = 0;
    this._lastDistM = Infinity;
    this._placeMarker();
    controls.auto.active = true;
    this.hooks.onSeek?.(this.target);
  }

  /** 每帧：方向写入 auto 通道；到达/卡住处理 */
  update(dt) {
    if (!this.target || !this.controls.enabled) return;
    const { controls } = this;
    const f = controls.frame;
    const p = controls.pos;
    const a = p.x * f.R0.x + p.y * f.R0.y + p.z * f.R0.z;
    const b = p.x * f.F0.x + p.y * f.F0.y + p.z * f.F0.z;
    const dA = this.target.a - a;
    const dB = this.target.b - b;
    const distM = Math.hypot(dA, dB) * f.mPerUnit;

    // 卡住检测：本帧位移进度低于 2cm/s 持续 0.6s → 放弃（Arrival：15 步无进展放弃，§7）
    if (this._lastDistM - distM < 0.02 * dt) this._stuckT += dt;
    else this._stuckT = 0;
    this._lastDistM = distM;
    if (this._stuckT > 0.6) {
      this.abort('stuck');
      this.app.hud.toast('去路被挡，已停止自动行走');
      return;
    }

    if (distM <= 0.22) {
      this.abort('arrived');
      this.hooks.onArrive?.();
      return;
    }

    // 复用第一人称 forward/strafe 通道（§7）：Arrival 每步做 fpv.forward = cam.forward·dir，
    // 等价于把目标的世界方向 (dA,dB) 投影到"当前视线前向/右向"——否则转向后点击，
    // 人物永远朝初始朝向走（视角换算缺失的 bug）。
    // F(yaw) = cos·F0 − sin·R0，R(yaw) = cos·R0 + sin·F0 ⟹ fwd = dB·cos − dA·sin，str = dA·cos + dB·sin
    const cos = Math.cos(controls.yaw);
    const sin = Math.sin(controls.yaw);
    const k = Math.min(1, distM / 0.6); // 接近目标时降速
    const distRaw = distM / f.mPerUnit;
    controls.auto.fwd = ((dB * cos - dA * sin) / distRaw) * k;
    controls.auto.str = ((dA * cos + dB * sin) / distRaw) * k;

    // 标记脉动
    if (this.marker) {
      const mt = performance.now() / 1000;
      this.marker.material.opacity = 0.45 + 0.3 * Math.sin(mt * 5);
    }
  }

  abort(reason = 'user') {
    if (!this.target && !this.marker) return;
    this.target = null;
    this.controls.auto.fwd = 0;
    this.controls.auto.str = 0;
    this.controls.auto.active = false;
    this._removeMarker();
    if (reason !== 'arrived') this.hooks.onAbort?.(reason);
  }

  _placeMarker() {
    this._removeMarker();
    const { controls, app } = this;
    const f = controls.frame;
    const geo = new THREE.RingGeometry(0.16 / f.mPerUnit, 0.24 / f.mPerUnit, 36);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xc9a86a,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(geo, mat);
    this._m4.makeBasis(f.R0, f.F0, f.U);
    ring.quaternion.setFromRotationMatrix(this._m4);
    ring.position.copy(this.target.world).addScaledVector(f.U, 0.03 / f.mPerUnit);
    ring.renderOrder = 5;
    this.marker = ring;
    app.scene.add(ring);
  }

  _removeMarker() {
    if (this.marker) {
      this.app.scene.remove(this.marker);
      this.marker.geometry.dispose();
      this.marker.material.dispose();
      this.marker = null;
    }
  }
}

function dom_width(app) { return app.renderer.domElement.clientWidth || innerWidth; }
function dom_height(app) { return app.renderer.domElement.clientHeight || innerHeight; }
