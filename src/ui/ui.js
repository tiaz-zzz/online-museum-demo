/**
 * ui.js — 全部 DOM 覆层：加载浮层、HUD、策展卡、讲解卡、菜单、引导、Toast、
 * 移动端摇杆、校准面板（文档 §6.6 / §8.1）。
 */
export class UI {
  constructor({ manifest, params = {} }) {
    this.manifest = manifest;
    this.params = params;
    this.menuOpen = false;
    this.calib = !!params.calib;
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    this._speakOn = false;

    const app = document.getElementById('app');
    this.appRoot = app;
    app.innerHTML = this._template();
    this._wire();

    this.onFirstFrame = null; // main.js 注入：首帧后撤掉 Splash
  }

  _template() {
    return `
      <div class="crosshair" id="crosshair"></div>
      <div id="overlay" style="position:fixed;inset:0;pointer-events:none;z-index:4"></div>

      <div class="curation" id="curation" title="点击查看展厅介绍">
        <div class="hall-name" id="cur-name">—</div>
        <div class="hall-sub" id="cur-sub">—</div>
      </div>

      <div class="hud-tr">
        <div class="perf-chip" id="perf">FPS —</div>
        <button class="icon-btn" id="btn-help" title="操作说明">?</button>
        <button class="icon-btn" id="btn-menu" title="菜单 (Esc)">☰</button>
      </div>

      <div class="minimap-wrap"><canvas id="minimap"></canvas></div>

      <div class="help gone" id="help">
        <h3>欢迎参观 · 操作引导</h3>
        <div class="keys">${this.touch ? `
          <div class="k-item"><div class="kbd"><kbd>左摇杆</kbd></div>行走</div>
          <div class="k-item"><div class="kbd"><kbd>右半屏拖动</kbd></div>环顾四周</div>
          <div class="k-item"><div class="kbd"><kbd>点击金色标记</kbd></div>查看展品</div>
          ` : `
          <div class="k-item"><div class="kbd"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div>行走</div>
          <div class="k-item"><div class="kbd"><kbd>鼠标</kbd></div>环顾四周</div>
          <div class="k-item"><div class="kbd"><kbd>Shift</kbd></div>疾走</div>
          <div class="k-item"><div class="kbd"><kbd>E</kbd></div>查看近处展品</div>
          <div class="k-item"><div class="kbd"><kbd>Esc</kbd></div>菜单 / 释放鼠标</div>
          <div class="k-item"><div class="kbd"><kbd>点击金色标记</kbd></div>展品讲解</div>
          <div class="k-item"><div class="kbd"><kbd>绿色传送门</kbd></div>前往邻厅</div>
          `}</div>
        <div style="margin-top:14px;font-size:11px;color:#7d766a">此引导将在开始移动后自动淡出</div>
      </div>

      <div class="infocard" id="infocard">
        <button class="close" id="ic-close">✕</button>
        <span class="cat" id="ic-cat"></span>
        <h3 id="ic-title"></h3>
        <div class="desc" id="ic-desc"></div>
        <div class="actions">
          <button id="ic-speak">🔊 语音讲解</button>
          <button id="ic-closeup" disabled title="展品特写环视（M3 路线图）">🔍 3D 特写（开发中）</button>
        </div>
      </div>

      <div class="menu-backdrop" id="menu-backdrop" style="display:none"></div>
      <div class="menu" id="menu" style="display:none"></div>

      <div class="loader" id="loader">
        <div class="l-hall" id="l-hall">云游博物馆</div>
        <div class="l-text" id="l-text"></div>
        <div class="l-bar"><i id="l-bar"></i></div>
      </div>

      <div class="toast" id="toast"></div>

      ${this.touch ? `
        <div class="look-pad" id="lookpad"></div>
        <div class="joystick" id="joystick"><div class="stick"></div></div>
      ` : ''}
      ${this.calib ? `
        <div class="calib">
          <div class="pos" id="calib-pos">pos —</div>
          <textarea id="calib-out" spellcheck="false" placeholder="校准数据会追加到这里"></textarea>
          <div class="row">
            <button id="calib-spot">⊕ 标热点(准星)</button>
            <button id="calib-spawn">⊕ 标出生点</button>
            <button id="calib-select">全选</button>
          </div>
        </div>` : ''}
    `;
  }

  _wire() {
    this.overlayEl = document.getElementById('overlay');
    this.minimapCanvas = document.getElementById('minimap');
    this.joystickEl = document.getElementById('joystick');
    this.lookPadEl = document.getElementById('lookpad');
    this.crosshairEl = document.getElementById('crosshair');
    this._menu = document.getElementById('menu');
    this._backdrop = document.getElementById('menu-backdrop');

    document.getElementById('btn-menu').addEventListener('click', () => (this.menuOpen ? this.closeMenu({ resume: true }) : this.openMenu()));
    document.getElementById('btn-help').addEventListener('click', () => this.showHelp());
    document.getElementById('curation').addEventListener('click', () => this._showHallIntro());
    document.getElementById('ic-close').addEventListener('click', () => this.closeInfoCard());
    document.getElementById('ic-speak').addEventListener('click', () => this._toggleSpeak());
    this._backdrop.addEventListener('click', () => this.closeMenu({ resume: true }));

    // toast
    this._toastEl = document.getElementById('toast');
    this._toastTimer = null;
    this._helpShown = false;
  }

  /* ---------------- Splash 交接 ---------------- */

  handoffSplash() {
    const splash = document.getElementById('splash');
    if (splash && !splash.classList.contains('gone')) {
      splash.classList.add('gone');
      setTimeout(() => splash.remove(), 600);
    }
  }

  /* ---------------- 加载浮层 ---------------- */

  get loading() {
    const el = document.getElementById('loader');
    const bar = document.getElementById('l-bar');
    const text = document.getElementById('l-text');
    const hall = document.getElementById('l-hall');
    const self = this;
    return {
      show(title) {
        hall.textContent = title || '云游博物馆';
        el.classList.add('show');
        bar.style.width = '0%';
      },
      hide() {
        el.classList.remove('show');
      },
      text(t) { text.textContent = t || ''; },
      progress(def, loaded, total) {
        const pct = total > 0 ? Math.min(100, (loaded / total) * 100) : 0;
        bar.style.width = pct.toFixed(1) + '%';
        const mb = (loaded / 1048576).toFixed(1);
        const tot = total > 0 ? ` / ${(total / 1048576).toFixed(1)}MB` : '';
        text.textContent = `正在加载 ${def?.name || ''} ${mb}${tot} · ${pct.toFixed(0)}%`;
      },
      fail(t) { text.textContent = t; self._toast(t, 4000); },
    };
  }

  /* ---------------- HUD ---------------- */

  perf({ fps, splats, memMB, debug, pos, yaw, pitch }) {
    const el = document.getElementById('perf');
    if (!document.getElementById('perf-fps')) {
      el.innerHTML = `<b id="perf-fps">—</b> FPS<br><span id="perf-sub"></span>`;
    }
    const f = document.getElementById('perf-fps');
    f.textContent = Math.round(fps);
    f.className = fps >= 55 ? '' : fps >= 30 ? 'warn' : 'bad';
    const mem = memMB != null ? ` · ${memMB.toFixed(0)}MB` : '';
    const sub = document.getElementById('perf-sub');
    if (debug) {
      sub.textContent = `${(pos.x).toFixed(1)},${(pos.y).toFixed(1)},${(pos.z).toFixed(1)} · yaw${((yaw * 180) / Math.PI).toFixed(0)}° p${((pitch * 180) / Math.PI).toFixed(0)}°${mem}`;
      sub.style.fontSize = '10px';
    } else {
      const spl = splats > 0 ? `${(splats / 10000).toFixed(0)} 万高斯` : '';
      sub.textContent = `${spl}${mem}`;
    }
    if (this._lastNear !== undefined) this.crosshairEl.classList.toggle('active', this._lastNear);
  }

  setNearHotspot(near) {
    this._lastNear = near;
    this.crosshairEl.classList.toggle('active', near);
  }

  setCuration(def) {
    document.getElementById('cur-name').textContent = def.name;
    document.getElementById('cur-sub').textContent = `${this.manifest.museum.curator} · ${this.manifest.museum.digitizer}`;
    this._currentDef = def;
  }

  _showHallIntro() {
    const def = this._currentDef;
    if (!def) return;
    this.showInfoCard({
      icon: '🏛️',
      category: '展厅介绍',
      title: def.name,
      desc: `${def.description || ''}<br><br><span style="color:#8b8577">${this.manifest.museum.notice}</span>`,
    });
  }

  /* ---------------- 讲解卡 ---------------- */

  showInfoCard(h) {
    const el = document.getElementById('infocard');
    document.getElementById('ic-cat').textContent = h.category || '展品';
    document.getElementById('ic-title').textContent = `${h.icon || ''} ${h.title}`;
    document.getElementById('ic-desc').innerHTML = (h.desc || '').replace(/\n/g, '<br>');
    el.classList.add('show');
    this._currentHotspot = h;
    this._stopSpeak();
  }

  closeInfoCard() {
    document.getElementById('infocard').classList.remove('show');
    this._stopSpeak();
    this._currentHotspot = null;
  }

  _toggleSpeak() {
    if (this._speakOn) { this._stopSpeak(); return; }
    const h = this._currentHotspot;
    if (!h?.desc) return;
    const synth = window.speechSynthesis;
    if (!synth) { this.toast('当前浏览器不支持语音合成'); return; }
    const u = new SpeechSynthesisUtterance(`${h.title}。${h.desc}`);
    u.lang = 'zh-CN';
    u.rate = 1;
    const zh = synth.getVoices().find((v) => v.lang?.startsWith('zh'));
    if (zh) u.voice = zh;
    u.onend = () => this._stopSpeak();
    synth.cancel();
    synth.speak(u);
    this._speakOn = true;
    document.getElementById('ic-speak').classList.add('on');
    document.getElementById('ic-speak').textContent = '⏸ 停止讲解';
  }

  _stopSpeak() {
    window.speechSynthesis?.cancel();
    this._speakOn = false;
    const b = document.getElementById('ic-speak');
    if (b) { b.classList.remove('on'); b.textContent = '🔊 语音讲解'; }
  }

  /* ---------------- 引导 ---------------- */

  showHelp() {
    const el = document.getElementById('help');
    el.classList.remove('gone');
    this._helpShown = true;
    clearTimeout(this._helpTimer);
    this._helpTimer = setTimeout(() => this.dismissHelp(), 9000);
  }

  dismissHelp() {
    if (!this._helpShown) return;
    document.getElementById('help').classList.add('gone');
  }

  /* ---------------- 菜单 ---------------- */

  openMenu() {
    if (this.menuOpen) return;
    this.menuOpen = true;
    this._renderMenu();
    this._menu.style.display = 'block';
    this._backdrop.style.display = 'block';
  }

  closeMenu({ resume = false } = {}) {
    if (!this.menuOpen) return;
    this.menuOpen = false;
    this._menu.style.display = 'none';
    this._backdrop.style.display = 'none';
    if (resume) this.onMenuResume?.();
  }

  _renderMenu() {
    const m = this._menu;
    const cur = this._currentDef;
    const halls = this.manifest.scenes.map((s) => {
      const isCur = cur && s.sceneId === cur.sceneId;
      return `<button class="hall-item ${isCur ? 'current' : ''}" data-hall="${s.sceneId}">
        <div class="h-name">${s.name}</div>
        <div class="h-meta">v${s.version} · ${s.splat.sizeMB}MB · ${s.splat.format.toUpperCase()}</div>
        <div class="h-desc">${s.description}</div>
      </button>`;
    }).join('');
    const fp = this._footprints();
    m.innerHTML = `
      <h2>云游博物馆</h2>
      <div class="m-sub">${this.manifest.museum.name} · ${this.manifest.museum.subtitle}</div>
      <h4>展厅</h4>
      <div class="hall-list">${halls}</div>
      <h4>设置</h4>
      <div class="set-row"><span>渲染倍率（自动档按帧率动态调整）</span>
        <select id="set-scale">
          <option value="auto">自动</option>
          <option value="0.6">60%</option>
          <option value="0.75">75%</option>
          <option value="1">100%</option>
        </select></div>
      <div class="set-row"><span>省电模式（限帧 30fps）</span><div class="switch" id="set-power"></div></div>
      <div class="set-row"><span>显示性能信息</span><div class="switch" id="set-perf"></div></div>
      <h4>我的足迹</h4>
      <div class="footprint">${fp || '暂无参观记录'}</div>
      <h4>导览</h4>
      <button class="tour-btn" id="btn-tour">▶ 播放本厅推荐路线（自动巡游）</button>
      <h4>关于</h4>
      <div class="about">
        ${this.manifest.museum.notice}<br>
        技术栈：three.js + Spark（高斯泼溅渲染） · Vue 化与后台管理见技术方案文档 §7<br>
        快捷键：WASD 行走 · Shift 疾走 · E 查看展品 · Esc 菜单
      </div>
      <button class="resume-btn" id="btn-resume">继 续 参 观</button>
    `;
    // 事件
    m.querySelectorAll('[data-hall]').forEach((b) =>
      b.addEventListener('click', () => this.onSelectHall?.(Number(b.dataset.hall))));
    const scaleSel = m.querySelector('#set-scale');
    scaleSel.value = String(this._settings.renderScale);
    scaleSel.addEventListener('change', () => this.onSetting?.('renderScale', scaleSel.value === 'auto' ? 'auto' : Number(scaleSel.value)));
    this._wireSwitch(m.querySelector('#set-power'), this._settings.powerSave, (v) => this.onSetting?.('powerSave', v));
    this._wireSwitch(m.querySelector('#set-perf'), this._settings.showPerf, (v) => this.onSetting?.('showPerf', v));
    m.querySelector('#btn-tour').addEventListener('click', () => { this.closeMenu(); this.onTour?.(); });
    m.querySelector('#btn-resume').addEventListener('click', () => this.closeMenu({ resume: true }));
    document.getElementById('perf').style.visibility = this._settings.showPerf ? 'visible' : 'hidden';
  }

  _wireSwitch(el, val, cb) {
    el.classList.toggle('on', !!val);
    el.addEventListener('click', () => {
      const on = !el.classList.contains('on');
      el.classList.toggle('on', on);
      cb(on);
    });
  }

  _footprints() {
    if (!this._visitedFn) return '';
    return this._visitedFn()
      .map(([id, ts]) => {
        const s = this.manifest.scenes.find((x) => x.sceneId === id);
        if (!s) return '';
        return `<div><b>${s.short || s.name}</b> · ${new Date(ts).toLocaleString('zh-CN', { hour12: false })}</div>`;
      })
      .join('');
  }

  syncTourBtn(active) {
    const b = document.getElementById('btn-tour');
    if (b) b.textContent = active ? '⏸ 停止巡游' : '▶ 播放本厅推荐路线（自动巡游）';
  }

  /* ---------------- Toast ---------------- */

  toast(t, ms = 2600) {
    this._toast(t, ms);
  }

  _toast(t, ms) {
    const el = this._toastEl;
    el.textContent = t;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }
}
