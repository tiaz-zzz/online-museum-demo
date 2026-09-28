/**
 * Stats — 访问统计埋点（文档 F7 / §7.2 统计服务的前端桩）
 * 正式版：批量 POST /api/museum/stats/track（见文档 §7.3）。
 * Demo：写入 localStorage 环形缓冲并 console.debug；如配置 museum.statsUrl 则尝试上报。
 */
const KEY = 'museum.stats';
const CAP = 200;

export class Stats {
  constructor() {
    this.endpoint = null;
    this.session = Math.random().toString(36).slice(2, 10);
    this.queue = [];
    try { this.endpoint = localStorage.getItem('museum.statsUrl') || null; } catch { /* ignore */ }
  }

  track(eventType, payload = {}) {
    const ev = {
      session: this.session,
      event_type: eventType,
      ...payload,
      ts: Date.now(),
      ua: navigator.userAgent.slice(0, 120),
    };
    this.queue.push(ev);
    console.debug('[stats]', ev.event_type, payload);
    try {
      const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      arr.push(ev);
      while (arr.length > CAP) arr.shift();
      localStorage.setItem(KEY, JSON.stringify(arr));
    } catch { /* ignore */ }
    if (this.endpoint) {
      fetch(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([ev]) }).catch(() => {});
    }
  }

  /** 我的足迹：按 sceneId 去重的访问记录 */
  visited() {
    try {
      const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
      const map = new Map();
      for (const e of arr) {
        if (e.event_type === 'scene_enter') map.set(e.sceneId, e.ts);
      }
      return [...map.entries()].sort((a, b) => b[1] - a[1]);
    } catch { return []; }
  }

  sampleFps(fps, sceneId) {
    this.track('perf_sample', { fps: Math.round(fps), sceneId, mem: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null });
  }
}
