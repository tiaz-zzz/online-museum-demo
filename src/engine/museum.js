import * as THREE from 'three';
import { SparkRenderer } from '@sparkjsdev/spark';
import { WalkControls } from './walk-controls.js';
import { SceneManager } from './scene-manager.js';
import { HotspotLayer } from './hotspots.js';
import { Minimap } from './minimap.js';
import { Tour } from './tour.js';
import { Stats } from './stats.js';

/**
 * MuseumApp — 游客端 SPA 的三维核心（文档 §7.2）
 * three.js 场景图 + Spark 高斯渲染 + 漫游控制 + 热点/门洞/小地图/导览 + 性能自适应。
 */
export class MuseumApp {
  constructor({ canvas, manifest, ui, params = {} }) {
    this.canvas = canvas;
    this.manifest = manifest;
    this.ui = ui;
    this.params = params;
    this.debug = !!params.debug;
    this.calib = !!params.calib;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(Number(params.fov) || 70, 1, 0.05, 500);

    // 设置（持久化到 localStorage，"自动"档由 FPS 探测接管 —— 文档 §6.6）
    this.settings = {
      ...manifest.settingsDefaults,
      ...this._loadSettings(),
    };

    this.spark = new SparkRenderer({ renderer: this.renderer });
    this.scene.add(this.spark);

    this.stats = new Stats();
    this.tour = new Tour({
      hooks: {
        onStart: () => this.ui.toast('自动巡游开始 · 任意移动操作即可退出'),
        onStop: (r) => { if (r === 'user') this.ui.toast('已退出巡游'); this.ui.syncTourBtn(false); },
      },
    });

    this.controls = new WalkControls({
      domElement: canvas,
      joystickEl: ui.joystickEl,
      lookPadEl: ui.lookPadEl,
      hooks: {
        onUnlock: () => { if (!this.calib && !this.switching) { this.controls.pause(); this.ui.openMenu(); } },
        canLock: () => !params.nolock && !this.ui.menuOpen && !this.calib && !this.switching,
        onUserMove: () => { if (this.tour.active) this.tour.stop('user'); this.ui.dismissHelp(); },
      },
    });

    this.scenes = new SceneManager({
      parent: this.scene,
      hooks: { onLoadProgress: (def, loaded, total) => this.ui.loading.progress(def, loaded, total) },
    });
    this.scenes.setDefs(manifest.scenes);

    this.hotspots = new HotspotLayer({
      container: ui.overlayEl,
      hooks: {
        onHotspotOpen: (h, def) => {
          this.ui.showInfoCard(h);
          this.stats.track('hotspot_open', { sceneId: def.sceneId, hotspotId: h.id });
        },
        onDoorEnter: (n) => this.switchScene(n.sceneId, n.entry),
      },
    });

    this.minimap = new Minimap({ canvas: ui.minimapCanvas });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE' && !this.ui.menuOpen && !this.calib) this.interactNearest();
    });
    window.addEventListener('resize', () => this._resize());

    this.currentId = null;
    this.switching = false;
    this._fps = 60;
    this._last = 0;
    this._fc = 0;
    this._acc = 0;
    this._perfT = 0;
    this._autoT = 0;
    this._firstFrame = true;
    this._resize();
    this._applyPixelRatio();
  }

  /* ---------------- 启动 / 切换 ---------------- */

  async boot() {
    const startId = Number(this.params.scene) || this.manifest.scenes[0].sceneId;
    let entry;
    if (this.params.pos) {
      const p = String(this.params.pos).split(',').map(Number);
      if (p.length === 3 && p.every(Number.isFinite)) entry = { pos: p, yaw: Number(this.params.yaw) || 0 };
    }
    await this.switchScene(startId, entry, { first: true });
    this._loop();
  }

  async switchScene(id, entry, opts = {}) {
    if (this.switching) return;
    this.switching = true;
    if (this.tour.active) this.tour.stop('switch');
    const def = this.scenes.defs.get(id);
    if (!def) { this.switching = false; return; }

    this.ui.loading.show(opts.first ? def.name : `进入 · ${def.name}`);
    this.ui.loading.text(`正在加载 ${def.name}`);
    try {
      // 加载目标厅（LRU 保证切换期间 当前厅+目标厅 ≤2 个常驻）
      await this.scenes.load(id);
      this.controls.setScene(def, entry);
      this.currentId = id;
      this.hotspots.setScene(def);
      this.minimap.setScene(def);
      this.ui.setCuration(def);
      const keep = [id, ...(def.neighbors || []).map((n) => n.sceneId).slice(0, 1)];
      this.scenes.trim(keep);
      this.stats.track('scene_enter', { sceneId: id, version: def.version });
      this.ui.loading.text('');
      this.ui.loading.hide();
      // 空闲预热邻厅（文档 §6.3）
      clearTimeout(this._pf);
      this._pf = setTimeout(() => {
        for (const n of def.neighbors || []) this.scenes.prefetch(n.sceneId);
      }, 8000);
    } catch (err) {
      console.error(err);
      this.ui.loading.text(`加载失败：${err?.message || err}（请刷新重试）`);
    }
    this.switching = false;
  }

  /* ---------------- 交互 ---------------- */

  interactNearest() {
    const def = this.scenes.defs.get(this.currentId);
    if (!def) return;
    const h = this.hotspots.nearestWithin(this.camera.position, 3.2 / (def.scale || 1));
    if (h) {
      this.ui.showInfoCard(h);
      this.stats.track('hotspot_open', { sceneId: def.sceneId, hotspotId: h.id });
    } else {
      this.ui.toast('附近没有可查看的展品，走近金色标记试试');
    }
  }

  toggleTour() {
    if (this.tour.active) { this.tour.stop('user'); return; }
    const def = this.scenes.defs.get(this.currentId);
    if (this.tour.start(this.controls, def)) this.ui.syncTourBtn(true);
    else this.ui.toast('本展厅暂无巡游路线');
  }

  setSetting(key, value) {
    this.settings[key] = value;
    this._saveSettings();
    if (key === 'renderScale') this._applyPixelRatio(true);
  }

  /* ---------------- 主循环 ---------------- */

  _loop() {
    this.renderer.setAnimationLoop((tms) => this._tick(tms));
  }

  _tick(tms) {
    let dt = (tms - this._last) / 1000 || 0.016;
    this._last = tms;
    if (dt > 0.1) dt = 0.1;

    // 省电模式：限帧 30fps（文档 §6.6）
    if (this.settings.powerSave) {
      this._acc += dt;
      if (this._acc < 1 / 31) return;
      dt = this._acc;
      this._acc = 0;
    }

    // FPS 统计
    const inst = 1 / dt;
    this._fps += (inst - this._fps) * 0.05;

    this.controls.update(dt, this.camera);
    if (this.tour.active) this.tour.update(dt, this.controls);

    // 门洞近距检测 → 自动切厅（?noauto=1 调试时可禁用）
    if (this.controls.enabled && !this.switching && !this.params.noauto) {
      const def = this.scenes.defs.get(this.currentId);
      for (const n of def?.neighbors || []) {
        const dx = this.controls.pos.x - n.doorPos[0];
        const dy = this.controls.pos.y - n.doorPos[1];
        const dz = this.controls.pos.z - n.doorPos[2];
        if (dx * dx + dy * dy + dz * dz < (n.radiusM / (def.scale || 1)) ** 2) {
          this.switchScene(n.sceneId, n.entry);
          this.ui.toast(`步入 ${this.scenes.defs.get(n.sceneId)?.short || ''}`);
          break;
        }
      }
    }

    // 覆层更新
    this.hotspots.update(this.camera, this.camera.position);
    if (this.controls.enabled && !this.switching) {
      const def = this.scenes.defs.get(this.currentId);
      const near = this.hotspots.nearestWithin(this.camera.position, 3.2 / (def?.scale || 1));
      this.ui.setNearHotspot(!!near);
    } else this.ui.setNearHotspot(false);
    if (this._fc++ % 3 === 0) this.minimap.update(this.controls);

    // 性能 HUD（2 次/秒）
    if (tms - this._perfT > 500) {
      this._perfT = tms;
      const mesh = this.scenes.get(this.currentId);
      this.ui.perf({
        fps: this._fps,
        splats: mesh?.numSplats || 0,
        memMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null,
        debug: this.debug,
        pos: this.controls.pos,
        yaw: this.controls.yaw,
        pitch: this.controls.pitch,
      });
    }

    // 自动渲染倍率（文档 §8.2 动态分辨率）
    if (this.settings.renderScale === 'auto') {
      this._autoT += dt;
      if (this._autoT > 2.5) {
        this._autoT = 0;
        if (this._fps < 45 && this._autoScale > 0.6) { this._autoScale = Math.max(0.6, this._autoScale - 0.15); this._applyPixelRatio(); }
        else if (this._fps > 57 && this._autoScale < 1) { this._autoScale = Math.min(1, this._autoScale + 0.1); this._applyPixelRatio(); }
      }
    }

    // 每 10s 上报性能样本
    this._sampleT = (this._sampleT || 0) + dt;
    if (this._sampleT > 10) {
      this._sampleT = 0;
      this.stats.sampleFps(this._fps, this.currentId);
    }

    this.renderer.render(this.scene, this.camera);
    if (this._firstFrame) {
      this._firstFrame = false;
      this.ui.onFirstFrame?.();
    }
  }

  /* ---------------- 设置与工具 ---------------- */

  _applyPixelRatio(force) {
    const base = Math.min(devicePixelRatio || 1, 2);
    if (this.settings.renderScale === 'auto') {
      if (force || this._autoScale == null) this._autoScale = 1;
      this.renderer.setPixelRatio(base * this._autoScale);
    } else {
      this.renderer.setPixelRatio(base * Number(this.settings.renderScale));
    }
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  _resize() {
    this._applyPixelRatio();
  }

  _loadSettings() {
    try { return JSON.parse(localStorage.getItem('museum.settings') || '{}'); } catch { return {}; }
  }

  _saveSettings() {
    try { localStorage.setItem('museum.settings', JSON.stringify(this.settings)); } catch { /* ignore */ }
  }

  /* ---------------- 校准（?calib=1） ---------------- */

  calibSpawn() {
    const p = this.controls.pos;
    return { pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)], yaw: Math.round((this.controls.yaw * 180) / Math.PI) };
  }

  calibAim(distM = 2.2) {
    const dir = this.camera.getWorldDirection(_v1);
    const d = distM / (this.controls.scale || 1);
    const p = _v2.copy(this.camera.position).addScaledVector(dir, d);
    return { pos: [+p.x.toFixed(2), +p.y.toFixed(2), +p.z.toFixed(2)] };
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    for (const [, mesh] of this.scenes.meshes) mesh.dispose?.();
    this.renderer.dispose();
  }
}

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
