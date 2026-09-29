import * as THREE from 'three';
import { SparkRenderer } from '@sparkjsdev/spark';
import { loadSplatScene, formatLabel, detectFormatFromPath, getNumSplats } from './core/scene-loader.js';
import { sampleSplats, calibrateScene, UP_CHOICES, fromFrame } from './core/calibrate.js';
import { OccupancyGrid, setSharedFrame } from './nav/occupancy.js';
import { ClickToGo } from './nav/click-to-go.js';
import { createInputGuards } from './core/input-guards.js';
import { FirstPersonControls } from './control/first-person.js';
import { HUD, syncMapYaw } from './ui/hud.js';

/**
 * NavApp — 3DGS 具身导航雏形编排器（框架的"外壳"）
 *
 * 数据流：
 *   URL/manifest → scene-loader（任意格式 → SplatMesh）
 *     → sampleSplats（高斯抽样）→ calibrateScene（up/地面/比例自动推断，可被参数覆盖）
 *     → OccupancyGrid.build（可行走区）→ FirstPersonControls（方向键+鼠标漫游）
 * 校准面板的每次修改都会走 rebuildNavigation() 重算后两步，形成"推断→人工修正"闭环。
 */
export class NavApp {
  constructor({ canvas, uiRoot, params = {}, manifest = null }) {
    this.canvas = canvas;
    this.params = params;
    this.manifest = manifest;
    this.debug = !!params.debug;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x0b0d11, 1);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(Number(params.fov) || 72, 1, 0.02, 500);
    this.spark = new SparkRenderer({ renderer: this.renderer });
    this.scene.add(this.spark);

    this.guards = createInputGuards();

    this.hud = new HUD({
      root: uiRoot,
      hooks: {
        canLock: () => !params.nolock && !this.hud.anyOverlayOpen(),
        onOverlay: (open) => {
          // CallerStack 守卫（§9）：浮层打开压住键盘移动与指针锁定，关闭弹栈
          if (open) {
            this.guards.keyboard.acquire('overlay');
            this.guards.lock.acquire('overlay');
            if (document.pointerLockElement) document.exitPointerLock();
          } else {
            this.guards.keyboard.release('overlay');
            this.guards.lock.release('overlay');
          }
        },
        onCalibAction: (action, hud) => this._onCalibAction(action, hud),
      },
    });

    this.guards = createInputGuards();

    this.controls = new FirstPersonControls({
      domElement: canvas,
      guards: this.guards,
      hooks: {
        canLock: () => !this.hud.anyOverlayOpen() && !params.nolock,
        onLockChange: (locked) => {
          if (locked) this._wasLocked = true;
          this.hud.setLocked(!locked && this._wasLocked && !this.hud.anyOverlayOpen());
        },
        onSpeed: (m) => this.hud.setSpeed(m),
        onMode: (m) => { this.hud.setMode(m); this.clickToGo?.abort('mode'); this.hud.toast(m === 'fly' ? '飞行模式：沿视线移动，Q/E 升降' : '行走模式：贴地行走，含碰撞'); },
        onView: (v) => this.hud.toast(v === 'tp' ? '第三人称：滚轮调距离，再按 V 回第一人称' : '第一人称'),
        onTpDist: (d) => this.hud.toast(`相机距离 ${d.toFixed(1)}m`, 900),
        onUserGesture: () => { this.hud.setHintVisible(false); this.clickToGo?.abort('user'); },
        onLand: () => { /* 预留：落地音效/脚步 */ },
      },
    });

    // 点击地面自动行走（§7）
    this.clickToGo = new ClickToGo({
      controls: this.controls,
      app: this,
      hooks: {
        onArrive: () => this.hud.toast('已到达目的地'),
      },
    });
    this.clickToGo.attach(canvas);

    // 第三人称人物标记（无虚拟形象，胶囊占位；仅第三人称渲染）
    const avatarGeo = new THREE.CapsuleGeometry(0.26, 0.9, 4, 12);
    const avatarMat = new THREE.MeshBasicMaterial({ color: 0xc9a86a, transparent: true, opacity: 0.55, depthWrite: false });
    this.controls.avatar = new THREE.Mesh(avatarGeo, avatarMat);
    this.controls.avatar.visible = false;
    this.controls.avatar.renderOrder = 6;
    this.scene.add(this.controls.avatar);

    // V：第一 ⇄ 第三人称（§6）
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyV' && !_isTyping(e) && this.controls.enabled) this.controls.toggleView();
    });

    // UI 悬停守卫（§9）：鼠标停在 HUD 交互容器上时压住场景输入
    const hoverGuard = (on) => {
      const g = this.guards;
      if (on) {
        g.lock.acquire('hover');
        g.keyboard.acquire('hover');
        g.clickToGo.acquire('hover');
      } else {
        g.lock.release('hover');
        g.keyboard.release('hover');
        g.clickToGo.release('hover');
      }
    };
    this.hud.bindHoverGuards(hoverGuard);

    // F 切换行走/飞行
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyF' && !_isTyping(e) && this.controls.enabled) this.controls.toggleMode();
    });

    window.addEventListener('resize', () => this._resize());
    this._resize();

    this._fps = 60;
    this._autoScale = Number(params.resolution) || 1;
    this._last = 0;
    this._statT = 0;
    this._autoT = 0;
    this._frameNo = 0;

    // 标定覆盖集（URL 参数 / 校准面板写入，rebuildNavigation 时生效）
    this._overrides = {
      up: params.up || null,
      floorRaw: params.floor != null ? Number(params.floor) : null,
      mPerUnit: params.scale != null ? Number(params.scale) : null,
      rot: params.rot != null ? Number(params.rot) : null, // 水平旋转（度）
    };
  }

  /* ---------------- 启动 ---------------- */

  async boot() {
    const p = this.params;
    this.hud.setStatus('正在解析场景来源…', 0.05);

    // 来源优先级：?file= 直连 > ?scene= manifest 条目 > manifest 首条
    let url = null;
    let name = '未命名场景';
    if (p.file || p.url) {
      url = new URL(p.file || p.url, document.baseURI).href;
      name = decodeURIComponent(url.split('/').pop().split('?')[0]) || '外部场景';
    } else {
      const scenes = this.manifest?.scenes || [];
      if (!scenes.length) throw new Error('未提供场景：请用 ?file=<泼溅文件URL> 或配置 public/data/manifest.json');
      const def = scenes.find((s) => String(s.sceneId) === String(p.scene)) || scenes[0];
      url = new URL(def.splat.url, document.baseURI).href;
      name = def.name || name;
      // manifest 已标定的场景沿用其标定（URL 参数优先级更高，见 _overrides 初始化）
      if (!this._overrides.up) this._overrides.up = def.up || null;
      if (this._overrides.mPerUnit == null) this._overrides.mPerUnit = def.scale || null;
      if (this._overrides.floorRaw == null) this._overrides.floorRaw = def.floorY ?? null;
      if (this._overrides.rot == null) this._overrides.rot = def.rot || 0;
      if (def.spawn?.pos) this._spawnOverride = { pos: def.spawn.pos, yaw: def.spawn.yaw ?? 0, snap: false };
    }
    if (p.spawn) {
      const v = String(p.spawn).split(',').map(Number);
      if (v.length >= 3 && v.every(Number.isFinite)) {
        this._spawnOverride = { pos: v.slice(0, 3), yaw: Number(p.yaw) || 0, snap: false };
      }
    }
    this._name = name;

    this.hud.setStatus(`正在加载 ${name} …`, 0.1);
    const guessed = detectFormatFromPath(url);
    const { mesh, format, byteSize } = await loadSplatScene({
      url,
      onProgress: (loaded, total) => {
        if (total > 0) this.hud.setStatus(`正在加载 ${name} ${(loaded / 1048576).toFixed(1)}/${(total / 1048576).toFixed(1)}MB`, 0.1 + 0.75 * (loaded / total));
        else this.hud.setStatus(`正在加载 ${name} ${(loaded / 1048576).toFixed(1)}MB`, null);
      },
    });
    this.mesh = mesh;
    this.scene.add(mesh);
    this.hud.setSceneInfo({ name, format: formatLabel(format), splats: getNumSplats(mesh) });

    // 标定 + 导航构建
    this.hud.setStatus('正在抽样高斯并推断场景结构…', 0.9);
    await _settle(50); // 让状态先绘制（不依赖 rAF，后台标签页也能推进）
    this.samples = sampleSplats(mesh, { maxSamples: Number(p.samples) || 250000 });
    await this.rebuildNavigation({ first: true });

    // 兜底：网格构建失败 → 自由飞行 + 边界约束
    if (!this.grid && this.controls.mode === 'walk') {
      this.controls.mode = 'fly';
      this.hud.toast('未能推断可行走区域（地面不明显），已切自由飞行；可按 C 校准地面后重试', 4200);
    }

    // 可走性回退选轴（Auto 档）：当前轴的可走域太碎时，逐轴重试取最大连通域
    this._maybeFallbackUpAxis(true);

    // 相机远平面按场景尺度设置
    const diag = Math.hypot(
      this.frame.bounds2D.maxA - this.frame.bounds2D.minA,
      this.frame.bounds2D.maxB - this.frame.bounds2D.minB,
      this.frame.vHi - this.frame.vLo
    );
    this.camera.far = Math.max(300, diag * 4);
    this.camera.updateProjectionMatrix();

    this.hud.hideSplash();
    this.hud.toggleMap(!!p.map);
    if (this.grid) this.hud.toast(`已推断可行走区：${(this.grid.walkableCount * this.grid.cellM ** 2).toFixed(0)}㎡ · 点击画面开始漫游`, 3600);
    this.renderer.setAnimationLoop((t) => this._tick(t));
  }

  /**
   * 可走性回退选轴：up 轴自动推断可能被噪声/竖直墙面带偏（实测某展馆 PLY 选错轴后
   * 可走格只有最优轴的 1/6）。当当前轴网格质量差（最大连通域 < max(40, 格数1%)）
   * 且用户未显式指定 up 时，逐轴重算标定+网格，选最大连通域的轴。
   */
  _maybeFallbackUpAxis(first) {
    if (this._overrides.up || !this.samples?.count) return;
    const g0 = this.grid;
    // 统一用"最大连通可走域面积(m²)"作质量度量（格数在不同格宽下不可比）
    const quality = g0 ? g0.largestComponent() * g0.cellM * g0.cellM : 0;
    const totalAreaM = g0 ? g0.cols * g0.rows * g0.cellM * g0.cellM : 0;
    const threshold = Math.max(2.5, totalAreaM * 0.01);
    if (quality >= threshold) return;
    let best = { up: this.frame.up, quality, frame: this.frame, grid: this.grid };
    // 预算各原始坐标轴的 2%~98% 跨度（尺度无关的"水平/竖直"合理性判断用）
    const spread = [0, 1, 2].map((ai) => {
      const v = new Float32Array(this.samples.count);
      for (let i = 0; i < this.samples.count; i++) v[i] = this.samples.centers[i * 3 + ai];
      v.sort();
      const q = (p) => v[Math.round((v.length - 1) * p)];
      return q(0.98) - q(0.02);
    });
    for (const up of UP_CHOICES) {
      if (up === this.frame.up) continue;
      const ai = up.includes('x') ? 0 : up.includes('y') ? 1 : 2;
      // 候选轴的"高度"跨度（p98-p2，原始单位）不得超过最长水平轴，否则是把水平长轴当 up
      const hUnits = spread[ai];
      const horiz = Math.max(...spread.filter((_, i) => i !== ai));
      if (hUnits > horiz) continue; // 把水平长轴当成 up → 不合理
      const f = calibrateScene(this.samples, { up, rotDeg: this._overrides.rot || 0 });
      const g = OccupancyGrid.build({ samples: this.samples, frame: f, cellSizeM: Number(this.params.cell) || 0.25 });
      // 用"最大连通域面积(m²)"比较，格数在不同格宽下不可比
      const q = g ? g.largestComponent() * g.cellM * g.cellM : 0;
      if (q > best.quality) best = { up, quality: q, frame: f, grid: g };
    }
    if (best.up !== this.frame.up && best.quality > quality * 2) {
      this._overrides.up = best.up;
      this._overrides.floorRaw = null;
      this.rebuildNavigation().then(() => {
        if (this.grid && this.params.mode !== 'fly' && this.controls.mode === 'fly') {
          this.controls.mode = 'walk';
          this.hud.setMode('walk');
        }
        this.hud.toast(`up 轴自动修正为 ${best.up}（可行走域 6 轴最优）`, 3600);
      });
    }
  }

  /* ---------------- 导航（重）构建 ---------------- */

  /**
   * 依当前 samples + overrides 重算标定、可行走网格与出生点。
   * 已有玩家位置尽量保留（投影进新网格；不可走则回出生点）。
   */
  async rebuildNavigation({ first = false } = {}) {
    let prevPos = first ? null : this.controls.pos.clone();
    const prevMode = this.controls.mode;
    this.clickToGo?.abort('rebuild');

    this.frame = calibrateScene(this.samples, {
      up: this._overrides.up,
      floorRaw: this._overrides.floorRaw,
      mPerUnit: this._overrides.mPerUnit,
      rotDeg: this._overrides.rot || 0,
    });
    // up 轴被更换（校准面板/回退选轴）→ 旧坐标系的玩家位置已无意义，不保留
    if (prevPos && !first && this._lastUpAxis && this._lastUpAxis !== this.frame.up) prevPos = null;
    this._lastUpAxis = this.frame.up;
    setSharedFrame(this.frame);

    this.grid = OccupancyGrid.build({
      samples: this.samples,
      frame: this.frame,
      cellSizeM: Number(this.params.cell) || 0.25,
    });
    this.controls.grid = this.grid;

    // 出生点：显式覆盖 > 网格质心附近择优
    let spawnPos;
    let yawDeg;
    let spawnNudged = false;
    if (this._spawnOverride) {
      spawnPos = new THREE.Vector3(...this._spawnOverride.pos);
      yawDeg = this._spawnOverride.yaw;
      // 出生点高度与整平后的地面差 >1.5m（陈旧标定）→ 先贴回地面
      const uErr = (spawnPos.dot(this.frame.U) - this.frame.floorU) * this.frame.mPerUnit;
      if (Math.abs(uErr) > 1.5) {
        spawnPos.addScaledVector(this.frame.U, this.frame.floorU - spawnPos.dot(this.frame.U));
        spawnNudged = true;
      }
    } else if (this.grid) {
      const pick = this._pickSpawn();
      spawnPos = pick.pos;
      yawDeg = pick.yawDeg;
    } else {
      const bd = this.frame.bounds2D;
      spawnPos = fromFrame(this.frame, (bd.minA + bd.maxA) / 2, (bd.minB + bd.maxB) / 2, this.frame.floorU);
      yawDeg = 0;
    }
    // 显式出生点落在障碍/未知格 → 就近吸附可行走格，避免卡死
    if (this._spawnOverride && this.grid && !this.grid.isWalkableRaw(spawnPos)) {
      const fixed = this.grid.nearestWalkableRaw(spawnPos, this.frame);
      if (fixed) { spawnPos.copy(fixed); spawnNudged = true; }
    }

    const desiredMode = (this.params.mode === 'fly' || prevMode === 'fly') ? 'fly' : 'walk';
    const mode = this.grid ? desiredMode : 'fly';
    this.controls.setScene({
      frame: this.frame,
      grid: this.grid,
      spawnPos,
      yawDeg,
      mode,
      speedM: Number(this.params.speed) || this.controls.speedM || 2.6,
      eyeHM: Number(this.params.eye) || this.controls.eyeHM || 1.55,
    });
    if (this._spawnOverride?.snap === false) {
      // 显式出生点不吸附地面（允许出生在高台/二楼），仅对齐水平面
      const U = this.frame.U;
      const u = spawnPos.dot(U);
      // 不做投影：保留用户给的完整三维坐标
      this.controls.pos.copy(spawnPos);
    }
    if (spawnNudged) this.hud.toast('配置的出生点位于障碍上，已自动吸附到最近可行走点', 3600);

    // 已有玩家位置保留（first=false 时来自校准重建）
    if (prevPos && this.controls.enabled) {
      const keepBlocked = this.grid && !this.grid.isWalkableRaw(prevPos);
      if (!keepBlocked) this.controls.pos.copy(prevPos);
    }

    // HUD 同步（校准视图 = 标定 + 网格 + 出生点的当前快照）
    this.hud.syncCalib(this._calibView());
    this._updateCalibExport();
  }

  /** 校准面板展示用的统一快照（重建与面板动作共用，避免两处格式漂移） */
  _calibView() {
    const gs = this.grid?.stats();
    return {
      name: this._name,
      axisLabel: this.frame.up,
      upAuto: !this._overrides.up,
      scores: this.frame.scores,
      floorRaw: this.frame.floorRaw,
      mPerUnit: this.frame.mPerUnit,
      mPerUnitAuto: this.frame.mPerUnitAuto,
      rot: this._overrides.rot || 0,
      tilt: this.frame.tiltDeg != null ? `地面倾角 ${this.frame.tiltDeg.toFixed(1)}° → 已自动整平` : '—',
      ceiling: this.frame.ceilingHm != null
        ? `高度 ${this.frame.ceilingHm.toFixed(2)}m（障碍层上限收到 ${this.frame.bodyHiM.toFixed(2)}m）`
        : '未检测到（露天场景）',
      bounds2D: this.frame.bounds2D,
      gridStats: gs
        ? `可行走 ${gs.walk} · 障碍 ${gs.block} · 未知 ${gs.unknown}（${gs.cols}×${gs.rows} @ ${gs.cellM.toFixed(2)}m）`
        : '构建失败（自由飞行兜底）',
      spawn: this.controls.pos.toArray(),
      yawDeg: (this.controls.yaw * 180) / Math.PI,
      sampleCount: this.samples.count,
    };
  }

  /** 在可行走格子中选离质心最近、离障碍最远的格子作为出生点 */
  _pickSpawn() {
    const g = this.grid;
    const cells = [];
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        if (g.data[r * g.cols + c] === 1) cells.push([c, r]);
      }
    }
    let cx = 0;
    let cy = 0;
    for (const [c, r] of cells) { cx += c; cy += r; }
    cx /= cells.length;
    cy /= cells.length;
    let best = cells[0];
    let bestD = Infinity;
    for (const [c, r] of cells) {
      const d = (c - cx) ** 2 + (r - cy) ** 2;
      if (d < bestD) { bestD = d; best = [c, r]; }
    }
    const a = g.minA + (best[0] + 0.5) * g.cell;
    const b = g.minB + (best[1] + 0.5) * g.cell;
    const pos = fromFrame(this.frame, a, b, this.frame.floorU);
    // 朝向：四个正交方向中"可走走廊最长"的方向，避免出生即面壁
    let yawDeg = 0;
    let bestRun = -1;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let run = 0;
      let cc = best[0];
      let rr = best[1];
      for (;;) {
        cc += dc;
        rr += dr;
        if (cc < 0 || rr < 0 || cc >= g.cols || rr >= g.rows) break;
        if (g.data[rr * g.cols + cc] !== 1) break;
        run++;
        if (run > 300) break;
      }
      if (run > bestRun) { bestRun = run; yawDeg = Math.atan2(-dc, dr) * (180 / Math.PI); }
    }
    return { pos, yawDeg };
  }

  /* ---------------- 校准面板动作 ---------------- */

  _onCalibAction(action, hud) {
    const ov = this._overrides;
    const m = this.frame.mPerUnit;
    switch (action) {
      case 'cycle-up': {
        const i = UP_CHOICES.indexOf(ov.up || this.frame.up);
        ov.up = UP_CHOICES[(i + 1) % UP_CHOICES.length];
        ov.floorRaw = null; // up 变了，地面必须重推
        break;
      }
      case 'floor+': ov.floorRaw = this.frame.floorRaw + 0.2 / m * this.frame.axisSign; break;
      case 'floor-': ov.floorRaw = this.frame.floorRaw - 0.2 / m * this.frame.axisSign; break;
      case 'rot+5': ov.rot = (ov.rot || 0) + 5; break;
      case 'rot-5': ov.rot = (ov.rot || 0) - 5; break;
      case 'rot+1': ov.rot = (ov.rot || 0) + 1; break;
      case 'rot-1': ov.rot = (ov.rot || 0) - 1; break;
      case 'scale*2': ov.mPerUnit = m * 2; break;
      case 'scale/2': ov.mPerUnit = m / 2; break;
      case 'spawn-here':
        this._spawnOverride = { pos: this.controls.pos.toArray(), yaw: (this.controls.yaw * 180) / Math.PI, snap: false };
        this.hud.toast('出生点已更新');
        this._updateCalibExport();
        this.hud.syncCalib(this._calibView());
        return;
      case 'fly-here': {
        const eye = this.camera.position.clone();
        this._spawnOverride = { pos: eye.toArray(), yaw: (this.controls.yaw * 180) / Math.PI, snap: false };
        this.params.mode = 'fly';
        this.controls.mode = 'fly';
        this.controls.pos.copy(eye);
        this.hud.setMode('fly');
        this.hud.toast('已飞至当前视角处');
        return;
      }
      case 'copy': {
        const ta = hud.root.querySelector('#nv-calib-out');
        ta.select();
        navigator.clipboard?.writeText(ta.value).then(
          () => this.hud.toast('已复制'),
          () => this.hud.toast('复制失败，请手动 Ctrl+C')
        );
        return;
      }
      default: return;
    }
    // up/floor/scale 变更 → 重算标定与网格
    this.rebuildNavigation().then(() => this.hud.toast('已按新标定重建可行走区域'));
  }

  /** 输出 manifest 兼容的标定片段 */
  _updateCalibExport() {
    const f = this.frame;
    const p = this.controls.pos.toArray().map((n) => +n.toFixed(2));
    this.hud.setCalibExport(JSON.stringify({
      up: f.up,
      scale: +f.mPerUnit.toPrecision(3),
      floorY: +f.floorRaw.toFixed(2),
      rot: this._overrides.rot || 0,
      spawn: { pos: p, yaw: Math.round((this.controls.yaw * 180) / Math.PI) },
    }));
  }

  /* ---------------- 主循环 ---------------- */

  _tick(tms) {
    try {
      this._tickInner(tms);
    } catch (err) {
      // 单帧异常不允许永久杀死渲染循环（上次错误 1s 内只上报一次）
      console.error('[nav] frame error:', err);
      if (!this._lastErrT || tms - this._lastErrT > 1000) {
        this._lastErrT = tms;
        this.hud.toast(`渲染帧异常已跳过：${String(err?.message || err).slice(0, 60)}`, 2600);
      }
    }
  }

  _tickInner(tms) {
    let dt = (tms - this._last) / 1000 || 0.016;
    this._last = tms;
    if (dt > 0.1) dt = 0.1;
    this._fps += (1 / dt - this._fps) * 0.05;

    // 点击行走先写 auto 通道，控制器同帧消费
    this.clickToGo.update(dt);
    this.controls.update(dt, this.camera);
    syncMapYaw(this.controls.yaw);

    if (tms - this._statT > 250) {
      this._statT = tms;
      this.hud.setStats({ fps: this._fps, speedM: this.controls.speedShown });
      if (this.hud.anyOverlayOpen() || this.debug) this._updateCalibExport();
    }
    if (this._frameNo++ % 2 === 0) this.hud.drawMap(this.grid, this.frame, this.controls.pos);

    this.renderer.render(this.scene, this.camera);
  }

  _resize() {
    const base = Math.min(devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(base * this._autoScale);
    this.renderer.setSize(innerWidth, innerHeight, false);
    // 竖屏时抬高 FOV 保证视野（§6 FOV 自适应）
    const baseFov = Number(this.params.fov) || 72;
    this.camera.fov = innerHeight > innerWidth ? Math.max(baseFov, 90) : baseFov;
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}

function _settle(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function _isTyping(e) {
  const tag = e.target?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable;
}
