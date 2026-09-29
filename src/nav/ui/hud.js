import '../nav.css';

/**
 * HUD — 导航雏形的界面层：加载态 / 准星 / 状态条 / 帮助 / 校准面板 / 可行走区小地图
 * 纯 DOM，不持有引擎状态；通过 hooks 回调把用户操作交回 NavApp。
 */
export class HUD {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.root        UI 挂载点
   * @param {object} opts.hooks            { onCalibAction(action, hud), canLock(), onOverlay(open) }
   */
  constructor({ root, hooks = {} }) {
    this.hooks = hooks;
    this.root = root;
    this.mapVisible = false;
    this._toastTimer = 0;
    this._lastStats = {};
    root.innerHTML = `
      <div class="nv-cross" id="nv-cross"></div>

      <div class="nv-topbar">
        <div class="nv-left">
          <span class="nv-title">具身导航雏形</span>
          <span class="nv-scene" id="nv-scene">—</span>
          <span class="nv-badge" id="nv-format">—</span>
          <span class="nv-dim" id="nv-splats"></span>
        </div>
        <div class="nv-right">
          <span class="nv-chip" id="nv-mode">行走</span>
          <span class="nv-chip" id="nv-speed">— m/s</span>
          <span class="nv-dim" id="nv-fps"></span>
        </div>
      </div>

      <canvas class="nv-map" id="nv-map" width="176" height="176" hidden></canvas>

      <div class="nv-hint" id="nv-hint">右键锁定鼠标 · <b>WASD</b> 行走 · <b>左键点地面</b> 自动走 · <b>V</b> 第三人称 · <b>H</b> 隐藏UI · <b>C</b> 校准 · <b>?</b> 帮助</div>

      <div class="nv-veil" id="nv-veil" hidden>
        <div class="nv-veil-card">
          <div class="nv-veil-t">已暂停</div>
          <div class="nv-veil-d">点击画面继续漫游 · Esc 呼出此层</div>
        </div>
      </div>

      <div class="nv-overlay" id="nv-help" hidden>
        <div class="nv-card">
          <div class="nv-card-h">操作说明 <button class="nv-x" data-close="help">✕</button></div>
          <table class="nv-kv">
            <tr><td>右键点击画面</td><td>锁定 / 解锁鼠标（锁定后移动鼠标环顾）</td></tr>
            <tr><td>W A S D / 方向键</td><td>行走（飞行时沿视线移动）</td></tr>
            <tr><td>V</td><td>第一 ⇄ 第三人称（第三人称下滚轮调相机距离）</td></tr>
            <tr><td>左键点击地面</td><td>自动走过去：按当前视角换算方向（转向后点击依然准确）；锁定鼠标时点击 = 走向准星指向的地面；任意输入可打断，直线被挡自动停</td></tr>
            <tr><td>未锁定时左键拖拽</td><td>环顾</td></tr>
            <tr><td>Space</td><td>跳跃（行走模式，0.5s 防连跳）</td></tr>
            <tr><td>Shift</td><td>疾行（飞行 ×3）</td></tr>
            <tr><td>滚轮</td><td>行走/飞行：调基础速度 · 第三人称：调相机距离</td></tr>
            <tr><td>F</td><td>行走 ⇄ 飞行（飞行穿墙，便于检查场景）</td></tr>
            <tr><td>Q / E（飞行）</td><td>下降 / 上升（Space = 上升）</td></tr>
            <tr><td>手柄</td><td>左摇杆移动 · 右摇杆视角 · A 跳跃</td></tr>
            <tr><td>触屏</td><td>左半屏移动 · 右半屏环顾 · 右区双击跳 · 双指捏合调速 · 摇杆拉满疾跑</td></tr>
            <tr><td>H</td><td>隐藏 / 恢复 UI 覆盖层（纯净截图）</td></tr>
            <tr><td>G / C / ?</td><td>可行走区小地图 / 校准面板 / 本帮助</td></tr>
            <tr><td>Esc</td><td>解锁鼠标 / 关闭面板</td></tr>
          </table>
          <div class="nv-foot">可行走区域由泼溅高斯自动推断（Splat-Nav 简化版）：地面层高斯 → 可踩，身体层高密度 → 障碍；up 轴推断失准会自动按"六轴可走域最大"回退修正。点击金色圆环目标即自动行走落点。</div>
        </div>
      </div>

      <div class="nv-overlay" id="nv-calib" hidden>
        <div class="nv-card nv-calib">
          <div class="nv-card-h">场景校准 <button class="nv-x" data-close="calib">✕</button></div>
          <div class="nv-grid" id="nv-calib-grid"></div>
          <div class="nv-btns">
            <button data-calib="cycle-up">切换 up 轴</button>
            <button data-calib="floor+">地面 ↑0.2m</button>
            <button data-calib="floor-">地面 ↓0.2m</button>
            <button data-calib="rot-5">水平 ↺5°</button>
            <button data-calib="rot-1">↺1°</button>
            <button data-calib="rot+1">↻1°</button>
            <button data-calib="rot+5">水平 ↻5°</button>
            <button data-calib="scale*2">比例 ×2</button>
            <button data-calib="scale/2">比例 ÷2</button>
            <button data-calib="spawn-here">以此处为出生点</button>
            <button data-calib="fly-here" title="把出生点抬到当前相机位置并切飞行，检查场景用">飞到此处</button>
          </div>
          <div class="nv-dim">自动推断的值可直接覆盖；以下 JSON 可粘进 manifest 或作为 URL 参数使用：</div>
          <textarea id="nv-calib-out" rows="3" spellcheck="false"></textarea>
          <div class="nv-btns"><button data-calib="copy">复制 JSON</button></div>
        </div>
      </div>

      <div class="nv-toast" id="nv-toast" hidden></div>

      <div class="nv-splash" id="nv-splash">
        <div class="nv-splash-seal">航</div>
        <div class="nv-splash-t">3DGS 具身导航雏形</div>
        <div class="nv-splash-d">多格式场景适配 · 泼溅推断可行走区 · 步入式漫游</div>
        <div class="nv-bar"><i id="nv-bar"></i></div>
        <div class="nv-splash-s" id="nv-status">正在启动…</div>
      </div>
    `;

    this.$ = (id) => root.querySelector(`#nv-${id}`);
    this.splash = this.$('splash');
    this.bar = this.$('bar');
    this.status = this.$('status');

    for (const btn of root.querySelectorAll('[data-close]')) {
      btn.addEventListener('click', () => this.closeOverlay(btn.dataset.close));
    }
    for (const btn of root.querySelectorAll('[data-calib]')) {
      btn.addEventListener('click', () => this.hooks.onCalibAction?.(btn.dataset.calib, this));
    }
    window.addEventListener('keydown', (e) => {
      if (_isTyping(e)) return;
      if (e.key === '?') this.toggleOverlay('help');
      if (e.code === 'KeyH') this.toggleChrome(); // H 隐藏/恢复 UI 覆盖层（§2 overlay:toggleUI）
      if (e.code === 'KeyC') this.toggleOverlay('calib');
      if (e.code === 'KeyG') this.toggleMap();
      if (e.code === 'Escape') { this.closeOverlay('help'); this.closeOverlay('calib'); }
    });
    // 启动看门狗：任何情况下 Splash 都不得永久遮挡（沿用博物馆 demo 的工程约定）
    this._watchdog = setTimeout(() => this.hideSplash(), 20000);
  }

  /**
   * UI 悬停守卫（§9）：指针停在 HUD 交互容器（面板/小地图）上时压住场景输入。
   * @param {(on:boolean)=>void} fn 由 NavApp 提供的压/弹栈回调
   */
  bindHoverGuards(fn) {
    for (const el of this.root.querySelectorAll('.nv-card, .nv-map')) {
      el.addEventListener('pointerenter', () => fn(true));
      el.addEventListener('pointerleave', () => fn(false));
    }
  }

  /** H：隐藏/恢复 HUD 覆盖层（顶栏/准星/提示/小地图/toast），便于纯净截图 */
  toggleChrome() {
    this.root.classList.toggle('nv-chrome-off');
    const off = this.root.classList.contains('nv-chrome-off');
    this.toast(off ? 'UI 已隐藏 · 按 H 恢复' : 'UI 已恢复', 1400);
    return off;
  }

  /* ---------------- 加载态 ---------------- */

  setStatus(text, progress = null) {
    this.status.textContent = text;
    if (progress != null) this.bar.style.width = `${Math.min(100, progress * 100).toFixed(1)}%`;
  }

  showError(msg) {
    clearTimeout(this._watchdog);
    this.splash.classList.add('nv-error');
    this.status.innerHTML = `启动失败：${msg}<br><span class="nv-dim">支持格式：.ply / .splat / .ksplat / .spz / .sog(zip) / meta.json / .rad · 本地文件需经 HTTP 访问（npm run dev）</span>`;
  }

  hideSplash() {
    clearTimeout(this._watchdog);
    this.splash.classList.add('gone');
    setTimeout(() => this.splash.remove(), 600);
  }

  /* ---------------- 状态条 / 提示 ---------------- */

  setSceneInfo({ name, format, splats }) {
    this.$('scene').textContent = name;
    this.$('format').textContent = format;
    this.$('splats').textContent = splats ? `${(splats / 1e4).toFixed(1)}万 splats` : '';
  }

  setStats({ fps, mode, speedM, yawDeg }) {
    if (fps != null) this.$('fps').textContent = `${fps.toFixed(0)} fps`;
    if (mode) this.$('mode').textContent = mode === 'fly' ? '飞行' : '行走';
    if (speedM != null) this.$('speed').textContent = `${speedM.toFixed(1)} m/s`;
    if (yawDeg != null) this._lastStats.yawDeg = yawDeg;
  }

  setMode(mode) { this.$('mode').textContent = mode === 'fly' ? '飞行' : '行走'; }
  setSpeed(mps) { this.$('speed').textContent = `${mps.toFixed(1)} m/s`; }

  setHintVisible(v) { this.$('hint').style.opacity = v ? '' : '0'; }
  setLocked(locked) {
    this.$('veil').hidden = locked;
    if (locked) this.setHintVisible(false);
  }

  toast(msg, ms = 2200) {
    const t = this.$('toast');
    t.textContent = msg;
    t.hidden = false;
    t.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.classList.remove('show'); setTimeout(() => { t.hidden = true; }, 300); }, ms);
  }

  /* ---------------- 覆层 ---------------- */

  anyOverlayOpen() {
    return !this.$('help').hidden || !this.$('calib').hidden;
  }

  toggleOverlay(id) {
    const el = this.$(id);
    el.hidden = !el.hidden;
    this.hooks.onOverlay?.(this.anyOverlayOpen());
  }

  closeOverlay(id) {
    this.$(id).hidden = true;
    this.hooks.onOverlay?.(this.anyOverlayOpen());
  }

  /* ---------------- 校准面板 ---------------- */

  syncCalib(data) {
    const s = data.scores;
    this.$('calib-grid').innerHTML = [
      ['场景', data.name],
      ['up 轴', `${data.axisLabel}${data.upAuto ? '（自动推断）' : '（指定）'}`],
      ['六轴地面评分', s ? Object.entries(s).map(([k, v]) => `${k}:${v.toFixed(0)}`).join('　') : '—'],
      ['地面高度', `${data.floorRaw.toFixed(2)}（沿 up 轴原始坐标）`],
      ['比例尺', `${data.mPerUnit.toPrecision(3)} 米/单位${data.mPerUnitAuto ? '（按层高假设估计，建议核对）' : ''}`],
      ['水平旋转', `${(data.rot || 0).toFixed(1)}°（绕 up 轴，↺ = 向左）`],
      ['倾角整平', data.tilt ?? '—'],
      ['天花板', data.ceiling ?? '—'],
      ['水平范围', `${data.bounds2D.minA.toFixed(1)}~${data.bounds2D.maxA.toFixed(1)} × ${data.bounds2D.minB.toFixed(1)}~${data.bounds2D.maxB.toFixed(1)}`],
      ['可行走网格', data.gridStats],
      ['出生点', data.spawn ? `[${data.spawn.map((n) => +n.toFixed(2)).join(', ')}] yaw ${data.yawDeg?.toFixed(0)}°` : '—'],
      ['采样', `${data.sampleCount} 高斯（上限内隔步采样）`],
    ].map(([k, v]) => `<div class="nv-k">${k}</div><div class="nv-v">${v}</div>`).join('');
  }

  setCalibExport(text) { this.$('calib-out').value = text; }

  /* ---------------- 可行走区小地图 ---------------- */

  toggleMap(force) {
    this.mapVisible = force ?? !this.mapVisible;
    this.$('map').hidden = !this.mapVisible;
  }

  /**
   * 绘制可行走网格 + 玩家位置。
   * @param {object|null} grid OccupancyGrid
   * @param {object} frame 标定标架
   * @param {THREE.Vector3} playerPos 脚点（原始坐标）
   */
  drawMap(grid, frame, playerPos) {
    if (!this.mapVisible) return;
    const cv = this.$('map');
    const ctx = cv.getContext('2d');
    const S = cv.width;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(10,12,16,.88)';
    ctx.fillRect(0, 0, S, S);
    if (!grid) {
      ctx.fillStyle = '#8a8f98';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('无可行走区数据', S / 2, S / 2);
      return;
    }
    const scale = S / Math.max(grid.cols, grid.rows);
    const ox = (S - grid.cols * scale) / 2;
    const oy = (S - grid.rows * scale) / 2;
    // b（前向）朝上：canvas 行 = rows-1-row
    let maxFloor = 1;
    for (let i = 0; i < grid.floorCount.length; i++) maxFloor = Math.max(maxFloor, grid.floorCount[i]);
    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const v = grid.data[row * grid.cols + col];
        if (v === 0) continue;
        const shade = grid.floorCount[row * grid.cols + col] / maxFloor;
        ctx.fillStyle = v === 2 ? '#343943'
          : shade > 0.35 ? '#4d9d6b' : shade > 0.08 ? '#3d7f58' : '#2f6247';
        ctx.fillRect(ox + col * scale, oy + (grid.rows - 1 - row) * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }
    // 玩家（视线方向 = F0·cosyaw − R0·sinyaw，映射到 canvas：x=+a, y=−b）
    const t = { a: 0, b: 0, u: 0 };
    t.a = playerPos.x * frame.R0.x + playerPos.y * frame.R0.y + playerPos.z * frame.R0.z;
    t.b = playerPos.x * frame.F0.x + playerPos.y * frame.F0.y + playerPos.z * frame.F0.z;
    const px = ox + ((t.a - grid.minA) / grid.cell) * scale;
    const py = oy + (grid.rows - 1 - (t.b - grid.minB) / grid.cell) * scale;
    const fA = -Math.sin(playerYawCache), fB = Math.cos(playerYawCache);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(fA, fB));
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.2, 5);
    ctx.lineTo(-4.2, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

let playerYawCache = 0;
/** 控制器每帧同步 yaw 给小地图（避免 HUD 依赖控制器实例） */
export function syncMapYaw(yaw) { playerYawCache = yaw; }

function _isTyping(e) {
  const t = e.target;
  const tag = t?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable;
}
